# ROC Workforce Solver: Cloud Run Deployment

This document provides the institutional roadmap for deploying the deterministic roster optimization engine.

## 1. Cloud Infrastructure Requirements

Before deployment, ensure the following Google Cloud APIs are enabled:
- `run.googleapis.com` (Cloud Run)
- `artifactregistry.googleapis.com` (Container Registry)
- `cloudbuild.googleapis.com` (Build Pipeline)

## 2. Identity & Access Management (IAM)

To maintain a Zero-Trust environment, the following service accounts are required:

### A. Runtime Service Account (`roc-solver-runner`)
- **Purpose**: The identity used by the Python service while running.
- **Roles**: `roles/logging.logWriter` (Standard logging).

### B. Invoking Service Account (`roc-app-invoker`)
- **Purpose**: Used by the Next.js backend to call the private solver.
- **Roles**: `roles/run.invoker` on the specific solver service.

## 3. Deployment Command

Execute the following from the `solver/` directory:

```bash
# 1. Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/roc-workforce-solver

# 2. Deploy to Cloud Run (Private Node)
gcloud run deploy roc-workforce-solver \
  --image gcr.io/YOUR_PROJECT_ID/roc-workforce-solver \
  --platform managed \
  --region asia-south1 \
  --memory 2Gi \
  --cpu 1 \
  --max-instances 2 \
  --no-allow-unauthenticated \
  --timeout 300 \
  --service-account roc-solver-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 4. Cost Considerations

- **Scale-to-Zero**: The service is configured with `min-instances 0`. You pay only when a roster is being generated.
- **Memory Footprint**: 2GiB is allocated to allow OR-Tools to explore complex conflict trees.
- **Estimated Cost**: For 50 solve requests per month (approx 1 minute each), the cost will likely fall within the **Google Cloud Free Tier**.

## 5. Limitations

- **State Persistence**: The current asynchronous job tracker is in-memory. If Cloud Run scales to multiple instances, job polling may fail. 
- **Production Recommendation**: Integrate Cloud Firestore for `jobs` collection if scaling beyond `max-instances 1`.
