# Solver Constraints & Objectives Matrix

## 1. Hard Constraints (Mandatory)
These must be satisfied 100% or the solver returns `INFEASIBLE`.

| Constraint | Description |
| :--- | :--- |
| **Exact Quotas** | Every shift must have exactly the count of staff requested by Admin. |
| **No Overlap** | Max 1 shift per employee per day. |
| **Off Protection** | Zero assignments on Confirmed Weekly-Off days. |
| **Leave Protection** | Zero assignments on Approved Leave/Training dates. |
| **Adjacency** | Restricted shift types (SO/OP) based on proximity to Off-days. |

## 2. Soft Objectives (Optimized)
Weighted goals that the solver attempts to reach without breaking Hard Constraints.

| Objective | Weight | Logic |
| :--- | :--- | :--- |
| **Employee Preference** | 0.5 | Honor 'Preferred Shift' requests. |
| **Gender Balance** | 0.8 | Aim for diversity bands (e.g., "2-3 women"). |
| **Opening Fairness** | 0.3 | Avoid back-to-back Opening shifts for the same person. |
| **Closing Fairness** | 0.3 | Avoid back-to-back Super Closing shifts. |

## 3. Feasibility Logic
The NextJS frontend performs a **Pre-Feasibility Check**:
- If `Sum(Quotas) != (ActivePool - Absences)`, the "Run Solver" button is blocked.
- This ensures the CP-SAT engine never attempts a mathematically impossible task.
