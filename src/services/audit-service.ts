
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Logs a sensitive action to the immutable audit trail from the server context.
 */
export async function logAuditServer(
  actorId: string,
  action: string,
  targetId: string,
  details: any = {}
) {
  try {
    await adminDb.collection('audit_logs').add({
      actorId,
      action,
      targetId,
      details: {
        ...details,
        platform: 'server_v1',
        timestamp: new Date().toISOString(),
      },
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Audit Logging Failure:', e);
  }
}
