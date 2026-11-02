# 04 Authentication and Session Audit

### Architecture:
The system uses **Firebase Phone Auth** combined with a custom **Firestore Session Layer**. 

### 365-Day Policy Verification:
- **Mechanism**: On login, a record is created in the `sessions` collection with a `deadlineAt` set to `now + 365 days`.
- **Enforcement**: The `useUser` hook and `RoleGuard` perform a real-time subscription to this specific session document. If the status is not `active` or the deadline has passed, access is revoked.
- **Verification**: SUCCESS. Manual document edits in Firestore immediately trigger UI lockouts.

### Revocation Logic:
- **Admin Control**: Super Admins can set status to `revoked`.
- **Latency**: Sub-second. Due to Firestore `onSnapshot` listeners, the user is redirected to the login barrier almost instantly upon revocation.
