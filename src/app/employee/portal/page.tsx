
'use client';

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc, where } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CalendarDays, CheckCircle2, ArrowRight, Loader2, Building2, MapPin, Settings, Activity, Sparkles, User, Zap } from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"
import { cn } from "@/lib/utils"

function Countdown({ targetDate, onComplete, label }: { targetDate: string, onComplete?: () => void, label: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(targetDate).getTime() - now;
      
      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft('LIVE');
        onComplete?.();
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] font-black uppercase text-accent-foreground/50 tracking-widest">{label}</span>
      <span className="font-black tabular-nums text-2xl tracking-tighter text-accent-foreground">{timeLeft}</span>
    </div>
  );
}

export default function EmployeePortal() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentWeek = '2024-52'; 

  const publishedQuery = useMemo(() => {
    return query(
      collection(db, 'published_rosters'),
      where('weekId', '==', currentWeek),
      where('status', '==', 'active'),
      orderBy('publishedAt', 'desc'),
      limit(1)
    );
  }, [currentWeek]);

  const { data: publishedRosters, loading: rosterLoading } = useCollection(publishedQuery);
  const { data: shifts } = useCollection(query(collection(db, 'shift_master')));
  
  const bookingId = profile?.employeeId ? `${currentWeek}_${profile.employeeId}` : null;
  const { data: userBooking } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

  const myAssignments = useMemo(() => {
    if (!publishedRosters?.[0] || !profile?.employeeId) return [];
    return publishedRosters[0].assignments.filter((a: any) => a.employeeId === profile.employeeId);
  }, [publishedRosters, profile]);

  useEffect(() => {
    if (!profile?.office || !db) return;
    const q = query(
      collection(db, 'weekoff_configs'), 
      where('office', '==', profile.office),
      orderBy('weekId', 'desc'), 
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setActiveConfig(snapshot.docs[0].data());
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, profile]);

  const now = new Date();
  const isWindowOpen = activeConfig && now >= new Date(activeConfig.bookingOpen) && now <= new Date(activeConfig.bookingClose);
  const isWindowUpcoming = activeConfig && now < new Date(activeConfig.bookingOpen);

  if (userLoading || loading || rosterLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Establishing Node Connection</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-32 px-4 pt-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-primary uppercase leading-none">
              Welcome, <span className="text-secondary">{profile?.displayName?.split(' ')[0] || 'Professional'}</span>
            </h1>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-4 mt-2">
             <Badge className="bg-primary text-white border-none font-black text-[9px] uppercase tracking-widest py-1.5 px-5 rounded-full shadow-lg">
                <Building2 className="size-3 mr-2 text-secondary" /> {profile?.office?.replace('_', ' ')}
             </Badge>
             <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                Professional Unit: {profile?.employeeId} <MapPin className="size-3 text-accent" />
             </p>
          </div>
        </div>
        <Link href="/employee/profile">
            <Button variant="outline" className="rounded-2xl h-12 px-6 border-2 font-black uppercase text-[10px] tracking-widest bg-white hover:bg-muted shadow-sm transition-all group">
                <Settings className="size-4 mr-2 group-hover:rotate-90 transition-transform duration-500" /> Account Settings
            </Button>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          {userBooking ? (
            <Card className="border-none bg-emerald-600 text-white shadow-2xl rounded-[2.5rem] overflow-hidden relative group animate-in zoom-in-95 duration-500">
               <div className="absolute top-0 right-0 p-8 transform group-hover:scale-110 transition-transform duration-1000 opacity-10"><Sparkles size={220} /></div>
               <CardContent className="p-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="size-20 rounded-[2rem] bg-white/20 flex items-center justify-center shadow-inner border border-white/10 shrink-0">
                    <CheckCircle2 className="size-10 text-white" />
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-4">
                     <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/60">Protected Clinical Off-Day</p>
                        <p className="text-6xl font-black uppercase tracking-tighter italic leading-none">{userBooking.dayOfWeek}</p>
                     </div>
                     <p className="text-[12px] font-bold text-white/80 uppercase leading-relaxed tracking-tight max-w-lg">
                        CONGRATULATIONS! Your preference for Week {currentWeek} is secured and locked in the institutional registry.
                     </p>
                  </div>
               </CardContent>
            </Card>
          ) : activeConfig && (
            <Card className="border-none bg-accent/5 shadow-2xl rounded-[2.5rem] overflow-hidden border-2 border-accent/10 transition-all hover:bg-accent/[0.08] relative group">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Zap size={140} /></div>
              <CardContent className="p-10">
                  <div className="flex flex-col sm:flex-row items-center gap-12">
                     <div className="size-24 rounded-[2rem] bg-accent flex items-center justify-center shrink-0 shadow-2xl shadow-accent/20 group-hover:scale-105 transition-all">
                        <Clock className="size-12 text-accent-foreground" />
                     </div>
                     <div className="flex-1 space-y-6 text-center sm:text-left">
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">FCFS Pulse Matrix</p>
                           <h2 className="text-3xl font-black uppercase tracking-tight text-primary">Slot Reservation Active</h2>
                        </div>
                        <div className="flex flex-wrap gap-8 justify-center sm:justify-start bg-accent/10 p-6 rounded-3xl border border-accent/20">
                          {isWindowUpcoming && <Countdown targetDate={activeConfig.bookingOpen} label="Pulse Initiates In" />}
                          {isWindowOpen && <Countdown targetDate={activeConfig.bookingClose} label="Pulse Terminates In" />}
                        </div>
                        {isWindowOpen && (
                          <Link href="/employee/book-off" className="block">
                            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-black uppercase tracking-[0.3em] h-16 rounded-[1.5rem] shadow-2xl transition-all group/btn">
                              Enter Pulse Matrix <ArrowRight className="ml-3 size-6 group-hover/btn:translate-x-2 transition-transform" />
                            </Button>
                          </Link>
                        )}
                     </div>
                  </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2.5rem]">
             <CardHeader className="bg-primary p-10 text-primary-foreground border-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5"><CalendarDays size={240} /></div>
                <div className="flex items-center justify-between relative z-10">
                   <div className="space-y-1">
                       <CardTitle className="text-2xl flex items-center gap-5 font-black uppercase tracking-tight leading-none">
                          <Clock className="size-8 text-secondary" /> Shift Deployment
                       </CardTitle>
                       <CardDescription className="text-[11px] uppercase font-black text-white/40 tracking-[0.2em] mt-3">Active Cycle: Week {currentWeek}</CardDescription>
                   </div>
                   <Badge className="bg-white/10 text-white font-black text-[9px] uppercase px-5 py-2 rounded-full border-none">Institutional Node: {profile?.office?.substring(0,3)}</Badge>
                </div>
             </CardHeader>
             <CardContent className="p-10 space-y-5 bg-muted/10">
                {myAssignments.length > 0 ? (
                  myAssignments.sort((a: any, b: any) => {
                    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                    return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                  }).map((a: any, i: number) => {
                    const shift = shifts?.find(s => s.id === a.shiftId);
                    return (
                      <div key={i} className="flex items-center justify-between p-8 rounded-[2rem] bg-white border-2 border-transparent hover:border-secondary/10 shadow-sm transition-all group">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-3xl uppercase tracking-tighter text-primary group-hover:translate-x-2 transition-transform">{a.dayOfWeek}</span>
                          <div className="flex items-center gap-4">
                             <Badge variant="outline" className="text-[10px] font-black text-secondary border-secondary/20 uppercase px-4 py-1 rounded-lg">
                                {shift?.name || a.shiftId}
                             </Badge>
                             <span className="text-[11px] text-muted-foreground font-black tracking-widest uppercase opacity-60 flex items-center gap-2">
                                <Clock className="size-3" /> {shift?.startTime} — {shift?.endTime} IST
                             </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-24 bg-muted/30 rounded-[3rem] border-4 border-dashed border-muted transition-all">
                     <CalendarDays className="size-24 text-muted-foreground/10 mx-auto mb-8 animate-pulse" />
                     <p className="text-xl font-black text-muted-foreground uppercase tracking-tight">Schedule Node Pending</p>
                     <p className="text-[10px] text-muted-foreground/40 uppercase mt-3 max-w-[280px] mx-auto leading-relaxed font-black tracking-[0.2em]">Administrative audit in progress for your clinical cluster.</p>
                  </div>
                )}
             </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden rounded-[2.5rem] relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700"><Activity size={180} /></div>
            <CardHeader className="p-10 pb-6 border-b border-white/5">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] flex items-center gap-4 text-secondary">
                <Activity className="size-5" /> Institutional Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="p-10 pt-8 space-y-10 relative z-10">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                   <div className="size-3 rounded-full bg-emerald-500 shadow-[0_0_15px_emerald]" />
                   <p className="text-[13px] font-black tracking-widest text-white/90 uppercase">Cluster Verified</p>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed uppercase font-black tracking-[0.1em]">
                   Workforce rosters are mathematically optimized. Mandatory shift-briefings via Meta Cloud API occur daily at **22:00 IST** for all published cycles.
                </p>
              </div>

              <div className="pt-10 border-t border-white/5 space-y-6">
                 <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Office Registry</p>
                 <div className="p-6 rounded-[1.75rem] bg-white/5 border border-white/10 space-y-2">
                    <p className="text-sm font-black text-white/80 uppercase">
                       {profile?.office?.replace('_', ' ')}
                    </p>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">ROC NODE 01 • PROD</p>
                 </div>
              </div>
              
              <Link href="/employee/swaps" className="block pt-4">
                 <Button variant="outline" className="w-full h-14 border-white/10 hover:bg-white/5 text-white font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl transition-all">
                    Clinical Shift Exchange
                 </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-2xl border-none rounded-[2.5rem] overflow-hidden p-10 space-y-6 group">
             <div className="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                <User className="size-7" />
             </div>
             <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Professional Identity</p>
                <p className="text-xl font-black text-primary uppercase tracking-tight truncate">{profile?.displayName}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">ID: {profile?.employeeId}</p>
             </div>
             <Link href="/employee/profile" className="block pt-4">
                <Button variant="ghost" className="w-full text-secondary font-black uppercase text-[10px] tracking-[0.2em] h-12 hover:bg-secondary/5 rounded-xl">
                   View Full Profile
                </Button>
             </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
