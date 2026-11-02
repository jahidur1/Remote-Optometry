
import { doc, setDoc, Firestore } from 'firebase/firestore';
import { addDays } from 'date-fns';

const SESSION_KEY = 'roc_workforce_session_v1';

/**
 * Retrieves or generates a persistent unique ID for the current browser instance.
 * This ID links the local browser to a server-side session record.
 */
export function getLocalSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `session_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Creates or refreshes a session record in Firestore.
 * Sets the 365-day re-verification deadline.
 */
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

  const derivedLabel = label || (typeof navigator !== 'undefined' ? 
    `${navigator.platform} (${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'})` : 
    'Unknown Device');

  const sessionData = {
    id: sessionId,
    uid,
    employeeId,
    label: derivedLabel,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    verifiedAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    lastActive: now.toISOString(),
    status: 'active'
  };

  await setDoc(sessionRef, sessionData, { merge: true });
  return sessionData;
}
