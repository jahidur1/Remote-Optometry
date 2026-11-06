
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Decommissioned Registry Hub
 * Enrollment is now centralized within the Super Admin Dashboard.
 */
export default function DecommissionedRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-10 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground animate-pulse">Redirecting to Terminal</p>
      </div>
    </div>
  );
}
