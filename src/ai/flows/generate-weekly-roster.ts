'use server';

/**
 * @fileOverview Hardened AI Roster Orchestrator.
 * 
 * Implements a Strict POJO Protocol to ensure 100% JSON-serializable returns.
 * Optimized with Lean Data Protocol: Sends only essential clinical identities
 * and quotas to Gemini to prevent serialization/timeout conflicts.
 * 
 * Configured with expanded execution window (60s) for complex clinical models.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getDatesForWeek } from '@/lib/date-utils';
import { verifyRosterIntegrity } from '@/lib/integrity-checker';
import { assertOfficeActive } from '@/lib/office-utils';

// Increase execution threshold for high-intensity optimization
export const maxDuration = 60;

// --- SCHEMA DEFINITIONS ---

export const GenerateWeeklyRosterInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
  employeeIds: z.array(z.string()),
  idToken: z.string(),
  globalFrequencyLimits: z.record(z.object({ min: z.number(), max: z.number(), label: z.string() })).optional(),
  globalPreOffShifts: z.array(z.string()).optional(),
  globalPostOffShifts: z.array(z.string()).optional(),
});

export type GenerateWeeklyRosterInput = z.infer<typeof GenerateWeeklyRosterInputSchema>;

const RosterAssignmentSchema = z.object({
  employeeId: z.string(),
  dayOfWeek: z.string(),
  shiftId: z.string(),
});

/**
 * Lean Prompt Input: Only the essential data needed for the solve.
 */
const LeanPromptInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
  employees: z.array(z.object({
    id: z.string(),
    name: z.string(),
    weekOffDay: z.string().nullable(), // The critical lock
  })),
  quotas: z.array(z.object({
    day: z.string(),
    shiftId: z.string(),
    count: z.number(),
  })),
  constraints: z.object({
    frequency: z.record(z.object({ min: z.number(), max: z.number() })),
    preOffShifts: z.array(z.string()),
    postOffShifts: z.array(z.string()),
  })
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

// --- GEMINI PROMPT ---

const aiPrompt = ai.definePrompt({
  name: 'generateWeeklyRosterAIPrompt',
  input: { schema: LeanPromptInputSchema },
  output: { schema: z.array(RosterAssignmentSchema) },
  prompt: `You are an institutional scheduling orchestrator for Hub {{{officeId}}}.

TASK: Generate clinical assignments for Cycle {{{weekId}}}.

MANDATORY EXECUTION RULES:
1. WEEK-OFF LOCKS: 
   - If an employee has a weekOffDay defined, you MUST NOT assign any shift to them on that day.
{{#each employees}}
   - {{name}} ({{id}}) is OFF on: {{#if weekOffDay}}{{weekOffDay}}{{else}}None{{/if}}.
{{/each}}

2. STAFFING QUOTAS (MINIMUM):
   - You MUST satisfy the following headcount requirements. Over-staffing is allowed, under-staffing is forbidden.
{{#each quotas}}
   - {{day}} | {{shiftId}} | Required: {{count}}
{{/each}}

3. FREQUENCY LIMITS:
   - Respect these weekly occurrence ranges for EVERY professional:
{{#each constraints.frequency}}
   - [{{@key}}]: must occur {{min}} to {{max}} times per professional.
{{/each}}

4. TRANSITION INTEGRITY:
   - On days before a weekOffDay, only assign shifts from: [{{#each constraints.preOffShifts}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}].
   - On days after a weekOffDay, only assign shifts from: [{{#each constraints.postOffShifts}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}].

5. UTILIZATION:
   - Every professional who is NOT off must be assigned exactly one shift per day to maximize clinic capacity.

OUTPUT: Return ONLY a JSON array of assignment objects.`,
});

// --- FLOW IMPLEMENTATION ---

