'use server';

/**
 * @fileOverview Genkit flow for generating an optimized weekly employee roster.
 * In a production environment, this flow orchestrates the call to the OR-Tools CP-SAT 
 * solver service running on Google Cloud Run.
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

export const GenerateWeeklyRosterInputSchema = z.object({
  shifts: z.array(ShiftSchema),
  employees: z.array(EmployeeSchema),
  weeklyQuotas: z.array(WeeklyQuotaSchema),
  employeeHardConstraints: z.array(EmployeeConstraintSchema),
  employeeSoftPreferences: z.array(EmployeePreferenceSchema).optional(),
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
});

export type GenerateWeeklyRosterOutput = z.infer<typeof GenerateWeeklyRosterOutputSchema>;

export async function generateWeeklyRoster(input: GenerateWeeklyRosterInput): Promise<GenerateWeeklyRosterOutput> {
  return generateWeeklyRosterFlow(input);
}

const generateWeeklyRosterPrompt = ai.definePrompt({
  name: 'generateWeeklyRosterPrompt',
  input: { schema: GenerateWeeklyRosterInputSchema },
  output: { schema: GenerateWeeklyRosterOutputSchema },
  prompt: `You are an expert roster manager simulating the logic of an OR-Tools CP-SAT solver.

Your primary goal is to satisfy all HARD CONSTRAINTS:
1. Staffing Quotas: Every shift must have exactly the required number of employees.
2. No Overlaps: One employee per shift per day.
3. Protected Days: No shifts on weeklyOff or unavailable days.

Optimize for SOFT OBJECTIVES:
1. Respect employee preferences where possible.
2. Maintain gender balance per shift.

Data:
Shifts: {{#each shifts}}{{this.id}} ({{this.name}}), {{/each}}
Employees: {{employees.length}} total professionals.
Quotas: {{#each weeklyQuotas}}{{this.dayOfWeek}} {{this.shiftId}}: {{this.requiredStaff}}; {{/each}}
Hard Constraints: {{employeeHardConstraints.length}} restricted assignments.

Generate a valid roster. If quotas exceed availability, return status INFEASIBLE and list the shortages in issuesEncountered.`,
});

const generateWeeklyRosterFlow = ai.defineFlow(
  {
    name: 'generateWeeklyRosterFlow',
    inputSchema: GenerateWeeklyRosterInputSchema,
    outputSchema: GenerateWeeklyRosterOutputSchema,
  },
  async (input) => {
    // In production, this would be: 
    // const response = await fetch(process.env.SOLVER_URL, { ... })
    
    // For this implementation, we use the defined prompt to simulate the solver's logic.
    const { output } = await generateWeeklyRosterPrompt(input);
    return output!;
  }
);
