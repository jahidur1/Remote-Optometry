# ROC Workforce: Firestore Index Configuration

To ensure the deterministic roster node and professional portal function at peak performance, the following composite indexes must be manually provisioned in the Firebase Console.

## 1. Professional Registry (employees)
- **Purpose**: Staff availability checks for the solver.
- **Fields**: 
  - `office` (Ascending)
  - `status` (Ascending)

## 2. FCFS Booking Ledger (weekoff_bookings)
- **Purpose**: Validating reservations during roster generation.
- **Fields**: 
  - `weekId` (Ascending)
  - `office` (Ascending)

## 3. Configuration Pulse (weekoff_configs)
- **Purpose**: Fetching the latest booking window for a specific ROC cluster.
- **Fields**: 
  - `office` (Ascending)
  - `weekId` (Descending)

## 4. Published Roster Matrix (published_rosters)
- **Purpose**: Displaying the active schedule in the employee portal.
- **Fields**: 
  - `status` (Ascending)
  - `publishedAt` (Descending)

## 5. Notification Trace (whatsapp_logs)
- **Purpose**: Idempotency checks for shift briefings.
- **Fields**: 
  - `employeeId` (Ascending)
  - `date` (Ascending)
  - `rosterVersion` (Ascending)
  - `status` (Ascending)

## 6. Preference Node (employee_preferences)
- **Purpose**: Soft constraint mapping for the CP-SAT engine.
- **Fields**: 
  - `employeeId` (Ascending)
  - `weekId` (Ascending)

---
**Protocol Note**: If you encounter a "Missing Index" error in the browser console during development, Firebase provides a direct link that will pre-fill these settings for you.