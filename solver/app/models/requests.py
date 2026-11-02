from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class Shift(BaseModel):
    id: str
    name: str

class Employee(BaseModel):
    id: str
    gender: str # 'male', 'female', 'other'
    historicalSO: int = 0
    historicalOP: int = 0
    historicalMD: int = 0
    historicalC1: int = 0
    historicalC2: int = 0
    historicalSC: int = 0

class DailyQuota(BaseModel):
    dayOfWeek: str # Monday, Tuesday, etc.
    shiftId: str
    requiredStaff: int

class GenderTarget(BaseModel):
    shiftId: str
    maleTarget: int = 0
    femaleTarget: int = 0

class EmployeeConstraint(BaseModel):
    employeeId: str
    type: str # 'unavailable', 'weeklyOff', 'restrictedShift'
    dayOfWeek: str
    restrictedToShifts: Optional[List[str]] = None

class EmployeePreference(BaseModel):
    employeeId: str
    dayOfWeek: str
    shiftId: str
    weight: float = 1.0

class SolverWeights(BaseModel):
    fairness: float = 0.8
    genderBalance: float = 0.5
    preferences: float = 0.5

class SolveRosterRequest(BaseModel):
    weekId: str
    officeId: str # KOLKATA_ROC, GURGAON_ROC, LUCKNOW_ROC
    shifts: List[Shift]
    employees: List[Employee]
    weeklyQuotas: List[DailyQuota]
    employeeHardConstraints: List[EmployeeConstraint]
    employeeSoftPreferences: Optional[List[EmployeePreference]] = Field(default_factory=list)
    genderTargets: Optional[List[GenderTarget]] = Field(default_factory=list)
    weights: Optional[SolverWeights] = Field(default_factory=SolverWeights)
    timeLimitSeconds: int = 30
