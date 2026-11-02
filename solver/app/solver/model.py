from ortools.sat.python import cp_model
from app.models.requests import SolveRosterRequest
from app.models.responses import Assignment, SolverMetadata, SolveRosterResponse
import time

class RosterSolver:
    """
    Deterministic Roster Optimization Engine using Google OR-Tools CP-SAT.
    
    Integrated Business Rules:
    1. Exact Quotas: No flexibility in headcount.
    2. Weekly-Off: Absolute protection of FCFS bookings.
    3. Adjacency: Enforced pre/post-off shift restrictions.
    4. Leave: Zero assignment during unavailability.
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
        """Identifies immediate mathematical impossibilities before solving."""
        errors = []
        for d in self.days:
            day_total_quota = sum(q.requiredStaff for q in self.request.weeklyQuotas if q.dayOfWeek == d)
            
            # Count unavailable emps (Weekly Off + Leave)
            unavailable_count = len({
                c.employeeId for c in self.request.employeeHardConstraints 
                if c.dayOfWeek == d and c.type in ['weeklyOff', 'unavailable']
            })
            
            available_pool = len(self.employees) - unavailable_count
            
            if day_total_quota > available_pool:
                errors.append(f"{d}: Quota surplus. Required={day_total_quota}, Available={available_pool} for office {self.request.officeId}")
        
        return errors

    def solve(self) -> SolveRosterResponse:
        start_time = time.time()
        
        # 0. Pre-Feasibility Check
        pre_errors = self.perform_pre_check()
        if pre_errors:
            return SolveRosterResponse(
                status='INFEASIBLE',
                assignments=[],
                metadata=SolverMetadata(solveTimeMs=0, status='INFEASIBLE'),
                errors=pre_errors
            )

        # --- HARD CONSTRAINTS ---

        # 1. Exact Staffing Quotas (Mandatory per Audit)
        for d in self.days:
            for s in self.shift_ids:
                quota = next((q.requiredStaff for q in self.request.weeklyQuotas 
                             if q.dayOfWeek == d and q.shiftId == s), 0)
                self.model.Add(sum(self.x[e.id, d, s] for e in self.employees) == quota)

        # 2. Single Assignment Per Day
        for e in self.employees:
            for d in self.days:
                self.model.Add(sum(self.x[e.id, d, s] for s in self.shift_ids) <= 1)

        # 3. Protected Off-Time (Weekly Off & Leaves)
        for c in self.request.employeeHardConstraints:
            if c.type in ['weeklyOff', 'unavailable']:
                if c.dayOfWeek in self.days:
                    for s in self.shift_ids:
                        self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)

        # 4. Adjacency Eligibility (Shift Restrictions)
        for c in self.request.employeeHardConstraints:
            if c.type == 'restrictedShift' and c.restrictedToShifts is not None:
                if c.dayOfWeek in self.days:
                    allowed = set(c.restrictedToShifts)
                    for s in self.shift_ids:
                        if s not in allowed:
                            self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)

        # --- SOFT OBJECTIVES ---

        # 5. Opening Fairness (SO/OP Penalties)
        penalties = []
        for e in self.employees:
            for d in self.days:
                if (e.id, d, "SO") in self.x:
                    penalties.append(self.x[e.id, d, "SO"] * (e.historicalSO + 1))
                if (e.id, d, "OP") in self.x:
                    penalties.append(self.x[e.id, d, "OP"] * (e.historicalOP + 1))
        
        if penalties:
            self.model.Minimize(sum(penalties))

        # --- EXECUTION ---
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.request.timeLimitSeconds)
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
                workerName="ROC-CP-SAT-Engine-v2"
            ),
            errors=pre_errors if status == cp_model.INFEASIBLE else []
        )
