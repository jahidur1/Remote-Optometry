
'use client';

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc, where } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useAuth, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Clock, 
  CalendarDays, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  Building2, 
  MapPin, 
  Settings, 
  Activity, 
  Sparkles, 
  User, 
  Zap,
  ChevronLeft,
  ChevronRight,
  History,
  TrendingUp,
  ArrowRightLeft
} from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"
import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from "@/components/ui/carousel"
import { getMyRosterAction } from "@/services/roster-actions"

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
      <span className="text-[9px] font-black uppercase text-secondary/50 tracking-widest">{label}</span>
      <span className="font-black tabular-nums text-2xl tracking-tighter text-black">{timeLeft}</span>
    </div>
  );
}

export default function EmployeePortal() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile, loading: userLoading } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  
  // High-fidelity roster data state (Projected server-side)
  const [rosterData, setRosterData] = useState<Record<string, { assignments: any[], published: boolean }>>({});
  const [rosterLoading, setRosterLoading] = useState(true);

  const upcomingWeek = '2025-01';
  const currentWeek = '2024-52'; 
  const prev1Week = '2024-51';
  const prev2Weeks = '2024-50';
  const weeks = [upcomingWeek, currentWeek, prev1Week, prev2Weeks];

  const { data: shifts } = useCollection(query(collection(db, 'shift_master'), orderBy('displayOrder')));
  
  const bookingId = profile?.employeeId ? `${currentWeek}_${profile.employeeId}` : null;
  const { data: userBooking } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

  // SECURE PULSE: Fetch assignments via server-side projection
  useEffect(() => {
    async function syncRosters() {
      if (!auth.currentUser) return;
      setRosterLoading(true);
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const results: any = {};
        
        await Promise.all(weeks.map(async (week) => {
          const res = await getMyRosterAction(idToken, week);
          if (res.success) {
            results[week] = { assignments: res.assignments || [], published: res.published };
          }
        }));
        
        setRosterData(results);
      } catch (e) {
        console.error("Roster Sync Pulse Failed:", e);
      } finally {
        setRosterLoading(false);
      }
    }
    syncRosters();
  }, [auth.currentUser]);

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
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-black/40 animate-pulse">Establishing Secure Node Link</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-40 px-4 pt-6 animate-in">
      {/* Institutional Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-primary flex items-center justify-center shadow-xl">
               <User className="size-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-black uppercase leading-none">
                Welcome, <span className="text-secondary">{profile?.displayName?.split(' ')[0] || 'Professional'}</span>
              </h1>
              <div className="flex items-center gap-4 mt-2">
                 <Badge className="bg-secondary text-white border-none font-black text-[9px] uppercase tracking-widest py-1.5 px-5 rounded-full shadow-lg shadow-secondary/20">
                    <Building2 className="size-3 mr-2" /> {profile?.office?.replace('_', ' ')}
                 </Badge>
                 <p className="text-black/40 font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                    Unit: {profile?.employeeId} <MapPin className="size-3 text-secondary" />
                 </p>
              </div>
            </div>
            <DemoBadge />
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/employee/swaps">
              <Button variant="outline" className="rounded-2xl h-14 px-8 border-2 border-slate-100 font-black uppercase text-[10px] tracking-widest bg-white hover:bg-slate-50 shadow-sm transition-all group text-black">
                  <ArrowRightLeft className="size-4 mr-3 group-hover:rotate-12 transition-transform duration-500 text-secondary" /> Shift Swaps
              </Button>
          </Link>
          <Link href="/employee/profile">
              <Button variant="outline" className="rounded-2xl h-14 px-8 border-2 border-slate-100 font-black uppercase text-[10px] tracking-widest bg-white hover:bg-slate-50 shadow-sm transition-all group text-black">
                  <Settings className="size-4 mr-3 group-hover:rotate-90 transition-transform duration-500 text-secondary" /> Account Settings
              </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-10">
          {/* FCFS Booking Pulse */}
          {userBooking ? (
            <Card className="border-none bg-emerald-500 text-white shadow-[0_30px_60px_-15px_rgba(16,185,129,0.4)] rounded-[3rem] overflow-hidden relative group animate-in zoom-in-95">
               <div className="absolute top-0 right-0 p-10 transform group-hover:scale-110 transition-transform duration-1000 opacity-20"><Sparkles className="size-260" /></div>
               <CardContent className="p-12 flex flex-col md:flex-row items-center gap-14 relative z-10">
                  <div className="size-24 rounded-[2.25rem] bg-white/20 flex items-center justify-center shadow-inner border border-white/20 shrink-0">
                    <CheckCircle2 className="size-12 text-white" />
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-4">
                     <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/60">Protected Weekly-Off secured</p>
                        <p className="text-7xl font-black uppercase tracking-tighter italic leading-none">{userBooking.dayOfWeek}</p>
                     </div>
                     <p className="text-[13px] font-bold text-white leading-relaxed tracking-tight max-w-lg">
                        INSTANT CONFIRMATION: Your preference for Week {currentWeek} is verified and locked in the clinical pool.
                     </p>
                  </div>
               </CardContent>
            </Card>
          ) : activeConfig && (
            <Card className="border-none bg-white shadow-2xl rounded-[3rem] overflow-hidden border-2 border-slate-100 transition-all hover:border-secondary/20 relative group">
              <div className="absolute top-0 right-0 p-10 opacity-5"><Zap size={180} /></div>
              <CardContent className="p-12">
                  <div className="flex flex-col md:flex-row items-center gap-14">
                     <div className="size-32 rounded-[2.5rem] bg-secondary flex items-center justify-center shrink-0 shadow-2xl shadow-secondary/30 group-hover:rotate-6 transition-all duration-500">
                        <Clock className="size-16 text-white" />
                     </div>
                     <div className="flex-1 space-y-8 text-center md:text-left">
                        <div className="space-y-2">
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-secondary">Live Pulse Matrix</p>
                           <h2 className="text-4xl font-black uppercase tracking-tight text-black leading-none">Slot Reservation Open</h2>
                        </div>
                        <div className="flex flex-wrap gap-8 justify-center md:justify-start bg-slate-50 p-8 rounded-[2rem] shadow-inner border-2 border-slate-100">
                          {isWindowUpcoming && <Countdown targetDate={activeConfig.bookingOpen} label="Pulse Initiates In" />}
                          {isWindowOpen && <Countdown targetDate={activeConfig.bookingClose} label="Pulse Terminates In" />}
                          {!isWindowOpen && !isWindowUpcoming && <p className="text-[14px] font-black uppercase tracking-widest text-black/40">Reservation Window Terminated</p>}
                        </div>
                        {isWindowOpen && (
                          <Link href="/employee/book-off" className="block">
                            <Button className="w-full bg-primary hover:bg-black text-white font-black uppercase tracking-[0.3em] h-20 rounded-3xl shadow-2xl transition-all group/btn hover:scale-[1.02] active:scale-95">
                              Enter Pulse Matrix <ArrowRight className="ml-4 size-7 group-hover/btn:translate-x-3 transition-transform" />
                            </Button>
                          </Link>
                        )}
                     </div>
                  </div>
              </CardContent>
            </Card>
          )}

          {/* Swipeable Roster Carousel */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <History className="size-5 text-secondary" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-black">Personal Deployment Matrix</h3>
               </div>
               <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => api?.scrollPrev()} className="rounded-xl border hover:bg-slate-50"><ChevronLeft className="size-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => api?.scrollNext()} className="rounded-xl border hover:bg-slate-50"><ChevronRight className="size-5" /></Button>
               </div>
            </div>

            <Carousel setApi={setApi} className="w-full">
              <CarouselContent>
                {weeks.map((week) => {
                  const weekData = rosterData[week] || { assignments: [], published: false };
                  const weekAssignments = weekData.assignments;
                  const isUpcoming = week === upcomingWeek;
                  const isCurrent = week === currentWeek;
                  
                  return (
                    <CarouselItem key={week}>
                      <Card className={cn(
                        "border-none shadow-2xl overflow-hidden rounded-[3rem] bg-white",
                        !isCurrent && "opacity-90"
                      )}>
                        <CardHeader className={cn(
                          "p-10 border-none relative overflow-hidden",
                          isUpcoming ? "bg-primary" : isCurrent ? "bg-[#0F172A]" : "bg-slate-100"
                        )}>
                           <div className="absolute top-0 right-0 p-10 opacity-5"><CalendarDays size={200} className={(!isUpcoming && !isCurrent) ? "text-black" : "text-white"} /></div>
                           <div className="flex items-center justify-between relative z-10">
                              <div className="space-y-1">
                                  <CardTitle className={cn(
                                    "text-2xl flex items-center gap-5 font-black uppercase tracking-tight leading-none",
                                    (!isUpcoming && !isCurrent) ? "text-black" : "text-white"
                                  )}>
                                     {isUpcoming ? <TrendingUp className="size-8 text-secondary" /> : isCurrent ? <Clock className="size-8 text-secondary" /> : <History className="size-8 text-black/40" />}
                                     {isUpcoming ? 'Upcoming Week' : isCurrent ? 'Active Cycle' : 'Historical Record'}
                                  </CardTitle>
                                  <CardDescription className={cn(
                                    "text-[11px] uppercase font-black tracking-[0.2em] mt-3",
                                    (!isUpcoming && !isCurrent) ? "text-black/40" : "text-white/40"
                                  )}>Cycle {week}</CardDescription>
                              </div>
                              <Badge className={cn(
                                "border-none font-black text-[9px] uppercase px-5 py-2 rounded-full",
                                (!isUpcoming && !isCurrent) ? "bg-black/10 text-black" : "bg-white/10 text-white"
                              )}>
                                 {weekData.published ? 'PUBLISHED' : 'PENDING'}
                              </Badge>
                           </div>
                        </CardHeader>
                        <CardContent className="p-10 space-y-6">
                           {weekData.published ? (
                             weekAssignments.length > 0 ? (
                               weekAssignments.sort((a: any, b: any) => {
                                 const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                                 return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                               }).map((a: any, i: number) => {
                                 const shift = shifts?.find(s => s.id === a.shiftId);
                                 return (
                                   <div key={i} className="flex items-center justify-between p-8 rounded-[2rem] bg-white border-2 border-slate-50 hover:border-secondary/20 shadow-sm transition-all group">
                                     <div className="flex flex-col gap-1.5">
                                       <span className="font-black text-3xl uppercase tracking-tighter text-black group-hover:translate-x-2 transition-transform">{a.dayOfWeek}</span>
                                       <div className="flex items-center gap-4">
                                          <Badge variant="outline" className="text-[10px] font-black text-secondary border-secondary/20 uppercase px-4 py-1 rounded-lg">
                                             {shift?.name || a.shiftId}
                                          </Badge>
                                          <span className="text-[11px] text-black font-black tracking-widest uppercase flex items-center gap-2">
                                             <Clock className="size-3 text-secondary" /> {shift?.startTime} — {shift?.endTime} IST
                                          </span>
                                       </div>
                                     </div>
                                     <div className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-secondary/10 group-hover:rotate-12 transition-all">
                                        <Zap className="size-5 text-secondary group-hover:text-secondary transition-colors" />
                                     </div>
                                   </div>
                                 )
                               })
                             ) : (
                               <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                                  <CalendarDays className="size-24 text-black/5 mx-auto mb-8" />
                                  <p className="text-xl font-black text-black/20 uppercase tracking-tight">No Duty Assigned</p>
                                  <p className="text-[10px] text-black/40 uppercase mt-3 max-w-[280px] mx-auto leading-relaxed font-black tracking-[0.2em]">
                                    You have no scheduled shifts for this cycle node.
                                  </p>
                               </div>
                             )
                           ) : (
                             <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                                <Lock className="size-24 text-black/5 mx-auto mb-8" />
                                <p className="text-xl font-black text-black/20 uppercase tracking-tight">Roster Node Pending</p>
                                <p className="text-[10px] text-black/40 uppercase mt-3 max-w-[280px] mx-auto leading-relaxed font-black tracking-[0.2em]">
                                  {isUpcoming ? 'The upcoming roster is currently in mathematical review by clinical leads.' : 'Historical records are being archived in the cluster cloud.'}
                                </p>
                             </div>
                           )}
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  )
                })}
              </CarouselContent>
            </Carousel>
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:col-span-4 space-y-10">
          <Card className="bg-[#0F172A] text-white shadow-2xl border-none overflow-hidden rounded-[3rem] relative group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000"><Activity size={240} /></div>
            <CardHeader className="p-10 pb-6 border-b border-white/5">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.5em] flex items-center gap-4 text-secondary">
                <Activity className="size-5" /> Institutional Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="p-10 pt-8 space-y-12 relative z-10">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                   <div className="size-3 rounded-full bg-emerald-500 shadow-[0_0_20px_#10b981]" />
                   <p className="text-[15px] font-black tracking-widest text-white uppercase">Cluster Connected</p>
                </div>
                <p className="text-[12px] text-white/40 leading-relaxed uppercase font-black tracking-[0.1em]">
                   Daily clinical briefings occur via Meta Cloud API at **22:00 IST**. All rosters are mathematically optimized to ensure pod-balance and professional off-time integrity.
                </p>
              </div>

              <div className="pt-10 border-t border-white/10 space-y-6">
                 <p className="text-[10px] font-black uppercase text-secondary tracking-[0.3em]">Office Node Registry</p>
                 <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-2 group hover:bg-white/10 transition-all">
                    <p className="text-lg font-black text-white uppercase tracking-tight">
                       {profile?.office?.replace('_', ' ')}
                    </p>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">AUTHORIZED PROD NODE • 01</p>
                 </div>
              </div>
              
              <Link href="/employee/preferences" className="block pt-4">
                 <Button className="w-full h-16 bg-secondary hover:bg-secondary/80 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl transition-all shadow-xl">
                    Update Shift Preferences
                 </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-2xl border-none rounded-[3rem] overflow-hidden p-12 space-y-8 group border-2 border-slate-100">
             <div className="size-20 rounded-[2.25rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                <User className="size-10" />
             </div>
             <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-black/40">Professional Identity</p>
                <p className="text-2xl font-black text-black uppercase tracking-tight truncate">{profile?.displayName}</p>
                <p className="text-[11px] font-black text-secondary uppercase tracking-widest bg-secondary/5 px-4 py-1 rounded-full w-fit mt-3">ID: {profile?.employeeId}</p>
             </div>
             <Link href="/employee/profile" className="block pt-6 border-t border-slate-100">
                <Button variant="ghost" className="w-full text-black font-black uppercase text-[10px] tracking-[0.3em] h-14 hover:bg-slate-50 rounded-2xl border-2 border-transparent hover:border-slate-100 transition-all">
                   Manage Profile Node
                </Button>
             </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
