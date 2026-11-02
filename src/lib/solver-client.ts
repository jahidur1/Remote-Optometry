/**
 * @fileOverview Secure client for interacting with the Python Solver Service.
 * Implements GCP IAM authentication and trusted payload handling.
 */

import { GoogleAuth } from 'google-auth-library';

const SOLVER_URL = process.env.SOLVER_URL || 'http://localhost:8000';
const SOLVER_API_KEY = process.env.SOLVER_API_KEY;

const auth = new GoogleAuth();

/**
 * Retrieves an OIDC ID token for service-to-service authentication on GCP.
 * This ensures only the authorized Next.js backend can call the private Solver API.
 */
async function getAuthHeaders(targetAudience: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (SOLVER_API_KEY) {
    headers['X-API-Key'] = SOLVER_API_KEY;
  }

  // Only attempt GCP IAM auth if in production or explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_IAM_AUTH === 'true') {
    try {
      // In GCP environments (Cloud Run/Functions), this retrieves the service account's identity token
      const client = await auth.getIdTokenClient(targetAudience);
      const authHeaders = await client.getRequestHeaders();
      if (authHeaders['Authorization']) {
        headers['Authorization'] = authHeaders['Authorization'];
      }
    } catch (e) {
      console.warn('Solver Client: GCP IAM Token fetch skipped. Ensure Service Account has "Cloud Run Invoker" permissions.', e);
    }
  }

  return headers;
}

export async function callSolver(payload: any) {
  const headers = await getAuthHeaders(SOLVER_URL);
  
  const response = await fetch(`${SOLVER_URL}/v1/rosters/solve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Solver Service Error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function validateAssignments(payload: any) {
  const headers = await getAuthHeaders(SOLVER_URL);
  
  const response = await fetch(`${SOLVER_URL}/v1/rosters/validate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Validation Service Error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function checkSolverHealth() {
  const response = await fetch(`${SOLVER_URL}/health`);
  return response.json();
}
