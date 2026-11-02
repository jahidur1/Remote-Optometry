
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
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
  office?: string;
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

    // 1. Profile Subscription
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        
        // Immediate lockout if status is not Active
        if (data.status !== 'Active') {
           setSessionValid(false);
        }
      } else {
        setProfile(null);
      }
    });

    // 2. Session Integrity Subscription
    const sessionId = getLocalSessionId();
    const sessionDocRef = doc(firestore, 'sessions', `${user.uid}_${sessionId}`);
    
    const unsubscribeSession = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const now = new Date();
        
        // Handle both Timestamp and String deadlines for migration safety
        const deadline = data.deadlineAt instanceof Timestamp 
          ? data.deadlineAt.toDate() 
          : new Date(data.deadlineAt);
        
        const isActive = data.status === 'active' && now < deadline;
        
        setSessionData(data);
        // Only set valid if both session AND profile status are correct
        setSessionValid(isActive && profile?.status === 'Active');
      } else {
        setSessionValid(false);
      }
      setLoading(false);
    }, (error) => {
      console.error("Session integrity check failed:", error);
      setSessionValid(false);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeSession();
    };
  }, [user, firestore, profile?.status]);

  return { 
    user, 
    profile, 
    sessionData,
    sessionValid,
    loading, 
    emailVerified: true 
  };
}
