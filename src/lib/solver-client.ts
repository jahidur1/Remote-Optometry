
/**
 * @fileOverview Secure client for interacting with the Python Solver Service.
 * Implements GCP IAM authentication and trusted payload handling.
 */

const SOLVER_URL = process.env.SOLVER_URL;
const ENABLE_IAM_AUTH = process.env.ENABLE_IAM_AUTH === 'true';
const SOLVER_TIMEOUT_MS = 60000; // 60s for complex clinical models

/**
 * Retrieves an OIDC ID token for service-to-service authentication on GCP.
 */
async function getAuthHeaders(targetAudience: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window === 'undefined' && ENABLE_IAM_AUTH) {
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(targetAudience);
      const authHeaders = await client.getRequestHeaders();
      if (authHeaders['Authorization']) {
        headers['Authorization'] = authHeaders['Authorization'];
      }
    } catch (e) {
      console.warn('Solver Client: GCP IAM Token fetch skipped.', e);
    }
  }

  return headers;
}

export async function callSolver(payload: any) {
  if (!SOLVER_URL) {
    throw new Error('Solver System Failure: SOLVER_URL is not configured in the environment.');
  }

  const headers = await getAuthHeaders(SOLVER_URL);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${SOLVER_URL}/v1/rosters/solve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Solver System Error (${response.status}): ${errorBody}`);
    }

    return response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Optimization Timeout: The clinical model exceeded the 60s processing threshold.');
    }
    throw err;
  }
}

export async function checkSolverHealth() {
  if (!SOLVER_URL) return { status: 'unconfigured' };
  try {
    const response = await fetch(`${SOLVER_URL}/health`, { 
      method: 'GET',
      cache: 'no-store',
      next: { revalidate: 300 } // Cache health check for 5 mins
    });
    if (!response.ok) return { status: 'offline' };
    return response.json();
  } catch (e) {
    return { status: 'offline' };
  }
}
