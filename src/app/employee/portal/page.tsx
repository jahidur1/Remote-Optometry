
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
  Loader2, 
  Building2, 
  MapPin, 
  Settings, 
  Activity, 
  Zap, 
  User, 
  ChevronLeft,
  ChevronRight,
  History,
  ArrowRightLeft,
  Lock
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from "@/components/ui/carousel"
import { getMyRosterAction } from "@/services/roster-actions"

/**
 * Institutional Weekly-Off Pulse Indicator
 * Specifically optimized for IST synchronization and 3-minute alerting.
 */
function WeekOffMatrixStatus({ config, userBooking, weekId }: { config: any, userBooking: any, weekId: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (userBooking) {
    return (
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500/20 space-y-2 md:space-y-3">
        <p className="text-[8px] md:text-[10px] font-black uppercase text-emerald-500 tracking-widest">FCFS Confirmed</p>
        <p className="text-3xl md:text-4xl font-black text-emerald-600 uppercase tracking-tighter italic leading-none">{userBooking.dayOfWeek}</p>
        <p className="text-[9px] text-black/20 uppercase font-black tracking-widest">Locked for Cycle {weekId}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-slate-50 border border-slate-100 text-center">
        <p className="text-[9px] font-black uppercase text-black/30 tracking-[0.25em]">No live weekly-off preference pool available</p>
      </div>
    );
  }

  const openTime = new Date(config.bookingOpen);
  const closeTime = new Date(config.bookingClose);
  const diffMs = openTime.getTime() - now.getTime();
  const diffMins = diffMs / (1000 * 60);

  if (now > closeTime) {
    return (
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-slate-50 border border-slate-100 text-center">
        <p className="text-[9px] font-black uppercase text-black/30 tracking-[0.25em]">Matrix Cycle Closed</p>
      </div>
    );
  }

  if (now >= openTime) {
    return (
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-secondary/5 border-2 border-secondary/20 space-y-4">
        <p className="text-[8px] md:text-[10px] font-black uppercase text-secondary tracking-[0.3em] flex items-center gap-2">
          <Zap className="size-3 fill-secondary" /> Pulse Live
        </p>
        <div className="space-y-2">
           <p className="text-[11px] font-bold text-black uppercase tracking-tight">Open for Cycle {config.weekId}.</p>
           <Link href="/employee/book-off" className="block">
              <Button className="w-full bg-secondary text-white font-black uppercase text-[10px] tracking-[0.15em] rounded-lg md:rounded-xl h-12 shadow-[0_10px_30px_-10px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-95 transition-all">
                Enter Matrix Hub
              </Button>
           </Link>
        </div>
      </div>
    );
  }

  if (diffMins <= 3) {
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return (
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-amber-500/5 border-2 border-amber-500/20 text-center space-y-4">
        <p className="text-[8px] md:text-[10px] font-black uppercase text-amber-600 tracking-[0.4em] animate-pulse">Pool Live In</p>
        <p className="text-4xl font-black text-amber-600 tabular-nums tracking-tighter leading-none">
          {mins}:{secs.toString().padStart(2, '0')}
        </p>
        <p className="text-[8px] font-black text-amber-500/40 uppercase tracking-widest">Prepare for Pulse</p>
      </div>
    );
  }

  const istTime = openTime.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-slate-50 border border-slate-100 text-center space-y-3">
       <p className="text-[8px] md:text-[10px] font-black uppercase text-black/30 tracking-[0.3em]">Weekly-Off Matrix</p>
       <p className="text-[12px] font-bold text-black uppercase tracking-tight leading-relaxed">
          Live pool available at <br />
          <span className="text-xl text-secondary mt-1 inline-block">{istTime} IST</span>
       </p>
       <p className="text-[9px] text-black/20 uppercase font-black tracking-widest mt-1">Status: Scheduled Pulse</p>
    </div>
  );
}

