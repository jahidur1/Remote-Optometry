# OR-Tools Architecture: ROC Workforce

## 1. Solver Service Design
The scheduler is a Python FastAPI service leveraging `ortools.sat.python.cp_model` for constraint programming.

## 2. Core Logic (CP-SAT Implementation)
```python
from ortools.sat.python import cp_model

def solve_roster(num_employees, num_shifts, quotas, hard_constraints):
    model = cp_model.CpModel()
    
    # Variables: x[e, d, s] is 1 if employee e works shift s on day d
    x = {}
    for e in range(num_employees):
        for d in range(7):
            for s in range(num_shifts):
                x[e, d, s] = model.NewBoolVar(f'shift_e{e}_d{d}_s{s}')

    # Hard Constraint 1: Exact Staffing Quotas
    for d in range(7):
        for s in range(num_shifts):
            model.Add(sum(x[e, d, s] for e in range(num_employees)) == quotas[d][s])

    # Hard Constraint 2: One shift per day
    for e in range(num_employees):
        for d in range(7):
            model.Add(sum(x[e, d, s] for s in range(num_shifts)) <= 1)

    # Hard Constraint 3: Protected Weekly Offs / Leave
    for (e, d) in hard_constraints['unavailable']:
        model.Add(sum(x[e, d, s] for s in range(num_shifts)) == 0)

    # Solver
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    
    return status, x
```

## 3. Private Cloud Run Deployment
- **Security**: The solver endpoint is internal-only, accessible via Service-to-Service authentication using Firebase ID tokens.
- **Performance**: 2GB RAM / 1 vCPU instances for 1,000-user clusters.
- **Idempotency**: Draft generation generates a unique `draftId` to prevent collision.