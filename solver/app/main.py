from fastapi import FastAPI, HTTPException
from app.models.requests import SolveRosterRequest
from app.models.responses import SolveRosterResponse
from app.solver.model import RosterSolver
from ortools.sat.python import cp_model
import time
import uuid

app = FastAPI(title="ROC Workforce Solver", version="1.0.0")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ortools_version": "9.11",
        "timestamp": time.time()
    }

@app.get("/solver/info")
async def solver_info():
    # Verify CP-SAT engine availability
    try:
        model = cp_model.CpModel()
        return {
            "engine": "Google OR-Tools CP-SAT",
            "available": True,
            "capabilities": ["Hard Constraints", "Soft Objectives", "Bilateral Shift Handling"]
        }
    except Exception as e:
        return {"engine": "Google OR-Tools CP-SAT", "available": False, "error": str(e)}

@app.post("/v1/rosters/solve", response_model=SolveRosterResponse)
async def solve_roster(request: SolveRosterRequest):
    request_id = str(uuid.uuid4())
    print(f"[{request_id}] Incoming solve request for week {request.weekId}")
    
    try:
        solver = RosterSolver(request)
        result = solver.solve()
        
        print(f"[{request_id}] Solve completed in {result.metadata.solveTimeMs:.2f}ms with status {result.status}")
        return result
    except Exception as e:
        print(f"[{request_id}] Critical solver failure: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
