
# Session Migration Guide

## Overview
The ROC Workforce session layer has transitioned to a server-enforced model. Existing active sessions are preserved, but all new sessions must strictly follow the new 365-day rule.

## Migration Strategy
1. **Existing Sessions**: Will remain valid if their `deadlineAt` is already in the future. The `useUser` hook handles the transition from String to Timestamp formats.
2. **Re-Authentication**: No force-logout was applied to active users. However, any user attempting to "fudge" their session length or bypass security will be blocked by the new Rules.
3. **Account Status**: All existing accounts were checked. Any account currently set to `Active` will continue working. Suspended accounts lose access immediately upon rule deployment.

## Action Required
- **Administrator**: Ensure all legacy test accounts have been assigned a proper status (`Active` or `Suspended`) in the `users` collection.
