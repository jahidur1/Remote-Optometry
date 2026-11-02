
'use server';

/**
 * @fileOverview Refactored Genkit flow for generating an optimized weekly employee roster.
 * This flow now acts as a trusted backend coordinator, fetching authoritative data 
 * from Firestore and delegating the heavy math to the Python OR-Tools solver.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { callSolver } from '@/lib/solver-client';
import { isDateInRange, getDatesForWeek } from '@/lib/date-utils';

const { firestore } = initializeFirebase();

export const GenerateWeeklyRosterInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
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
  }).optional(),
});

export type GenerateWeeklyRosterOutput = z.infer<typeof GenerateWeeklyRosterOutputSchema>;

/**
 * Trusted Backend Entry Point: Fetches authoritative data and strips PII.
 */
export async function generateWeeklyRoster(input: GenerateWeeklyRosterInput): Promise<GenerateWeeklyRosterOutput> {
  return generateWeeklyRosterFlow(input);
}

const generateWeeklyRosterFlow = ai.defineFlow(
  {
    name: 'generateWeeklyRosterFlow',
    inputSchema: GenerateWeeklyRosterInputSchema,
    outputSchema: GenerateWeeklyRosterOutputSchema,
  },
  async (input) => {
    const start = Date.now();
    const { weekId, officeId } = input;
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekDates = getDatesForWeek(weekId);

    try {
      // 1. Authoritative Data Fetching (Trusted Backend context)
      const [empSnap, shiftsSnap, quotaSnap, bookingsSnap, leavesSnap, rulesSnap, prefsSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'employees'), where('office', '==', officeId), where('status', '==', 'Active'))),
        getDocs(query(collection(firestore, 'shift_master'), orderBy('displayOrder'))),
        getDoc(doc(firestore, 'roster_quotas', weekId)),
        getDocs(query(collection(firestore, 'weekoff_bookings'), where('weekId', '==', weekId), where('office', '==', officeId))),
        getDocs(query(collection(firestore, 'employee_leaves'), where('status', '==', 'approved'))),
        getDocs(query(collection(firestore, 'shift_adjacency_rules'), where('weekId', '==', weekId))),
        getDocs(query(collection(firestore, 'employee_preferences'), where('weekId', '==', weekId)))
      ]);

      if (!quotaSnap.exists()) {
        throw new Error(`Quotas for week ${weekId} not configured.`);
      }

      const quotaData = quotaSnap.data()!;
      const employees = empSnap.docs.map(d => ({ 
        id: d.id, 
        gender: (d.data().gender || 'Other').toLowerCase(),
        // Historical metrics could be aggregated here from previous published_rosters
        historicalSO: 0, 
        historicalOP: 0 
      }));

      const shifts = shiftsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

      // 2. Constraint Construction (Stripping PII)
      const employeeHardConstraints = [
        ...bookingsSnap.docs.map(d => ({ 
          employeeId: d.data().employeeId, 
          type: 'weeklyOff', 
          dayOfWeek: d.data().dayOfWeek 
        })),
        ...leavesSnap.docs.flatMap(d => {
          const leaf = d.data();
          const emp = employees.find(e => e.id === leaf.employeeId);
          if (!emp) return [];
          return DAYS.filter((day, idx) => isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
            .map(day => ({ employeeId: leaf.employeeId, type: 'unavailable', dayOfWeek: day }));
        }),
        ...bookingsSnap.docs.flatMap(d => {
          const booking = d.data();
          const rule = rulesSnap.docs.find(r => r.data().employeeId === booking.employeeId)?.data();
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

      const weeklyQuotas = Object.entries(quotaData.quotas || {}).map(([key, val]) => {
        const [day, shiftId] = key.split('_');
        return { dayOfWeek: day, shiftId, requiredStaff: val as number };
      });

      const employeeSoftPreferences = prefsSnap.docs.map(d => ({
        employeeId: d.data().employeeId,
        dayOfWeek: d.data().dayOfWeek,
        shiftId: d.data().shiftId,
        weight: 1.0
      }));

      // 3. Mathematical Optimization (Delegating to Python Solver)
      const solverPayload = {
        weekId,
        officeId,
        shifts,
        employees,
        weeklyQuotas,
        employeeHardConstraints,
        employeeSoftPreferences,
        timeLimitSeconds: 60
      };

      const result = await callSolver(solverPayload);

      // 4. Output Validation & Mapping
      return {
        rosterAssignments: result.assignments || [],
        summary: result.status === 'OPTIMAL' 
          ? `Mathematically optimal roster found for ${officeId}.` 
          : `Solver status: ${result.status}. ${result.errors?.join(' ') || ''}`,
        status: result.status,
        issuesEncountered: result.errors || [],
        solverMetadata: {
          solveTimeMs: result.metadata.solveTimeMs,
          constraintsChecked: solverPayload.employeeHardConstraints.length,
          objectiveValue: result.metadata.objectiveValue
        }
      };

    } catch (e: any) {
      console.error('Roster Flow Error:', e);
      return {
        rosterAssignments: [],
        summary: `Institutional Error: ${e.message}`,
        status: 'UNKNOWN',
        issuesEncountered: [e.message],
        solverMetadata: { solveTimeMs: Date.now() - start, constraintsChecked: 0 }
      };
    }
  }
);
