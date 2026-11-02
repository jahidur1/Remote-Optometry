
# Backup and Disaster Recovery Protocol

## 1. Data Protection
- **Automated Backup**: Enable Daily Firestore Exports to a dedicated GCP Storage Bucket via Cloud Scheduler.
- **Retention**: Maintain 30-day versioning for all exports to allow point-in-time recovery.
- **Auth Export**: Weekly export of Firebase Users via CLI to secure, encrypted offline storage.

## 2. Disaster Recovery (DR)
- **RTO (Recovery Time Objective)**: 4 Hours.
- **RPO (Recovery Point Objective)**: 24 Hours (Based on daily exports).

## 3. Recovery Steps
1. Restore Firestore collections from the latest GCS Export.
2. Re-import Auth Users via Firebase CLI.
3. Re-deploy Security Rules and Indexes to re-establish the Zero-Trust boundary.
4. Update App Hosting build if source code was compromised or corrupted.
5. Notify Clinical Leads of the 24h data delta.
