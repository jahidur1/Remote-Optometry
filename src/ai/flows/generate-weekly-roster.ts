'use server';

/**
 * Trusted Coordinator Flow for Clinical Roster Generation.
 * Refactored: Uses structured Prompt Schema and hard-coded Logic-Locks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { callSolver } from '@/lib/solver-client';
import { isDateInRange, getDatesForWeek } from '@/lib/date-utils';
import { verifyRosterIntegrity } from '@/lib/integrity-checker';
import { assertOfficeActive } from '@/lib/office-utils';

export const GenerateWeeklyRosterInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
  idToken: z.string().describe('Firebase ID token for administrative authentication.'),
  method: z.enum(['solver', 'ai']).default('solver').describe('Generation strategy: Mathematical CP-SAT or Generative AI.'),
});

export type GenerateWeeklyRosterInput = z.infer<typeof GenerateWeeklyRosterInputSchema>;

const RosterAssignmentSchema = z.object({
  employeeId: z.string(),
  dayOfWeek: z.string(),
  shiftId: z.string(),
});

/**
 * Structured schema for the AI prompt to ensure deterministic input parsing.
 */
const PromptInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
  weeklyQuotas: z.array(z.object({
    dayOfWeek: z.string(),
    shiftId: z.string(),
    requiredStaff: z.number(),
  })),
  employees: z.array(z.object({
    id: z.string(),
    gender: z.string(),
    historicalSO: z.number(),
    historicalOP: z.number(),
  })),
  locks: z.array(z.object({
    employeeId: z.string(),
    dayOfWeek: z.string(),
  })),
  adjacencies: z.array(z.object({
    employeeId: z.string(),
    dayOfWeek: z.string(),
    restrictedToShifts: z.array(z.string()),
  })),
});

export const GenerateWeeklyRosterOutputSchema = z.object({
  rosterAssignments: z.array(RosterAssignmentSchema),
  summary: z.string(),
  status: z.enum(['OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN']),
  issuesEncountered: z.array(z.string()),
  solverMetadata: z.object({
    solveTimeMs: z.number(),
    constraintsChecked: z.number(),
    objectiveValue: z.number().optional(),
    runId: z.string().optional(),
  }).optional(),
});

export type GenerateWeeklyRosterOutput = z.infer<typeof GenerateWeeklyRosterOutputSchema>;

export async function generateWeeklyRoster(input: GenerateWeeklyRosterInput): Promise<GenerateWeeklyRosterOutput> {
  return generateWeeklyRosterFlow(input);
}

const aiPrompt = ai.definePrompt({
  name: 'generateWeeklyRosterAIPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: z.array(RosterAssignmentSchema) },
  prompt: `You are an expert institutional clinical scheduler. Your goal is to generate a roster that matches SHIFT QUOTAS 100%.

## CONTEXT
Hub: {{{officeId}}}
Cycle: {{{weekId}}}

## MANDATORY REQUIREMENTS
1. FCFS PROTECTION (Locks): 
{{#each locks}}
- Employee {{employeeId}} is OFF on {{dayOfWeek}}. Assign NO SHIFT.
{{/each}}

2. STAFFING QUOTAS (Crucial):
You MUST assign exactly this many people per shift per day.
{{#each weeklyQuotas}}
- {{dayOfWeek}} | {{shiftId}} | Required: {{requiredStaff}}
{{/each}}

3. TRANSITION RULES (Adjacencies):
{{#each adjacencies}}
- Employee {{employeeId}} on {{dayOfWeek}} can ONLY work: [{{#each restrictedToShifts}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}].
{{/each}}

## LOGIC
- FIRST: Identify all professionals on leave or week-off (Locks) and remove them from the daily pool.
- SECOND: Fill the required Quotas for every shift using available staff.
- THIRD: Ensure Adjacency Rules are followed.
- FOURTH: Balance "SO" and "OP" shifts fairly based on historical metrics.

## OUTPUT
Return ONLY a JSON array of assignment objects.
Example: [{"employeeId": "EMP1", "dayOfWeek": "Monday", "shiftId": "SO"}]`,
});

