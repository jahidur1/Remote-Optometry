
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
  Globe,
  Cpu
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
              priority
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4 sm:p-6 text-black relative overflow-hidden font-body">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-50/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-50/50 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="max-w-4xl w-full space-y-12 sm:space-y-16 text-center relative z-10 py-10">
        <div className="space-y-10 animate-slide-up">
          {/* Identity Mark */}
          <div className="relative mx-auto size-24 sm:size-32 group">
            <div className="relative h-full w-full transform transition-all duration-700 group-hover:scale-105 cursor-default">
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
          </div>

          {/* Main Cinematic Heading */}
          <div className="space-y-4 px-2">
             <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tighter font-headline sm:text-6xl md:text-7xl uppercase leading-[0.9] text-black">
                  Remote <br /> <span className="text-[#0F172A] italic">Optometry</span>
                </h1>
                <p className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.4em] text-black/30 mt-4">
                  Intelligent Optimization Node
                </p>
             </div>
          </div>

          {/* Value Proposition */}
          <p className="mx-auto max-w-[580px] text-base sm:text-lg text-slate-500 leading-relaxed font-medium px-4">
            Precision clinical orchestration for Remote Optometry Centres. 
            Powered by deterministic CP-SAT optimization and Zero-Trust identity architecture.
          </p>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col items-center gap-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
           <Link href="/login" className="w-full max-w-[320px] group px-4">
             <Button className="w-full bg-[#0F172A] text-white hover:bg-black h-16 sm:h-18 text-lg font-black uppercase tracking-[0.15em] rounded-2xl shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] transition-all duration-500 hover:scale-[1.02] active:scale-95 border-none relative overflow-hidden group">
               <span className="relative z-10 flex items-center justify-center">
                 Authentication
                 <ArrowRight className="ml-3 size-5 group-hover:translate-x-2 transition-transform" />
               </span>
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
             </Button>
           </Link>
           
           {/* Visual Divider */}
           <div className="flex items-center gap-6 text-black/10 px-6 w-full max-w-lg mx-auto">
              <div className="h-[1px] flex-1 bg-slate-100" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] whitespace-nowrap text-black/20">Institutional Credentials Required</span>
              <div className="h-[1px] flex-1 bg-slate-100" />
           </div>
        </div>

        {/* Protocol Matrix - 2x2 Grid Like the Reference */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:gap-x-16 sm:gap-y-16 max-w-2xl mx-auto pt-12 animate-slide-up" style={{ animationDelay: '0.4s' }}>
           {[
             { icon: ShieldCheck, label: "Zero-Trust", sub: "Auth Guard" },
             { icon: Sparkles, label: "CP-SAT Logic", sub: "Deterministic" },
             { icon: Globe, label: "Cluster Sync", sub: "Cloud Native" },
             { icon: Cpu, label: "Optimization", sub: "Proof Node" }
           ].map((item, i) => (
             <div key={i} className="flex flex-col items-center gap-4 group cursor-default">
                <div className="size-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                   <item.icon className="size-6 text-black/60 group-hover:text-black transition-colors" strokeWidth={1.5} />
                </div>
                <div className="space-y-1 text-center">
                   <p className="text-[11px] font-black uppercase tracking-widest text-black leading-none">{item.label}</p>
                   <p className="text-[9px] font-bold uppercase tracking-widest text-black/30 group-hover:text-black/40 transition-colors">{item.sub}</p>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Footer Branding Trace */}
      <div className="fixed bottom-10 left-0 right-0 flex justify-center pointer-events-none opacity-[0.04] overflow-hidden">
         <p className="text-[10px] font-black uppercase tracking-[1.5em] text-black whitespace-nowrap">REMOTE OPTOMETRY GRID</p>
      </div>
    </div>
  );
}
