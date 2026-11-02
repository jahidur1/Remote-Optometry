
# Roster Workflow & Versioning Standard

## 1. The Deployment Pipeline
1. **Draft Generation**: The mathematical engine produces a candidate roster based on quotas and constraints.
2. **Clinical Review**: Admins use the **Integrity HUD** to verify coverage and resolve any AI-simulated conflicts.
3. **Manual Adjustments**: Administrators can swap shifts. The HUD provides real-time warnings if a quota becomes unbalanced.
4. **Approval**: Once the HUD shows `FULFILLED` for all 7 days, the "Publish" trigger is unlocked.
5. **Rollout**: A versioned document is created, and the employee portal updates immediately.

## 2. Versioning Logic
- **Storage**: `published_rosters/{weekId}_v{timestamp}`
- **Active Record**: The portal always fetches the record for the target `weekId` with the latest `publishedAt` timestamp and `status: 'active'`.
- **Traceability**: Every record contains `publisherId` and `version`, linked to the institutional audit trail.

## 3. Governance
- **Lock Protection**: Confirmed weekly-offs (FCFS) are visually and functionally locked in the review grid.
- **Super Admin Override**: Only users with the `SUPER_ADMIN` claim can bypass an FCFS lock. This action requires a mandatory reason and generates a high-severity audit event.
