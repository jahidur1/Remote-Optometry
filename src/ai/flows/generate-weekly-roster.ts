'use server';

/**
 * @fileOverview Trusted Coordinator Flow for Clinical Roster Generation.
 * Migrated to Firebase Admin SDK for server-side security and institutional authorization.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { callSolver } from '@/lib/solver-client';
import { isDateInRange, getDatesForWeek } from '@/lib/date-utils';
import { verifyRosterIntegrity } from '@/lib/integrity-checker';

export const GenerateWeeklyRosterInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
  idToken: z.string().describe('Firebase ID token for administrative authentication and office verification.'),
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
      // 1. Institutional Permission Gate (Server-Side Authorization)
      if (!idToken) throw new Error("Access Denied: Authentication token missing.");
      
      // Verify token and check revocation for high-security operation
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
      
      if (!adminSnap.exists) {
        throw new Error("Access Denied: Administrative profile not found.");
      }
      
      const adminData = adminSnap.data()!;
      if (adminData.status !== 'Active' || !['ADMIN', 'SUPER_ADMIN'].includes(adminData.role)) {
        throw new Error("Access Denied: Unauthorized administrative identity.");
      }
      
      // Office Isolation: Admins can only solve for their own cluster
      if (adminData.role === 'ADMIN' && adminData.office !== officeId) {
        throw new Error(`Access Denied: You are not authorized to manage rosters for cluster ${officeId}.`);
      }

      // 2. Data Synchronization (Authoritative Fetch via Admin SDK)
      const [empSnap, shiftsSnap, quotaSnap, bookingsSnap, leavesSnap, rulesSnap, prefsSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('shift_master').orderBy('displayOrder').get(),
        adminDb.collection('roster_quotas').doc(weekId).get(),
        adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
        adminDb.collection('employee_leaves').where('status', '==', 'approved').get(),
        adminDb.collection('shift_adjacency_rules').where('weekId', '==', weekId).get(),
        adminDb.collection('employee_preferences').where('weekId', '==', weekId).get()
      ]);

      if (!quotaSnap.exists) {
        throw new Error(`Configuration Missing: Clinical quotas for Week ${weekId} have not been defined.`);
      }

      const quotaData = quotaSnap.data()!;
      const employees = empSnap.docs.map(d => ({ 
        id: d.id, 
        gender: (d.data().gender || 'Other').toLowerCase(),
        historicalSO: d.data().historicalSO || 0, 
        historicalOP: d.data().historicalOP || 0 
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

      // 4. CP-SAT Execution
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
      const integrity = verifyRosterIntegrity(
        result.assignments || [],
        bookingsSnap.docs.map(d => d.data()),
        leavesSnap.docs.map(d => d.data()),
        weekDates
      );

      return {
        rosterAssignments: result.assignments || [],
        summary: !integrity.isValid 
          ? "CRITICAL INTEGRITY FAILURE: Solver output violated hard clinical rules."
          : result.status === 'OPTIMAL' 
          ? `Mathematically optimal roster found for clinical cluster ${officeId}.` 
          : result.status === 'INFEASIBLE'
          ? `Optimization failed: Clinical constraints (quotas/offs) are mathematically incompatible.`
          : `Solver status: ${result.status}. ${result.errors?.join(' ') || ''}`,
        status: !integrity.isValid ? 'UNKNOWN' : result.status,
        issuesEncountered: [...(result.errors || []), ...integrity.issues],
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