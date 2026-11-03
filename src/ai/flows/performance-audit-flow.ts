
'use server';
/**
 * @fileOverview Institutional Performance Audit Flow.
 * 
 * Orchestrates technical stress tests using synthetic data to verify 
 * CP-SAT solver integrity, latency, and security protocols.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { callSolver } from '@/lib/solver-client';
import { verifyRosterIntegrity } from '@/lib/integrity-checker';

const AuditInputSchema = z.object({
  testPoolSize: z.number().describe('Number of synthetic employees to generate for the test.'),
  weekId: z.string().default('2024-52'),
});

const AuditOutputSchema = z.object({
  success: z.boolean(),
  metrics: z.object({
    solveTimeMs: z.number(),
    variableCount: z.number(),
    status: z.string(),
    integrityChecked: z.boolean(),
  }),
  logs: z.array(z.string()),
});

export async function runPerformanceAudit(poolSize: number) {
  return performanceAuditFlow({ testPoolSize: poolSize });
}

const performanceAuditFlow = ai.defineFlow(
  {
    name: 'performanceAuditFlow',
    inputSchema: AuditInputSchema,
    outputSchema: AuditOutputSchema,
  },
  async (input) => {
    const { testPoolSize, weekId } = input;
    const logs: string[] = [];
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const SHIFTS = [
      { id: 'SO', name: 'Super Opening' },
      { id: 'OP', name: 'Opening' },
      { id: 'MD', name: 'Mid Shift' },
      { id: 'C1', name: 'Closing' },
      { id: 'C2', name: 'Closing 2' },
      { id: 'SC', name: 'Super Closing' }
    ];

    logs.push(`INITIATING AUDIT: Pool Size ${testPoolSize}`);

    // 1. Generate Synthetic Data
    const employees = Array.from({ length: testPoolSize }, (_, i) => ({
      id: `SYNTH_${i}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      historicalSO: 0,
      historicalOP: 0
    }));

    // Generate Quotas (Approx 85% of staff working, 15% off)
    const dailyQuotaPerShift = Math.floor((testPoolSize * 0.85) / 6);
    const weeklyQuotas = DAYS.flatMap(day => 
      SHIFTS.map(shift => ({
        dayOfWeek: day,
        shiftId: shift.id,
        requiredStaff: dailyQuotaPerShift
      }))
    );

    // Generate Hard Constraints (15% random weekly offs)
    const mockBookings = employees.slice(0, Math.floor(testPoolSize * 0.15)).map(emp => ({
      employeeId: emp.id,
      dayOfWeek: DAYS[Math.floor(Math.random() * 7)]
    }));

    const employeeHardConstraints = mockBookings.map(b => ({
      employeeId: b.employeeId,
      type: 'weeklyOff',
      dayOfWeek: b.dayOfWeek
    }));

    const solverPayload = {
      weekId,
      officeId: 'AUDIT_NODE',
      shifts: SHIFTS,
      employees,
      weeklyQuotas,
      employeeHardConstraints,
      timeLimitSeconds: 30
    };

    logs.push(`PAYLOAD CONSTRUCTED: ${employees.length * 7 * SHIFTS.length} variables`);

    // 2. Execute Solver Call
    try {
      const start = Date.now();
      const result = await callSolver(solverPayload);
      const end = Date.now();

      logs.push(`SOLVER COMPLETED: Status ${result.status} in ${end - start}ms`);

      // 3. Independent Integrity Check via trusted utility
      const integrity = verifyRosterIntegrity(
        result.assignments || [],
        mockBookings,
        [], // No leaves in simple audit
        Array(7).fill(new Date()) // Dummy dates
      );

      if (!integrity.isValid) {
        integrity.issues.forEach(issue => logs.push(`INTEGRITY FAILURE: ${issue}`));
      } else {
        logs.push(`INTEGRITY VERIFIED: No hard constraint violations.`);
      }

      return {
        success: integrity.isValid && (result.status === 'OPTIMAL' || result.status === 'FEASIBLE'),
        metrics: {
          solveTimeMs: result.metadata.solveTimeMs,
          variableCount: employees.length * 7 * SHIFTS.length,
          status: result.status,
          integrityChecked: true
        },
        logs
      };

    } catch (e: any) {
      logs.push(`AUDIT CRITICAL FAILURE: ${e.message}`);
      return {
        success: false,
        metrics: { solveTimeMs: 0, variableCount: 0, status: 'ERROR', integrityChecked: false },
        logs
      };
    }
  }
);
