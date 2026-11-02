from ortools.sat.python import cp_model
from app.models.requests import SolveRosterRequest
from app.models.responses import Assignment, SolverMetadata, SolveRosterResponse
import time

class RosterSolver:
    def __init__(self, request: SolveRosterRequest):
        self.request = request
        self.model = cp_model.CpModel()
        self.days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        self.employees = request.employees
        self.shifts = request.shifts
        
        # Decision Variables: x[employee, day, shift] is true if employee works shift on day
        self.x = {}
        for e in self.employees:
            for d in self.days:
                for s in self.shifts:
                    self.x[e.id, d, s.id] = self.model.NewBoolVar(f'x_{e.id}_{d}_{s.id}')

    def solve(self) -> SolveRosterResponse:
        start_time = time.time()
        
        # 1. Hard Constraint: Exact Quotas
        # Every shift on every day must have exactly the required staff
        for d in self.days:
            for s in self.shifts:
                quota = next((q.requiredStaff for q in self.request.weeklyQuotas if q.dayOfWeek == d and q.shiftId == s.id), 0)
                self.model.Add(sum(self.x[e.id, d, s.id] for e in self.employees) == quota)

        # 2. Hard Constraint: Single assignment per day
        # An employee can work at most one shift per day
        for e in self.employees:
            for d in self.days:
                self.model.Add(sum(self.x[e.id, d, s.id] for s in self.shifts) <= 1)

        # 3. Hard Constraint: Protected Off-Time (Weekly Off & Unavailable)
        for c in self.request.employeeHardConstraints:
            if c.type in ['weeklyOff', 'unavailable']:
                for s in self.shifts:
                    self.model.Add(self.x[c.employeeId, c.dayOfWeek, s.id] == 0)

        # 4. Hard Constraint: Adjacency (Restricted Shifts)
        # If a day has restrictions (pre/post off), enforce the allowed set
        for c in self.request.employeeHardConstraints:
            if c.type == 'restrictedShift' and c.restrictedToShifts is not None:
                allowed = set(c.restrictedToShifts)
                for s in self.shifts:
                    if s.id not in allowed:
                        self.model.Add(self.x[c.employeeId, c.dayOfWeek, s.id] == 0)

        # 5. Soft Objective: Opening Fairness
        # Penalize assigning SO/OP shifts to those who have high historical counts
        penalties = []
        for e in self.employees:
            for d in self.days:
                # Super Opening penalty
                if (e.id, d, "SO") in self.x:
                    penalties.append(self.x[e.id, d, "SO"] * (e.historicalSO + 1))
                # Opening penalty
                if (e.id, d, "OP") in self.x:
                    penalties.append(self.x[e.id, d, "OP"] * (e.historicalOP + 1))
        
        if penalties:
            self.model.Minimize(sum(penalties))

        # Solve settings
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.request.timeLimitSeconds
        status = solver.Solve(self.model)
        
        solve_duration_ms = (time.time() - start_time) * 1000
        
        status_map = {
            cp_model.OPTIMAL: 'OPTIMAL',
            cp_model.FEASIBLE: 'FEASIBLE',
            cp_model.INFEASIBLE: 'INFEASIBLE',
            cp_model.MODEL_INVALID: 'UNKNOWN',
            cp_model.UNKNOWN: 'UNKNOWN'
        }

        assignments = []
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for e in self.employees:
                for d in self.days:
                    for s in self.shifts:
                        if solver.Value(self.x[e.id, d, s.id]):
                            assignments.append(Assignment(employeeId=e.id, dayOfWeek=d, shiftId=s.id))

        return SolveRosterResponse(
            status=status_map.get(status, 'UNKNOWN'),
            assignments=assignments,
            metadata=SolverMetadata(
                solveTimeMs=solve_duration_ms,
                status=status_map.get(status, 'UNKNOWN'),
                objectiveValue=solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None
            )
        )
