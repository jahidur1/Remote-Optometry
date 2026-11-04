
'use client';

import { useState, useEffect } from 'react';
import { 
  type Query, 
  onSnapshot, 
  type QuerySnapshot, 
  type DocumentData 
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/**
 * Institutional Data Hook: useCollection
 * Fetches a real-time stream of a Firestore collection.
 * 
 * Performance: Requires a stable Query object (memoized in parent).
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData(null);
      setLoading(false);
      return;
    }

    // Performance Optimization: Only set loading to true if we don't have data yet
    // to avoid flickering on re-subscriptions to stable queries.
    if (!data) setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        const items = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setData(items);
        setLoading(false);
      },
      async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: 'Collection Query',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(serverError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]); // Identity-based dependency requires memoized query from parent

  return { data, loading, error };
}
