
'use server';

/**
 * DECOMMISSIONED: External solver actions have been deprecated in favor of 
 * the ROC local deterministic orchestration engine.
 */
export async function getSolverHealthAction() {
  return { status: 'decommissioned' };
}
