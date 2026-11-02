# ROC Workforce: OR-Tools CP-SAT Integration Audit

**Date:** October 2023  
**Role:** Senior Software Architect / Optimization Engineer  
**Status:** READ-ONLY Architectural Review

## 1. Existing Architecture Overview
The current system is a robust Next.js 15 application utilizing Firebase for Authentication and Firestore for state. 

### Core Components:
- **Identity**: Firebase Auth (Phone OTP) + `employees` collection.
- **Operations**: `weekoff_configs` and `weekoff_bookings` handle atomic FCFS reservations.
- **Constraints**: `roster_quotas` (Exact headcount) and `shift_adjacency_rules` (Pre/Post off restrictions).
- **Current Solver**: `src/ai/flows/generate-weekly-roster.ts` (Genkit/LLM Simulation).

## 2. Identified Roster Workflow
The administrative lifecycle for a roster cycle is:
1. **Initialize**: Quotas are set in `admin/quotas`.
2. **Reservation**: Employees secure weekly-offs via `employee/book-off`.
3. **Adjacency**: Admins set restricted shifts in `admin/adjacency`.
4. **Trigger**: `admin/roster` calls `generateWeeklyRoster` (Genkit).
5. **Review**: `admin/roster/review/[draftId]` allows manual tweaks.
6. **Deploy**: Final roster is saved to `published_rosters`.

## 3. Mock/Demo Detection
The "Solver" in the current codebase is **MOCKED** via an AI prompt.
- **File**: `src/ai/flows/generate-weekly-roster.ts`
- **Mechanism**: LLM instructions simulating CP-SAT logic.
- **Risk**: Inconsistent results, no guarantee of feasibility, non-deterministic.

## 4. Proposed Data Contract (Next.js -> Python)
To integrate the real solver, we will transition to a JSON payload containing:

### Input Schema:
```json
{
  "week_id": "2024-52",
  "office_id": "KOLKATA_ROC",
  "shifts": [
    {"id": "SO", "start": "09:30", "end": "18:30"},
    {"id": "OP", "start": "10:00", "end": "19:00"},
    {"id": "MD", "start": "11:00", "end": "20:00"},
    {"id": "C1", "start": "12:00", "end": "21:00"},
    {"id": "C2", "start": "12:30", "end": "21:30"},
    {"id": "SC", "start": "13:00", "end": "22:00"}
  ],
  "employees": [
    {"id": "EMP1", "gender": "male", "hist_so": 5, "hist_op": 2}
  ],
  "daily_quotas": {
    "Monday": {"SO": 2, "OP": 3, "MD": 2, "C1": 1, "C2": 1, "SC": 1}
  },
  "constraints": {
    "weekly_off": [{"emp_id": "EMP1", "day": "Tuesday"}],
    "unavailability": [{"emp_id": "EMP1", "day": "Wednesday"}],
    "adjacency": [{"emp_id": "EMP1", "day": "Monday", "allowed": ["MD", "C1"]}]
  },
  "objectives": {
    "fairness_weight": 0.8,
    "gender_balance_weight": 0.5
  }
}
```

## 5. Business Rules to Preserve
- **Atomic Quotas**: Every shift must have exactly the required staff.
- **Single Assignment**: Max one shift per day per professional.
- **FCFS Protection**: No shift assigned on a confirmed weekly-off.
- **Bilateral Distinction**: C1 (Closing) and C2 (Closing 2) must be treated as independent variables.

## 6. Security & Risks
- **Authentication**: The Python API on Cloud Run must be private. Use Google IAM (OIDC tokens) or a shared secret header verified in FastAPI.
- **PII**: Only IDs and Gender should be sent to the solver. No names or phone numbers.
- **Timeouts**: OR-Tools may take >30s for complex rosters. Need asynchronous polling or high timeout configuration (Cloud Run supports up to 60 min).

## 7. Implementation Sequence
1. **Phase 1**: Setup `solver/` directory with `main.py` (FastAPI) and `model.py` (CP-SAT).
2. **Phase 2**: Define the CP-SAT variables: `x[employee, day, shift]`.
3. **Phase 3**: Implement Hard Constraints (Quotas, Off-days, Adjacency).
4. **Phase 4**: Implement Soft Objectives (Historical fairness for SO/OP).
5. **Phase 5**: Refactor `src/ai/flows/generate-weekly-roster.ts` to call the Python API instead of Gemini.

## 8. Verification Status
- **Verified**: Firestore schema, FCFS logic, Adjacency UI, Quota management.
- **Missing**: Python environment, OR-Tools model, Cloud Run service account.
- **Mocked**: Deterministic mathematical optimization.
- **Unknown**: Actual solving latency for cluster sizes > 200 professionals.

---
**Audit Certified by:** Senior Optimization Engineer