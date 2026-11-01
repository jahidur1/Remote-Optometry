
'use client';

import { useEffect, useState } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stethoscope, ShieldCheck, ArrowRight, Loader2, Sparkles, Building2 } from "lucide-react";
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // If user is already logged in, redirect them to the unified portal entry
  useEffect(() => {
    if (!loading && user && profile) {
      setIsRedirecting(true);
      if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/employee/portal');
      }
    }
  }, [user, profile, loading, router]);

  if (loading || isRedirecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary text-primary-foreground gap-4">
        <Loader2 className="size-12 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 animate-pulse">Initializing ROC Node</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary p-6 text-primary-foreground relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-4xl w-full space-y-16 text-center relative z-10">
        <div className="space-y-6">
          <div className="mx-auto size-24 rounded-[2rem] bg-secondary flex items-center justify-center shadow-2xl mb-8 transform hover:scale-110 transition-transform duration-500 border-4 border-white/10 group">
            <Stethoscope className="size-12 text-white group-hover:rotate-12 transition-transform" />
          </div>
          <div className="space-y-2">
             <h1 className="text-6xl font-black tracking-tighter font-headline sm:text-7xl uppercase leading-none">
               ROC <span className="text-accent italic">Workforce</span>
             </h1>
             <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary opacity-80">Institutional Shift Intelligence</p>
          </div>
          <p className="mx-auto max-w-[600px] text-lg text-primary-foreground/70 leading-relaxed font-medium">
            The next-generation clinical management platform for Remote Optometry Centres. 
            Optimized for accuracy, fairness, and atomic scheduling.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
           <Link href="/login" className="w-full max-w-sm">
             <Button className="w-full bg-white text-primary hover:bg-secondary hover:text-white h-16 text-lg font-black uppercase tracking-[0.1em] rounded-2xl shadow-2xl transition-all duration-300 group">
               Access Workforce Portal 
               <ArrowRight className="ml-3 size-5 group-hover:translate-x-2 transition-transform" />
             </Button>
           </Link>
           
           <div className="flex items-center gap-4 text-white/40">
              <div className="h-px w-12 bg-white/10" />
              <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Access Node 01</span>
              <div className="h-px w-12 bg-white/10" />
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-white/5 opacity-50">
           <div className="flex flex-col items-center gap-2">
              <ShieldCheck className="size-5 text-secondary" />
              <span className="text-[9px] font-black uppercase tracking-widest">Secure OTP</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Sparkles className="size-5 text-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest">AI Optimized</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Building2 className="size-5 text-secondary" />
              <span className="text-[9px] font-black uppercase tracking-widest">Institutional</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-5 text-accent animate-spin" />
              <span className="text-[9px] font-black uppercase tracking-widest">Atomic Sync</span>
           </div>
        </div>

        <div className="pt-12 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
          Powered by OR-Tools CP-SAT • Built for Precision Clinical Operations
        </div>
      </div>
    </div>
  );
}
