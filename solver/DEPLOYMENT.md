# ROC Workforce Solver: Manual Deployment Protocol

This node is architected for **Google Cloud Run**. Follow these steps to provision the deterministic optimization engine.

## 1. Prerequisites
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed.
- Active GCP Project with Billing enabled.

## 2. Infrastructure Setup
Execute from your local machine:

```bash
# 1. Login and select project
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]

# 2. Enable Required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 3. Deployment Command (Standard)
Run this command from within the `solver/` directory:

```bash
gcloud run deploy roc-workforce-solver \
  --source . \
  --platform managed \
  --region asia-south1 \
  --memory 2Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --no-allow-unauthenticated \
  --timeout 300
```

## 4. Post-Deployment (Secure Link)
1. After deployment, `gcloud` will return a **Service URL** (e.g., `https://roc-solver-xyz-as.a.run.app`).
2. Add this URL to your Next.js project as an environment variable: `SOLVER_URL`.
3. In the Cloud Console, ensure the Service Account running your Next.js backend has the **Cloud Run Invoker** role for this specific solver service.

## 5. Security Note
This service is deployed with `--no-allow-unauthenticated`. 
It strictly requires **Google IAM OIDC Identity Tokens** for invocation. This ensures that only your authorized Next.js backend can trigger the mathematical solver.
