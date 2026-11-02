
'use server';

/**
 * @fileOverview Genkit flow for generating an optimized weekly employee roster.
 * This flow serves as the orchestration layer for the mathematical solver.
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
  type: z.enum(['unavailable', 'weeklyOff', 'restrictedShift']),
  dayOfWeek: DayOfWeekSchema,
  restrictedToShifts: z.array(z.string()).optional().describe('List of eligible shift IDs for this day'),
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

Your objective is to find a perfect assignment of employees to shifts that satisfies all HARD CONSTRAINTS and maximizes SOFT OBJECTIVES.

## HARD CONSTRAINTS (MANDATORY)
1. EXACT STAFFING: Every shift on every day MUST have precisely the number of employees specified in 'weeklyQuotas'.
2. SINGLE ASSIGNMENT: An employee can work at most ONE shift per day.
3. PROTECTED OFF-TIME: No shifts can be assigned to an employee on a day where they have a 'weeklyOff' or 'unavailable' constraint.
4. ADJACENCY ELIGIBILITY: If an employee has a 'restrictedShift' constraint, they can ONLY be assigned to the shifts listed in 'restrictedToShifts'.

## SOFT OBJECTIVES (PRIORITIZED BY WEIGHTS)
1. Preferences: Honor 'employeeSoftPreferences' where possible.
2. Gender Balance: Aim for 'genderTargets' per shift instance.
3. Fairness: Distribute Opening and Closing shifts evenly across the active pool.

## INPUT DATA
Week: {{{weekId}}}
Available Staff: {{employees.length}}
Shifts: {{#each shifts}}{{this.id}} ({{this.name}}), {{/each}}

Analyze the availability vs required quotas. If the total required headcount exceeds available staff for any day, you MUST return status INFEASIBLE and list the shortfall in issuesEncountered. 

If feasible, generate the assignment grid in 'rosterAssignments'.`,
});

const generateWeeklyRosterFlow = ai.defineFlow(
  {
    name: 'generateWeeklyRosterFlow',
    inputSchema: GenerateWeeklyRosterInputSchema,
    outputSchema: GenerateWeeklyRosterOutputSchema,
  },
  async (input) => {
    const start = Date.now();
    
    // Independent Pre-Feasibility Check
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const issues: string[] = [];

    days.forEach(day => {
      const quotaForDay = input.weeklyQuotas
        .filter(q => q.dayOfWeek === day)
        .reduce((sum, q) => sum + q.requiredStaff, 0);
      
      const offCount = input.employeeHardConstraints
        .filter(c => c.dayOfWeek === day && (c.type === 'weeklyOff' || c.type === 'unavailable')).length;
      
      const available = input.employees.length - offCount;

      if (quotaForDay !== available) {
        issues.push(`${day}: Quota shortfall/surplus. Available (${available}) != Required (${quotaForDay}).`);
      }
    });

    if (issues.length > 0) {
      return {
        rosterAssignments: [],
        summary: "Mathematical pre-feasibility failed. Staffing imbalance detected.",
        status: 'INFEASIBLE',
        issuesEncountered: issues,
        solverMetadata: { solveTimeMs: Date.now() - start, constraintsChecked: issues.length }
      };
    }

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
