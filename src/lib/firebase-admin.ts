
import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Institutional Firebase Admin SDK Registry.
 * 
 * Provides privileged access to Authentication, Firestore, and Storage.
 * Bypasses client-side Security Rules for trusted backend operations.
 */

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  // Initialize with the standard web config's project ID and explicit storage bucket
  return initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: 'studio-9087637488-aa952.firebasestorage.app',
  });
}

const app = getAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
