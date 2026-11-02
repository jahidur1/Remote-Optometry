
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
 * REQUIREMENTS INTEGRATED:
 * 1. Office-specific schedule validation.
 * 2. Simultaneous final-slot competition handling.
 * 3. Server-side office verification.
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

      // 1. Office Verification (Server-Side)
      if (config.office !== employee.office) {
        return { success: false, message: "Unauthorized: You can only book slots for your assigned ROC cluster." };
      }

      // 2. Status & Window Checks
      if (employee.status !== 'Active') {
        return { success: false, message: "Access Denied: Inactive account." };
      }

      const now = new Date();
      if (now < new Date(config.bookingOpen)) {
        return { success: false, message: "Booking window is not yet open." };
      }
      if (now > new Date(config.bookingClose)) {
        return { success: false, message: "Booking window has closed." };
      }

      // 3. Duplicate Booking Check for this week
      const bookingId = `${config.weekId}_${employeeId}`;
      const bookingRef = doc(db, 'weekoff_bookings', bookingId);
      const bookingDoc = await transaction.get(bookingRef);

      if (bookingDoc.exists()) {
        return { success: false, message: "You have already secured a weekly-off for this cycle." };
      }

      // 4. Quota Competition Check
      const totalQuota = config.quotas?.[dayOfWeek] || 0;
      const currentBooked = config.booked?.[dayOfWeek] || 0;

      if (currentBooked >= totalQuota) {
        return { success: false, message: `SLOT FULL: ${dayOfWeek} was claimed by another professional. Please select another day.` };
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

      return { success: true, message: `Success! Your weekly-off for ${dayOfWeek} is secured.` };
    });
  } catch (error: any) {
    console.error("Booking transaction failed:", error);
    return { success: false, message: "A network conflict occurred. Please retry your selection." };
  }
}
