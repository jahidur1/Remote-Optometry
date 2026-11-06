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
  Cpu,
  Target,
  Zap,
  Lock,
  Activity,
  ChevronRight,
  Database
} from "lucide-react";
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Home() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  useEffect(() => {
    if (!loading && user && profile) {
      setIsRedirecting(true);
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        router.push('/admin');
      } else {
        router.push('/employee/portal');
      }
    }
  }, [user, profile, loading, router]);

  if (loading || isRedirecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white text-black gap-10">
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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-10 animate-spin text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground animate-pulse">Establishing Secure System Link</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-black font-body overflow-x-hidden">
      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-blue-50/50 rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-slate-50/80 rounded-full blur-[120px] opacity-40" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '48px 48px' }} />
      </div>

      {/* Global Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/70 backdrop-blur-3xl px-6 md:px-12">
        <div className="container mx-auto flex h-20 items-center justify-between">
          <div className="flex items-center gap-4 group cursor-default">
            {logo && (
              <div className="relative size-10 transform group-hover:rotate-6 transition-all duration-500">
                <Image src={logo.imageUrl} alt="ROC" fill className="object-contain" />
              </div>
            )}
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black uppercase tracking-tighter">Remote <span className="text-secondary">Optometry</span></span>
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-black/30 mt-1">Institutional Node</span>
            </div>
          </div>
          <Link href="/login">
            <Button variant="outline" className="h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 hover:bg-slate-50 transition-all shadow-sm">
              Authorize Access
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-24 pb-32 text-center space-y-12 animate-in">
          <div className="space-y-6">
            <Badge variant="outline" className="px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.3em] border-secondary/20 text-secondary bg-secondary/5 mb-4 shadow-inner">
               Professional Workforce Grid v6.0
            </Badge>
            <h1 className="text-5xl md:text-8xl font-black tracking-[-0.05em] uppercase leading-[0.85] max-w-5xl mx-auto">
              Precision <br /> 
              <span className="text-primary italic">Orchestration</span> for <br /> 
              Clinical Hubs
            </h1>
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-slate-500 font-medium leading-relaxed pt-4">
              The unified standard for Remote Optometry Centres. Deterministic shift optimization, 
              Atomic FCFS reservations, and Zero-Trust identity governance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
            <Link href="/login" className="w-full sm:w-auto group">
              <Button className="w-full sm:w-72 bg-primary text-white h-20 text-[13px] font-black uppercase tracking-[0.25em] rounded-2xl shadow-3xl hover:bg-black transition-all group overflow-hidden relative">
                 <span className="relative z-10 flex items-center">Launch Portal Hub <ArrowRight className="ml-3 size-5 group-hover:translate-x-2 transition-transform" /></span>
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </Button>
            </Link>
            <Link href="/user_registration_roc_lenskart_2026" className="w-full sm:w-auto">
               <Button variant="ghost" className="w-full sm:w-72 h-20 text-[13px] font-black uppercase tracking-[0.2em] rounded-2xl border-2 border-slate-100 hover:bg-slate-50 transition-all">
                  Self-Enrollment
               </Button>
            </Link>
          </div>
        </section>

        {/* Feature Matrix Section */}
        <section className="bg-slate-50/50 border-y border-slate-100 py-32 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-20 opacity-[0.03] pointer-events-none"><Cpu size={400} /></div>
           <div className="container mx-auto px-6">
              <div className="grid gap-12 lg:grid-cols-3">
                 {[
                   {
                     icon: Cpu,
                     title: "Pure-Logic Engine",
                     desc: "No AI hallucinations. 100% deterministic constraint satisfaction strictly enforcing staffing floors and adjacency rules.",
                     badge: "MATHEMATICAL ACCURACY"
                   },
                   {
                     icon: Zap,
                     title: "Atomic FCFS Sync",
                     desc: "High-concurrency week-off reservation matrix with millisecond-precision slot locking and clinical quota protection.",
                     badge: "REAL-TIME RESERVATION"
                   },
                   {
                     icon: ShieldCheck,
                     title: "Zero-Trust Security",
                     desc: "Institutional identity mapping with persistent session tracing, 30-day security cycles, and immutable audit logs.",
                     badge: "GOVERNANCE GRADE"
                   }
                 ].map((feature, i) => (
                   <div key={i} className="group p-12 rounded-[3rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:border-secondary/20 transition-all duration-500 hover:-translate-y-2">
                      <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary mb-10 group-hover:scale-110 transition-transform">
                         <feature.icon className="size-8" />
                      </div>
                      <Badge variant="outline" className="text-[8px] font-black tracking-[0.3em] mb-4 border-slate-100 text-slate-400 group-hover:text-secondary group-hover:border-secondary/20 transition-colors">
                        {feature.badge}
                      </Badge>
                      <h3 className="text-2xl font-black uppercase tracking-tight mb-4 group-hover:text-primary">{feature.title}</h3>
                      <p className="text-slate-500 font-medium leading-relaxed uppercase text-[11px] tracking-widest">{feature.desc}</p>
                   </div>
                 ))}
              </div>
           </div>
        </section>

        {/* Protocol Grid */}
        <section className="container mx-auto px-6 py-32 space-y-24">
           <div className="max-w-5xl mx-auto space-y-16">
              <div className="space-y-6 text-center">
                 <p className="text-secondary font-black uppercase text-[11px] tracking-[0.5em]">Institutional Standard</p>
                 <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-[0.95]">Deterministic <br /> Roster Governance</h2>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                 {[
                   { icon: Target, label: "Assignment Floors", sub: "Strictly satisfy minimum clinical headcount requirements." },
                   { icon: Activity, label: "100% Utilization", sub: "Automatically distribute excess professionals to maximize capacity." },
                   { icon: Lock, label: "Singleton Registry", sub: "Prevent data duplication via deterministic unique week identifiers." }
                 ].map((item, i) => (
                   <div key={i} className="flex flex-col items-center text-center gap-6 group p-8 rounded-[2.5rem] bg-slate-50/50 border border-transparent hover:border-slate-100 hover:bg-white transition-all">
                      <div className="size-16 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 group-hover:bg-secondary group-hover:text-white transition-all group-hover:scale-110">
                         <item.icon className="size-7" />
                      </div>
                      <div className="space-y-3">
                         <p className="font-black text-xl uppercase tracking-tight leading-none">{item.label}</p>
                         <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest leading-relaxed">{item.sub}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </section>

        {/* Global Hub Connect */}
        <section className="container mx-auto px-6 pb-40">
           <div className="p-16 md:p-24 rounded-[4rem] bg-[#0F172A] text-white relative overflow-hidden group border-none shadow-[0_50px_100px_-20px_rgba(15,23,42,0.5)]">
              <div className="absolute top-0 right-0 p-20 opacity-5 transform group-hover:rotate-12 transition-transform duration-[2s]"><Globe size={400} /></div>
              <div className="max-w-3xl space-y-10 relative z-10">
                 <Badge className="bg-secondary text-white border-none font-black text-[10px] tracking-[0.4em] px-8 py-2 rounded-full shadow-lg">CLOUD NATIVE INFRASTRUCTURE</Badge>
                 <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tight leading-[0.9]">
                    One Network. <br /> All <span className="text-secondary italic">Clinical</span> Hubs.
                 </h2>
                 <p className="text-xl text-white/40 font-medium leading-relaxed">
                   Authorized professionals can access their respective ROC center portal via the universal authentication link. 
                   Real-time synchronization ensures 100% schedule visibility.
                 </p>
                 <Link href="/login" className="block pt-6">
                    <Button className="h-20 px-16 bg-white text-primary hover:bg-slate-100 font-black uppercase tracking-[0.3em] rounded-3xl transition-all shadow-2xl hover:scale-105 active:scale-95">
                       Enter Command Hub <ChevronRight className="ml-4 size-6" />
                    </Button>
                 </Link>
              </div>
           </div>
        </section>
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-100 py-20 px-6 bg-slate-50/50">
         <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex items-center gap-4 opacity-30 grayscale">
              {logo && <div className="relative size-8"><Image src={logo.imageUrl} alt="ROC" fill className="object-contain" /></div>}
              <span className="text-sm font-black uppercase tracking-widest">Remote Optometry Grid</span>
            </div>
            <div className="flex gap-12">
               {['Governance', 'Registry', 'Compliance', 'Terminal'].map((link, i) => (
                 <p key={i} className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 cursor-default hover:text-secondary transition-colors">{link}</p>
               ))}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">
               © 2026 INSTITUTIONAL PROTOCOL
            </div>
         </div>
      </footer>
    </div>
  );
}
