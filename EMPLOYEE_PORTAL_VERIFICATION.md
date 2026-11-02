
# Employee Portal Verification (Phase 4)

## 1. User Story: Clinical Schedule Access
- **Scenario**: Professional logs in via mobile browser.
- **Verification**: Dashboard immediately displays the confirmed off-day (secured in Phase 2) and the institutional assignments for the active cycle.
- **Status**: **PASS**

## 2. User Story: Data Isolation
- **Scenario**: User attempts to query `/employees` or `/published_rosters` for other staff IDs.
- **Verification**: Firestore Security Rules block the request. The UI only renders assignments where `assignment.employeeId === profile.employeeId`.
- **Status**: **PASS**

## 3. User Story: FCFS Status Tracking
- **Scenario**: User hasn't booked their off-day yet.
- **Verification**: Portal shows a high-visibility "Priority Action Required" card with a link to the location matrix.
- **Status**: **PASS**

## 4. User Story: Real-time Updates
- **Scenario**: Admin publishes a new version of the roster.
- **Verification**: `onSnapshot` listener on the portal triggers an immediate UI update without requiring a manual refresh.
- **Status**: **PASS**
