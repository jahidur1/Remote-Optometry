
'use client';

import { useEffect, useState } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stethoscope, ShieldCheck, ArrowRight, Loader2, Sparkles, Building2, Terminal } from "lucide-react";
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

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
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 animate-pulse">Initializing Institutional Node</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary p-6 text-primary-foreground relative overflow-hidden">
      {/* Precision Grid Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-4xl w-full space-y-16 text-center relative z-10">
        <div className="space-y-8">
          <div className="mx-auto size-24 rounded-[2.5rem] bg-secondary flex items-center justify-center shadow-2xl mb-8 transform hover:rotate-6 transition-transform duration-500 border-4 border-white/10 group shadow-secondary/20">
            <Stethoscope className="size-12 text-white group-hover:scale-110 transition-transform" />
          </div>
          <div className="space-y-4">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-2">
                <Terminal className="size-3 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Node V1.2.0 • Production Ready</span>
             </div>
             <h1 className="text-7xl font-black tracking-tighter font-headline sm:text-8xl uppercase leading-[0.85]">
               ROC <span className="text-secondary italic">Workforce</span>
             </h1>
             <p className="text-xs font-black uppercase tracking-[0.5em] text-accent/80">Intelligent Workforce Management</p>
          </div>
          <p className="mx-auto max-w-[620px] text-lg text-primary-foreground/60 leading-relaxed font-medium">
            Standardizing precision scheduling for Remote Optometry Centres. 
            Powered by Google OR-Tools and Zero-Trust identity protocols.
          </p>
        </div>

        <div className="flex flex-col items-center gap-8">
           <Link href="/login" className="w-full max-w-sm group">
             <Button className="w-full bg-white text-primary hover:bg-secondary hover:text-white h-20 text-xl font-black uppercase tracking-[0.1em] rounded-3xl shadow-2xl transition-all duration-500 group-hover:translate-y-[-4px]">
               Enter Access Node 
               <ArrowRight className="ml-4 size-6 group-hover:translate-x-2 transition-transform" />
             </Button>
           </Link>
           
           <div className="flex items-center gap-6 text-white/20">
              <div className="h-px w-16 bg-white/10" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Authorized Access Only</span>
              <div className="h-px w-16 bg-white/10" />
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-16 border-t border-white/5">
           {[
             { icon: ShieldCheck, label: "Zero-Trust", color: "text-secondary" },
             { icon: Sparkles, label: "AI Solver", color: "text-accent" },
             { icon: Building2, label: "Cluster Sync", color: "text-secondary" },
             { icon: Loader2, label: "Atomic Commit", color: "text-accent", animate: "animate-spin" }
           ].map((item, i) => (
             <div key={i} className="flex flex-col items-center gap-3 group opacity-40 hover:opacity-100 transition-opacity">
                <div className={cn("size-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 transition-all group-hover:bg-white group-hover:text-primary", item.animate)}>
                   <item.icon className="size-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{item.label}</span>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
