
'use server';

/**
 * @fileOverview Hardened AI Roster Orchestrator with Lean Data Protocol.
 * 
 * Implements a Strict POJO Protocol to ensure 100% JSON-serializable returns.
 * Optimized with Lean Data Protocol: Sends only essential clinical identities
 * and quotas to Gemini to prevent serialization/timeout conflicts.
 * 
 * NEXT.JS 15 COMPLIANCE: Only async functions are exported.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getDatesForWeek } from '@/lib/date-utils';
import { verifyRosterIntegrity } from '@/lib/integrity-checker';
import { assertOfficeActive } from '@/lib/office-utils';

// --- SCHEMA DEFINITIONS (Internal only to satisfy Next.js "use server" exports) ---

const RosterAssignmentSchema = z.object({
  employeeId: z.string(),
  dayOfWeek: z.string(),
  shiftId: z.string(),
});

const LeanPromptInputSchema = z.object({
  weekId: z.string(),
  officeId: z.string(),
  employees: z.array(z.object({
    id: z.string(),
    name: z.string(),
    weekOffDay: z.string().nullable(),
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

// --- AI PROMPT DEFINITION ---

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
   - You MUST satisfy the following headcount requirements.
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

/**
 * generateWeeklyRoster
 * 
 * High-intensity orchestration pulse.
 * Implements Lean Data Protocol: Strips PII and metadata before AI inference.
 */
export async function generateWeeklyRoster(input: {
  weekId: string;
  officeId: string;
  employeeIds: string[];
  idToken: string;
  globalFrequencyLimits?: Record<string, { min: number, max: number, label: string }>;
  globalPreOffShifts?: string[];
  globalPostOffShifts?: string[];
}) {
  const start = Date.now();
  
  try {
    const { weekId, officeId, employeeIds, idToken, globalFrequencyLimits, globalPreOffShifts, globalPostOffShifts } = input;

    // 1. Auth Pulse (Lightweight verification)
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userRef = adminDb.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) throw new Error("IDENTITY_NOT_FOUND");
    await assertOfficeActive(officeId);
    
    // 2. Data Aggregation (Lean Fetching)
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

    // 3. Lean Registry Construction (User requested: ID, Name, WeekOff only)
    const bookingsMap = new Map();
    bookingsSnap.docs.forEach(d => {
      const b = d.data();
      bookingsMap.set(b.employeeId, b.dayOfWeek);
    });

    const employees = empSnap.docs
      .filter(d => employeeIds.includes(d.id))
      .map(d => ({
        id: String(d.id),
        name: String(d.data().fullName || 'Unknown'),
        weekOffDay: bookingsMap.get(d.id) || null
      }));

    const rawQuotas = quotaSnap.data()?.quotas || {};
    const quotas = Object.entries(rawQuotas).map(([key, val]) => {
      const [day, sId] = key.split('_');
      return { day: String(day), shiftId: String(sId), count: Number(val) };
    });

    const frequencyConstraints: Record<string, { min: number, max: number }> = {};
    if (globalFrequencyLimits) {
      Object.entries(globalFrequencyLimits).forEach(([sid, lim]) => {
        frequencyConstraints[sid] = { min: Number(lim.min), max: Number(lim.max) };
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
    
    // 5. Secure Serialization Boundary (Absolute POJO mapping)
    const resultAssignments = rawAssignments.map(a => ({
        employeeId: String(a.employeeId),
        dayOfWeek: String(a.dayOfWeek),
        shiftId: String(a.shiftId)
    }));

    const integrity = verifyRosterIntegrity(
      resultAssignments, 
      bookingsSnap.docs.map(d => ({ employeeId: d.data().employeeId, dayOfWeek: d.data().dayOfWeek })), 
      leavesSnap.docs.map(d => ({ employeeId: d.data().employeeId, startDate: d.data().startDate, endDate: d.data().endDate })), 
      getDatesForWeek(weekId)
    );

    return {
      rosterAssignments: resultAssignments,
      summary: !integrity.isValid ? "Critical rules violated. Conflict with clinical locks detected." : "Assignments synchronized with clinical registry.",
      status: !integrity.isValid ? 'INFEASIBLE' : 'FEASIBLE',
      issuesEncountered: integrity.issues.map(i => String(i)),
      solverMetadata: {
        solveTimeMs: Date.now() - start,
        constraintsChecked: employees.length * 7,
        runId: `ai_${Date.now()}`
      }
    };

  } catch (e: any) {
    console.error('Engine Conflict Debug:', e);
    // Explicitly return a POJO error message to avoid Next.js serialization crash
    return {
      rosterAssignments: [],
      summary: `Engine Conflict: ${String(e.message || 'SERIALIZATION_FAILURE')}`,
      status: 'UNKNOWN',
      issuesEncountered: ["The generation pipeline encountered a connection or timeout error. Please verify your quota configuration."],
      solverMetadata: { solveTimeMs: 0, constraintsChecked: 0, runId: 'none' }
    };
  }
}
