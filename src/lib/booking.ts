
import { 
  doc, 
  runTransaction, 
  Firestore, 
  serverTimestamp,
  increment
} from 'firebase/firestore';

export type BookingResult = {
  success: boolean;
  message: string;
};

/**
 * Performs an atomic weekly-off booking using Firestore Transactions.
 * 
 * INTEGRATED REQUIREMENTS:
 * 1. Office-specific schedule validation (Server-side enforced).
 * 2. Simultaneous final-slot competition handling.
 * 3. Atomic counter increment.
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

      // 1. Office Identity Verification (Server-Side)
      // An employee from Kolkata ROC must never book a Gurgaon ROC slot.
      if (config.office !== employee.office) {
        return { success: false, message: `Unauthorized: Your profile is assigned to ${employee.office}. You cannot book for ${config.office}.` };
      }

      // 2. Status & Window Checks
      if (employee.status !== 'Active') {
        return { success: false, message: "Access Denied: Your clinical account is not active." };
      }

      const now = new Date();
      if (now < new Date(config.bookingOpen)) {
        return { success: false, message: "The booking pulse has not yet initiated." };
      }
      if (now > new Date(config.bookingClose)) {
        return { success: false, message: "The booking window for this cycle has closed." };
      }

      // 3. Duplicate Booking Check for this week
      const bookingId = `${config.weekId}_${employeeId}`;
      const bookingRef = doc(db, 'weekoff_bookings', bookingId);
      const bookingDoc = await transaction.get(bookingRef);

      if (bookingDoc.exists()) {
        return { success: false, message: "A reservation already exists for your ID this week." };
      }

      // 4. Quota Competition Check
      const totalQuota = config.quotas?.[dayOfWeek] || 0;
      const currentBooked = config.booked?.[dayOfWeek] || 0;

      if (currentBooked >= totalQuota) {
        return { success: false, message: `SLOT FULL: The last slot for ${dayOfWeek} was just claimed. Please select another day.` };
      }

      // 5. Atomic Commit
      transaction.set(bookingRef, {
        id: bookingId,
        weekId: config.weekId,
        office: config.office,
        employeeId,
        dayOfWeek,
        timestamp: serverTimestamp(),
        status: 'confirmed',
        actorId,
        source: 'employee_portal_v2'
      });

      transaction.update(configRef, {
        [`booked.${dayOfWeek}`]: increment(1),
        updatedAt: serverTimestamp()
      });

      return { success: true, message: `CONGRATULATIONS! Your weekly-off for ${dayOfWeek} is secured and locked.` };
    });
  } catch (error: any) {
    console.error("Booking transaction failed:", error);
    return { success: false, message: "A network conflict occurred during reservation. Please refresh and try again." };
  }
}
