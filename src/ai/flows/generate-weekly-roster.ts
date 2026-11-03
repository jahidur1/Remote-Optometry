'use server';

/**
 * @fileOverview Trusted Coordinator Flow for Clinical Roster Generation.
 *
 * This flow orchestrates the deterministic optimization process:
 * 1. Fetches authoritative clinical data from Firestore.
 * 2. Strips PII and builds the mathematical model payload.
 * 3. Calls the authenticated Python CP-SAT Solver on Google Cloud Run.
 * 4. Independently validates assignments against core integrity rules.
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
  adminUid: z.string().describe('The UID of the administrator performing the action for permission verification.'),
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

/**
 * Validates solver output against institutional hard rules.
 */
function validateAssignments(assignments: any[], bookings: any[]) {
  const issues: string[] = [];
  
  // Rule: No assignments on protected FCFS Weekly-Offs
  assignments.forEach(a => {
    const isOff = bookings.some(b => b.employeeId === a.employeeId && b.dayOfWeek === a.dayOfWeek);
    if (isOff) issues.push(`INTEGRITY ALERT: Assignment for ${a.employeeId} overlaps with a protected Weekly-Off on ${a.dayOfWeek}.`);
  });

  // Rule: Single assignment per professional per day
  const keys = assignments.map(a => `${a.employeeId}_${a.dayOfWeek}`);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    issues.push(`INTEGRITY ALERT: Double-assignment detected for one or more professionals.`);
  }

  return issues;
}

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
    const { weekId, officeId, adminUid } = input;
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekDates = getDatesForWeek(weekId);

    try {
      // 1. Institutional Permission Gate
      const adminSnap = await getDoc(doc(firestore, 'users', adminUid));
      if (!adminSnap.exists() || !['ADMIN', 'SUPER_ADMIN'].includes(adminSnap.data().role)) {
        throw new Error("Access Denied: Unauthorized administrative identity.");
      }
      
      if (adminSnap.data().office !== officeId && adminSnap.data().role !== 'SUPER_ADMIN') {
        throw new Error(`Access Denied: You are not authorized to manage rosters for cluster ${officeId}.`);
      }

      // 2. Data Synchronization (Authoritative Fetch)
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
        throw new Error(`Configuration Missing: Clinical quotas for Week ${weekId} have not been defined.`);
      }

      const quotaData = quotaSnap.data()!;
      const employees = empSnap.docs.map(d => ({ 
        id: d.id, 
        gender: (d.data().gender || 'Other').toLowerCase(),
        // Historical values could be fetched from a summary collection in production
        historicalSO: 0, 
        historicalOP: 0 
      }));

      const shifts = shiftsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

      // 3. Model Construction (PII-Stripped)
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

      // 4. CP-SAT Execution (Authenticated Service-to-Service)
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

      // 5. Independent Output Validation Gate
      const assignments = result.assignments || [];
      const integrityIssues = validateAssignments(assignments, bookingsSnap.docs.map(d => d.data()));

      return {
        rosterAssignments: assignments,
        summary: result.status === 'OPTIMAL' 
          ? `Mathematically optimal roster found for clinical cluster ${officeId}.` 
          : result.status === 'INFEASIBLE'
          ? `Optimization failed: Clinical constraints (quotas/offs) are mathematically incompatible.`
          : `Solver status: ${result.status}. ${result.errors?.join(' ') || ''}`,
        status: result.status,
        issuesEncountered: [...(result.errors || []), ...integrityIssues],
        solverMetadata: {
          solveTimeMs: result.metadata.solveTimeMs,
          constraintsChecked: solverPayload.employeeHardConstraints.length,
          objectiveValue: result.metadata.objectiveValue,
          runId: `run_${Date.now().toString().slice(-6)}`
        }
      };

    } catch (e: any) {
      console.error('Institutional Pipeline Failure:', e);
      return {
        rosterAssignments: [],
        summary: `Deterministic Node Failure: ${e.message}`,
        status: 'UNKNOWN',
        issuesEncountered: [e.message],
        solverMetadata: { solveTimeMs: Date.now() - start, constraintsChecked: 0 }
      };
    }
  }
);
