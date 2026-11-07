import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Institutional Firebase Admin SDK Registry.
 * 
 * Provides privileged access to Authentication and Firestore, 
 * bypassing client-side Security Rules for trusted backend operations.
 * Optimized for Next.js Server Components and Actions.
 * 
 * INTEGRATION: Explicitly defines the storageBucket to enable server-side 
 * image persistence and automated cleanup pulses.
 */

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  // Initialize with the standard web config's project ID and storage bucket
  return initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: `${firebaseConfig.projectId}.firebasestorage.app`,
  });
}

const app = getAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
