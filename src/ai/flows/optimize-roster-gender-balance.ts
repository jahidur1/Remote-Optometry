'use server';
/**
 * @fileOverview This flow helps administrators optimize employee rosters for gender balance using AI assistance.
 * It takes existing roster data and employee gender information, and then uses a prompt to generate
 * specific objectives and constraints for an external mathematical solver (e.g., Google OR-Tools CP-SAT)
 * to achieve the desired gender balance in shift assignments.
 *
 * - optimizeRosterForGenderBalance - A function that handles the gender-balanced roster optimization process.
 * - OptimizeRosterForGenderBalanceInput - The input type for the optimizeRosterForGenderBalance function.
 * - OptimizeRosterForGenderBalanceOutput - The return type for the optimizeRosterForGenderBalance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Assume a simplified representation for demonstration.
// In a real application, these would be much more detailed.

const ShiftAssignmentSchema = z.object({
  employeeId: z.string(),
  shiftId: z.string(),
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.enum(['Male', 'Female', 'Other']).describe('Employee gender'),
  // Add other relevant employee details like skills, availability, etc.
});

const OptimizeRosterForGenderBalanceInputSchema = z.object({
  currentRoster: z.array(ShiftAssignmentSchema).describe('The current shift assignments.'),
  employees: z.array(EmployeeSchema).describe('List of all employees with their details, including gender.'),
  optimizationGoalDescription: z.string().describe('Natural language description of the desired gender balance objective (e.g., "ensure an even split of genders on all shifts", "at least 40% female on every night shift").'),
});
export type OptimizeRosterForGenderBalanceInput = z.infer<typeof OptimizeRosterForGenderBalanceInputSchema>;

// The output of the AI prompt will be structured instructions for the solver.
// This schema defines what the AI needs to extract/generate for the solver.
const SolverGenderBalanceObjectiveSchema = z.object({
  targetRatioPerShift: z.record(z.enum(['Male', 'Female', 'Other']), z.number().min(0).max(1)).optional().describe('Target gender ratio (e.g., {"Female": 0.5, "Male": 0.5}) for shifts, or specific shift types if applicable.'),
  minGenderPerShift: z.record(z.enum(['Male', 'Female', 'Other']), z.number().int().min(0)).optional().describe('Minimum number of employees of a certain gender required per shift.'),
  maxGenderPerShift: z.record(z.enum(['Male', 'Female', 'Other']), z.number().int().min(0)).optional().describe('Maximum number of employees of a certain gender allowed per shift.'),
  shiftSpecificRules: z.array(z.object({
    shiftId: z.string(),
    minGenderPerShift: z.record(z.enum(['Male', 'Female', 'Other']), z.number().int().min(0)).optional(),
    targetRatioPerShift: z.record(z.enum(['Male', 'Female', 'Other']), z.number().min(0).max(1)).optional(),
  })).optional().describe('Specific gender balance rules for individual shifts.'),
  softConstraintWeight: z.number().min(0).max(1).default(0.7).describe('Weight for this soft constraint in the solver objective function (0-1, higher means more important).'),
  additionalSolverNotes: z.string().optional().describe('Any additional notes or considerations for the solver based on the optimization goal.'),
});

const OptimizedRosterOutputSchema = z.object({
  optimizedRoster: z.array(ShiftAssignmentSchema).describe('The roster optimized for gender balance.'),
  genderBalanceReport: z.string().describe('A summary report on how gender balance was achieved and any deviations from the goal.'),
  solverStatus: z.string().describe('Status of the roster solver operation (e.g., "OPTIMAL", "INFEASIBLE").'),
  solverMessages: z.array(z.string()).optional().describe('Any messages from the solver.'),
});
export type OptimizeRosterForGenderBalanceOutput = z.infer<typeof OptimizedRosterOutputSchema>;

// This function would represent the external OR-Tools solver.
// It's a placeholder since OR-Tools isn't a GenAI model.
// In a real application, this would be imported from a `src/services/or-tools-solver.ts` or similar.
async function solveRosterWithGenderBalance(
  currentRoster: z.infer<typeof OptimizeRosterForGenderBalanceInputSchema>['currentRoster'],
  employees: z.infer<typeof OptimizeRosterForGenderBalanceInputSchema>['employees'],
  genderBalanceObjective: z.infer<typeof SolverGenderBalanceObjectiveSchema>
): Promise<OptimizeRosterForGenderBalanceOutput> {
  // Mock implementation for the solver.
  // In a real scenario, this would involve complex OR-Tools CP-SAT model building and solving.

  console.log('--- Calling OR-Tools Solver (Mock) ---');
  console.log('Current Roster (first 5 assignments):', currentRoster.slice(0, 5));
  console.log('Employees (first 5):', employees.slice(0, 5));
  console.log('Gender Balance Objective:', JSON.stringify(genderBalanceObjective, null, 2));
  console.log('------------------------------------');

  // Simulate some optimization logic.
  // For now, we'll just return the original roster with a mock report.
  const optimizedRoster = currentRoster; // In a real app, this would be computed by the solver.

  const report = `Roster optimization completed. The administrator's goal for gender balance was interpreted as:\n  ${genderBalanceObjective.additionalSolverNotes || 'No specific notes provided.'}\n  Target ratios per gender: ${JSON.stringify(genderBalanceObjective.targetRatioPerShift || {}, null, 2)}\n  Minimums per gender per shift: ${JSON.stringify(genderBalanceObjective.minGenderPerShift || {}, null, 2)}\n  Shift-specific rules applied: ${JSON.stringify(genderBalanceObjective.shiftSpecificRules || [], null, 2)}\n  Soft constraint weight: ${genderBalanceObjective.softConstraintWeight}.\n  The solver attempted to achieve the objective, but for this mock, the roster remains unchanged.`

  return {
    optimizedRoster: optimizedRoster,
    genderBalanceReport: report,
    solverStatus: 'OPTIMAL',
    solverMessages: ['Mock solver ran successfully. In a real scenario, an OR-Tools solver would compute the optimized roster based on the provided objectives.'],
  };
}

// Prompt input schema specifically for the AI, includes stringified versions of complex objects.
const GenderBalancePromptInputSchema = z.object({
  currentRosterJson: z.string().describe('JSON string of the current shift assignments.'),
  employeesJson: z.string().describe('JSON string of all employees with their details, including gender.'),
  optimizationGoalDescription: z.string().describe('Natural language description of the desired gender balance objective.'),
});

const genderBalancePrompt = ai.definePrompt({
  name: 'genderBalanceSolverConfigPrompt',
  input: {schema: GenderBalancePromptInputSchema}, // Use the new prompt-specific input schema
  output: {schema: SolverGenderBalanceObjectiveSchema},
  // The prompt's job is to extract and structure the optimization goal for the solver.
  prompt: `You are an AI assistant tasked with interpreting an administrator's request for gender-balanced shift assignments and translating it into a structured JSON format for a mathematical roster solver.\n\nAnalyze the provided 'currentRosterJson', 'employeesJson' (which includes gender for each employee), and the 'optimizationGoalDescription'. Your task is to extract clear, actionable parameters for the solver to achieve the specified gender balance.\n\nCurrent Roster Details (JSON):\n{{{currentRosterJson}}}\n\nEmployee Details (JSON):\n{{{employeesJson}}}\n\nAdministrator's Gender Balance Optimization Goal:\n{{{optimizationGoalDescription}}}\n\nBased on the administrator's goal, provide a JSON object adhering to the SolverGenderBalanceObjectiveSchema.\nRemember to set 'softConstraintWeight' and 'additionalSolverNotes' clearly.\n\nIf the goal specifies a target percentage or ratio for genders, use 'targetRatioPerShift'.\nIf the goal specifies a minimum or maximum count of a gender on a shift, use 'minGenderPerShift' or 'maxGenderPerShift'.\nIf rules apply to specific shifts (e.g., "night shifts"), use 'shiftSpecificRules'.\n\nAlways default 'softConstraintWeight' to 0.7 if not explicitly implied by the administrator's description (e.g., "prioritize highly" might mean 0.9, "as a secondary goal" might mean 0.5).\n\nExample 1:\nGoal: "ensure an even split of genders on all shifts, prioritizing it highly"\nExpected JSON:\n{\n  "targetRatioPerShift": {\n    "Male": 0.5,\n    "Female": 0.5\n  },\n  "softConstraintWeight": 0.9,\n  "additionalSolverNotes": "The primary goal is to achieve an even gender split across all shifts as a strong soft constraint."\n}\n\nExample 2:\nGoal: "at least 2 female employees on every night shift (shift ID 'NIGHT_A'), but keep it a moderate priority"\nExpected JSON:\n{\n  "shiftSpecificRules": [\n    {\n      "shiftId": "NIGHT_A",\n      "minGenderPerShift": {\n        "Female": 2\n      }\n    }\n  ],\n  "softConstraintWeight": 0.6,\n  "additionalSolverNotes": "Ensure a minimum of 2 female employees on night shift 'NIGHT_A'."\n}\n`,
});

export async function optimizeRosterForGenderBalance(
  input: OptimizeRosterForGenderBalanceInput
): Promise<OptimizeRosterForGenderBalanceOutput> {
  return optimizeRosterForGenderBalanceFlow(input);
}

const optimizeRosterForGenderBalanceFlow = ai.defineFlow(
  {
    name: 'optimizeRosterForGenderBalanceFlow',
    inputSchema: OptimizeRosterForGenderBalanceInputSchema,
    outputSchema: OptimizedRosterOutputSchema,
  },
  async (input) => {
    // Prepare input for the prompt, stringifying complex objects for clarity to the LLM.
    const promptInput = {
      currentRosterJson: JSON.stringify(input.currentRoster),
      employeesJson: JSON.stringify(input.employees),
      optimizationGoalDescription: input.optimizationGoalDescription,
    };

    // Step 1: Use the AI prompt to interpret the optimization goal and generate solver parameters.
    const {output: solverObjective} = await genderBalancePrompt(promptInput);

    if (!solverObjective) {
        throw new Error('AI failed to generate solver objective for gender balance.');
    }

    // Step 2: Call the external (mock) OR-Tools solver with the interpreted objectives.
    // In a real application, this would be an actual solver function, likely in a service file.
    const optimizedResult = await solveRosterWithGenderBalance(
      input.currentRoster, // Pass original objects to the solver.
      input.employees,     // Pass original objects to the solver.
      solverObjective
    );

    return optimizedResult;
  }
);
