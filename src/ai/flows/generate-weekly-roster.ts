
'use server';

/**
 * Trusted Coordinator Flow for Clinical Roster Generation.
 * Refactored: Uses dynamic Office Registry and ensures serializable output.
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
        throw new Error(`Access Denied: You are not authorized to manage rosters for cluster ${officeId}.`);
      }

      // 3. Data Synchronization (Scoped to Office)
      const quotaId = `${weekId}_${officeId}`;
      const [empSnap, shiftsSnap, quotaSnap, bookingsSnap, leavesSnap, rulesSnap, prefsSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('shift_master').orderBy('displayOrder').get(),
        adminDb.collection('roster_quotas').doc(quotaId).get(),
        adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
        adminDb.collection('employee_leaves').where('status', '==', 'approved').get(),
        adminDb.collection('shift_adjacency_rules').where('weekId', '==', weekId).get(),
        adminDb.collection('employee_preferences').where('weekId', '==', weekId).get()
      ]);

      if (!quotaSnap.exists) {
        return {
          rosterAssignments: [],
          summary: `Configuration Missing: Clinical quotas for ROC ${officeId} in Week ${weekId} have not been defined.`,
          status: 'UNKNOWN',
          issuesEncountered: [`MISSING_QUOTA_CONFIG: ${quotaId}`],
          solverMetadata: { solveTimeMs: Date.now() - start, constraintsChecked: 0 }
        };
      }

      // STRICT SERIALIZATION: Map all snapshots to plain data objects immediately
      const employees = empSnap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          gender: (data.gender || 'Other').toLowerCase(),
          historicalSO: Number(data.historicalSO || 0), 
          historicalOP: Number(data.historicalOP || 0) 
        };
      });

      const shifts = shiftsSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, name: String(data.name) };
      });

      const quotaData = quotaSnap.data()!;
      const bookings = bookingsSnap.docs.map(d => d.data());
      const leaves = leavesSnap.docs.map(d => d.data());
      const rules = rulesSnap.docs.map(d => d.data());
      const prefs = prefsSnap.docs.map(d => d.data());

      const employeeHardConstraints = [
        ...bookings.map(b => ({ 
          employeeId: b.employeeId, 
          type: 'weeklyOff', 
          dayOfWeek: b.dayOfWeek 
        })),
        ...leaves.flatMap(leaf => {
          const emp = employees.find(e => e.id === leaf.employeeId);
          if (!emp) return [];
          return DAYS.filter((day, idx) => idx < weekDates.length && isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
            .map(day => ({ employeeId: leaf.employeeId, type: 'unavailable', dayOfWeek: day }));
        }),
        ...bookings.flatMap(booking => {
          const rule = rules.find(r => r.employeeId === booking.employeeId);
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
        return { dayOfWeek: day, shiftId, requiredStaff: Number(val) };
      });

      const employeeSoftPreferences = prefs.map(p => ({
        employeeId: p.employeeId,
        dayOfWeek: p.dayOfWeek,
        shiftId: p.shiftId,
        weight: 1.0
      }));

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
      
      // Deterministic Integrity Re-Check
      const integrity = verifyRosterIntegrity(
        result.assignments || [],
        bookings,
        leaves,
        weekDates
      );

      return {
        rosterAssignments: result.assignments || [],
        summary: !integrity.isValid 
          ? "CRITICAL INTEGRITY FAILURE: Solver output violated hard clinical rules."
          : result.status === 'OPTIMAL' 
          ? `Mathematically optimal roster found for clinical cluster ${officeId}.` 
          : result.status === 'INFEASIBLE'
          ? `Optimization failed: Clinical constraints (quotas/offs) for ${officeId} are mathematically incompatible.`
          : `Solver status: ${result.status}. ${result.errors?.join(' ') || ''}`,
        status: !integrity.isValid ? 'UNKNOWN' : result.status,
        issuesEncountered: [...(result.errors || []), ...integrity.issues],
        solverMetadata: {
          solveTimeMs: result.metadata?.solveTimeMs || 0,
          constraintsChecked: solverPayload.employeeHardConstraints.length,
          objectiveValue: result.metadata?.objectiveValue,
          runId: `run_${Date.now().toString().slice(-6)}`
        }
      };

    } catch (e: any) {
      console.error('Deterministic Pipeline Failure:', e);
      return {
        rosterAssignments: [],
        summary: `Deterministic Pipeline Failure: ${e.message}`,
        status: 'UNKNOWN',
        issuesEncountered: [e.message],
        solverMetadata: { solveTimeMs: Date.now() - start, constraintsChecked: 0 }
      };
    }
  }
);
