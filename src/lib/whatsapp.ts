
'use client';

import { collection, addDoc, Firestore, query, where, getDocs, limit } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { sendWhatsAppShiftBriefing } from '@/services/whatsapp-action';

/**
 * Orchestrates shift briefing notifications with strict idempotency and masked logging.
 * 
 * DESIGN:
 * 1. Verify previous successful notification for the same date/version.
 * 2. Dispatch via Secure Server Action (Meta API).
 * 3. Mask PII before writing to the public audit log.
 * 4. Added top-level office field for security rules isolation.
 */
export async function dispatchAndLogNotification(
  db: Firestore,
  employeeId: string,
  employeeName: string,
  phone: string,
  date: string,
  shiftName: string,
  shiftTime: string,
  rosterVersion: string,
  office: string // Required for security isolation
) {
  const logRef = collection(db, 'whatsapp_logs');
  
  // 1. Idempotency Check: Don't double-send if already successful for this specific roster version
  const q = query(
    logRef,
    where('employeeId', '==', employeeId),
    where('date', '==', date),
    where('rosterVersion', '==', rosterVersion),
    where('status', '==', 'success'),
    limit(1)
  );

  try {
    const snap = await getDocs(q);
    if (!snap.empty) {
        return { success: true, message: 'IDEMPOTENT_SKIP' };
    }

    // 2. Dispatch via Meta Cloud API
    const result = await sendWhatsAppShiftBriefing(
      phone,
      employeeName,
      shiftName,
      shiftTime,
      date
    );

    // 3. Mask Phone for Privacy (PII Protection)
    const maskedPhone = phone.replace(/(\d{2})(\d{6})(\d{2})/, '$1******$3');

    await addDoc(logRef, {
        employeeId,
        maskedPhone,
        office, // Institutional metadata for security rules
        date,
        rosterVersion,
        status: result.success ? 'success' : 'failed',
        messageId: result.messageId || null,
        failureReason: result.error || null,
        timestamp: new Date().toISOString(),
        source: 'roster_publisher_v1'
    });

    return result;
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({
      path: 'whatsapp_logs',
      operation: 'create',
      requestResourceData: { employeeId, date, rosterVersion }
    });
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: error.message };
  }
}
