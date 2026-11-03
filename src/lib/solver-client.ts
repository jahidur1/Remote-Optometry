
/**
 * @fileOverview Secure client for interacting with the Python Solver Service.
 * Implements GCP IAM authentication and trusted payload handling.
 */

import { GoogleAuth } from 'google-auth-library';

const SOLVER_URL = process.env.SOLVER_URL || 'http://localhost:8000';
const SOLVER_API_KEY = process.env.SOLVER_API_KEY;

// Idempotent auth instance for server-side ID token retrieval
let authInstance: any = null;
function getAuth() {
  if (typeof window === 'undefined' && !authInstance) {
    authInstance = new GoogleAuth();
  }
  return authInstance;
}

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

  // Only attempt GCP IAM auth if explicitly enabled
  // This code only runs on the server (Server Actions / Genkit Flows)
  if (typeof window === 'undefined' && process.env.ENABLE_IAM_AUTH === 'true') {
    try {
      const auth = getAuth();
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
    cache: 'no-store'
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
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Validation Service Error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function checkSolverHealth() {
  try {
    const response = await fetch(`${SOLVER_URL}/health`, { 
      method: 'GET',
      cache: 'no-store' 
    });
    if (!response.ok) return { status: 'offline' };
    return response.json();
  } catch (e) {
    return { status: 'offline' };
  }
}