const generateWeeklyRosterFlow = ai.defineFlow(
  {
    name: 'generateWeeklyRosterFlow',
    inputSchema: GenerateWeeklyRosterInputSchema,
    outputSchema: GenerateWeeklyRosterOutputSchema,
  },
  async (input) => {
    const start = Date.now();
    const { weekId, officeId, idToken, method } = input;
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekDates = getDatesForWeek(weekId);

    try {
      if (!idToken) throw new Error("Access Denied: Authentication token missing.");
      
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
      
      if (!adminSnap.exists) throw new Error("Access Denied: Administrative profile not found.");
      const adminData = adminSnap.data()!;
      
      if (adminData.status !== 'Active' || !['admin', 'super_admin'].includes(adminData.role)) {
        throw new Error("Access Denied: Unauthorized administrative identity.");
      }
      
      await assertOfficeActive(officeId);
      
      const authorizedOffices = adminData.officeIds || (adminData.office ? [adminData.office] : []);
      if (adminData.role === 'admin' && !authorizedOffices.includes(officeId)) {
        throw new Error(`Access Denied: Not authorized for cluster ${officeId}.`);
      }

      const quotaId = `${weekId}_${officeId}`;
      const [empSnap, shiftsSnap, quotaSnap, bookingsSnap, leavesSnap, rulesSnap, prefsSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('shift_master').orderBy('displayOrder').get(),
        adminDb.collection('roster_quotas').doc(quotaId).get(),
        adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
        adminDb.collection('employee_leaves').where('office', '==', officeId).where('status', '==', 'approved').get(),
        adminDb.collection('shift_adjacency_rules').where('weekId', '==', weekId).where('office', '==', officeId).get(),
        adminDb.collection('employee_preferences').where('weekId', '==', weekId).where('office', '==', officeId).get()
      ]);

      if (!quotaSnap.exists) {
        return {
          rosterAssignments: [],
          summary: `Configuration Pulse Missing: Quotas for ROC ${officeId} in Week ${weekId} are unset.`,
          status: 'UNKNOWN',
          issuesEncountered: [`MISSING_QUOTA: ${quotaId}`],
          solverMetadata: { solveTimeMs: Date.now() - start, constraintsChecked: 0 }
        };
      }

      const employees = empSnap.docs.map(d => ({ 
        id: d.id, 
        gender: (d.data().gender || 'Other').toLowerCase(),
        historicalSO: Number(d.data().historicalSO || 0), 
        historicalOP: Number(d.data().historicalOP || 0) 
      }));

      const shifts = shiftsSnap.docs.map(d => ({ id: d.id, name: String(d.data().name) }));
      const bookings = bookingsSnap.docs.map(d => ({ ...d.data(), id: d.id } as any));
      const leaves = leavesSnap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          startDate: String(data.startDate || ''),
          endDate: String(data.endDate || '')
        } as any;
      });
      const adjacencyRules = rulesSnap.docs.map(d => ({ ...d.data(), id: d.id } as any));

      const locks = [
        ...bookings.map(b => ({ employeeId: b.employeeId, dayOfWeek: b.dayOfWeek })),
        ...leaves.flatMap(leaf => {
          return DAYS.filter((day, idx) => idx < weekDates.length && isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
            .map(day => ({ employeeId: leaf.employeeId, dayOfWeek: day }));
        })
      ];

      const adjacencies = bookings.flatMap(booking => {
        const rule = adjacencyRules.find((r: any) => r.employeeId === booking.employeeId);
        if (!rule) return [];
        const res: any[] = [];
        const idx = DAYS.indexOf(booking.dayOfWeek);
        if (idx > 0 && rule.allowedPreOffShifts?.length > 0) {
          res.push({ employeeId: booking.employeeId, dayOfWeek: DAYS[idx - 1], restrictedToShifts: rule.allowedPreOffShifts });
        }
        if (idx < 6 && rule.allowedPostOffShifts?.length > 0) {
          res.push({ employeeId: booking.employeeId, dayOfWeek: DAYS[idx + 1], restrictedToShifts: rule.allowedPostOffShifts });
        }
        return res;
      });

      const weeklyQuotas = Object.entries(quotaSnap.data()?.quotas || {}).map(([key, val]) => {
        const [day, sId] = key.split('_');
        return { dayOfWeek: day, shiftId: sId, requiredStaff: Number(val) };
      });

      let resultAssignments: any[] = [];
      let solverStatus: any = 'UNKNOWN';
      let metadata: any = { solveTimeMs: 0, constraintsChecked: locks.length + adjacencies.length };

      if (method === 'ai') {
          const aiInput = {
            weekId,
            officeId,
            weeklyQuotas,
            employees,
            locks,
            adjacencies
          };
          const { output } = await aiPrompt(aiInput);
          resultAssignments = output || [];
          solverStatus = 'FEASIBLE';
          metadata.solveTimeMs = Date.now() - start;
      } else {
          // CP-SAT Implementation
          const solverResult = await callSolver({
            weekId,
            officeId,
            shifts,
            employees,
            weeklyQuotas,
            employeeHardConstraints: [
              ...locks.map(l => ({ ...l, type: 'weeklyOff' })),
              ...adjacencies.map(a => ({ ...a, type: 'restrictedShift' }))
            ],
            timeLimitSeconds: 60
          });
          resultAssignments = solverResult.assignments || [];
          solverStatus = solverResult.status;
          metadata = { ...solverResult.metadata, constraintsChecked: locks.length + adjacencies.length };
      }
      
      const integrity = verifyRosterIntegrity(resultAssignments, bookings, leaves, weekDates);

      return {
        rosterAssignments: resultAssignments,
        summary: !integrity.isValid 
          ? "CRITICAL INTEGRITY FAILURE: Roster violated clinical hard constraints."
          : solverStatus === 'OPTIMAL' 
          ? `Mathematically optimal roster secured for Hub ${officeId}.` 
          : `Success: Cluster roster generated via ${method.toUpperCase()} protocol.`,
        status: !integrity.isValid ? 'UNKNOWN' : solverStatus,
        issuesEncountered: integrity.issues,
        solverMetadata: metadata
      };

    } catch (e: any) {
      console.error('Pipeline Conflict:', e);
      return {
        rosterAssignments: [],
        summary: `Pipeline Failure: ${e.message}`,
        status: 'UNKNOWN',
        issuesEncountered: [e.message],
        solverMetadata: { solveTimeMs: Date.now() - start, constraintsChecked: 0 }
      };
    }
  }
);
