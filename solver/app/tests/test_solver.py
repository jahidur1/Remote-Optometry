import pytest
from app.models.requests import SolveRosterRequest, Shift, Employee, DailyQuota, EmployeeConstraint
from app.solver.model import RosterSolver

def test_solver_respects_adjacency_restrictions():
    """Verify that restrictedShift constraints are honored (Pre/Post Off rules)."""
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
            # Employee can ONLY work SO, but the quota requires C1
            EmployeeConstraint(employeeId="EMP1", type="restrictedShift", dayOfWeek="Monday", restrictedToShifts=["SO"])
        ]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status == 'INFEASIBLE'

def test_solver_pre_check_failure():
    """Verify that the pre-solve check identifies quota surpluses immediately."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="GURGAON_ROC",
        shifts=[Shift(id="SO", name="SO")],
        employees=[Employee(id="EMP1", gender="male")],
        weeklyQuotas=[
            DailyQuota(dayOfWeek="Monday", shiftId="SO", requiredStaff=10) # 10 needed, 1 available
        ],
        employeeHardConstraints=[]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status == 'INFEASIBLE'
    assert any("Quota surplus" in e for e in result.errors)

def test_solver_bilateral_shift_distinction():
    """Verify that C1 and C2 are treated as distinct assignments."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="LUCKNOW_ROC",
        shifts=[
            Shift(id="C1", name="Closing"),
            Shift(id="C2", name="Closing 2")
        ],
        employees=[
            Employee(id="EMP1", gender="male"),
            Employee(id="EMP2", gender="female")
        ],
        weeklyQuotas=[
            DailyQuota(dayOfWeek="Monday", shiftId="C1", requiredStaff=1),
            DailyQuota(dayOfWeek="Monday", shiftId="C2", requiredStaff=1)
        ],
        employeeHardConstraints=[]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status in ['OPTIMAL', 'FEASIBLE']
    shifts_assigned = {a.shiftId for a in result.assignments}
    assert "C1" in shifts_assigned
    assert "C2" in shifts_assigned
