import pytest
from app.models.requests import SolveRosterRequest, Shift, Employee, DailyQuota, EmployeeConstraint
from app.solver.model import RosterSolver

def test_solver_basic_feasibility():
    """Verify that a basic feasible request returns OPTIMAL."""
    request = SolveRosterRequest(
        weekId="2024-52",
        shifts=[
            Shift(id="SO", name="Super Opening"),
            Shift(id="C1", name="Closing")
        ],
        employees=[
            Employee(id="EMP1", gender="male"),
            Employee(id="EMP2", gender="female")
        ],
        weeklyQuotas=[
            DailyQuota(dayOfWeek="Monday", shiftId="SO", requiredStaff=1),
            DailyQuota(dayOfWeek="Monday", shiftId="C1", requiredStaff=1),
            # Set 0 for other days to keep test simple
            *[DailyQuota(dayOfWeek=d, shiftId=s, requiredStaff=0) 
              for d in ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] 
              for s in ["SO", "C1"]]
        ],
        employeeHardConstraints=[]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status in ['OPTIMAL', 'FEASIBLE']
    assert len(result.assignments) == 2
    # Ensure both employees are assigned
    assigned_emps = {a.employeeId for a in result.assignments}
    assert "EMP1" in assigned_emps
    assert "EMP2" in assigned_emps

def test_solver_infeasibility_quota_exceeds_pool():
    """Verify that requesting more staff than available returns INFEASIBLE."""
    request = SolveRosterRequest(
        weekId="2024-52",
        shifts=[Shift(id="SO", name="SO")],
        employees=[Employee(id="EMP1", gender="male")],
        weeklyQuotas=[
            DailyQuota(dayOfWeek="Monday", shiftId="SO", requiredStaff=5) # Only 1 emp available
        ],
        employeeHardConstraints=[]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status == 'INFEASIBLE'

def test_solver_respects_weekly_off():
    """Verify that an employee is never assigned a shift on their Weekly Off."""
    request = SolveRosterRequest(
        weekId="2024-52",
        shifts=[Shift(id="SO", name="SO")],
        employees=[Employee(id="EMP1", gender="male")],
        weeklyQuotas=[
            DailyQuota(dayOfWeek="Monday", shiftId="SO", requiredStaff=1)
        ],
        employeeHardConstraints=[
            EmployeeConstraint(employeeId="EMP1", type="weeklyOff", dayOfWeek="Monday")
        ]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    # Should be infeasible because the only employee is off
    assert result.status == 'INFEASIBLE'
    assert len(result.assignments) == 0

def test_solver_bilateral_shift_distinction():
    """Verify that C1 and C2 are treated as distinct assignments."""
    request = SolveRosterRequest(
        weekId="2024-52",
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

def test_solver_respects_adjacency_restrictions():
    """Verify that restrictedShift constraints are honored."""
    request = SolveRosterRequest(
        weekId="2024-52",
        shifts=[
            Shift(id="SO", name="SO"),
            Shift(id="C1", name="C1")
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
