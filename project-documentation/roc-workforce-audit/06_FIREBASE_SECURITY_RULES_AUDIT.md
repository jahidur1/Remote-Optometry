# 06 Firebase Security Rules Audit

### Current Status: **REMEDIATION RECOMMENDED**

| Match Path | Rule | Risk Level |
| :--- | :--- | :--- |
| `/employees/{id}` | `allow read, create: if true` | **HIGH** |
| `/users/{id}` | `allow write: if isOwner(id)` | **LOW** |
| `/audit_logs/{id}` | `allow read: if isAdmin()` | **LOW** |

### Findings:
1. **PII Exposure**: The `employees` collection is globally readable. This was done to allow the login page to check if a phone number exists before sending an OTP.
2. **Recommendation**: Change `allow read` to `allow get` and use a Secure Cloud Function or a specific `list` query that filters by the verified `auth.token.phone_number`.
