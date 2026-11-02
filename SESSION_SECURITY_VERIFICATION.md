# Session Security Verification: ROC Workforce

**Auditor:** Senior Security Architect  
**Status:** COMPLETE (Audit Only)  
**Date:** 2024-05-23

## 1. Audit Scope & Inspected Files
This audit evaluated the transition from simple Firebase Authentication to the institutional 365-day device-persistent session model.

**Files Inspected:**
- `src/firebase/auth/use-user.tsx`: Real-time session monitoring.
- `src/lib/session-utils.ts`: Session lifecycle management.
- `src/app/login/page.tsx`: OTP verification and session initialization.
- `src/components/auth/role-guard.tsx`: Front-line access enforcement.
- `firestore.rules`: Server-side permission enforcement.

## 2. Session Document Structure
Sessions are stored in the `sessions` collection with a composite ID: `{uid}_{sessionId}`.

| Field | Purpose | Source |
| :--- | :--- | :--- |
| `uid` | Link to Firebase Auth User | Server (Auth) |
| `id` | Browser-persistent unique ID | Client (Persistent) |
| `employeeId` | Authorized Clinical ID | Database Lookup |
| `deadlineAt` | Rolling 365-day expiry | `verifiedAt + 365d` |
| `status` | `active` or `revoked` | System/Admin |
| `verifiedAt` | Trusted timestamp of latest OTP | Client (saved to DB) |

## 3. Enforcement Layers

### A. Frontend Enforcement (High Integrity)
The `useUser` hook subscribes to the specific session document for the current device. 
- **Mechanism:** `onSnapshot` on `/sessions/{uid}_{localId}`.
- **Logic:** `sessionValid = (status === 'active' && now < deadlineAt)`.
- **Result:** Sub-second UI lockout upon revocation.

### B. Backend Enforcement (Medium Integrity)
The Firestore Rules currently verify `isSignedIn()`.
- **Risk:** Rules do not currently perform a `get()` call to the `sessions` collection to verify the specific session status for every data request.
- **Impact:** A revoked session remains "Firebase Authorized" for up to 60 minutes (until the ID token expires), allowing direct SDK/API access during that window even if the UI is locked.

## 4. Security Test Results

| Test ID | Test Case Description | Result | Evidence / Logic |
| :--- | :--- | :--- | :--- |
| T01 | Access protected API with valid token but revoked session | **PASS (UI)** / **FAIL (DB)** | UI locks immediately; Firestore Rules allow access until token expiry. |
| T02 | Modify `deadlineAt` from browser console | **FAIL** | Current rules allow `allow write: if isOwner(userId)`, permitting self-extension. |
| T03 | 365-Day Deadline Enforcement | **PASS** | `RoleGuard` correctly redirects to verification once `now > deadlineAt`. |
| T04 | Client Clock Manipulation | **PASS** | `deadlineAt` is a static string in DB; UI check against `new Date()` can be spoofed locally but DB records remain unchanged. |
| T05 | Cross-Device Independence | **PASS** | `localStorage` session ID ensures separate tokens for mobile vs laptop. |
| T06 | Account Suspension | **PASS** | `RoleGuard` and `useUser` check `profile.status`, providing immediate global lockout. |

## 5. Critical Findings

### CF-01: Session Document Mutation Risk
**Severity: HIGH**  
The rule `match /sessions/{sessionId} { allow write: if isOwner(userId) }` allows an authenticated user to overwrite their own session data, including the `deadlineAt` and `status` fields.  
**Recommendation:** Restrict `update` permissions on sessions to prevent users from modifying their own expiry or status.

### CF-02: Backend-Session Decoupling
**Severity: MEDIUM**  
Firestore data rules for `/employees` and `/rosters` only check `request.auth != null`. They do not verify that the specific session used by the client is still active in the `sessions` collection.  
**Recommendation:** Update data match rules to include a helper function that verifies the current session status.

## 6. Audit Summary & Readiness
The system is **Functionally Ready** but requires **Security Rules Hardening** before enterprise deployment. The custom 365-day policy is accurately calculated and effectively enforced at the application level, but the database layer lacks the necessary constraints to prevent self-extension or immediate token-level revocation.

**Deployment Required:** YES (Update to Firestore Rules).
