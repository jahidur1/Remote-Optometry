# Solver Constraints & Objectives Matrix

## 1. Hard Constraints (Unbreakable)
1. **Clinical Coverage**: Every operational shift must have exactly the requested professional count.
2. **Duty Hours**: Minimum 10 hours rest between shifts (implied by timing patterns).
3. **Identity Protection**: Super Opening (SO) and Super Closing (SC) cannot overlap.
4. **Fairness Adjacency**: If restricted to "Opening only" after a day off, Mid/Closing shifts are mathematically excluded.

## 2. Soft Objectives (Optimized)
1. **Employee Preference (Weight: 0.5)**: System attempts to award requested shifts.
2. **Gender Proximity (Weight: 0.7)**: Aiming for target bands (e.g., 2 Women on Closing).
3. **Opening Cycle (Weight: 0.3)**: Prioritize employees who didn't work Opening last week.
4. **Weekend Balance (Weight: 0.4)**: Distribute Saturday/Sunday duties evenly.

## 3. Feasibility Thresholds
- **Infeasible**: Availability < Quota. System blocks generation.
- **Feasible**: Constraints met, objectives partially met.
- **Optimal**: All constraints met, maximum objective score reached.