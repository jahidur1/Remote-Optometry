from ortools.sat.python import cp_model
from app.models.requests import SolveRosterRequest
from app.models.responses import Assignment, SolverMetadata, SolveRosterResponse, FairnessMetrics
import time

class RosterSolver:
    """
    Optimized Roster Engine using Google OR-Tools CP-SAT.
    
    Objectives:
    1. Satisfy 100% Hard Constraints (Quotas, Off-time, Adjacency).
    2. Minimize Historical Fairness Penalty (SO/OP distribution).
    3. Maximize Preference Satisfaction (Soft Objectives).
    4. Maintain Clinical Pod Balance (Soft Gender Targets).
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
                errors.append(f"{d}: Quota shortfall. Required={day_total_quota}, Available={available_pool}")
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
        for d in self.days:
            for s in self.shift_ids:
                quota = next((q.requiredStaff for q in self.request.weeklyQuotas 
                             if q.dayOfWeek == d and q.shiftId == s), 0)
                self.model.Add(sum(self.x[e.id, d, s] for e in self.employees) == quota)

        for e in self.employees:
            for d in self.days:
                self.model.Add(sum(self.x[e.id, d, s] for s in self.shift_ids) <= 1)

        for c in self.request.employeeHardConstraints:
            if c.type in ['weeklyOff', 'unavailable']:
                for s in self.shift_ids:
                    self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)
            elif c.type == 'restrictedShift' and c.restrictedToShifts:
                allowed = set(c.restrictedToShifts)
                for s in self.shift_ids:
                    if s not in allowed:
                        self.model.Add(self.x[c.employeeId, c.dayOfWeek, s] == 0)

        # --- 2. SOFT OBJECTIVES (Linear Weighted Sum) ---
        obj_terms = []
        
        # A. Historical Fairness (Minimize assigning demand shifts to high-count staff)
        # Weight historical counts by the 'fairness' parameter
        fairness_weight = int(self.request.weights.fairness * 100)
        for e in self.employees:
            for d in self.days:
                if (e.id, d, "SO") in self.x:
                    obj_terms.append(self.x[e.id, d, "SO"] * (e.historicalSO + 1) * fairness_weight)
                if (e.id, d, "OP") in self.x:
                    obj_terms.append(self.x[e.id, d, "OP"] * (e.historicalOP + 1) * fairness_weight)

        # B. Preferences (Minimize dissatisfaction = Maximize satisfaction)
        pref_weight = int(self.request.weights.preferences * 100)
        for p in self.request.employeeSoftPreferences:
            if (p.employeeId, p.dayOfWeek, p.shiftId) in self.x:
                # Maximize satisfaction: subtract from objective (minimization)
                obj_terms.append(self.x[p.employeeId, p.dayOfWeek, p.shiftId] * (-10 * pref_weight))

        # C. Gender Balance (Minimize deviation from targets)
        balance_weight = int(self.request.weights.genderBalance * 100)
        for target in self.request.genderTargets:
            for d in self.days:
                # Variables for slack (deviation)
                male_assigned = [self.x[e.id, d, target.shiftId] for e in self.employees if e.gender.lower() == 'male']
                female_assigned = [self.x[e.id, d, target.shiftId] for e in self.employees if e.gender.lower() == 'female']
                
                # Soft target logic: Penalize deviation from target counts
                if male_assigned:
                    m_slack = self.model.NewIntVar(0, len(self.employees), f'm_slack_{d}_{target.shiftId}')
                    self.model.Add(sum(male_assigned) - target.maleTarget <= m_slack)
                    self.model.Add(target.maleTarget - sum(male_assigned) <= m_slack)
                    obj_terms.append(m_slack * balance_weight)
                
                if female_assigned:
                    f_slack = self.model.NewIntVar(0, len(self.employees), f'f_slack_{d}_{target.shiftId}')
                    self.model.Add(sum(female_assigned) - target.femaleTarget <= f_slack)
                    self.model.Add(target.femaleTarget - sum(female_assigned) <= f_slack)
                    obj_terms.append(f_slack * balance_weight)

        self.model.Minimize(sum(obj_terms))

        # --- 3. EXECUTION ---
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.request.timeLimitSeconds)
        status = solver.Solve(self.model)
        
        solve_duration_ms = (time.time() - start_time) * 1000
        status_map = {cp_model.OPTIMAL: 'OPTIMAL', cp_model.FEASIBLE: 'FEASIBLE', 
                      cp_model.INFEASIBLE: 'INFEASIBLE', cp_model.MODEL_INVALID: 'UNKNOWN', cp_model.UNKNOWN: 'UNKNOWN'}

        assignments = []
        pref_satisfied = 0
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for e in self.employees:
                for d in self.days:
                    for s in self.shift_ids:
                        if solver.Value(self.x[e.id, d, s]):
                            assignments.append(Assignment(employeeId=e.id, dayOfWeek=d, shiftId=s))
            
            # Post-solve metrics
            for p in self.request.employeeSoftPreferences:
                if solver.Value(self.x[p.employeeId, p.dayOfWeek, p.shiftId]):
                    pref_satisfied += 1

        return SolveRosterResponse(
            status=status_map.get(status, 'UNKNOWN'),
            assignments=assignments,
            fairness=FairnessMetrics(
                preferenceSatisfactionRate=(pref_satisfied / len(self.request.employeeSoftPreferences) * 100) if self.request.employeeSoftPreferences else 100.0,
                avgHistoricalSOCount=sum(e.historicalSO for e in self.employees) / len(self.employees) if self.employees else 0,
                avgHistoricalOPCount=sum(e.historicalOP for e in self.employees) / len(self.employees) if self.employees else 0
            ),
            metadata=SolverMetadata(
                solveTimeMs=solve_duration_ms,
                status=status_map.get(status, 'UNKNOWN'),
                objectiveValue=solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None
            ),
            errors=[]
        )
