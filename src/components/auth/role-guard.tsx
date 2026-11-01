
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE')[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, loading, emailVerified } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Check email verification - strictly enforced for production
    if (!emailVerified && pathname !== '/verify-email') {
      router.push('/verify-email');
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
  }, [user, profile, loading, emailVerified, allowedRoles, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Verifying Credentials</p>
      </div>
    );
  }

  // Double-gate check to prevent unauthorized flash
  const isAuthorized = user && profile && allowedRoles.includes(profile.role) && profile.status !== 'Suspended' && emailVerified;

  if (!isAuthorized && pathname !== '/verify-email' && pathname !== '/login' && pathname !== '/account-disabled' && pathname !== '/unauthorized') {
    return null;
  }

  return <div className="animate-in">{children}</div>;
}
