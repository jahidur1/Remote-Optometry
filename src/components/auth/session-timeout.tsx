
'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export function SessionTimeout() {
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const logout = async () => {
    if (auth.currentUser) {
      await signOut(auth);
      toast({
        title: "Session Expired",
        description: "You have been logged out due to 4 hours of inactivity.",
        variant: "destructive"
      });
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (user) {
      timeoutRef.current = setTimeout(logout, SESSION_TIMEOUT);
    }
  };

  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Initial start
    resetTimer();

    // Listen for activity
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user]);

  return null;
}
