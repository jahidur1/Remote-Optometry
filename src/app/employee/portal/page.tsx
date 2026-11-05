
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
  Activity, 
  Zap, 
  User, 
  ChevronLeft,
  ChevronRight,
  Lock,
  RotateCcw,
  ShieldCheck
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
import { displayWeekRange, getDatesForWeek } from "@/lib/date-utils";
import { format, startOfISOWeek, subWeeks, addWeeks, addDays } from "date-fns";

const DAYS_LIST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function WeekOffMatrixStatus({ config, userBooking, weekId }: { config: any, userBooking: any, weekId: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (userBooking) {
    return (
      <div className="p-8 rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500/20 space-y-3">
        <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">FCFS Confirmed</p>
        <p className="text-4xl font-black text-emerald-600 uppercase tracking-tighter italic leading-none">{userBooking.dayOfWeek}</p>
        <p className="text-[9px] text-black/20 uppercase font-black tracking-widest">Locked for Cycle {displayWeekRange(weekId)}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 text-center">
        <p className="text-[10px] font-black uppercase text-black/30 tracking-[0.2em] leading-relaxed">No live week-off preference pool available</p>
      </div>
    );
  }

  const openTime = new Date(config.bookingOpen);
  const closeTime = new Date(config.bookingClose);
  const diffMs = openTime.getTime() - now.getTime();
  const diffMins = diffMs / (1000 * 60);

  if (now > closeTime) {
    return (
      <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 text-center">
        <p className="text-[10px] font-black uppercase text-black/30 tracking-[0.2em]">Matrix Cycle Closed</p>
      </div>
    );
  }

  if (now >= openTime) {
    return (
      <div className="p-8 rounded-[2rem] bg-secondary/5 border-2 border-secondary/20 space-y-4">
        <p className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] flex items-center gap-2">
          <Zap className="size-3 fill-secondary" /> Pulse Live
        </p>
        <div className="space-y-2">
           <p className="text-[11px] font-bold text-black uppercase tracking-tight">Window Open for Cycle {displayWeekRange(config.weekId)}.</p>
           <Link href="/employee/book-off" className="block">
              <Button className="w-full bg-secondary text-white font-black uppercase text-[10px] tracking-[0.15em] rounded-xl h-12 shadow-[0_10px_30px_-10px_rgba(59,130,246,0.5)] hover:scale-[1.02] transition-all">
                Enter Matrix Hub
              </Button>
           </Link>
        </div>
      </div>
    );
  }

  if (diffMins > 0 && diffMins <= 3) {
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return (
      <div className="p-8 rounded-[2rem] bg-amber-500/5 border-2 border-amber-500/20 text-center space-y-4">
        <p className="text-[10px] font-black uppercase text-amber-600 tracking-[0.4em] animate-pulse">Pool Live In</p>
        <p className="text-4xl font-black text-amber-600 tabular-nums tracking-tighter leading-none">
          {mins}:{secs.toString().padStart(2, '0')}
        </p>
        <p className="text-[8px] font-black text-amber-500/40 uppercase tracking-widest">Fast-Finger Sync Active</p>
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
    <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 text-center space-y-3">
       <p className="text-[9px] font-black uppercase text-black/30 tracking-[0.3em]">Institutional Pulse</p>
       <p className="text-[12px] font-bold text-black uppercase tracking-tight leading-relaxed">
          Live pool available at <br />
          <span className="text-xl text-secondary mt-1 inline-block">{istTime} IST</span>
       </p>
       <p className="text-[8px] text-black/20 uppercase font-black tracking-widest mt-1">Status: Scheduled Cycle {displayWeekRange(config.weekId)}</p>
    </div>
  );
}

export default function EmployeePortal() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile, loading: userLoading } = useUser();
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(2);
  
  const [rosterData, setRosterData] = useState<Record<string, { assignments: any[], published: boolean }>>({});
  const [rosterLoading, setRosterLoading] = useState(true);
  const [activeConfig, setActiveConfig] = useState<any>(null);

  const weeks = useMemo(() => {
    const now = new Date();
    const currentStart = startOfISOWeek(now);
    
    const generateId = (start: Date) => {
      // Monday to Saturday cycle
      const end = addDays(start, 5);
      return `${format(start, 'yyyyMMdd')}-${format(end, 'yyyyMMdd')}`;
    };

    return [
      subWeeks(currentStart, 2),
      subWeeks(currentStart, 1),
      currentStart,
      addWeeks(currentStart, 1)
    ].map(date => generateId(date));
  }, []);

  const currentWeekId = weeks[2];

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const { data: shifts } = useCollection(shiftQuery);
  
  const bookingsQuery = useMemo(() => {
    if (!profile?.employeeId) return null;
    return query(
      collection(db, 'weekoff_bookings'), 
      where('employeeId', '==', profile.employeeId),
      where('weekId', 'in', weeks)
    );
  }, [db, profile?.employeeId, weeks]);

  const { data: userBookings } = useCollection(bookingsQuery);

  useEffect(() => {
    if (!db || userLoading || !profile?.office) return;
    
    const q = query(
      collection(db, 'weekoff_configs'), 
      where('office', '==', profile.office),
      orderBy('weekId', 'desc'), 
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setActiveConfig(snapshot.docs[0].data());
      else setActiveConfig(null);
    });
    return () => unsubscribe();
  }, [db, profile?.office, userLoading]);

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
  }, [auth.currentUser, weeks]);

  useEffect(() => {
    if (api && weeks.length > 0) {
      api.scrollTo(2);
      api.on("select", () => {
        setCurrentIndex(api.selectedScrollSnap());
      });
    }
  }, [api, weeks]);

  if (userLoading || rosterLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-black/40">Syncing System Link</p>
      </div>
    );
  }

  const now = new Date();
  const today = format(now, 'EEEE');
  const todayShift = rosterData[currentWeekId]?.assignments.find(a => a.dayOfWeek === today);
  const todayShiftDetails = shifts?.find(s => s.id === todayShift?.shiftId);
  const todayBooking = userBookings?.find(b => b.weekId === currentWeekId && b.dayOfWeek === today);

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-40 px-6 pt-6 animate-in text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary flex items-center justify-center shadow-xl shrink-0">
             <User className="size-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">
              {profile?.displayName?.split(' ')[0] || 'Professional'}
            </h1>
            <Badge className="bg-secondary text-white border-none font-black text-[9px] uppercase tracking-widest py-1 px-3 rounded-full mt-2 shadow-lg">
              {profile?.office?.replace('_', ' ')} Center
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-10">
          <Card className="border-none bg-[#0F172A] text-white shadow-2xl rounded-[3rem] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-12 opacity-10 transform group-hover:scale-110 duration-1000"><Zap size={260} /></div>
             <CardContent className="p-14 relative z-10">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">Today's Pulse</p>
                <h2 className="text-7xl font-black uppercase tracking-tighter leading-none italic mt-2">{today}</h2>
                {todayBooking ? (
                   <div className="flex items-center gap-3 mt-6">
                      <Badge className="bg-emerald-500 text-white text-[10px] font-black uppercase px-8 py-3 rounded-xl shadow-2xl">
                         <ShieldCheck className="size-4 mr-2" /> PROTECTED WEEK-OFF
                      </Badge>
                   </div>
                ) : todayShift ? (
                   <div className="mt-8 space-y-4">
                      <div className="flex items-center gap-4">
                        <Badge className="bg-secondary text-white text-[12px] font-black uppercase px-8 py-3 rounded-2xl shadow-xl">
                          {todayShiftDetails?.name || todayShift.shiftId}
                        </Badge>
                        <Badge variant="outline" className="border-white/20 text-white/40 font-black text-[10px] px-3 py-1 rounded-lg">
                          {todayShift.shiftId}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-white/60">
                        <Clock className="size-5 text-secondary" />
                        <span className="text-xl font-black tracking-[0.2em] tabular-nums">
                          {todayShiftDetails?.startTime} — {todayShiftDetails?.endTime}
                        </span>
                      </div>
                   </div>
                ) : (
                  <p className="text-lg font-bold text-white/40 uppercase tracking-widest mt-6">No Duty Assigned</p>
                )}
             </CardContent>
          </Card>

          <div className="space-y-6">
             <div className="flex items-center justify-between bg-white p-2 rounded-2xl border-2 border-slate-50 shadow-lg">
                <Button 
                   variant="ghost" 
                   size="icon" 
                   className="size-12 rounded-xl hover:bg-slate-100" 
                   onClick={() => api?.scrollPrev()}
                   disabled={currentIndex === 0}
                >
                   <ChevronLeft className="size-6" />
                </Button>
                
                <div className="flex items-center gap-4">
                   <div className="text-center">
                      <p className="text-[9px] font-black uppercase text-secondary tracking-widest">
                         {currentIndex < 2 ? "History Cycle" : currentIndex === 2 ? "Current Hub Cycle" : "Upcoming Cycle"}
                      </p>
                      <p className="text-[13px] font-black uppercase text-black tracking-tighter">
                         {displayWeekRange(weeks[currentIndex])}
                      </p>
                   </div>
                   {currentIndex !== 2 && (
                      <Button 
                         variant="outline" 
                         size="sm" 
                         onClick={() => api?.scrollTo(2)}
                         className="h-8 border-2 border-secondary/20 text-secondary font-black text-[9px] uppercase tracking-widest rounded-lg"
                      >
                         <RotateCcw className="size-3 mr-1.5" /> Reset
                      </Button>
                   )}
                </div>

                <Button 
                   variant="ghost" 
                   size="icon" 
                   className="size-12 rounded-xl hover:bg-slate-100" 
                   onClick={() => api?.scrollNext()}
                   disabled={currentIndex === weeks.length - 1}
                >
                   <ChevronRight className="size-6" />
                </Button>
             </div>

             <Carousel setApi={setApi} className="w-full">
               <CarouselContent>
                 {weeks.map((week) => {
                   const weekData = rosterData[week] || { assignments: [], published: false };
                   const isCurrent = week === currentWeekId;
                   const weekDates = getDatesForWeek(week);
                   
                   return (
                     <CarouselItem key={week}>
                       <div className="grid grid-cols-1 gap-3 px-1">
                         {DAYS_LIST.map((day, idx) => {
                           const date = weekDates[idx];
                           const dateStr = date ? format(date, 'MMM dd') : '-- --';
                           const assignment = weekData.assignments.find(a => a.dayOfWeek === day);
                           const shift = shifts?.find(s => s.id === assignment?.shiftId);
                           const isOff = userBookings?.some(b => b.weekId === week && b.dayOfWeek === day);

                           return (
                             <Card key={day} className={cn(
                               "border-none shadow-md overflow-hidden rounded-2xl bg-white transition-all group hover:scale-[1.01] hover:shadow-xl",
                               isCurrent ? "border-l-4 border-l-secondary" : "",
                               isOff ? "bg-emerald-50/30" : ""
                             )}>
                               <CardContent className="p-5 flex items-center justify-between">
                                  <div className="flex items-center gap-5">
                                     <div className="w-14 text-center border-r-2 border-slate-50 pr-4">
                                        <p className="text-[10px] font-black uppercase text-black/30 leading-none">{day.substring(0,3)}</p>
                                        <p className="text-[14px] font-black text-black mt-1.5 tabular-nums">{dateStr.split(' ')[1]}</p>
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-primary leading-tight">{day}</span>
                                        {isOff ? (
                                           <div className="flex items-center gap-2 mt-1">
                                              <Badge className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md border-none animate-in">PROTECTED WEEK-OFF</Badge>
                                           </div>
                                        ) : weekData.published ? (
                                           shift ? (
                                             <div className="flex flex-col gap-1 mt-1">
                                                <span className="text-[11px] font-black uppercase text-secondary leading-none">{shift.name}</span>
                                                <div className="flex items-center gap-2">
                                                   <Badge className="bg-slate-50 text-slate-400 text-[7px] font-black uppercase px-1.5 py-0 rounded border-none">{shift.id}</Badge>
                                                   <span className="text-[9px] font-bold text-black/30 uppercase tracking-[0.1em]">{shift.startTime} - {shift.endTime}</span>
                                                </div>
                                             </div>
                                           ) : (
                                             <span className="text-[9px] font-bold text-black/20 uppercase tracking-widest italic mt-1">No Duty Assigned</span>
                                           )
                                        ) : (
                                           <div className="flex items-center gap-2 mt-1 text-black/10">
                                              <Lock className="size-3" />
                                              <span className="text-[9px] font-bold uppercase tracking-widest italic">Pending Publication</span>
                                           </div>
                                        )}
                                     </div>
                                  </div>
                                  {(isOff || (weekData.published && shift)) && (
                                     <div className="size-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                        <CheckCircle2 className={cn("size-4 text-emerald-500", isOff && "animate-pulse")} />
                                     </div>
                                  )}
                               </CardContent>
                             </Card>
                           );
                         })}
                       </div>
                     </CarouselItem>
                   )
                 })}
               </CarouselContent>
             </Carousel>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <Card className="bg-white shadow-2xl border-none rounded-[2.5rem] border border-slate-100">
            <CardHeader className="p-10 pb-4 border-b border-slate-50">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] flex items-center gap-4 text-secondary">
                <Activity className="size-5" /> Institutional Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="p-10 pt-8 space-y-12">
               <WeekOffMatrixStatus config={activeConfig} userBooking={userBookings?.find(b => b.weekId === currentWeekId)} weekId={currentWeekId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
