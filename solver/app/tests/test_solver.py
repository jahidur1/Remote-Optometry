import pytest
from app.models.requests import SolveRosterRequest, Shift, Employee, DailyQuota, EmployeeConstraint, EmployeePreference, GenderTarget
from app.solver.model import RosterSolver

def test_solver_satisfies_preferences_optimally():
    """Prove that solver prioritizes shift preferences when feasible."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="KOLKATA_ROC",
        shifts=[Shift(id="SO", name="Super Opening"), Shift(id="C1", name="Closing")],
        employees=[Employee(id="EMP1", gender="male")],
        weeklyQuotas=[DailyQuota(dayOfWeek="Monday", shiftId="SO", requiredStaff=1)],
        employeeHardConstraints=[],
        employeeSoftPreferences=[
            EmployeePreference(employeeId="EMP1", dayOfWeek="Monday", shiftId="SO")
        ]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status == 'OPTIMAL'
    assert result.assignments[0].shiftId == "SO"
    assert result.fairness.preferenceSatisfactionRate == 100.0

def test_solver_fairness_distribution():
    """Prove that solver avoids assigning SO to an employee with high historical SO count."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="GURGAON_ROC",
        shifts=[Shift(id="SO", name="Super Opening")],
        employees=[
            Employee(id="EMP_FRESH", gender="female", historicalSO=0),
            Employee(id="EMP_VETERAN", gender="male", historicalSO=100)
        ],
        weeklyQuotas=[DailyQuota(dayOfWeek="Tuesday", shiftId="SO", requiredStaff=1)],
        employeeHardConstraints=[]
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    # Fresh employee should get the SO shift due to fairness penalty on veteran
    assignment = next(a for a in result.assignments if a.dayOfWeek == "Tuesday")
    assert assignment.employeeId == "EMP_FRESH"

def test_gender_balance_soft_targets():
    """Prove that gender targets are respected when possible but don't cause infeasibility."""
    request = SolveRosterRequest(
        weekId="2024-52",
        officeId="LUCKNOW_ROC",
        shifts=[Shift(id="SO", name="Super Opening")],
        employees=[
            Employee(id="M1", gender="male"),
            Employee(id="F1", gender="female")
        ],
        weeklyQuotas=[DailyQuota(dayOfWeek="Wednesday", shiftId="SO", requiredStaff=1)],
        employeeHardConstraints=[],
        genderTargets=[GenderTarget(shiftId="SO", femaleTarget=1)] # Soft request for a female
    )
    
    solver = RosterSolver(request)
    result = solver.solve()
    
    assert result.status == 'OPTIMAL'
    assert result.assignments[0].employeeId == "F1"
