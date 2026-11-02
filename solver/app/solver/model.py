from ortools.sat.python import cp_model
from app.models.requests import SolveRosterRequest
from app.models.responses import Assignment, SolverMetadata, SolveRosterResponse
import time

class RosterSolver:
    """
    Deterministic Roster Optimization Engine using Google OR-Tools CP-SAT.
    
    This model finds a mapping between employees and shifts for a 7-day period
    that satisfies all Hard Constraints and optimizes for Soft Objectives.
    """
    def __init__(self, request: SolveRosterRequest):
        self.request = request
        self.model = cp_model.CpModel()
        self.days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        self.employees = request.employees
        self.shifts = request.shifts
        
        # Mapping for easy lookup
        self.shift_ids = [s.id for s in self.shifts]
        
        # Decision Variables: x[employee, day, shift]
        # x = 1 if employee works shift s on day d, else 0.
        self.x = {}
        for e in self.employees:
            for d in self.days:
                for s in self.shift_ids:
                    self.x[e.id, d, s] = self.model.NewBoolVar(f'x_{e.id}_{d}_{s}')

    def solve(self) -> SolveRosterResponse:
        start_time = time.time()
        
        # --- HARD CONSTRAINTS ---

        # 1. Exact Staffing Quotas
        # Every shift on every day MUST have exactly the required headcount.
        for d in self.days:
            for s in self.shift_ids:
                quota = next((q.requiredStaff for q in self.request.weeklyQuotas 
                             if q.dayOfWeek == d and q.shiftId == s), 0)
                self.model.Add(sum(self.x[e.id, d, s] for e in self.employees) == quota)

        # 2. Single Assignment Per Day
        # An employee can work at most one shift per day.
        for e in self.employees:
            for d in self.days:
                self.model.Add(sum(self.x[e.id, d, s] for s in self.shift_ids) <= 1)

        # 3. Protected Off-Time (Weekly Off & Leaves)
        # Prevent any shift assignment on days where the employee is unavailable.
        for c in self.request.employeeHardConstraints:
            if c.type in ['weeklyOff', 'unavailable']:
                if c.dayOfWeek in self.days:
                    for s in self.shift_ids:
                        self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)

        # 4. Adjacency Eligibility (Restricted Shifts)
        # Enforce "Allowed Shifts" based on pre/post off rules.
        for c in self.request.employeeHardConstraints:
            if c.type == 'restrictedShift' and c.restrictedToShifts is not None:
                allowed = set(c.restrictedToShifts)
                for s in self.shift_ids:
                    if s not in allowed:
                        self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)

        # --- SOFT OBJECTIVES (Optimization) ---

        # 5. Opening Fairness
        # We minimize the penalty of assigning SO/OP shifts to professionals who have 
        # already worked them frequently in the past.
        penalties = []
        for e in self.employees:
            for d in self.days:
                # Penalty for Super Opening (SO)
                if (e.id, d, "SO") in self.x:
                    penalties.append(self.x[e.id, d, "SO"] * (e.historicalSO + 1))
                # Penalty for Opening (OP)
                if (e.id, d, "OP") in self.x:
                    penalties.append(self.x[e.id, d, "OP"] * (e.historicalOP + 1))
        
        if penalties:
            self.model.Minimize(sum(penalties))

        # --- EXECUTION ---
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.request.timeLimitSeconds)
        # Use parallel workers for better performance in clinical scale rosters
        solver.parameters.num_search_workers = 8
        
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
                    for s in self.shift_ids:
                        if solver.Value(self.x[e.id, d, s]):
                            assignments.append(Assignment(employeeId=e.id, dayOfWeek=d, shiftId=s))

        return SolveRosterResponse(
            status=status_map.get(status, 'UNKNOWN'),
            assignments=assignments,
            metadata=SolverMetadata(
                solveTimeMs=solve_duration_ms,
                status=status_map.get(status, 'UNKNOWN'),
                objectiveValue=solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None,
                workerName="OR-Tools-CP-SAT-Engine-v1"
            )
        )
