
# ROC Workforce: Deployment Protocol

This guide outlines the mandatory environment configuration and infrastructure setup required for production stability.

## 1. Environment Variables
Add these to your production environment (GCP Cloud Run, App Hosting, or .env.production).

| Variable | Purpose | Value/Source |
| :--- | :--- | :--- |
| `SOLVER_URL` | Cloud Run Solver Endpoint | `https://roc-workforce-solver-...run.app` |
| `ENABLE_IAM_AUTH` | Secure service-to-service auth | `true` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Cloud API | From Meta Developer Portal |
| `WHATSAPP_ACCESS_TOKEN` | Meta System User Token | Permanent Token recommended |
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Client SDK Config | JSON string from Firebase Console |

## 2. Firebase Infrastructure
1.  **Storage**: Enable Firebase Storage for Logo and Profile asset persistence.
2.  **App Check**: Register your site with Firebase App Check (reCAPTCHA Enterprise) to protect Cloud Functions and Firestore from bots.
3.  **Authentication**: Authorized domains must include `roc-workforce.app` and your Cloud Run domains.

## 3. Manual Firestore Indexes
Deploy indexes using:
```bash
firebase deploy --only firestore:indexes
```
Or manually configure in the console using the paths defined in `firestore.indexes.json`.

## 4. WhatsApp Template
Ensure the `shift_briefing` template is approved in your WhatsApp Manager:
- **Name**: `shift_briefing`
- **Category**: `UTILITY`
- **Body**: `Hi {{1}}, your shift for {{2}} is {{3}} ({{4}}). Login to the portal for details.`
