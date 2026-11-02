'use client';

import { collection, addDoc, serverTimestamp, Firestore, query, where, getDocs, limit } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { sendWhatsAppShiftBriefing } from '@/services/whatsapp-action';

/**
 * Orchestrates the sending and logging of a shift briefing.
 * 
 * DESIGN:
 * 1. Check for previous successful notification (idempotency).
 * 2. Invoke Secure Server Action for Meta API.
 * 3. Log the outcome to Firestore for audit.
 */
export async function dispatchAndLogNotification(
  db: Firestore,
  employeeId: string,
  employeeName: string,
  phone: string,
  date: string,
  shiftName: string,
  shiftTime: string,
  rosterVersion: string
) {
  const logRef = collection(db, 'whatsapp_logs');
  
  // 1. Idempotency Check
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
        console.log(`Notification already sent for ${employeeId} on ${date}. Skipping.`);
        return { success: true, message: 'Already sent' };
    }

    // 2. Dispatch via Meta Cloud API (Server Action)
    const result = await sendWhatsAppShiftBriefing(
      phone,
      employeeName,
      shiftName,
      shiftTime,
      date
    );

    // 3. Log to Audit Trail
    const maskedPhone = phone.replace(/(\d{2})(\d{6})(\d{2})/, '$1******$3');

    await addDoc(logRef, {
        employeeId,
        maskedPhone,
        date,
        rosterVersion,
        status: result.success ? 'success' : 'failed',
        messageId: result.messageId || null,
        failureReason: result.error || null,
        timestamp: new Date().toISOString(),
        source: 'automated_scheduler_v1'
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
