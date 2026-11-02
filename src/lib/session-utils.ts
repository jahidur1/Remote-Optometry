
import { doc, setDoc, Firestore, serverTimestamp } from 'firebase/firestore';
import { addDays } from 'date-fns';

const SESSION_KEY = 'roc_workforce_session_v1';

/**
 * Retrieves or generates a persistent unique ID for the current browser instance.
 * Ensures the session is tied to a specific browser installation.
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
 * Strictly adheres to the 365-day security rules using request.time alignment.
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
  // Calculate exactly 365 days later. 
  // Note: The Firestore Rule uses request.time + 31536000s (365 days).
  // We match this exactly on the client to ensure the write is accepted.
  const deadline = addDays(now, 365);

  const derivedLabel = label || (typeof navigator !== 'undefined' ? 
    `${navigator.platform} (${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'})` : 
    'Unknown Device');

  // CRITICAL: verifiedAt uses serverTimestamp() to satisfy Firestore Rules.
  // deadlineAt is a Date which Firestore converts to a Timestamp.
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

  // setDoc without await to allow optimistic UI, but we catch errors for Rule validation
  setDoc(sessionRef, sessionData).catch((error) => {
    console.error("Session creation rejected by Security Rules:", error);
  });

  return sessionData;
}

/**
 * Sends a heartbeat to keep the session active without modifying security fields.
 */
export async function sessionHeartbeat(db: Firestore, uid: string) {
  const sessionId = getLocalSessionId();
  const sessionRef = doc(db, 'sessions', `${uid}_${sessionId}`);
  
  // Rules allow updating lastActive for the owner
  setDoc(sessionRef, {
    lastActive: serverTimestamp()
  }, { merge: true });
}
