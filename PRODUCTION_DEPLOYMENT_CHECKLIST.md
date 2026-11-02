
# Production Deployment Checklist (Institutional)

## 1. Firebase Environment
- [ ] **Authorized Domains**: Add production ROC domain and Firebase preview URL to Auth whitelist.
- [ ] **Security Rules**: Deploy `firestore.rules` (v2.0 with isUserActive).
- [ ] **Indexes**: Ensure composite indexes for `audit_logs` and `published_rosters` are created in Console.

## 2. Secrets & Keys
- [ ] **WhatsApp Access Token**: Set `WHATSAPP_ACCESS_TOKEN` in Firebase App Hosting secrets.
- [ ] **Meta Phone ID**: Verify `WHATSAPP_PHONE_NUMBER_ID` matches production node.
- [ ] **Solver Auth**: Configure Shared Secret for Cloud Run service communication.
- [ ] **reCAPTCHA**: Enable Enterprise reCAPTCHA for bot-protection on OTP.

## 3. External Services
- [ ] **Meta Cloud API**: Verify Template `shift_briefing` is approved in WhatsApp Manager.
- [ ] **Cloud Run**: Deploy Python OR-Tools microservice to private VPC.
- [ ] **Cloud Scheduler**: Configure 10 PM IST cron job for automated shift briefings.

## 4. Final Verification
- [ ] **Provisioning**: Create the first SUPER_ADMIN account manually in Firebase Console.
- [ ] **Uptime Pulse**: Verify 99.9% availability of the Auth Pulse and Solver endpoints.
- [ ] **Demo Mode**: Ensure `FICTIONAL DEMO DATA` badge is active for stakeholder presentations.
