from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class Shift(BaseModel):
    id: str
    name: str

class Employee(BaseModel):
    id: str
    gender: str
    historicalSO: int = 0
    historicalOP: int = 0

class DailyQuota(BaseModel):
    dayOfWeek: str
    shiftId: str
    requiredStaff: int

class EmployeeConstraint(BaseModel):
    employeeId: str
    type: str # 'unavailable', 'weeklyOff', 'restrictedShift'
    dayOfWeek: str
    restrictedToShifts: Optional[List[str]] = None

class SolverWeights(BaseModel):
    fairness: float = 0.8
    genderBalance: float = 0.5
    preferences: float = 0.5

class SolveRosterRequest(BaseModel):
    weekId: str
    shifts: List[Shift]
    employees: List[Employee]
    weeklyQuotas: List[DailyQuota]
    employeeHardConstraints: List[EmployeeConstraint]
    weights: Optional[SolverWeights] = Field(default_factory=SolverWeights)
    timeLimitSeconds: int = 30
