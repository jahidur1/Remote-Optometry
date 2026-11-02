# 09 OR-Tools Solver Audit

### Implementation Status: **SIMULATED (AI)**

### Findings:
- The "Solver" is currently an AI Flow (`src/ai/flows/generate-weekly-roster.ts`).
- It uses Gemini 2.5 Flash to process constraints and assignments.
- **Risks**: At scales > 150 employees, LLMs may fail to maintain 100% mathematical consistency for hard constraints.
- **Recommendation**: For production clusters, implement a Python service using `ortools.sat.python.cp_model` and call it via a Genkit Tool or API endpoint.
