'use client';

import React, { useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { type FirebaseApp } from 'firebase/app';
import { type Firestore } from 'firebase/firestore';
import { type Auth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [instances, setInstances] = useState<{
    app: FirebaseApp;
    firestore: Firestore;
    auth: Auth;
  } | null>(null);

  useEffect(() => {
    const { app, firestore, auth } = initializeFirebase();
    
    // Task 3: Institutional App Check Initialization
    // reCAPTCHA Enterprise provides a Zero-Trust token handshake for Firestore, Storage, and Functions.
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        });
        console.log('ROC_SEC_PULSE: App Check initiated via reCAPTCHA Enterprise.');
      } catch (e) {
        console.warn('ROC_SEC_ALERT: App Check initialization failed. Enrollment required in Firebase Console.');
      }
    }

    setInstances({ app, firestore, auth });
  }, []);

  if (!instances) return null;

  return (
    <FirebaseProvider app={instances.app} firestore={instances.firestore} auth={instances.auth}>
      {children}
    </FirebaseProvider>
  );
}
