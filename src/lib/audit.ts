
import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Logs a sensitive administrative or employee action to the immutable audit trail.
 * 
 * SECURITY: All logs are stored with a server-side timestamp to ensure temporal integrity.
 * TOP-LEVEL OFFICE: Added top-level office field to satisfy Firestore Security Rules for isolation.
 */
export function logAudit(
  db: Firestore,
  actorId: string,
  action: string,
  targetId: string,
  details: any = {}
) {
  const auditRef = collection(db, 'audit_logs');
  
  const payload = {
    actorId,
    action,
    targetId,
    office: details.office || null, // Standardized office metadata
    details: {
      ...details,
      platform: 'web_v1',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    },
    timestamp: serverTimestamp(),
  };

  addDoc(auditRef, payload).catch(async (error) => {
    const permissionError = new FirestorePermissionError({
      path: 'audit_logs',
      operation: 'create',
      requestResourceData: { actorId, action, targetId },
    });
    errorEmitter.emit('permission-error', permissionError);
  });
}
