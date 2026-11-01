
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';
import { validateSession } from '@/lib/session-utils';

export type UserProfile = {
  uid: string;
  email: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
  displayName: string | null;
  status?: 'Active' | 'Inactive' | 'Suspended';
  employeeId?: string;
  phoneNumber?: string;
};

export function useUser() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setSessionValid(false);
        setLoading(false);
      } else {
        // Initial session check
        const { valid } = await validateSession(firestore, firebaseUser.uid);
        setSessionValid(valid);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, firestore]);

  useEffect(() => {
    if (!user || !firestore) return;

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user profile:", error);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user, firestore]);

  return { 
    user, 
    profile, 
    sessionValid,
    loading, 
    emailVerified: true // Phone auth implies verification
  };
}
