
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
 * Performs an atomic weekly-off booking.
 * 
 * DESIGN PRINCIPLES:
 * 1. FCFS Priority: Determined strictly by Firestore transaction commit order.
 * 2. Atomics: Quota decrement and booking creation happen in one atomic unit.
 * 3. Validation: Checks window status, existing bookings, and quota within the transaction.
 */
export async function bookWeeklyOff(
  db: Firestore,
  weekId: string,
  employeeId: string,
  dayOfWeek: string,
  actorId: string
): Promise<BookingResult> {
  const configRef = doc(db, 'weekoff_configs', weekId);
  const bookingId = `${weekId}_${employeeId}`;
  const bookingRef = doc(db, 'weekoff_bookings', bookingId);
  const employeeRef = doc(db, 'employees', employeeId);

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Fetch all necessary data within the transaction scope
      const configDoc = await transaction.get(configRef);
      const bookingDoc = await transaction.get(bookingRef);
      const employeeDoc = await transaction.get(employeeRef);

      // 2. Fundamental existence checks
      if (!configDoc.exists()) {
        return { success: false, message: "System Error: Booking configuration not found for this week." };
      }
      if (!employeeDoc.exists()) {
        return { success: false, message: "System Error: Your employee record could not be verified." };
      }

      const config = configDoc.data();
      const employee = employeeDoc.data();

      // 3. Security Check: Is the account active?
      if (employee.status !== 'Active') {
        return { success: false, message: "Access Denied: Your account is currently suspended or inactive." };
      }

      // 4. Window Check: Is the booking window currently open?
      // Note: We use the local device time for the check, but security rules should enforce this on the server.
      const now = new Date();
      const openTime = new Date(config.bookingOpen);
      const closeTime = new Date(config.bookingClose);

      if (now < openTime) {
        return { success: false, message: `The booking window is not yet open. It opens at ${openTime.toLocaleString('en-IN')}.` };
      }
      if (now > closeTime) {
        return { success: false, message: "The booking window has already closed." };
      }

      // 5. Uniqueness Check: Does this employee already have a booking?
      if (bookingDoc.exists()) {
        const existing = bookingDoc.data();
        return { success: false, message: `You have already confirmed your weekly off for ${existing.dayOfWeek}. Edits are not permitted.` };
      }

      // 6. Quota Check: Is there a slot available for this specific day?
      const quotas = config.quotas || {};
      const booked = config.booked || {};
      const totalQuota = quotas[dayOfWeek] || 0;
      const currentBooked = booked[dayOfWeek] || 0;

      if (currentBooked >= totalQuota) {
        return { success: false, message: `Sorry, slots for ${dayOfWeek} were just filled. Please choose another available day.` };
      }

      // 7. Atomic Write Operations
      // Create the booking record
      transaction.set(bookingRef, {
        id: bookingId,
        weekId,
        employeeId,
        dayOfWeek,
        timestamp: serverTimestamp(),
        status: 'confirmed',
        actorId,
        source: 'employee_portal_v1'
      });

      // Increment the booked count in the config document
      transaction.update(configRef, {
        [`booked.${dayOfWeek}`]: increment(1),
        updatedAt: serverTimestamp()
      });

      return { success: true, message: `Weekly-off for ${dayOfWeek} has been successfully secured and locked.` };
    });
  } catch (error: any) {
    console.error("Critical: Booking transaction failed", error);
    return { success: false, message: "A technical conflict occurred during reservation. Please try again." };
  }
}
