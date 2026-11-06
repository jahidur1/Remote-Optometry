
/**
 * @fileOverview DECOMMISSIONED - External Solver Client.
 * The application now utilizes the internal pure-logic orchestrator for 
 * roster generation.
 */

export async function callSolver(payload: any) {
  throw new Error("Solver Decommissioned: Use internal orchestration engine.");
}

export async function checkSolverHealth() {
  return { status: 'decommissioned' };
}
