
import { doc, setDoc, Firestore, serverTimestamp } from 'firebase/firestore';
import { addDays } from 'date-fns';

const SESSION_KEY = 'roc_workforce_session_v1';

/**
 * Retrieves or generates a persistent unique ID for the current browser instance.
 * Ties the session to a specific browser installation for security auditing.
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
 * Mandatory 30-day security deadline enforced at the database layer.
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
  // Institutional Policy: Sessions expire strictly after 30 days.
  const deadline = addDays(now, 30);

  const derivedLabel = label || (typeof navigator !== 'undefined' ? 
    `${navigator.platform} (${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'})` : 
    'Unknown Device');

  const sessionData = {
    id: sessionId,
    uid,
    employeeId,
    label: derivedLabel,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    verifiedAt: serverTimestamp(),
    deadlineAt: deadline,
    lastActive: serverTimestamp(),
    status: 'active'
  };

  setDoc(sessionRef, sessionData).catch((error) => {
    console.error("Session creation rejected by Security Rules:", error);
  });

  return sessionData;
}

/**
 * Sends a heartbeat pulse to keep the session active without modifying core security fields.
 */
export async function sessionHeartbeat(db: Firestore, uid: string) {
  const sessionId = getLocalSessionId();
  const sessionRef = doc(db, 'sessions', `${uid}_${sessionId}`);
  
  setDoc(sessionRef, {
    lastActive: serverTimestamp()
  }, { merge: true });
}
