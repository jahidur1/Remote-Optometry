# ROC Workforce: Deployment Protocol

This guide outlines the mandatory environment configuration and infrastructure setup required for production stability.

## 1. Environment Variables (.env)
Populate your environment using `.env.example` as a template.

| Variable | Purpose | Value/Source |
| :--- | :--- | :--- |
| `SOLVER_URL` | Cloud Run Solver Endpoint | `https://roc-workforce-solver-...run.app` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Cloud API | From Meta Developer Portal (`1143569695505848`) |
| `WHATSAPP_ACCESS_TOKEN` | Meta API Token | Permanent System User Token |
| `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` | App Check Security | From Google Cloud Console |

## 2. Firebase Infrastructure Setup
1. **Storage**: Navigate to the Firebase Console -> Storage. Click **Get Started**. Ensure the bucket `studio-9087637488-aa952.firebasestorage.app` is initialized.
2. **App Check**: 
   - Enable **reCAPTCHA Enterprise** in the Google Cloud Console.
   - Register your Web App in the Firebase Console under App Check.
   - Enforcement should only be enabled *after* initial production traffic is verified.
3. **Authentication**: Authorized domains must include `roc-workforce.app` and your Firebase App Hosting domains.

## 3. Secret Configuration (CLI)
Execute these commands to provision secrets for Cloud Functions:
```bash
firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
```

## 4. Manual Component Deployment
Run these commands in order:
```bash
# 1. Deploy Firestore Indexes
firebase deploy --only firestore:indexes

# 2. Deploy Security Rules
firebase deploy --only firestore:rules,storage

# 3. Deploy Scheduler & Briefing Pulse
firebase deploy --only functions
```

## 5. WhatsApp Template Verification
Ensure the `roc_two_day_roster_notification` template is **ACTIVE** in your WhatsApp Manager:
- **Name**: `roc_two_day_roster_notification`
- **Category**: `UTILITY`
- **Language**: `en_US`
- **Header**: Image (Variable)
- **Body**: `Hello {{1}}, your upcoming ROC work schedule is ready. Please check the attached roster image for your assigned shifts for the next two days.`

## 6. Monitoring & Troubleshooting
- **Audit Logs**: Check the `/audit_logs` collection in Firestore for `AUTH_OTP_REQUEST` and `DISPATCH_OFFICE_WHATSAPP` pulses.
- **WhatsApp Logs**: Check `/whatsapp_logs` for `failureReason` if messages are not delivered.
- **Storage Hygiene**: The `storageCleanupPulse` runs hourly. No manual deletion of roster images is required.
