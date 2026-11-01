
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { addDays } from 'date-fns';

const SESSION_KEY = 'roc_workforce_session_v1';

export function getLocalSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `session_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function createOrUpdateSession(
  db: Firestore, 
  uid: string, 
  employeeId: string, 
  label?: string
) {
  const sessionId = getLocalSessionId();
  const sessionRef = doc(db, 'sessions', `${uid}_${sessionId}`);
  
  const now = new Date();
  const deadline = addDays(now, 365);

  const sessionData = {
    id: sessionId,
    uid,
    employeeId,
    label: label || (typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) : 'Unknown Device'),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    verifiedAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    lastActive: now.toISOString(),
    status: 'active'
  };

  await setDoc(sessionRef, sessionData, { merge: true });
  return sessionData;
}

export async function validateSession(db: Firestore, uid: string) {
  const sessionId = getLocalSessionId();
  if (!sessionId || !uid) return { valid: false };

  const sessionRef = doc(db, 'sessions', `${uid}_${sessionId}`);
  const snap = await getDoc(sessionRef);

  if (!snap.exists()) return { valid: false };

  const data = snap.data();
  const now = new Date();
  const deadline = new Date(data.deadlineAt);

  if (data.status !== 'active' || now > deadline) {
    return { valid: false, data };
  }

  // Background update last active
  updateDoc(sessionRef, { lastActive: serverTimestamp() });

  return { valid: true, data };
}
