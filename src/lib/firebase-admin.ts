
import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

/**
 * Institutional Firebase Admin SDK Node.
 * 
 * Provides privileged access to Authentication and Firestore, 
 * bypassing client-side Security Rules for trusted backend operations.
 */
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
