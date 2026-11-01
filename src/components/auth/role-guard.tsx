
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE')[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && profile && !allowedRoles.includes(profile.role)) {
      router.push('/');
    }
  }, [user, profile, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user || !profile || !allowedRoles.includes(profile.role)) {
    return null;
  }

  return <>{children}</>;
}
