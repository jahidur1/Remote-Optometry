# ROC Workforce: Deployment Protocol

This guide outlines the mandatory infrastructure setup and security configuration required for institutional stability.

## 1. Firebase Console Pre-requisites
1.  **Storage**: Initialize the default bucket. Ensure it matches the bucket ID in `firebase.json`.
2.  **App Check**: 
    *   Navigate to **App Check** in the Firebase Console.
    *   Register your Web App.
    *   Enable **reCAPTCHA Enterprise**.
    *   Copy the **Site Key** and add it to your environment as `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`.
3.  **Authentication**: Add your production domain (e.g., `roc-workforce.web.app`) to the **Authorized Domains** list.

## 2. Meta Developer Portal Setup
1.  Verify the WhatsApp Business Phone Number: `1143569695505848`.
2.  Ensure the template `roc_two_day_roster_notification` is **ACTIVE**.
3.  Generate a **Permanent System User Token** with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.

## 3. Secret Configuration (Terminal)
Execute these commands to securely provision Meta credentials to the Cloud Functions environment:

```bash
# Set Meta Access Token (EAASX...)
firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN

# Set Phone Number ID (1143569695505848)
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID

# Set Internal Trigger Key (Match INTERNAL_TRIGGER_KEY in .env)
firebase functions:secrets:set INTERNAL_TRIGGER_KEY
```

## 4. Component Deployment
Run these commands in order to sync the institutional registry:

```bash
# 1. Deploy Security Rules & Storage Config
firebase deploy --only firestore:rules,storage

# 2. Deploy Database Indexes
firebase deploy --only firestore:indexes

# 3. Deploy Cloud Functions (Scheduler & Cleanup)
firebase deploy --only functions
```

## 5. Environment Variables (.env)
Populate your production environment (e.g., App Hosting or .env.local):

| Variable | Purpose | Value Source |
| :--- | :--- | :--- |
| `SOLVER_URL` | Cloud Run Optimization Node | GCP Cloud Run URL |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta API Endpoint | 1143569695505848 |
| `WHATSAPP_ACCESS_TOKEN` | Meta API Token | Meta Developer Portal |
| `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` | App Check Identity | Google Cloud Console |
| `INTERNAL_TRIGGER_KEY` | Pulse Authorization | Custom Random String |

## 6. Verification Trace
*   **Test Dispatch**: Use the "Dispatch WhatsApp" button in the **Master Matrix** dashboard to verify end-to-end media synthesis.
*   **Audit Logs**: Monitor the `/audit_logs` collection for `DISPATCH_OFFICE_WHATSAPP` pulses.
*   **Storage Purge**: The `storageCleanupPulse` runs hourly. No manual binary management is required.

---
**GOVERNANCE NOTE**: WhatsApp Automation is controlled by the `masterEnabled` toggle in `system_settings/whatsapp_automation`. Keep this `false` until testing is verified.
