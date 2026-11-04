'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { useAuth } from '@/firebase';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('super_admin' | 'admin' | 'user')[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, sessionValid, emailVerified, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (pathname !== '/login') router.push('/login');
      return;
    }

    if (profile?.status === 'Suspended') {
      router.push('/account-disabled');
      return;
    }

    const isEmailUser = user.providerData.some(p => p.providerId === 'password' || p.providerId === 'google.com');
    if (isEmailUser && !emailVerified) {
       if (pathname !== '/verify-email') {
          sendEmailVerification(user).catch(err => console.warn("Verification Pulse Throttled"));
          router.push('/verify-email');
          return;
       }
       return; 
    }

    if (profile && !allowedRoles.includes(profile.role)) {
      router.push('/unauthorized');
      return;
    }
  }, [user, profile, sessionValid, emailVerified, loading, allowedRoles, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Verifying Session Status</p>
      </div>
    );
  }

  if (user && !sessionValid && pathname !== '/login' && pathname !== '/verify-email') {
    return (
      <div className="flex h-screen items-center justify-center bg-primary p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center space-y-6 shadow-2xl">
           <div className="mx-auto size-16 rounded-2xl bg-secondary/10 flex items-center justify-center">
              <Clock className="size-10 text-secondary" />
           </div>
           <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Re-Verification Required</h2>
           <p className="text-sm text-muted-foreground leading-relaxed">
              Your device session has reached the 30-day security deadline or was revoked by administration. 
              Please re-verify with your mobile OTP to continue.
           </p>
           <Button className="w-full h-12 font-black uppercase tracking-widest bg-secondary" onClick={() => signOut(auth).then(() => router.push('/login'))}>
              Authorize Device with OTP
           </Button>
        </div>
      </div>
    );
  }

  if (pathname === '/verify-email' && emailVerified) {
     return null; 
  }

  const isAuthorized = user && profile && sessionValid && allowedRoles.includes(profile.role) && (emailVerified || !user.providerData.some(p => p.providerId === 'password'));

  if (!isAuthorized && pathname !== '/login' && pathname !== '/account-disabled' && pathname !== '/unauthorized' && pathname !== '/verify-email') {
    return null;
  }

  return <div className="animate-in">{children}</div>;
}
