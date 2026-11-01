
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

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

    // Check email verification
    if (!emailVerified && pathname !== '/verify-email') {
      router.push('/verify-email');
      return;
    }

    // Check account status
    if (profile?.status === 'Inactive') {
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
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  // Final check to prevent content flash before redirect
  if (!user || (profile && !allowedRoles.includes(profile.role)) || (profile?.status === 'Inactive') || (!emailVerified && pathname !== '/verify-email')) {
    return null;
  }

  return <>{children}</>;
}
