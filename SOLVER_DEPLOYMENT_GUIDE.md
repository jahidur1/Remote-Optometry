# Solver Deployment Guide (Cloud Run)

## 1. Environment Requirements
- Python 3.11+
- `fastapi`, `uvicorn`, `ortools`, `firebase-admin`
- Google Cloud Project with Cloud Run enabled.

## 2. Secrets Configuration
- `SOLVER_AUTH_KEY`: Shared secret with NextJS.
- `FIREBASE_SERVICE_ACCOUNT`: JSON for DB access.

## 3. Dockerfile (Abbreviated)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## 4. NextJS Integration
The `generateWeeklyRoster` flow calls the Cloud Run URL using the `ai.generate` context for logging and observability.