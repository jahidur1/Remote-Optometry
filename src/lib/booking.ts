
import { 
  doc, 
  runTransaction, 
  Firestore, 
  serverTimestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export type BookingResult = {
  success: boolean;
  message: string;
};

/**
 * Performs an atomic weekly-off booking using Firestore Transactions.
 * Hardened to ensure strict quota enforcement under high concurrency.
 */
export async function bookWeeklyOff(
  db: Firestore,
  configId: string, 
  employeeId: string,
  dayOfWeek: string,
  actorId: string
): Promise<BookingResult> {
  const employeeRef = doc(db, 'employees', employeeId);
  const configRef = doc(db, 'weekoff_configs', configId);

  try {
    return await runTransaction(db, async (transaction) => {
      const configDoc = await transaction.get(configRef);
      const employeeDoc = await transaction.get(employeeRef);

      if (!configDoc.exists() || !employeeDoc.exists()) {
        return { success: false, message: "System Error: Missing configuration or profile." };
      }

      const config = configDoc.data();
      const employee = employeeDoc.data();

      // 1. Authorization Pulse
      if (config.office !== employee.office) {
        return { success: false, message: `Unauthorized: Your profile is assigned to ${employee.office}.` };
      }

      if (employee.status !== 'Active') {
        return { success: false, message: "Access Denied: Your account is suspended." };
      }

      // 2. Window Integrity Check
      const now = new Date();
      if (now < new Date(config.bookingOpen)) {
        return { success: false, message: "The booking pulse has not yet initiated." };
      }
      if (now > new Date(config.bookingClose)) {
        return { success: false, message: "The booking window for this cycle has closed." };
      }

      const bookingId = `${config.weekId}_${employeeId}`;
      const bookingRef = doc(db, 'weekoff_bookings', bookingId);
      const bookingDoc = await transaction.get(bookingRef);

      if (bookingDoc.exists()) {
        return { success: false, message: "A reservation already exists for your ID this week." };
      }

      // 3. Strict Quota Enforcement (Deterministic Read-Check)
      // Fix: Ensure we handle undefined keys by defaulting to 0 before Number coercion
      const totalQuota = Number(config.quotas?.[dayOfWeek] || 0);
      const currentBooked = Number(config.booked?.[dayOfWeek] || 0);

      if (currentBooked >= totalQuota) {
        return { success: false, message: "sorry currently no slot available in this day you choice, you can select different day as a week off" };
      }

      // 4. Atomic Commit
      transaction.set(bookingRef, {
        id: bookingId,
        weekId: config.weekId,
        office: config.office,
        employeeId,
        dayOfWeek,
        timestamp: serverTimestamp(),
        status: 'confirmed',
        actorId,
      });

      // Update the counter in the config document using the read-verified value
      transaction.update(configRef, {
        [`booked.${dayOfWeek}`]: currentBooked + 1,
        updatedAt: serverTimestamp()
      });

      return { success: true, message: `successfully booking week off on ${dayOfWeek}` };
    });
  } catch (error: any) {
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: configRef.path,
          operation: 'update',
          requestResourceData: { dayOfWeek, action: 'increment' }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    }

    return { success: false, message: "A network conflict occurred during reservation. Please refresh and try again." };
  }
}
