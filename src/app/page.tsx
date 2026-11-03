"use client"

import { useEffect, useState } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Stethoscope, 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  Building2, 
  Terminal, 
  Activity,
  Zap,
  Cpu,
  Globe,
  Lock
} from "lucide-react";
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-white text-black gap-6">
        <Loader2 className="size-16 animate-spin text-primary opacity-30" />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Establishing Secure Node Link</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-black relative overflow-hidden font-body">
      {/* Institutional Topographic Overlay */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      
      {/* Professional Sub-Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary/5 rounded-full blur-[160px]" />
      </div>

      {/* System Status Node */}
      <div className="fixed top-8 right-8 z-50 hidden md:flex items-center gap-4 bg-white border border-border px-6 py-2.5 rounded-full shadow-sm">
         <div className="size-2 rounded-full bg-emerald-600 shadow-[0_0_10px_emerald]" />
         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">System Node: Operational</span>
      </div>

      <div className="max-w-4xl w-full space-y-20 text-center relative z-10">
        <div className="space-y-12">
          {/* Identity Mark */}
          <div className="relative mx-auto size-28 group">
            <div className="relative h-full w-full rounded-[2.5rem] bg-primary flex items-center justify-center shadow-2xl border-4 border-white transform transition-transform duration-700 group-hover:rotate-6 active:scale-95 cursor-default">
              <Stethoscope className="size-14 text-white group-hover:scale-110 transition-transform" />
            </div>
          </div>

          <div className="space-y-6">
             <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-muted border border-border animate-in fade-in slide-in-from-top-4 duration-700">
                <Terminal className="size-3.5 text-primary" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">Node v2.0 • Institutional Protocol</span>
             </div>
             
             <div className="space-y-2">
                <h1 className="text-7xl font-black tracking-tighter font-headline sm:text-[9rem] uppercase leading-[0.8] tracking-[-0.05em] text-black">
                  ROC <br /> <span className="text-primary italic">Workforce</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[1em] text-primary/40 mt-4 animate-in fade-in duration-1000">Intelligent Optimization Node</p>
             </div>
          </div>

          <p className="mx-auto max-w-[620px] text-lg text-muted-foreground leading-relaxed font-medium px-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Precision clinical orchestration for Remote Optometry Centres. 
            Powered by deterministic CP-SAT optimization and Zero-Trust identity architecture.
          </p>
        </div>

        <div className="flex flex-col items-center gap-12">
           <Link href="/login" className="w-full max-w-sm group">
             <Button className="w-full bg-primary text-white hover:bg-black h-20 text-xl font-black uppercase tracking-[0.15em] rounded-[1.5rem] shadow-xl transition-all duration-500 group-hover:translate-y-[-4px] border-none relative overflow-hidden">
               Enter Node Access 
               <ArrowRight className="ml-4 size-6 group-hover:translate-x-4 transition-transform" />
             </Button>
           </Link>
           
           <div className="flex items-center gap-8 text-black/5 px-4 w-full">
              <div className="h-[1px] flex-1 bg-border" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap text-muted-foreground/60">Authorized Credentials Managed by Node 01</span>
              <div className="h-[1px] flex-1 bg-border" />
           </div>
        </div>

        {/* Protocol Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-16 border-t border-border animate-in fade-in duration-1000 delay-500">
           {[
             { icon: ShieldCheck, label: "Zero-Trust", color: "text-primary", sub: "Auth Guard" },
             { icon: Sparkles, label: "CP-SAT Logic", color: "text-primary", sub: "Optimized" },
             { icon: Globe, label: "Cluster Sync", color: "text-primary", sub: "Cloud Native" },
             { icon: Cpu, label: "Deterministic", color: "text-primary", sub: "Proof Node" }
           ].map((item, i) => (
             <div key={i} className="flex flex-col items-center gap-4 group opacity-60 hover:opacity-100 transition-all duration-500 cursor-default">
                <div className="size-14 rounded-2xl bg-muted flex items-center justify-center border border-border transition-all group-hover:bg-primary group-hover:text-white group-hover:rotate-12 group-hover:scale-110">
                   <item.icon className={cn("size-7", "group-hover:text-white")} />
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-black leading-none">{item.label}</p>
                   <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{item.sub}</p>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Institutional Footer Trace */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center pointer-events-none opacity-10">
         <p className="text-[9px] font-black uppercase tracking-[1.5em] text-black">ROC INTELLIGENCE GRID</p>
      </div>
    </div>
  );
}