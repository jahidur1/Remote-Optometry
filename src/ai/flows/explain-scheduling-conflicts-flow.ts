'use server';

/**
 * @fileOverview A GenAI tool to help administrators understand scheduling conflicts.
 * Only async functions are exported to satisfy Next.js "use server" requirements.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExplainSchedulingConflictsInputSchema = z.object({
  problemDescription: z.string(),
  hardConstraints: z.array(z.string()),
  softConstraints: z.array(z.string()),
  solverOutcome: z.string(),
  detectedConflicts: z.array(z.string()),
});

const ExplainSchedulingConflictsOutputSchema = z.object({
  overallSummary: z.string(),
  constraintSummary: z.object({
    hard: z.string(),
    soft: z.string(),
  }),
  conflictExplanations: z.array(
    z.object({
      conflict: z.string(),
      explanation: z.string(),
      suggestedAction: z.string(),
    })
  ),
  solverInterpretation: z.string(),
});

const explainSchedulingConflictsPrompt = ai.definePrompt({
  name: 'explainSchedulingConflictsPrompt',
  input: { schema: ExplainSchedulingConflictsInputSchema },
  output: { schema: ExplainSchedulingConflictsOutputSchema },
  prompt: `You are an expert scheduling analyst. Analyze the conflicts and solver outcomes provided and generate a detailed interpretation in JSON.
  
  Description: {{{problemDescription}}}
  Solver Status: {{{solverOutcome}}}
  Conflicts: {{#each detectedConflicts}}- {{{this}}}{{/each}}`,
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

export async function explainSchedulingConflicts(input: z.infer<typeof ExplainSchedulingConflictsInputSchema>) {
  return explainSchedulingConflictsFlow(input);
}