export default function EmployeePortal() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile, loading: userLoading } = useUser();
  const [api, setApi] = useState<CarouselApi>();
  
  const [rosterData, setRosterData] = useState<Record<string, { assignments: any[], published: boolean }>>({});
  const [rosterLoading, setRosterLoading] = useState(true);
  const [activeConfig, setActiveConfig] = useState<any>(null);

  const currentWeek = '2024-52'; 
  const upcomingWeek = '2025-01';
  const weeks = [upcomingWeek, currentWeek];

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const { data: shifts } = useCollection(shiftQuery);
  
  const bookingId = profile?.employeeId ? `${currentWeek}_${profile.employeeId}` : null;
  const { data: userBooking } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

  useEffect(() => {
    if (!db || !profile?.office) return;
    const q = query(
      collection(db, 'weekoff_configs'), 
      where('office', '==', profile.office),
      orderBy('weekId', 'desc'), 
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveConfig(snapshot.docs[0].data());
      } else {
        setActiveConfig(null);
      }
    });
    return () => unsubscribe();
  }, [db, profile?.office]);

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

  if (userLoading || rosterLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-12 md:size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] text-black/40 animate-pulse">Establishing Secure System Link</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayShift = rosterData[currentWeek]?.assignments.find(a => a.dayOfWeek === today);
  const todayShiftDetails = shifts?.find(s => s.id === todayShift?.shiftId);

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 md:space-y-12 pb-32 md:pb-40 px-2 sm:px-6 pt-4 md:pt-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8">
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="size-12 md:size-14 rounded-xl md:rounded-2xl bg-primary flex items-center justify-center shadow-xl shrink-0">
               <User className="size-6 md:size-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-black uppercase leading-none truncate max-w-[200px] md:max-w-none">
                {profile?.displayName?.split(' ')[0] || 'Professional'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1.5 md:mt-2">
                 <Badge className="bg-secondary text-white border-none font-black text-[7px] md:text-[9px] uppercase tracking-widest py-1 px-3 md:px-5 rounded-full shadow-lg">
                    <Building2 className="size-2.5 md:size-3 mr-1.5 md:mr-2" /> {profile?.office?.replace('_', ' ')}
                 </Badge>
                 <p className="text-black/40 font-black uppercase text-[8px] md:text-[10px] tracking-[0.1em] md:tracking-[0.2em] flex items-center gap-2">
                    Unit: {profile?.employeeId?.slice(-6)} <MapPin className="size-2.5 md:size-3 text-secondary" />
                 </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 w-full md:w-auto">
          <Link href="/employee/swaps" className="flex-1 md:flex-none">
              <Button variant="outline" className="w-full rounded-xl md:rounded-2xl h-12 md:h-14 px-4 md:px-8 border-2 border-slate-100 font-black uppercase text-[8px] md:text-[10px] tracking-widest bg-white shadow-sm transition-all group">
                  <ArrowRightLeft className="size-3 md:size-4 mr-2 md:mr-3 group-hover:rotate-12 transition-transform text-secondary" /> Swaps
              </Button>
          </Link>
          <Link href="/employee/profile" className="flex-1 md:flex-none">
              <Button variant="outline" className="w-full rounded-xl md:rounded-2xl h-12 md:h-14 px-4 md:px-8 border-2 border-slate-100 font-black uppercase text-[8px] md:text-[10px] tracking-widest bg-white shadow-sm transition-all group">
                  <Settings className="size-3 md:size-4 mr-2 md:mr-3 group-hover:rotate-90 transition-transform text-secondary" /> Account
              </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-8 md:gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8 md:space-y-10">
          <Card className="border-none bg-[#0F172A] text-white shadow-2xl rounded-[2rem] md:rounded-[3rem] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-12 opacity-10 transform group-hover:scale-110 transition-transform duration-1000 hidden md:block"><Zap size={260} /></div>
             <CardContent className="p-8 md:p-14 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
                   <div className="space-y-2 md:space-y-4 text-center md:text-left w-full md:w-auto">
                      <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-secondary">Today's Deployment Pulse</p>
                      <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none italic">{today}</h2>
                      {todayShift ? (
                         <div className="flex flex-col md:flex-row items-center gap-3 md:gap-5 justify-center md:justify-start pt-2 md:pt-4">
                            <Badge className="bg-emerald-500 text-white text-[10px] md:text-[12px] font-black uppercase px-4 md:px-6 py-1.5 md:py-2 rounded-lg md:rounded-xl">
                               {todayShiftDetails?.name || todayShift.shiftId}
                            </Badge>
                            <span className="text-[14px] md:text-[16px] font-black tabular-nums tracking-widest text-white/60">
                               {todayShiftDetails?.startTime} — {todayShiftDetails?.endTime}
                            </span>
                         </div>
                      ) : (
                        <p className="text-lg md:text-xl font-bold text-white/40 uppercase tracking-widest pt-2 md:pt-4">No Duty Assigned</p>
                      )}
                   </div>
                   <div className="size-24 md:size-32 rounded-2xl md:rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl shrink-0">
                      <Clock className="size-12 md:size-16 text-secondary" />
                   </div>
                </div>
             </CardContent>
          </Card>

          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center justify-between px-1 md:px-2">
               <div className="flex items-center gap-3 md:gap-4">
                  <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-secondary/10 flex items-center justify-center">
                    <History className="size-4 md:size-5 text-secondary" />
                  </div>
                  <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-black">Roster Ledger</h3>
               </div>
               <div className="flex items-center gap-2 md:gap-3">
                  <Button variant="ghost" size="icon" onClick={() => api?.scrollPrev()} className="rounded-lg md:rounded-xl border hover:bg-slate-50 size-8 md:size-10"><ChevronLeft className="size-4 md:size-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => api?.scrollNext()} className="rounded-lg md:rounded-xl border hover:bg-slate-50 size-8 md:size-10"><ChevronRight className="size-4 md:size-5" /></Button>
               </div>
            </div>

            <Carousel setApi={setApi} className="w-full">
              <CarouselContent>
                {weeks.map((week) => {
                  const weekData = rosterData[week] || { assignments: [], published: false };
                  const isCurrent = week === currentWeek;
                  const isUpcoming = week === upcomingWeek;
                  
                  return (
                    <CarouselItem key={week}>
                      <Card className={cn(
                        "border-none shadow-xl md:shadow-2xl overflow-hidden rounded-[2rem] md:rounded-[3rem] bg-white",
                        !isCurrent && "opacity-90"
                      )}>
                        <CardHeader className={cn(
                          "p-6 md:p-10 border-none relative overflow-hidden",
                          isUpcoming ? "bg-primary" : isCurrent ? "bg-secondary" : "bg-slate-100"
                        )}>
                           <div className="flex items-center justify-between relative z-10">
                              <div className="space-y-0.5 md:space-y-1">
                                  <CardTitle className={cn(
                                    "text-lg md:text-2xl flex items-center gap-3 md:gap-5 font-black uppercase tracking-tight leading-none",
                                    (!isUpcoming && !isCurrent) ? "text-black" : "text-white"
                                  )}>
                                     {isUpcoming ? 'Next week' : isCurrent ? 'Active Cycle' : 'Historical Matrix'}
                                  </CardTitle>
                                  <CardDescription className={cn(
                                    "text-[9px] md:text-[11px] uppercase font-black tracking-[0.1em] md:tracking-[0.2em] mt-2 md:mt-3",
                                    (!isUpcoming && !isCurrent) ? "text-black/40" : "text-white/40"
                                  )}>Cycle {week}</CardDescription>
                              </div>
                              <Badge className={cn(
                                "border-none font-black text-[7px] md:text-[9px] uppercase px-3 md:px-5 py-1 md:py-2 rounded-full",
                                (!isUpcoming && !isCurrent) ? "bg-black/10 text-black" : "bg-white/10 text-white"
                              )}>
                                 {weekData.published ? 'PUBLISHED' : 'PENDING'}
                              </Badge>
                           </div>
                        </CardHeader>
                        <CardContent className="p-6 md:p-10 space-y-4 md:space-y-6">
                           {weekData.published ? (
                             weekData.assignments.length > 0 ? (
                               weekData.assignments.sort((a, b) => {
                                 const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                                 return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                               }).map((a, i) => {
                                 const shift = shifts?.find(s => s.id === a.shiftId);
                                 return (
                                   <div key={i} className="flex items-center justify-between p-4 md:p-8 rounded-xl md:rounded-[2rem] bg-white border-2 border-slate-50 hover:border-secondary/20 shadow-sm transition-all group">
                                     <div className="flex flex-col gap-1 md:gap-1.5">
                                       <span className="font-black text-xl md:text-3xl uppercase tracking-tighter text-black group-hover:translate-x-1 md:group-hover:translate-x-2 transition-transform">{a.dayOfWeek.substring(0,3)}</span>
                                       <div className="flex flex-wrap items-center gap-2 md:gap-4">
                                          <Badge variant="outline" className="text-[8px] md:text-[10px] font-black text-secondary border-secondary/20 uppercase px-2 md:px-4 py-0.5 md:py-1 rounded-md md:rounded-lg">{shift?.id || a.shiftId}</Badge>
                                          <span className="text-[9px] md:text-[11px] text-black/40 font-black tracking-widest uppercase truncate max-w-[120px] md:max-w-none">{shift?.startTime} — {shift?.endTime}</span>
                                       </div>
                                     </div>
                                     <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                        <CheckCircle2 className="size-4 md:size-5 text-emerald-500" />
                                     </div>
                                   </div>
                                 )
                               })
                             ) : (
                               <div className="text-center py-12 md:py-20 bg-slate-50 rounded-xl md:rounded-[2rem] border-2 border-dashed border-slate-200">
                                  <CalendarDays className="size-10 md:size-16 text-black/5 mx-auto mb-3 md:mb-4" />
                                  <p className="text-[9px] md:text-[11px] text-black/30 uppercase font-black tracking-[0.2em] md:tracking-[0.3em]">No Duty Found</p>
                               </div>
                             )
                           ) : (
                             <div className="text-center py-16 md:py-24 bg-slate-50 rounded-[2rem] md:rounded-[3rem] border-4 border-dashed border-slate-200">
                                <Lock className="size-14 md:size-20 text-black/5 mx-auto mb-6 md:mb-8" />
                                <p className="text-lg md:text-xl font-black text-black/20 uppercase tracking-tight">Roster Pending</p>
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

        <div className="lg:col-span-4 space-y-8 md:space-y-10">
          <Card className="bg-white shadow-2xl border-none rounded-[2rem] md:rounded-[3rem] relative group border border-slate-100">
            <CardHeader className="p-8 md:p-10 pb-4 md:pb-6 border-b border-slate-50">
              <CardTitle className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] flex items-center gap-3 md:gap-4 text-secondary">
                <Activity className="size-4 md:size-5" /> Institutional Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 md:p-10 pt-6 md:p-8 space-y-8 md:space-y-12 relative z-10">
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-3 md:gap-4">
                   <div className="size-2.5 md:size-3 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981]" />
                   <p className="text-[13px] md:text-[15px] font-black tracking-widest text-black uppercase">Center Connected</p>
                </div>
                <p className="text-[10px] md:text-[12px] text-black/40 leading-relaxed uppercase font-black tracking-[0.05em] md:tracking-[0.1em]">
                   Daily briefings dispatched via Meta Cloud API at **22:00 IST**. Optimized for clinical pod-balance.
                </p>
              </div>

              <div className="pt-8 md:pt-10 border-t border-slate-50 space-y-6 md:space-y-8">
                 <WeekOffMatrixStatus config={activeConfig} userBooking={userBooking} weekId={currentWeek} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-2xl border-none rounded-[2rem] md:rounded-[3.5rem] overflow-hidden p-8 md:p-12 space-y-6 md:space-y-8 group border-2 border-slate-100">
             <div className="size-16 md:size-20 rounded-2xl md:rounded-[2.25rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform shrink-0">
                <User className="size-8 md:size-10" />
             </div>
             <div className="space-y-2">
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-black/40">Professional Identity</p>
                <p className="text-xl md:text-2xl font-black text-black uppercase tracking-tight truncate">{profile?.displayName}</p>
                <Badge variant="outline" className="text-[8px] md:text-[10px] font-black text-secondary border-secondary/20 bg-secondary/5 px-3 md:px-4 py-0.5 md:py-1 rounded-full w-fit mt-2 md:mt-3 uppercase tracking-widest">ID: {profile?.employeeId?.slice(-8)}</Badge>
             </div>
             <Link href="/employee/profile" className="block pt-6 border-t border-slate-100">
                <Button variant="ghost" className="w-full text-black font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] h-12 md:h-14 hover:bg-slate-50 rounded-xl md:rounded-2xl transition-all">
                   Manage Profile
                </Button>
             </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
