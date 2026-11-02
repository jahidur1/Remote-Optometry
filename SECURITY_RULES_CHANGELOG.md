
# Security Rules Changelog

## Version 2.0 (Foundation Hardening)

### Added
- `isUserActive()` helper: Performs a cross-collection join to `users/{uid}` to verify `status == 'Active'` before granting access to any workforce data.
- Session Creation Constraints: Enforced `request.resource.data.deadlineAt == request.time + 365d`.
- Field-Level Protection: Blocked employees from modifying `role`, `status`, or `id` in the `employees` collection.

### Changed
- `employees/{id}`: Changed from public read to identity-bound `get`. `list` restricted to admins.
- `sessions/{id}`: Tightened update rules. Only admins can revoke; owners can only update heartbeats and labels.
- `audit_logs`: Set to immutable (no update/delete).

### Removed
- Unauthenticated access to `employees` collection.
- Generic `allow write` permissions for owners on sessions.
