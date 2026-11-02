# ROC Workforce Solver Service

Deterministic roster optimization engine powered by Google OR-Tools CP-SAT and FastAPI.

## Key Features
- **Hard Constraints**: Atomic quotas, off-time protection, and adjacency rules.
- **Soft Objectives**: Historical shift fairness (SO/OP distribution).
- **FastAPI Core**: Async-ready API with Pydantic validation.

## Local Development

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run service:
   ```bash
   uvicorn app.main:app --reload
   ```

3. Health Check:
   ```bash
   curl http://localhost:8000/health
   ```

## Production Deployment
The service is containerized via Docker and ready for Google Cloud Run.
