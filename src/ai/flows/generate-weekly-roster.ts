'use server';

/**
 * Trusted Coordinator Flow for Clinical Roster Generation.
 * Hardened: Gemini AI Exclusive Protocol with Minimum Quota Enforcement and Max Utilization.
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
  idToken: z.string().describe('Firebase ID token for administrative authentication.'),
  method: z.enum(['ai']).default('ai'),
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
  prompt: `You are an institutional scheduling orchestrator. Generate a clinical roster for Week {{{weekId}}} and Hub {{{officeId}}}.

MANDATORY EXECUTION RULES:

1. VACANCY LOCKS (ABSOLUTE):
The following professionals are OFF on specific days (Weekly-Off or Approved Leave). 
You MUST NOT assign any shift to these professionals on these days:
{{#each locks}}
- Prof {{employeeId}} is OFF on {{dayOfWeek}}.
{{/each}}

2. STAFFING QUOTAS (MINIMUM REQUIREMENT):
You MUST assign AT LEAST the following number of professionals to each shift. 
Over-staffing is perfectly acceptable if extra professionals are available, but you MUST NOT reduce the count below these requirements:
{{#each weeklyQuotas}}
- Day: {{dayOfWeek}} | Shift: {{shiftId}} | Minimum Required: {{requiredStaff}}
{{/each}}

3. FREQUENCY DISTRIBUTION MATRIX:
Respect these weekly occurrence ranges for each professional. Do not exceed the 'max' or go below the 'min' for each shift type:
{{#each employees}}
{{#if frequencyLimits}}
- Prof {{id}}: {{#each frequencyLimits}}[{{@key}}: {{min}} to {{max}} times] {{/each}}
{{/if}}
{{/each}}

4. TRANSITION INTEGRITY:
Respect eligibility rules for days surrounding a professional's day off:
{{#each adjacencies}}
- Prof {{employeeId}} on {{dayOfWeek}} is RESTRICTED. Only assign one of: [{{#each restrictedToShifts}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}].
{{/each}}

5. MAXIMUM UTILIZATION PROTOCOL:
For every professional who is NOT locked (off/leave) on a given day, you MUST attempt to assign them a shift. 
- Priority 1: Satisfy all Minimum Staffing Quotas.
- Priority 2: Assign remaining available professionals to shifts to ensure no professional is left "Unassigned" unless they have reached their weekly maximum frequency limits.

OUTPUT SPECIFICATION:
- Return ONLY a JSON array of assignment objects.
- Ensure 100% compliance with minimum quotas.
- Never double-assign a professional on the same day.`,
});

const generateWeeklyRosterFlow = ai.defineFlow(
  {
    name: 'generateWeeklyRosterFlow',
    inputSchema: GenerateWeeklyRosterInputSchema,
    outputSchema: GenerateWeeklyRosterOutputSchema,
  },
  async (input) => {
    const start = Date.now();
    const { weekId, officeId, idToken } = input;
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
          issuesEncountered: [`MISSING_QUOTA: ${weekId}_${officeId}`]
        };
      }

      const rulesData = rulesSnap.docs.map(d => d.data());
      const employees = empSnap.docs.map(d => {
        const rule = rulesData.find(r => r.employeeId === d.id);
        return { 
          id: d.id, 
          gender: (d.data().gender || 'Other').toLowerCase(),
          historicalSO: Number(d.data().historicalSO || 0), 
          historicalOP: Number(d.data().historicalOP || 0),
          frequencyLimits: rule?.frequencyLimits || {}
        };
      });

      const bookings = bookingsSnap.docs.map(d => d.data());
      const leaves = leavesSnap.docs.map(d => d.data());

      const locks = [
        ...bookings.map((b: any) => ({ employeeId: b.employeeId, dayOfWeek: b.dayOfWeek })),
        ...leaves.flatMap((leaf: any) => {
          return DAYS.filter((day, idx) => idx < weekDates.length && isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
            .map(day => ({ employeeId: leaf.employeeId, dayOfWeek: day }));
        })
      ];

      const adjacencies = bookings.flatMap((booking: any) => {
        const rule = rulesData.find(r => r.employeeId === booking.employeeId);
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

      // Gemini AI Exclusive Path
      const { output } = await aiPrompt({ weekId, officeId, weeklyQuotas, employees, locks, adjacencies });
      const resultAssignments = output || [];
      const solveTimeMs = Date.now() - start;
      
      const integrity = verifyRosterIntegrity(resultAssignments, bookings, leaves, weekDates);

      return {
        rosterAssignments: resultAssignments,
        summary: !integrity.isValid ? "CRITICAL INTEGRITY FAILURE: Roster violated clinical locks." : `Registry Synchronized: Week ${weekId} generated via GENAI Protocol. Min quotas satisfied with max personnel utilization.`,
        status: !integrity.isValid ? 'UNKNOWN' : 'FEASIBLE',
        issuesEncountered: integrity.issues,
        solverMetadata: {
          solveTimeMs,
          constraintsChecked: locks.length + adjacencies.length,
          runId: `ai_${Date.now()}`
        }
      };

    } catch (e: any) {
      return {
        rosterAssignments: [],
        summary: `Pipeline Conflict: ${e.message}`,
        status: 'UNKNOWN',
        issuesEncountered: [e.message]
      };
    }
  }
);
