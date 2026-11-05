'use server';
/**
 * @fileOverview Institutional Performance Audit Flow.
 * Only async functions are exported to satisfy Next.js "use server" requirements.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { callSolver } from '@/lib/solver-client';
import { verifyRosterIntegrity } from '@/lib/integrity-checker';

const AuditInputSchema = z.object({
  testPoolSize: z.number(),
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

    const employees = Array.from({ length: testPoolSize }, (_, i) => ({
      id: `SYNTH_${i}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      historicalSO: 0,
      historicalOP: 0
    }));

    const dailyQuotaPerShift = Math.floor((testPoolSize * 0.85) / 6);
    const weeklyQuotas = DAYS.flatMap(day => 
      SHIFTS.map(shift => ({
        dayOfWeek: day,
        shiftId: shift.id,
        requiredStaff: dailyQuotaPerShift
      }))
    );

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

    try {
      const result = await callSolver(solverPayload);
      const integrity = verifyRosterIntegrity(
        result.assignments || [],
        mockBookings,
        [],
        Array(7).fill(new Date())
      );

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
      return {
        success: false,
        metrics: { solveTimeMs: 0, variableCount: 0, status: 'ERROR', integrityChecked: false },
        logs: [...logs, `AUDIT CRITICAL FAILURE: ${e.message}`]
      };
    }
  }
);

export async function runPerformanceAudit(poolSize: number) {
  return performanceAuditFlow({ testPoolSize: poolSize });
}
