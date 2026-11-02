import pytest
from app.models.requests import SolveRosterRequest, Shift, Employee, DailyQuota, EmployeeConstraint
from app.solver.model import RosterSolver

def test_solver_enforces_adjacency_rules():
    """Prove that restrictedShift constraints are honored (Pre/Post Off fairness)."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="KOLKATA_ROC",
        shifts=[
            Shift(id="SO", name="Super Opening"),
            Shift(id="C1", name="Closing")
        ],
        employees=[Employee(id="EMP1", gender="male")],
        weeklyQuotas=[
            DailyQuota(dayOfWeek="Monday", shiftId="C1", requiredStaff=1)
        ],
        employeeHardConstraints=[
            # Adjacency rule: professional can ONLY work SO on Monday
            EmployeeConstraint(
                employeeId="EMP1", 
                type="restrictedShift", 
                dayOfWeek="Monday", 
                restrictedToShifts=["SO"]
            )
        ]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    # Result should be INFEASIBLE because quota requires C1 but adjacency allows ONLY SO
    assert result.status == 'INFEASIBLE'

def test_solver_protects_confirmed_off_days():
    """Prove that confirmed FCFS weekly-offs are 100% protected."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="GURGAON_ROC",
        shifts=[Shift(id="OP", name="Opening")],
        employees=[Employee(id="EMP1", gender="female")],
        weeklyQuotas=[
            DailyQuota(dayOfWeek="Tuesday", shiftId="OP", requiredStaff=1)
        ],
        employeeHardConstraints=[
            EmployeeConstraint(employeeId="EMP1", type="weeklyOff", dayOfWeek="Tuesday")
        ]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    # INFEASIBLE: Required 1 OP staff, but the only employee is off
    assert result.status == 'INFEASIBLE'

def test_solver_enforces_exact_quota_match():
    """Prove that headcount must match exactly (No surplus or shortfall)."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="LUCKNOW_ROC",
        shifts=[Shift(id="MD", name="Mid Shift")],
        employees=[
            Employee(id="EMP1", gender="male"),
            Employee(id="EMP2", gender="female")
        ],
        weeklyQuotas=[
            # Quota requires 2 staff, both employees available
            DailyQuota(dayOfWeek="Wednesday", shiftId="MD", requiredStaff=2)
        ],
        employeeHardConstraints=[]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status in ['OPTIMAL', 'FEASIBLE']
    assert len(result.assignments) == 2
