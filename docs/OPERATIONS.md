
# ROC Workforce: Operations & Recovery Ledger

Institutional procedures for data integrity and business continuity.

## 1. Manual System Initialization (First Super Admin)
To provision the first Super Admin account without using automated scripts, follow this manual sequence in the Firebase Console:

### Phase A: Identity Mark
1. Navigate to **Authentication** in the Firebase Console.
2. Click **Add User** and enter:
   - **Email**: `jahidur1204@gmail.com`
   - **Password**: [Set a secure password]
3. After creation, **COPY the UID** (e.g., `gHZ9n7s2...`).

### Phase B: Clinical Registry Entry
1. Navigate to **Firestore Database**.
2. Create a collection named `employees`.
3. Create a document with **ID**: `ROC-SADMIN-001`.
4. Add the following fields:
   - `fullName`: "JAHIDUR RAHAMAN"
   - `email`: "jahidur1204@gmail.com"
   - `whatsappNumber`: "+919832441153"
   - `role`: "super_admin"
   - `status`: "Active"
   - `office`: "HQ_GLOBAL"
   - `gender`: "Male"
   - `id`: "ROC-SADMIN-001"

### Phase C: Governance Profile Binding
1. Create a collection named `users`.
2. Create a document with **ID**: [PASTE THE UID FROM PHASE A].
3. Add the following fields:
   - `uid`: [PASTE THE UID FROM PHASE A]
   - `email`: "jahidur1204@gmail.com"
   - `role`: "super_admin"
   - `displayName`: "JAHIDUR RAHAMAN"
   - `employeeId`: "ROC-SADMIN-001"
   - `office`: "HQ_GLOBAL"
   - `status`: "Active"

## 2. Backup Protocol
- **Automated Export**: Configure a daily GCP Cloud Function to export Firestore to a GCS Bucket.
- **Retention**: Maintain 30 days of standard backups and 12 monthly snapshots.

## 3. Disaster Recovery (RTO: 4 Hours)
1.  **Registry Failure**: If `/offices` is corrupted, re-run `seedOriginalOfficesAction` via Super Admin CLI.
2.  **Data Restore**:
    ```bash
    gcloud firestore import gs://[BACKUP_BUCKET_NAME]/[TIMESTAMP]
    ```

## 4. Communication Hygiene
- **WhatsApp Failures**: Monitor `whatsapp_logs` daily. Failures due to `API_REJECTED` usually indicate invalid phone formats.
- **Idempotency**: The system prevents double-sending for the same `employeeId` + `date` + `rosterVersion`.
