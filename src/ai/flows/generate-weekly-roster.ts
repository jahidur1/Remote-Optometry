
'use server';

/**
 * Trusted Coordinator Flow for Clinical Roster Generation.
 * Hardened: Gemini AI Exclusive Protocol with Minimum Quota Enforcement and Max Utilization.
 * Uses high-precision plain objects to prevent Next.js serialization conflicts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { isDateInRange, getDatesForWeek } from '@/lib/date-utils';
import { verifyRosterIntegrity } from '@/lib/integrity-checker';
import { assertOfficeActive } from '@/lib/office-utils';

export const GenerateWeeklyRosterInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
  employeeIds: z.array(z.string()).describe('List of professional IDs selected for this generation pulse.'),
  idToken: z.string().describe('Firebase ID token for administrative authentication.'),
});

export type GenerateWeeklyRosterInput = z.infer<typeof GenerateWeeklyRosterInputSchema>;

const RosterAssignmentSchema = z.object({
  employeeId: z.string(),
  dayOfWeek: z.string(),
  shiftId: z.string(),
});

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
    frequencyLimits: z.record(z.object({ min: z.number(), max: z.number(), label: z.string() })).optional(),
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
    runId: z.string(),
  }),
});

export type GenerateWeeklyRosterOutput = z.infer<typeof GenerateWeeklyRosterOutputSchema>;

const aiPrompt = ai.definePrompt({
  name: 'generateWeeklyRosterAIPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: z.array(RosterAssignmentSchema) },
  prompt: `You are an institutional scheduling orchestrator. Generate a clinical roster for Week {{{weekId}}} and Hub {{{officeId}}}.

MANDATORY EXECUTION RULES:

1. VACANCY LOCKS (ABSOLUTE):
The following professionals are OFF on specific days. You MUST NOT assign any shift to these professionals on these days:
{{#each locks}}
- Prof {{employeeId}} is OFF on {{dayOfWeek}}.
{{/each}}

2. STAFFING QUOTAS (MINIMUM REQUIREMENT):
You MUST assign AT LEAST the following number of professionals to each shift. Over-staffing is acceptable if extra staff are available:
{{#each weeklyQuotas}}
- Day: {{dayOfWeek}} | Shift: {{shiftId}} | Minimum Required: {{requiredStaff}}
{{/each}}

3. FREQUENCY DISTRIBUTION MATRIX:
Respect weekly occurrence ranges for each professional. Do not exceed the 'max' or go below the 'min' for each shift type:
{{#each employees}}
{{#if frequencyLimits}}
- Prof {{id}}: {{#each frequencyLimits}}[{{@key}}: {{min}} to {{max}} times] {{/each}}
{{/if}}
{{/each}}

4. TRANSITION INTEGRITY (ADJACENCY):
Respect eligibility rules for days surrounding a professional's day off:
{{#each adjacencies}}
- Prof {{employeeId}} on {{dayOfWeek}} is RESTRICTED. Only assign one of: [{{#each restrictedToShifts}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}].
{{/each}}

5. MAXIMUM UTILIZATION PROTOCOL:
For every professional who is NOT locked (off/leave) on a given day, you MUST attempt to assign them a shift to satisfy minimum quotas first, then remaining available staff.

OUTPUT SPECIFICATION:
- Return ONLY a JSON array of assignment objects.
- Ensure 100% compliance with minimum quotas.
- Never double-assign a professional on the same day.`,
});

/**
 * High-Intensity Server Action for Roster Generation.
 * Hardened against serialization errors by converting all data to plain JSON.
 */
export async function generateWeeklyRoster(input: GenerateWeeklyRosterInput): Promise<GenerateWeeklyRosterOutput> {
  const start = Date.now();
  const { weekId, officeId, employeeIds, idToken } = input;
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekDates = getDatesForWeek(weekId);

  try {
    if (!idToken) throw new Error("Access Denied: Authentication token missing.");
    
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!adminSnap.exists) throw new Error("Access Denied: Profile not found.");
    
    await assertOfficeActive(officeId);
    
    const [empSnap, shiftsSnap, quotaSnap, bookingsSnap, leavesSnap, rulesSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('shift_master').orderBy('displayOrder').get(),
      adminDb.collection('roster_quotas').doc(`${weekId}_${officeId}`).get(),
      adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
      adminDb.collection('employee_leaves').where('office', '==', officeId).where('status', '==', 'approved').get(),
      adminDb.collection('shift_adjacency_rules').where('weekId', '==', weekId).where('office', '==', officeId).get(),
    ]);

    if (!quotaSnap.exists) {
      return {
        rosterAssignments: [],
        summary: `Pipeline Blocked: Staffing Quotas for Hub ${officeId} in Week ${weekId} are unset.`,
        status: 'UNKNOWN',
        issuesEncountered: [`MISSING_QUOTA: ${weekId}_${officeId}`],
        solverMetadata: { solveTimeMs: 0, constraintsChecked: 0, runId: 'none' }
      };
    }

    const rulesData = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Filter employees based on selection
    const allEmployees = empSnap.docs.map(d => {
      const data = d.data();
      const rule: any = rulesData.find(r => r.employeeId === d.id);
      return { 
        id: d.id, 
        gender: (data.gender || 'Other').toLowerCase(),
        historicalSO: Number(data.historicalSO || 0), 
        historicalOP: Number(data.historicalOP || 0),
        frequencyLimits: rule?.frequencyLimits || {}
      };
    });

    const employees = allEmployees.filter(e => employeeIds.includes(e.id));

    if (employees.length === 0) {
      throw new Error("Pipeline Blocked: No professionals selected for generation.");
    }

    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((b: any) => employeeIds.includes(b.employeeId));
    const leaves = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((l: any) => employeeIds.includes(l.employeeId));

    const locks = [
      ...bookings.map((b: any) => ({ employeeId: b.employeeId, dayOfWeek: b.dayOfWeek })),
      ...leaves.flatMap((leaf: any) => {
        return DAYS.filter((day, idx) => idx < weekDates.length && isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
          .map(day => ({ employeeId: leaf.employeeId, dayOfWeek: day }));
      })
    ];

    const adjacencies = bookings.flatMap((booking: any) => {
      const rule: any = rulesData.find(r => r.employeeId === booking.employeeId);
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

    // Gemini Inference Pulse
    const { output } = await aiPrompt({ weekId, officeId, weeklyQuotas, employees, locks, adjacencies });
    const resultAssignments = output || [];
    const solveTimeMs = Date.now() - start;
    
    const integrity = verifyRosterIntegrity(resultAssignments, bookings, leaves, weekDates);

    return {
      rosterAssignments: resultAssignments,
      summary: !integrity.isValid ? "CRITICAL INTEGRITY FAILURE: AI violated clinical locks." : `Registry Synchronized: Week ${weekId} generated via GENAI Protocol for ${employees.length} selected professionals.`,
      status: !integrity.isValid ? 'UNKNOWN' : 'FEASIBLE',
      issuesEncountered: integrity.issues,
      solverMetadata: {
        solveTimeMs,
        constraintsChecked: locks.length + adjacencies.length,
        runId: `ai_${Date.now()}`
      }
    };

  } catch (e: any) {
    console.error('Roster Generation Conflict:', e);
    return {
      rosterAssignments: [],
      summary: `Pipeline Conflict: ${e.message}`,
      status: 'UNKNOWN',
      issuesEncountered: [e.message],
      solverMetadata: { solveTimeMs: 0, constraintsChecked: 0, runId: 'error' }
    };
  }
}
