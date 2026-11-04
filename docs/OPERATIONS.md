
# ROC Workforce: Operations & Recovery Ledger

Institutional procedures for data integrity and business continuity.

## 1. Backup Protocol
- **Automated Export**: Configure a daily GCP Cloud Function to export Firestore to a GCS Bucket.
- **Retention**: Maintain 30 days of standard backups and 12 monthly snapshots.
- **Manual Trigger**:
  ```bash
  gcloud firestore export gs://[BACKUP_BUCKET_NAME]
  ```

## 2. Disaster Recovery (RTO: 4 Hours)
1.  **Registry Failure**: If `/offices` is corrupted, re-run `seedOriginalOfficesAction` via Super Admin CLI.
2.  **Data Restore**:
    ```bash
    gcloud firestore import gs://[BACKUP_BUCKET_NAME]/[TIMESTAMP]
    ```
3.  **Version Conflict**: If a Published Roster is incorrect, administrators must create a new version with a higher `publishedAt` timestamp. The UI always prioritizes the latest version.

## 3. Communication Hygiene
- **WhatsApp Failures**: Monitor `whatsapp_logs` daily. Failures due to `API_REJECTED` usually indicate invalid phone formats or template changes.
- **Idempotency**: The system prevents double-sending for the same `employeeId` + `date` + `rosterVersion`.

## 4. Administrative Audit
All sensitive actions (Status changes, Quota updates, Solver runs) are recorded in `audit_logs`. Super Admins should review this ledger weekly to ensure protocol compliance.
