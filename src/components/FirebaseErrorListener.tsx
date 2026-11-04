
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Institutional Firebase Error Listener
 * 
 * Captures specialized FirestorePermissionError emissions and throws them as
 * uncaught exceptions. This triggers the Next.js development overlay with
 * rich context (auth, path, method, data) for rapid Security Rule debugging.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Throwing the error as an uncaught exception triggers the Next.js dev overlay
      throw error;
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
