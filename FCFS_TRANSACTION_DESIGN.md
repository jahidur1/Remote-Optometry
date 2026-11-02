
# FCFS Transaction Design: ROC Workforce

## Objective
To ensure 100% accurate, first-come-first-served reservation of clinical weekly-offs without the risk of overbooking or duplicate assignments.

## Core Flow (Atomic)
The system uses the `runTransaction` API from Firestore to perform a Read-Modify-Write cycle:

1. **Phase 1: Read (Isolation)**
   - Fetch `weekoff_config` (to check quotas and window status).
   - Fetch `weekoff_booking` for the current user (to prevent duplicates).
   - Fetch `employee` record (to verify active clinical status).

2. **Phase 2: Logic (Constraint Solving)**
   - Verify `now >= openTime` and `now <= closeTime`.
   - Verify `employee.status == 'Active'`.
   - Verify `bookingDoc.exists == false`.
   - Verify `config.booked[day] < config.quotas[day]`.

3. **Phase 3: Write (Commit)**
   - Create `weekoff_booking` document with `serverTimestamp()`.
   - Increment `config.booked[day]` using `increment(1)`.

## Concurrency Handling
If two professionals attempt to book the final slot on the same millisecond:
1. Both start the transaction.
2. One commits successfully first.
3. The second professional's transaction fails because the `config` document was modified by the first.
4. The second transaction retries, reads the updated `booked` count, sees the day is now `FULL`, and returns a clear conflict message to the professional.

## Scalability
The single-document transaction model is optimized for ROC clusters of 100-500 users. For global scale (1,000+ simultaneous), contention on the `config` document is mitigated by Firestore's internal retry mechanism and standard FCFS "fast finger" behavior where losers are naturally redirected to other days.
