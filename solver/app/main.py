from fastapi import FastAPI, HTTPException, BackgroundTasks
from app.models.requests import SolveRosterRequest
from app.models.responses import SolveRosterResponse
from app.solver.model import RosterSolver
from ortools.sat.python import cp_model
import time
import uuid
import logging
from typing import Dict, Any

# Institutional Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("solver-service")

app = FastAPI(
    title="ROC Workforce Solver",
    version="1.2.0",
    description="Deterministic Roster Optimization Node"
)

# In-memory job store (Volatile)
# SECURITY NOTE: In-memory store is suitable for single-instance Cloud Run.
# For production clusters with max-instances > 1, move this to Firestore.
jobs: Dict[str, Dict[str, Any]] = {}

@app.get("/health")
async def health_check():
    """Reports service health and OR-Tools status."""
    return {
        "status": "healthy",
        "ortools_version": "9.11",
        "timestamp": time.time(),
        "node": "GCP_CLOUD_RUN_V1"
    }

@app.get("/solver/info")
async def solver_info():
    """Verifies CP-SAT engine availability."""
    try:
        model = cp_model.CpModel()
        return {
            "engine": "Google OR-Tools CP-SAT",
            "available": True,
            "capabilities": ["Hard Constraints", "Soft Objectives", "Bilateral Shift Handling", "Async Jobs"]
        }
    except Exception as e:
        return {"engine": "Google OR-Tools CP-SAT", "available": False, "error": str(e)}

@app.post("/v1/rosters/solve", response_model=SolveRosterResponse)
async def solve_roster(request: SolveRosterRequest):
    """Executes mathematical optimization synchronously (Time limit: 60s)."""
    request_id = str(uuid.uuid4())
    logger.info(f"ACTION=SOLVE_SYNC | REQ_ID={request_id} | WEEK={request.weekId} | OFFICE={request.officeId}")
    
    try:
        solver = RosterSolver(request)
        result = solver.solve()
        
        logger.info(f"ACTION=SOLVE_DONE | REQ_ID={request_id} | STATUS={result.status} | TIME={result.metadata.solveTimeMs:.2f}ms")
        return result
    except Exception as e:
        logger.error(f"ACTION=SOLVE_ERROR | REQ_ID={request_id} | ERROR={str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def run_async_solve_task(job_id: str, request: SolveRosterRequest):
    """Background task executor for complex models."""
    jobs[job_id]["status"] = "RUNNING"
    try:
        solver = RosterSolver(request)
        result = solver.solve()
        jobs[job_id]["status"] = "COMPLETED"
        jobs[job_id]["result"] = result
        jobs[job_id]["completedAt"] = time.time()
        logger.info(f"ACTION=JOB_COMPLETE | JOB_ID={job_id} | STATUS={result.status}")
    except Exception as e:
        jobs[job_id]["status"] = "FAILED"
        jobs[job_id]["error"] = str(e)
        logger.error(f"ACTION=JOB_FAILED | JOB_ID={job_id} | ERROR={str(e)}")

@app.post("/v1/rosters/solve-async")
async def solve_roster_async(request: SolveRosterRequest, background_tasks: BackgroundTasks):
    """Initiates an asynchronous solve job for long-running optimizations."""
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    jobs[job_id] = {
        "id": job_id,
        "status": "QUEUED",
        "submittedAt": time.time(),
        "weekId": request.weekId,
        "officeId": request.officeId
    }
    
    background_tasks.add_task(run_async_solve_task, job_id, request)
    logger.info(f"ACTION=JOB_START | JOB_ID={job_id} | WEEK={request.weekId} | OFFICE={request.officeId}")
    return {"jobId": job_id, "status": "QUEUED"}

@app.get("/v1/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Polls for the result of an asynchronous solve job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job record not found")
    
    return jobs[job_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
