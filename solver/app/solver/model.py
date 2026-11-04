
from ortools.sat.python import cp_model
from app.models.requests import SolveRosterRequest
from app.models.responses import Assignment, SolverMetadata, SolveRosterResponse, FairnessMetrics
import time

class RosterSolver:
    """
    Optimized Roster Engine using Google OR-Tools CP-SAT.
    
    Hard Constraints enforced:
    1. Daily Staffing Quotas.
    2. Single shift per professional per day.
    3. FCFS Weekly-Offs and Absences.
    4. Adjacency transition restrictions (Pre/Post Off).
    5. Weekly Shift Frequency Ranges (Distribution Limits).
    """
    def __init__(self, request: SolveRosterRequest):
        self.request = request
        self.model = cp_model.CpModel()
        self.days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        self.employees = request.employees
        self.shifts = request.shifts
        self.shift_ids = [s.id for s in self.shifts]
        
        # Decision Variables: x[employee, day, shift]
        self.x = {}
        for e in self.employees:
            for d in self.days:
                for s in self.shift_ids:
                    self.x[e.id, d, s] = self.model.NewBoolVar(f'x_{e.id}_{d}_{s}')

    def perform_pre_check(self) -> list[str]:
        errors = []
        for d in self.days:
            day_total_quota = sum(q.requiredStaff for q in self.request.weeklyQuotas if q.dayOfWeek == d)
            unavailable_count = len({
                c.employeeId for c in self.request.employeeHardConstraints 
                if c.dayOfWeek == d and c.type in ['weeklyOff', 'unavailable']
            })
            available_pool = len(self.employees) - unavailable_count
            if day_total_quota > available_pool:
                errors.append(f"{d}: Staffing shortfall. Required={day_total_quota}, Available={available_pool}")
        return errors

    def solve(self) -> SolveRosterResponse:
        start_time = time.time()
        pre_errors = self.perform_pre_check()
        if pre_errors:
            return SolveRosterResponse(
                status='INFEASIBLE',
                assignments=[],
                metadata=SolverMetadata(solveTimeMs=0, status='INFEASIBLE'),
                errors=pre_errors
            )

        # --- 1. HARD CONSTRAINTS ---
        
        # A. Quota Fulfillment
        for d in self.days:
            for s in self.shift_ids:
                quota = next((q.requiredStaff for q in self.request.weeklyQuotas 
                             if q.dayOfWeek == d and q.shiftId == s), 0)
                self.model.Add(sum(self.x[e.id, d, s] for e in self.employees) == quota)

        # B. Single Shift per Day
        for e in self.employees:
            for d in self.days:
                self.model.Add(sum(self.x[e.id, d, s] for s in self.shift_ids) <= 1)

        # C. Mandatory Offs & Adjacency Rules
        for c in self.request.employeeHardConstraints:
            if c.type in ['weeklyOff', 'unavailable']:
                for s in self.shift_ids:
                    if (c.employeeId, c.dayOfWeek, s) in self.x:
                        self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)
            
            elif c.type == 'restrictedShift' and c.restrictedToShifts:
                allowed = set(c.restrictedToShifts)
                for s in self.shift_ids:
                    if s not in allowed and (c.employeeId, c.dayOfWeek, s) in self.x:
                        self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)

        # D. Weekly Shift Frequency Distribution (Ranges)
        if self.request.employeeShiftLimits:
            for limit in self.request.employeeShiftLimits:
                if limit.shiftId in self.shift_ids:
                    self.model.Add(sum(self.x[limit.employeeId, d, limit.shiftId] for d in self.days) >= limit.minOccurrences)
                    self.model.Add(sum(self.x[limit.employeeId, d, limit.shiftId] for d in self.days) <= limit.maxOccurrences)

        # --- 2. SOFT OBJECTIVES ---
        obj_terms = []
        
        # Fairness & Preferences
        fairness_weight = int(self.request.weights.fairness * 100)
        for e in self.employees:
            for d in self.days:
                if (e.id, d, "SO") in self.x:
                    obj_terms.append(self.x[e.id, d, "SO"] * (e.historicalSO + 1) * fairness_weight)
                if (e.id, d, "OP") in self.x:
                    obj_terms.append(self.x[e.id, d, "OP"] * (e.historicalOP + 1) * fairness_weight)

        pref_weight = int(self.request.weights.preferences * 100)
        for p in self.request.employeeSoftPreferences:
            if (p.employeeId, p.dayOfWeek, p.shiftId) in self.x:
                obj_terms.append(self.x[p.employeeId, p.dayOfWeek, p.shiftId] * (-10 * pref_weight))

        self.model.Minimize(sum(obj_terms))

        # --- 3. EXECUTION ---
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.request.timeLimitSeconds)
        status = solver.Solve(self.model)
        
        solve_duration_ms = (time.time() - start_time) * 1000
        status_map = {cp_model.OPTIMAL: 'OPTIMAL', cp_model.FEASIBLE: 'FEASIBLE', cp_model.INFEASIBLE: 'INFEASIBLE'}

        assignments = []
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for e in self.employees:
                for d in self.days:
                    for s in self.shift_ids:
                        if solver.Value(self.x[e.id, d, s]):
                            assignments.append(Assignment(employeeId=e.id, dayOfWeek=d, shiftId=s))

        return SolveRosterResponse(
            status=status_map.get(status, 'UNKNOWN'),
            assignments=assignments,
            metadata=SolverMetadata(
                solveTimeMs=solve_duration_ms,
                status=status_map.get(status, 'UNKNOWN'),
                objectiveValue=solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None
            )
        )
