
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Institutional AI Orchestrator
 * 
 * Configures Genkit with Google Gemini Flash.
 * Updated to use stable googleai/gemini-1.5-flash identifier to resolve 404 conflicts.
 */

if (typeof window === 'undefined' && !process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.warn('GENKIT_AUTH_ALERT: No Google AI API key detected. Connect via GOOGLE_GENAI_API_KEY env var.');
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
