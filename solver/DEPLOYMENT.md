# ROC Workforce Solver: Cloud Run Roadmap

This document provides the institutional roadmap for deploying the deterministic roster optimization engine.

## 1. Cloud Infrastructure Requirements

Before deployment, ensure the following Google Cloud APIs are enabled in your project:
- `run.googleapis.com` (Cloud Run)
- `artifactregistry.googleapis.com` (Container Registry)
- `cloudbuild.googleapis.com` (Build Pipeline)

## 2. Identity & Access Management (IAM)

To maintain a Zero-Trust environment, the following service accounts are recommended:

### A. Runtime Service Account (`roc-solver-runner`)
- **Purpose**: The identity used by the Python service while running.
- **Roles**: `roles/logging.logWriter` (Standard logging).

### B. Invoking Service Account (`roc-app-invoker`)
- **Purpose**: Used by the Next.js backend to call the private solver.
- **Roles**: `roles/run.invoker` on the specific solver service.

## 3. Deployment Commands

Execute the following from the `solver/` directory:

```bash
# 1. Create Artifact Registry (One-time)
gcloud artifacts repositories create roc-workforce \
  --repository-format=docker \
  --location=asia-south1 \
  --description="ROC Optimization Node"

# 2. Build and push to Artifact Registry
gcloud builds submit --tag asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/roc-workforce/solver

# 3. Deploy to Cloud Run (Private Node)
gcloud run deploy roc-workforce-solver \
  --image asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/roc-workforce/solver \
  --platform managed \
  --region asia-south1 \
  --memory 2Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --no-allow-unauthenticated \
  --timeout 300 \
  --service-account roc-solver-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 4. Cost Considerations (Institutional Estimates)

| Component | Setting | Cost Impact |
| :--- | :--- | :--- |
| **CPU/RAM** | 1 vCPU / 2GiB | Only billed during active requests. |
| **Scaling** | min: 0 | Service costs $0.00 when not in use. |
| **Free Tier** | 180k vCPU-seconds | ~50 rosters per month will likely fit in the **Free Tier**. |
| **Artifacts** | 0.5 GB Storage | Minimal (~$0.10 / month). |

## 5. Architectural Limitations

- **Job State**: Job status is currently in-memory. If Cloud Run scales to multiple instances, polling may fail if the request hits a different instance.
- **Production Recommendation**: For clusters with >1000 staff, modify `jobs` state to use Cloud Firestore.
