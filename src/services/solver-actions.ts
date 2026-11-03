'use server';

import { checkSolverHealth } from '@/lib/solver-client';

/**
 * Server action to safely check solver health from client components
 * without exposing Node.js internal logic.
 */
export async function getSolverHealthAction() {
  return checkSolverHealth();
}
