'use client';

import React, { useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { type FirebaseApp } from 'firebase/app';
import { type Firestore } from 'firebase/firestore';
import { type Auth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

/**
 * ROC WORKFORCE — INSTITUTIONAL CLIENT PROVIDER
 * 
 * Orchestrates:
 * 1. Idempotent Firebase Service Initialization.
 * 2. Zero-Trust App Check handshake via reCAPTCHA Enterprise.
 * 3. Contextual Provisioning for React trees.
 */
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [instances, setInstances] = useState<{
    app: FirebaseApp;
    firestore: Firestore;
    auth: Auth;
  } | null>(null);

  useEffect(() => {
    const { app, firestore, auth } = initializeFirebase();
    
    // TASK 3: App Check Token Handshake
    // reCAPTCHA Enterprise provides a cryptographic guarantee that the caller is your authorized Web App.
    if (typeof window !== 'undefined') {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
      
      if (siteKey) {
        try {
          initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(siteKey),
            isTokenAutoRefreshEnabled: true,
          });
          console.log('ROC_SEC_PULSE: App Check initiated via reCAPTCHA Enterprise.');
        } catch (e) {
          console.warn('ROC_SEC_ALERT: App Check failed to initialize. Verify Site Key in Google Cloud Console.');
        }
      } else {
        console.warn('ROC_SEC_ALERT: reCAPTCHA Site Key missing. App Check Enforcement is currently BYPASSED.');
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
