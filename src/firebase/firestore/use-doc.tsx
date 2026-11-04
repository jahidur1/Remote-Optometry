
'use client';

import { useState, useEffect } from 'react';
import { 
  type DocumentReference, 
  onSnapshot, 
  type DocumentSnapshot, 
  type DocumentData 
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/**
 * Institutional Data Hook: useDoc
 * Fetches a real-time stream of a single Firestore document.
 * 
 * Performance: Requires a stable DocumentReference (memoized in parent).
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    if (!data) setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<T>) => {
        setData(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null);
        setLoading(false);
      },
      async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(serverError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading, error };
}
