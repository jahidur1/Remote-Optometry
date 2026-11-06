
# ROC Workforce Solver: DECOMMISSIONED

This service has been replaced by the internal deterministic logic orchestrator 
located in `src/services/roster-engine.ts`. 

## Removal Steps:
1. Run: `gcloud run services delete roc-workforce-solver --region asia-south1`
2. Remove the `SOLVER_URL` environment variable from your production registry.
