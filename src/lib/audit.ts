
import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function logAudit(
  db: Firestore,
  actorId: string,
  action: string,
  targetId: string,
  details: any = {}
) {
  const auditRef = collection(db, 'audit_logs');
  
  addDoc(auditRef, {
    actorId,
    action,
    targetId,
    details,
    timestamp: serverTimestamp(),
  }).catch(async (error) => {
    const permissionError = new FirestorePermissionError({
      path: 'audit_logs',
      operation: 'create',
      requestResourceData: { actorId, action, targetId },
    });
    errorEmitter.emit('permission-error', permissionError);
  });
}
