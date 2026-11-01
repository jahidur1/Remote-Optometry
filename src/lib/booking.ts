
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
      const configDoc = await transaction.get(configRef);
      const bookingDoc = await transaction.get(bookingRef);
      const employeeDoc = await transaction.get(employeeRef);

      if (!configDoc.exists()) {
        return { success: false, message: "Booking configuration not found for this week." };
      }

      if (!employeeDoc.exists()) {
        return { success: false, message: "Employee record not found." };
      }

      const config = configDoc.data();
      const employee = employeeDoc.data();

      // 1. Check if window is open
      const now = new Date();
      const openTime = new Date(config.bookingOpen);
      const closeTime = new Date(config.bookingClose);

      if (now < openTime) {
        return { success: false, message: `Booking window opens at ${openTime.toLocaleString('en-IN')}` };
      }
      if (now > closeTime) {
        return { success: false, message: "Booking window is closed." };
      }

      // 2. Check if user already has a booking
      if (bookingDoc.exists()) {
        const existing = bookingDoc.data();
        return { success: false, message: `You already have a confirmed weekly off for ${existing.dayOfWeek}.` };
      }

      // 3. Check quota
      const quotas = config.quotas || {};
      const booked = config.booked || {};
      const totalQuota = quotas[dayOfWeek] || 0;
      const currentBooked = booked[dayOfWeek] || 0;

      if (currentBooked >= totalQuota) {
        return { success: false, message: `Sorry, ${dayOfWeek} is already full. Please choose another day.` };
      }

      // 4. Atomic Write
      transaction.set(bookingRef, {
        id: bookingId,
        weekId,
        employeeId,
        dayOfWeek,
        timestamp: serverTimestamp(),
        status: 'confirmed',
        actorId
      });

      transaction.update(configRef, {
        [`booked.${dayOfWeek}`]: increment(1),
        updatedAt: serverTimestamp()
      });

      return { success: true, message: "Booking confirmed successfully!" };
    });
  } catch (error: any) {
    console.error("Booking transaction failed: ", error);
    return { success: false, message: "A technical error occurred. Please try again." };
  }
}
