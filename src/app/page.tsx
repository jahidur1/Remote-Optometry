"use client"

import { useEffect, useState } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stethoscope, ShieldCheck, ArrowRight, Loader2, Sparkles, Building2, Terminal, Activity } from "lucide-react";
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

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
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 animate-pulse">Establishing Secure Node Link</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary p-6 text-primary-foreground relative overflow-hidden">
      {/* Precision Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary rounded-full blur-[140px]"></div>
      </div>

      <div className="max-w-4xl w-full space-y-20 text-center relative z-10">
        <div className="space-y-10">
          <div className="mx-auto size-24 rounded-[2.5rem] bg-secondary flex items-center justify-center shadow-2xl mb-8 transform hover:rotate-6 transition-transform duration-500 border-4 border-white/10 group shadow-secondary/30">
            <Stethoscope className="size-12 text-white group-hover:scale-110 transition-transform" />
          </div>
          <div className="space-y-6">
             <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-2 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
                <Terminal className="size-3 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/70">Node v2.0 • Institutional Ready</span>
             </div>
             <h1 className="text-7xl font-black tracking-tighter font-headline sm:text-9xl uppercase leading-[0.8]">
               ROC <span className="text-secondary italic">Workforce</span>
             </h1>
             <p className="text-xs font-black uppercase tracking-[0.8em] text-accent/80 animate-in fade-in duration-1000">Intelligent Optimization Node</p>
          </div>
          <p className="mx-auto max-w-[680px] text-lg text-primary-foreground/60 leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Precision workforce orchestration for Remote Optometry Centres. 
            Powered by Google OR-Tools CP-SAT mathematical optimization and Zero-Trust identity.
          </p>
        </div>

        <div className="flex flex-col items-center gap-10">
           <Link href="/login" className="w-full max-w-sm group">
             <Button className="w-full bg-white text-primary hover:bg-secondary hover:text-white h-20 text-xl font-black uppercase tracking-[0.1em] rounded-3xl shadow-2xl transition-all duration-500 group-hover:translate-y-[-6px] group-hover:shadow-secondary/20">
               Enter Node Access 
               <ArrowRight className="ml-4 size-6 group-hover:translate-x-3 transition-transform" />
             </Button>
           </Link>
           
           <div className="flex items-center gap-8 text-white/10 px-4">
              <div className="h-px flex-1 min-w-20 bg-gradient-to-r from-transparent to-white/10" />
              <span className="text-[10px] font-black uppercase tracking-[0.6em] whitespace-nowrap">Authorized Credentials Only</span>
              <div className="h-px flex-1 min-w-20 bg-gradient-to-l from-transparent to-white/10" />
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-16 border-t border-white/5 animate-in fade-in duration-1000 delay-500">
           {[
             { icon: ShieldCheck, label: "Zero-Trust", color: "text-secondary" },
             { icon: Sparkles, label: "CP-SAT Logic", color: "text-accent" },
             { icon: Building2, label: "Cluster Sync", color: "text-secondary" },
             { icon: Activity, label: "Live Optimization", color: "text-accent" }
           ].map((item, i) => (
             <div key={i} className="flex flex-col items-center gap-4 group opacity-30 hover:opacity-100 transition-all duration-500">
                <div className={cn("size-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 transition-all group-hover:bg-white group-hover:text-primary group-hover:rotate-12")}>
                   <item.icon className="size-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{item.label}</span>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}