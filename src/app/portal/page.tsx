
'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

/**
 * Unified Portal Dispatcher
 * This page serves as a generic entry point that dispatches users to the 
 * correct dashboard based on their role in the database.
 */
export default function PortalDispatcher() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (profile) {
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        router.push('/admin');
      } else {
        router.push('/employee/portal');
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-primary gap-8">
      {logo && (
        <div className="relative size-24 animate-pulse">
          <Image 
            src={logo.imageUrl} 
            alt="Remote Optometry" 
            fill 
            className="object-contain"
            data-ai-hint="remote optometry"
          />
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="size-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 animate-pulse">Syncing Unified Portal</p>
      </div>
    </div>
  );
}
