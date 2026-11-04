'use client';

import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoutButtonProps {
  className?: string;
}

/**
 * Institutional Logout Component
 * Provides a high-visibility destructive pulse to terminate device sessions.
 */
export function LogoutButton({ className }: LogoutButtonProps) {
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout protocol failure:', error);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleLogout}
      className={cn(
        "font-black uppercase text-[10px] tracking-widest border-2 border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all rounded-xl px-4 h-10 shadow-sm",
        className
      )}
    >
      <LogOut className="size-4 mr-2" /> 
      <span className="hidden sm:inline">Log Out</span>
    </Button>
  );
}
