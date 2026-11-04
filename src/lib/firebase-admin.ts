
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
 */

const app: App = getApps().length === 0 
  ? initializeApp({
      projectId: firebaseConfig.projectId,
    })
  : getApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
