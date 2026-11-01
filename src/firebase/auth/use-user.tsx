
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';
import { getLocalSessionId } from '@/lib/session-utils';

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
  const [sessionData, setSessionData] = useState<any>(null);
  const [sessionValid, setSessionValid] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setSessionData(null);
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
        setProfile(null);
      }
    });

    // Device-specific session policy enforcement (365-day)
    const sessionId = getLocalSessionId();
    const sessionDocRef = doc(firestore, 'sessions', `${user.uid}_${sessionId}`);
    
    const unsubscribeSession = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const now = new Date();
        const deadline = new Date(data.deadlineAt);
        const isActive = data.status === 'active' && now < deadline;
        
        setSessionData(data);
        setSessionValid(isActive);
      } else {
        // If Firebase Auth is valid but session record is missing, 
        // it means the device hasn't completed an OTP check recently or storage was cleared.
        setSessionValid(false);
      }
      setLoading(false);
    }, (error) => {
      console.error("Session lookup error:", error);
      setSessionValid(false);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeSession();
    };
  }, [user, firestore]);

  return { 
    user, 
    profile, 
    sessionData,
    sessionValid,
    loading, 
    emailVerified: true 
  };
}
