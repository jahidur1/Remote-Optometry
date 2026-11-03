
"use client"

import { useEffect, useState } from 'react';
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  Terminal, 
  Activity,
  Zap,
  Cpu,
  Globe
} from "lucide-react";
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-white text-black gap-8">
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
          <Loader2 className="size-8 animate-spin text-primary opacity-30" />
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground">Establishing Secure Node Link</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFFFF] p-6 text-black relative overflow-hidden font-body">
      {/* High-Intensity mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-50/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-50/50 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="max-w-4xl w-full space-y-24 text-center relative z-10">
        <div className="space-y-12 animate-slide-up">
          {/* Identity Mark - Logo Integration */}
          <div className="relative mx-auto size-40 group">
            <div className="relative h-full w-full transform transition-all duration-700 group-hover:rotate-6 group-hover:scale-110 active:scale-95 cursor-default">
              {logo && (
                <Image 
                  src={logo.imageUrl} 
                  alt="Remote Optometry" 
                  fill 
                  className="object-contain"
                  priority
                  data-ai-hint="remote optometry"
                />
              )}
            </div>
            <div className="absolute -inset-8 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
          </div>

          <div className="space-y-8">
             <div className="space-y-4">
                <h1 className="text-8xl font-black tracking-tight font-headline sm:text-[10rem] uppercase leading-[0.8] text-black">
                  Remote <br /> <span className="text-primary italic">Optometry</span>
                </h1>
                <p className="text-[11px] font-black uppercase tracking-[1.2em] text-primary/30 mt-6">Intelligent Optimization Node</p>
             </div>
          </div>

          <p className="mx-auto max-w-[660px] text-xl text-slate-600 leading-relaxed font-medium px-4">
            Precision clinical orchestration for Remote Optometry Centres. 
            Powered by deterministic CP-SAT optimization and Zero-Trust identity architecture.
          </p>
        </div>

        <div className="flex flex-col items-center gap-14 animate-slide-up" style={{ animationDelay: '0.2s' }}>
           <Link href="/login" className="w-full max-w-sm group">
             <Button className="w-full bg-primary text-white hover:bg-black h-20 text-xl font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-2xl transition-all duration-500 hover:scale-[1.02] active:scale-95 border-none relative overflow-hidden group">
               <span className="relative z-10 flex items-center justify-center">
                 Authentication
                 <ArrowRight className="ml-4 size-7 group-hover:translate-x-4 transition-transform" />
               </span>
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
             </Button>
           </Link>
           
           <div className="flex items-center gap-8 text-black/10 px-4 w-full">
              <div className="h-[1px] flex-1 bg-slate-200" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap text-black/40">Institutional Credentials Required</span>
              <div className="h-[1px] flex-1 bg-slate-200" />
           </div>
        </div>

        {/* Protocol Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-20 border-t border-slate-100 animate-slide-up" style={{ animationDelay: '0.4s' }}>
           {[
             { icon: ShieldCheck, label: "Zero-Trust", color: "text-primary", sub: "Auth Guard" },
             { icon: Sparkles, label: "CP-SAT Logic", color: "text-primary", sub: "Deterministic" },
             { icon: Globe, label: "Cluster Sync", color: "text-primary", sub: "Cloud Native" },
             { icon: Cpu, label: "Optimization", color: "text-primary", sub: "Proof Node" }
           ].map((item, i) => (
             <div key={i} className="flex flex-col items-center gap-5 group opacity-70 hover:opacity-100 transition-all duration-500 cursor-default">
                <div className="size-16 rounded-[1.75rem] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-slate-50 transition-all group-hover:bg-primary group-hover:text-white group-hover:rotate-12 group-hover:scale-110">
                   <item.icon className="size-8" />
                </div>
                <div className="space-y-1.5">
                   <p className="text-[11px] font-black uppercase tracking-widest text-black leading-none">{item.label}</p>
                   <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{item.sub}</p>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Institutional Footer Trace */}
      <div className="fixed bottom-10 left-0 right-0 flex justify-center pointer-events-none opacity-[0.05]">
         <p className="text-[10px] font-black uppercase tracking-[2em] text-black">REMOTE OPTOMETRY GRID</p>
      </div>
    </div>
  );
}
