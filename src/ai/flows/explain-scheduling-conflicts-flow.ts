'use server';
/**
 * @fileOverview A GenAI tool to help administrators understand scheduling conflicts,
 * summarize complex constraints, and explain solver results for the ROC Workforce system.
 *
 * - explainSchedulingConflicts - A function that processes scheduling problem details
 *   and provides AI-generated explanations and interpretations.
 * - ExplainSchedulingConflictsInput - The input type for the explainSchedulingConflicts function.
 * - ExplainSchedulingConflictsOutput - The return type for the explainSchedulingConflicts function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExplainSchedulingConflictsInputSchema = z.object({
  problemDescription: z
    .string()
    .describe(
      'A general description of the scheduling problem, e.g., "Generating a weekly roster for remote optometrists."' 
    ),
  hardConstraints: z
    .array(z.string())
    .describe('A list of hard constraints that must be satisfied, e.g., "Each shift requires at least 2 optometrists."'),
  softConstraints: z
    .array(z.string())
    .describe(
      'A list of soft constraints that are preferred but can be violated for optimization, e.g., "Aim for a gender-balanced distribution across shifts."' 
    ),
  solverOutcome: z
    .string()
    .describe(
      'The outcome or status message from the OR-Tools solver, e.g., "OPTIMAL_SOLUTION_FOUND", "INFEASIBLE", "Solution found with 3 soft constraint violations."' 
    ),
  detectedConflicts: z
    .array(z.string())
    .describe(
      'A list of specific scheduling conflicts identified, e.g., "Employee John Doe assigned to two overlapping shifts."' 
    ),
});
export type ExplainSchedulingConflictsInput = z.infer<
  typeof ExplainSchedulingConflictsInputSchema
>;

const ExplainSchedulingConflictsOutputSchema = z.object({
  overallSummary: z
    .string()
    .describe('A high-level summary of the scheduling situation and solver run.'),
  constraintSummary: z.object({
    hard: z.string().describe('A summary of all hard constraints.'),
    soft: z.string().describe('A summary of all soft constraints.'),
  }),
  conflictExplanations: z
    .array(
      z.object({
        conflict: z.string().describe('The original conflict statement.'),
        explanation: z
          .string()
          .describe('A detailed explanation of why this conflict occurred.'),
        suggestedAction: z
          .string()
          .describe(
            'A suggested action to resolve or mitigate this specific conflict.'
          ),
      })
    )
    .describe('Detailed explanations for each detected conflict.'),
  solverInterpretation: z
    .string()
    .describe(
      "An interpretation of the solver's outcome, explaining its implications and what it means for the roster."
    ),
});
export type ExplainSchedulingConflictsOutput = z.infer<
  typeof ExplainSchedulingConflictsOutputSchema
>;

export async function explainSchedulingConflicts(
  input: ExplainSchedulingConflictsInput
): Promise<ExplainSchedulingConflictsOutput> {
  return explainSchedulingConflictsFlow(input);
}

const explainSchedulingConflictsPrompt = ai.definePrompt({
  name: 'explainSchedulingConflictsPrompt',
  input: { schema: ExplainSchedulingConflictsInputSchema },
  output: { schema: ExplainSchedulingConflictsOutputSchema },
  prompt: `You are an expert scheduling analyst with a deep understanding of OR-Tools CP-SAT solver results and complex constraint systems. Your task is to explain scheduling conflicts, summarize constraints, and interpret solver outcomes for an administrator of a remote optometry center.

Analyze the provided scheduling problem details and generate a comprehensive explanation in the specified JSON format.

## Scheduling Problem Description
{{{problemDescription}}}

## Hard Constraints
{{#if hardConstraints}}
{{#each hardConstraints}}
- {{{this}}}
{{/each}}
{{else}}
No specific hard constraints provided.
{{/if}}

## Soft Constraints
{{#if softConstraints}}
{{#each softConstraints}}
- {{{this}}}
{{/each}}
{{else}}
No specific soft constraints provided.
{{/if}}

## Solver Outcome
{{{solverOutcome}}}

## Detected Conflicts
{{#if detectedConflicts}}
{{#each detectedConflicts}}
- {{{this}}}
{{/each}}
{{else}}
No specific conflicts detected or reported.
{{/if}}


Generate your response in JSON format. Ensure all fields in the output schema are populated with relevant information based on your analysis. For conflict explanations, assume the most common reasons for such conflicts given the context of a workforce management system and propose practical actions.
`,
});

const explainSchedulingConflictsFlow = ai.defineFlow(
  {
    name: 'explainSchedulingConflictsFlow',
    inputSchema: ExplainSchedulingConflictsInputSchema,
    outputSchema: ExplainSchedulingConflictsOutputSchema,
  },
  async (input) => {
    const { output } = await explainSchedulingConflictsPrompt(input);
    return output!;
  }
);
