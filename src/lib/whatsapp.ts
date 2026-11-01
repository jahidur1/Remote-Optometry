
'use client';

import { collection, addDoc, serverTimestamp, Firestore, query, where, getDocs, limit } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Logs a WhatsApp notification attempt.
 * In production, this would be preceded by a call to the Meta Cloud API.
 */
export async function logNotification(
  db: Firestore,
  employeeId: string,
  phone: string,
  date: string,
  rosterVersion: string,
  status: 'success' | 'failed',
  failureReason?: string
) {
  // Idempotency check: Don't notify the same employee for the same version and date twice
  const logRef = collection(db, 'whatsapp_logs');
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
        console.log(`Notification already sent for ${employeeId} on ${date} (V${rosterVersion}). Skipping.`);
        return;
    }

    const maskedPhone = phone.replace(/(\d{2})(\d{6})(\d{2})/, '$1******$3');

    await addDoc(logRef, {
        employeeId,
        maskedPhone,
        date,
        rosterVersion,
        status,
        failureReason: failureReason || null,
        timestamp: new Date().toISOString(),
        source: 'automated_scheduler_v1'
    });
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({
      path: 'whatsapp_logs',
      operation: 'create',
      requestResourceData: { employeeId, date, rosterVersion }
    });
    errorEmitter.emit('permission-error', permissionError);
  }
}
