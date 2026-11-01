
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldAlert, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE')[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, sessionValid, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Check account status
    if (profile?.status === 'Suspended') {
      router.push('/account-disabled');
      return;
    }

    // Check role access
    if (profile && !allowedRoles.includes(profile.role)) {
      router.push('/unauthorized');
      return;
    }

    // Check 365-day session validity (Crucial Requirement C)
    if (!sessionValid && pathname !== '/login' && pathname !== '/account-disabled' && pathname !== '/unauthorized') {
      // Session expired or revoked
      console.warn("Session invalid, redirecting to re-verification.");
    }
  }, [user, profile, sessionValid, loading, allowedRoles, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Verifying Precision Session</p>
      </div>
    );
  }

  // Re-verification screen for expired sessions
  if (user && !sessionValid && pathname !== '/login') {
    return (
      <div className="flex h-screen items-center justify-center bg-primary p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center space-y-6 shadow-2xl">
           <div className="mx-auto size-16 rounded-2xl bg-secondary/10 flex items-center justify-center">
              <Clock className="size-10 text-secondary" />
           </div>
           <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Re-Verification Required</h2>
           <p className="text-sm text-muted-foreground leading-relaxed">
              Your device session has reached the 365-day security deadline or was revoked by an administrator. 
              Please re-verify with OTP to continue.
           </p>
           <Button className="w-full h-12 font-black uppercase tracking-widest bg-secondary" onClick={() => signOut(auth).then(() => router.push('/login'))}>
              Verify with Mobile OTP
           </Button>
        </div>
      </div>
    );
  }

  const isAuthorized = user && profile && sessionValid && allowedRoles.includes(profile.role) && profile.status !== 'Suspended';

  if (!isAuthorized && pathname !== '/login' && pathname !== '/account-disabled' && pathname !== '/unauthorized') {
    return null;
  }

  return <div className="animate-in">{children}</div>;
}