export async function generateWeeklyRoster(input: GenerateWeeklyRosterInput): Promise<GenerateWeeklyRosterOutput> {
  const start = Date.now();
  
  try {
    const { weekId, officeId, employeeIds, idToken, globalFrequencyLimits, globalPreOffShifts, globalPostOffShifts } = input;

    // 1. Auth Pulse (Minimal check to prevent timeout)
    const decoded = await adminAuth.verifyIdToken(idToken);
    const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!adminSnap.exists) throw new Error("ID_NOT_FOUND");
    
    await assertOfficeActive(officeId);
    
    // 2. Data Aggregation (Fetch everything in parallel)
    const [empSnap, quotaSnap, bookingsSnap, leavesSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('roster_quotas').doc(`${weekId}_${officeId}`).get(),
      adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
      adminDb.collection('employee_leaves').where('office', '==', officeId).where('status', '==', 'approved').get()
    ]);

    if (!quotaSnap.exists) {
      return {
        rosterAssignments: [],
        summary: `Quota Matrix Missing: Staffing requirements for ROC ${officeId} in Week ${weekId} have not been defined.`,
        status: 'UNKNOWN',
        issuesEncountered: ["MISSING_QUOTA"],
        solverMetadata: { solveTimeMs: 0, constraintsChecked: 0, runId: 'error' }
      };
    }

    // 3. Lean Registry Construction (Explicit POJO Mapping)
    const bookingsMap = new Map();
    bookingsSnap.docs.forEach(d => {
      const b = d.data();
      bookingsMap.set(b.employeeId, b.dayOfWeek);
    });

    const employees = empSnap.docs
      .filter(d => employeeIds.includes(d.id))
      .map(d => ({
        id: String(d.id),
        name: String(d.data().fullName),
        weekOffDay: bookingsMap.get(d.id) || null
      }));

    const rawQuotas = quotaSnap.data()?.quotas || {};
    const quotas = Object.entries(rawQuotas).map(([key, val]) => {
      const [day, sId] = key.split('_');
      return { day: String(day), shiftId: String(sId), count: Number(val) };
    });

    // Clean constraints to remove internal UI labels before sending to AI
    const frequencyConstraints: Record<string, { min: number, max: number }> = {};
    if (globalFrequencyLimits) {
      Object.entries(globalFrequencyLimits).forEach(([sid, lim]) => {
        frequencyConstraints[sid] = { min: lim.min, max: lim.max };
      });
    }

    const constraints = {
      frequency: frequencyConstraints,
      preOffShifts: globalPreOffShifts || [],
      postOffShifts: globalPostOffShifts || [],
    };

    // 4. Intelligence Pulse
    const { output } = await aiPrompt({
      weekId,
      officeId,
      employees,
      quotas,
      constraints
    });

    const rawAssignments = output || [];
    
    // 5. Secure Serialization Boundary (Final POJO mapping)
    const resultAssignments = rawAssignments.map(a => ({
        employeeId: String(a.employeeId),
        dayOfWeek: String(a.dayOfWeek),
        shiftId: String(a.shiftId)
    }));

    // Integrity Check
    const integrity = verifyRosterIntegrity(
      resultAssignments, 
      bookingsSnap.docs.map(d => ({ employeeId: d.data().employeeId, dayOfWeek: d.data().dayOfWeek })), 
      leavesSnap.docs.map(d => ({ employeeId: d.data().employeeId, startDate: d.data().startDate, endDate: d.data().endDate })), 
      getDatesForWeek(weekId)
    );

    return {
      rosterAssignments: resultAssignments,
      summary: !integrity.isValid ? "Critical rules violated. The engine encountered conflicts with clinical locks." : "Assignments synchronized with clinical registry.",
      status: !integrity.isValid ? 'INFEASIBLE' : 'FEASIBLE',
      issuesEncountered: integrity.issues.map(i => String(i)),
      solverMetadata: {
        solveTimeMs: Date.now() - start,
        constraintsChecked: employees.length * 7,
        runId: `ai_${Date.now()}`
      }
    };

  } catch (e: any) {
    console.error('AI Roster Engine Failed:', e.message);
    return {
      rosterAssignments: [],
      summary: `Engine Conflict: ${e.message || 'SERIALIZATION_FAILURE'}`,
      status: 'UNKNOWN',
      issuesEncountered: ["The generation pipeline encountered a serialization or timeout error. This usually occurs when the clinical model is too large or network stability is compromised."],
      solverMetadata: { solveTimeMs: 0, constraintsChecked: 0, runId: 'none' }
    };
  }
}
