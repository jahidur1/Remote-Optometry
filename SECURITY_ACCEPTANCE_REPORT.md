
# Security Acceptance Report

## 1. Zero-Trust Verification
The system has moved from client-side trust to server-enforced integrity.
- **Identity**: Identity is established ONLY after OTP verification via the `phone_number` claim.
- **Data Access**: Firestore rules perform a cross-collection join to `users/{uid}` to verify `status == 'Active'`.

## 2. Session Integrity
- **365-Day Policy**: Rules enforce `deadlineAt == request.time + 365d`.
- **Revocation**: Tested. Revoking a session in the Admin panel triggers immediate UI and Database lockout.
- **Field Lockdown**: Sensitive fields (`role`, `employeeId`) are immutable for non-admin users.

## 3. Privacy Compliance
- **PII Protection**: Directory lists are restricted to Admins. Individual reads require ownership.
- **Log Masking**: Recipient phone numbers in `whatsapp_logs` are masked for display.

**Status**: **PASS (Institutional Grade)**
