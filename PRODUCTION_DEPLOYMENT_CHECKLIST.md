
# Production Deployment Checklist (Institutional)

## 1. Firebase Environment
- [ ] **Authorized Domains**: Add production ROC domain to Firebase Auth whitelist.
- [ ] **Security Rules**: Deploy `firestore.rules` (v2.0 with isUserActive).
- [ ] **Indexes**: Ensure composite indexes for `audit_logs` and `published_rosters` are created.

## 2. Secrets & Keys
- [ ] **WhatsApp Access Token**: Set `WHATSAPP_ACCESS_TOKEN` in App Hosting secrets.
- [ ] **Solver Auth**: Configure Shared Secret for Cloud Run service.
- [ ] **reCAPTCHA**: Enable Enterprise reCAPTCHA for OTP protection.

## 3. External Services
- [ ] **Meta Cloud API**: Verify Template `shift_briefing` is approved in WhatsApp Manager.
- [ ] **Cloud Run**: Deploy Python OR-Tools microservice to private VPC.
- [ ] **Cloud Scheduler**: Configure 10 PM IST cron job for notifications.

## 4. Final Verification
- [ ] **Provisioning**: Create the first SUPER_ADMIN account manually in Firebase Console.
- [ ] **Uptime**: Verify 99.9% availability of the Auth Pulse.
