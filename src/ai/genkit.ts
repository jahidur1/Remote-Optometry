
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Institutional AI Orchestrator
 * 
 * Configures Genkit 1.x with Google Gemini.
 * Model updated to stable identifier to resolve 404 Beta endpoint conflicts.
 */

// Diagnostic Check: Alert administrative console if API connection is not configured
if (typeof window === 'undefined' && !process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.warn('GENKIT_AUTH_ALERT: No Google AI API key detected. Connect via GOOGLE_GENAI_API_KEY env var.');
}

export const ai = genkit({
  plugins: [googleAI()],
  // Use standard model ID to ensure compatibility with v1beta endpoints
  model: 'googleai/gemini-1.5-flash',
});
