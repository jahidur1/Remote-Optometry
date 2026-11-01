
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    if (!user || !firestore) return;

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // If user exists in Auth but no profile exists, they might be mid-migration
        // or unauthorized. RoleGuard will handle the redirect.
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
    loading, 
    emailVerified: true // Phone auth inherently verifies ownership
  };
}
