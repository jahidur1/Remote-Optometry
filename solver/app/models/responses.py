from pydantic import BaseModel
from typing import List, Optional, Dict

class Assignment(BaseModel):
    employeeId: str
    dayOfWeek: str
    shiftId: str

class FairnessMetrics(BaseModel):
    preferenceSatisfactionRate: float
    avgHistoricalSOCount: float
    avgHistoricalOPCount: float

class SolverMetadata(BaseModel):
    solveTimeMs: float
    status: str
    objectiveValue: Optional[float] = None
    workerName: str = "OR-Tools-CP-SAT"

class SolveRosterResponse(BaseModel):
    status: str # 'OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN'
    assignments: List[Assignment]
    fairness: Optional[FairnessMetrics] = None
    metadata: SolverMetadata
    errors: List[str] = []
