
'use client';

import { useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Unified Portal Redirector
 * This page serves as a generic entry point that dispatches users to the 
 * correct dashboard based on their role in the database.
 */
export default function PortalDispatcher() {
  const { user, profile, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (profile) {
      if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/employee/portal');
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-primary gap-4">
      <Loader2 className="size-12 animate-spin text-secondary" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 animate-pulse uppercase">Syncing Unified Portal</p>
    </div>
  );
}
