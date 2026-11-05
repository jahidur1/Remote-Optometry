import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * Institutional AI Orchestrator
 * 
 * Configures Genkit with Google Gemini 1.5 Flash.
 * Uses the explicit model object from the plugin to ensure reliable API routing 
 * and resolve 404 conflicts associated with v1beta endpoints.
 */

if (typeof window === 'undefined' && !process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.warn('GENKIT_AUTH_ALERT: No Google AI API key detected. Connect via GOOGLE_GENAI_API_KEY env var.');
}

export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
