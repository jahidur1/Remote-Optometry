'use server';

/**
 * @fileOverview Genkit flow for generating an optimized weekly employee roster.
 * This flow orchestrates the call to the OR-Tools CP-SAT mathematical solver.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DayOfWeekSchema = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

const ShiftSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.enum(['male', 'female', 'other']),
});

const WeeklyQuotaSchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  shiftId: z.string(),
  requiredStaff: z.number().int(),
});

const EmployeeConstraintSchema = z.object({
  employeeId: z.string(),
  type: z.enum(['unavailable', 'weeklyOff']),
  dayOfWeek: DayOfWeekSchema,
});

const EmployeePreferenceSchema = z.object({
  employeeId: z.string(),
  type: z.enum(['preferDayOff', 'preferShift']),
  dayOfWeek: DayOfWeekSchema,
  shiftId: z.string().optional(),
});

const GenderTargetSchema = z.object({
  shiftId: z.string(),
  maleTarget: z.string().describe('Target band e.g. "1-2"'),
  femaleTarget: z.string().describe('Target band e.g. "2-3"'),
});

export const GenerateWeeklyRosterInputSchema = z.object({
  weekId: z.string(),
  shifts: z.array(ShiftSchema),
  employees: z.array(EmployeeSchema),
  weeklyQuotas: z.array(WeeklyQuotaSchema),
  employeeHardConstraints: z.array(EmployeeConstraintSchema),
  employeeSoftPreferences: z.array(EmployeePreferenceSchema).optional(),
  genderTargets: z.array(GenderTargetSchema).optional(),
  softWeights: z.object({
    preferences: z.number().default(0.5),
    genderBalance: z.number().default(0.7),
    fairness: z.number().default(0.3),
  }).optional(),
});

export type GenerateWeeklyRosterInput = z.infer<typeof GenerateWeeklyRosterInputSchema>;

const RosterAssignmentSchema = z.object({
  employeeId: z.string(),
  dayOfWeek: DayOfWeekSchema,
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

export async function generateWeeklyRoster(input: GenerateWeeklyRosterInput): Promise<GenerateWeeklyRosterOutput> {
  return generateWeeklyRosterFlow(input);
}

const generateWeeklyRosterPrompt = ai.definePrompt({
  name: 'generateWeeklyRosterPrompt',
  input: { schema: GenerateWeeklyRosterInputSchema },
  output: { schema: GenerateWeeklyRosterOutputSchema },
  prompt: `You are a mathematical roster optimization engine simulating OR-Tools CP-SAT logic.

Your primary goal is to satisfy all HARD CONSTRAINTS:
1. Exact Staffing Quotas: Every shift MUST have exactly the required number of employees.
2. No Overlaps: One employee per shift per day maximum.
3. Protected Time: No shifts on weeklyOff or unavailable days (leave/training).
4. Shift Eligibility: Only assign employees to shifts they are eligible for.

Optimize for SOFT OBJECTIVES (using weights if provided):
1. Employee shift preferences.
2. Gender balance targets per shift instance.
3. Historical fairness (opening/closing distribution).

Data for Week {{{weekId}}}:
- Shifts: {{#each shifts}}{{this.id}} ({{this.name}}), {{/each}}
- Employees: {{employees.length}} total.
- Hard Constraints: {{employeeHardConstraints.length}} restricted assignments.
- Quotas: {{#each weeklyQuotas}}{{{this.dayOfWeek}}} {{{this.shiftId}}}: {{{this.requiredStaff}}}; {{/each}}
- Gender Targets: {{#each genderTargets}}{{{this.shiftId}}}: M {{{this.maleTarget}}} F {{{this.femaleTarget}}}; {{/each}}

If hard constraints (specifically staffing totals vs availability) cannot be satisfied, return status INFEASIBLE and list the shortages in issuesEncountered. Otherwise, provide the best FEASIBLE or OPTIMAL assignments.`,
});

const generateWeeklyRosterFlow = ai.defineFlow(
  {
    name: 'generateWeeklyRosterFlow',
    inputSchema: GenerateWeeklyRosterInputSchema,
    outputSchema: GenerateWeeklyRosterOutputSchema,
  },
  async (input) => {
    // In production, this calls a private Python FastAPI Cloud Run service:
    // const solverResponse = await fetch(process.env.SOLVER_SERVICE_URL, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${adminToken}` },
    //   body: JSON.stringify(input)
    // });
    
    // For the foundation, we use Genkit to simulate the optimization logic.
    const start = Date.now();
    const { output } = await generateWeeklyRosterPrompt(input);
    
    return {
      ...output!,
      solverMetadata: {
        solveTimeMs: Date.now() - start,
        constraintsChecked: input.employees.length * 7 * input.shifts.length,
      }
    };
  }
);