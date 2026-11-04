
'use server';

/**
 * Trusted Coordinator Flow for Clinical Roster Generation.
 * Refactored: Uses dynamic Office Registry, enforces Adjacency Rules, and supports dual-engine (CP-SAT/AI).
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
  input: { schema: z.any() },
  output: { schema: z.array(RosterAssignmentSchema) },
  prompt: `You are an expert clinical scheduler. Generate a weekly roster for the cluster hub: {{{officeId}}}.

## Context
Week Cycle: {{{weekId}}}
Days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday

## Staff Pool
{{#each employees}}
- ID: {{id}}, Gender: {{gender}}, History (SO: {{historicalSO}}, OP: {{historicalOP}})
{{/each}}

## Clinical Requirements (Quotas)
{{#each weeklyQuotas}}
- {{dayOfWeek}}: {{shiftId}} requires {{requiredStaff}} professionals.
{{/each}}

## Hard Constraints
1. NEVER assign a professional on their confirmed Weekly-Off.
2. NEVER assign a professional during their approved leave window.
3. Adhere strictly to Shift Adjacency Rules:
{{#each employeeHardConstraints}}
   {{#if (eq type "restrictedShift")}}
   - Professional {{employeeId}} on {{dayOfWeek}} MUST be assigned one of: [{{#each restrictedToShifts}}{{this}}, {{/each}}].
   {{/if}}
{{/each}}

## Instructions
- Ensure 100% quota fulfillment.
- Balance demand shifts (SO/OP) fairly across history counts.
- Return a valid JSON array of assignments.
`,
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
      // 1. Institutional Permission Gate
      if (!idToken) throw new Error("Access Denied: Authentication token missing.");
      
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
      
      if (!adminSnap.exists) throw new Error("Access Denied: Administrative profile not found.");
      const adminData = adminSnap.data()!;
      
      if (adminData.status !== 'Active' || !['admin', 'super_admin'].includes(adminData.role)) {
        throw new Error("Access Denied: Unauthorized administrative identity.");
      }
      
      // 2. Dynamic Registry & Scoping Check
      await assertOfficeActive(officeId);
      
      const authorizedOffices = adminData.officeIds || (adminData.office ? [adminData.office] : []);
      if (adminData.role === 'admin' && !authorizedOffices.includes(officeId)) {
        throw new Error(`Access Denied: Not authorized for cluster ${officeId}.`);
      }

      // 3. Institutional Sync
      const quotaId = `${weekId}_${officeId}`;
      const [empSnap, shiftsSnap, quotaSnap, bookingsSnap, leavesSnap, rulesSnap, prefsSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('shift_master').orderBy('displayOrder').get(),
        adminDb.collection('roster_quotas').doc(quotaId).get(),
        adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
        adminDb.collection('employee_leaves').where('status', '==', 'approved').get(),
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
      const bookings = bookingsSnap.docs.map(d => d.data());
      const leaves = leavesSnap.docs.map(d => d.data());
      const adjacencyRules = rulesSnap.docs.map(d => d.data());

      // 4. Hard Constraint Synthesis (Including Adjacency)
      const employeeHardConstraints: any[] = [
        ...bookings.map(b => ({ employeeId: b.employeeId, type: 'weeklyOff', dayOfWeek: b.dayOfWeek })),
        ...leaves.flatMap(leaf => {
          return DAYS.filter((day, idx) => idx < weekDates.length && isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
            .map(day => ({ employeeId: leaf.employeeId, type: 'unavailable', dayOfWeek: day }));
        }),
        ...bookings.flatMap(booking => {
          const rule = adjacencyRules.find(r => r.employeeId === booking.employeeId);
          if (!rule) return [];
          const res: any[] = [];
          const idx = DAYS.indexOf(booking.dayOfWeek);
          if (idx > 0 && rule.allowedPreOffShifts?.length > 0) {
            res.push({ employeeId: booking.employeeId, type: 'restrictedShift', dayOfWeek: DAYS[idx - 1], restrictedToShifts: rule.allowedPreOffShifts });
          }
          if (idx < 6 && rule.allowedPostOffShifts?.length > 0) {
            res.push({ employeeId: booking.employeeId, type: 'restrictedShift', dayOfWeek: DAYS[idx + 1], restrictedToShifts: rule.allowedPostOffShifts });
          }
          return res;
        })
      ];

      const weeklyQuotas = Object.entries(quotaSnap.data()?.quotas || {}).map(([key, val]) => {
        const [day, sId] = key.split('_');
        return { dayOfWeek: day, shiftId: sId, requiredStaff: Number(val) };
      });

      const solverPayload = {
        weekId,
        officeId,
        shifts,
        employees,
        weeklyQuotas,
        employeeHardConstraints,
        employeeSoftPreferences: prefsSnap.docs.map(d => ({ employeeId: d.data().employeeId, dayOfWeek: d.data().dayOfWeek, shiftId: d.data().shiftId, weight: 1.0 })),
        timeLimitSeconds: 60
      };

      let resultAssignments: any[] = [];
      let solverStatus: any = 'UNKNOWN';
      let metadata: any = { solveTimeMs: 0, constraintsChecked: employeeHardConstraints.length };

      if (method === 'ai') {
          const { output } = await aiPrompt(solverPayload);
          resultAssignments = output || [];
          solverStatus = 'FEASIBLE';
          metadata.solveTimeMs = Date.now() - start;
      } else {
          const solverResult = await callSolver(solverPayload);
          resultAssignments = solverResult.assignments || [];
          solverStatus = solverResult.status;
          metadata = { ...solverResult.metadata, constraintsChecked: employeeHardConstraints.length };
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
