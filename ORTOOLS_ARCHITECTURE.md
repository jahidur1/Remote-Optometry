# OR-Tools CP-SAT Architecture: ROC Workforce

## 1. Mathematical Model
The scheduler leverages `ortools.sat.python.cp_model` to solve a constraint satisfaction problem.

### Variables
- `x[e, d, s]`: Boolean variable, 1 if employee `e` works shift `s` on day `d`.

### Hard Constraints (Non-Negotiable)
1. **Exact Quota Satisfaction**: 
   `sum(x[e, d, s] for e in Employees) == quotas[d][s]` for all days `d` and shifts `s`.
2. **One Shift Per Day**: 
   `sum(x[e, d, s] for s in Shifts) <= 1` for all employees `e` on day `d`.
3. **Protected Unavailability**: 
   `x[e, d, s] == 0` if employee `e` is OFF or on LEAVE on day `d`.
4. **Adjacency Eligibility**: 
   If `s` is not in `allowed_shifts[e][d]`, then `x[e, d, s] == 0`.

### Soft Objectives (Optimized)
- **Maximize Preferences**: Reward the solver for matching `x[e, d, s]` with `preference[e][d][s]`.
- **Gender Balance**: Penalize deviations from target diversity bands.
- **Fairness**: Distribute 'Super Opening' and 'Super Closing' shifts evenly over time.

## 2. Service Implementation (Python)
```python
from ortools.sat.python import cp_model

def solve(input_data):
    model = cp_model.CpModel()
    # ... logic implementation ...
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.Solve(model)
    return status, assignments
```

## 3. Deployment
- **Platform**: Google Cloud Run (Private).
- **Security**: Service-to-Service authentication via Bearer Token.
- **Data Access**: Firebase Admin SDK (Read-only for solving).
