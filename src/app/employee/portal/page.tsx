
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
import { displayWeekRange, getDatesForWeek } from "@/lib/date-utils";
import { format, startOfISOWeek, endOfISOWeek, subWeeks, addWeeks } from "date-fns";

const DAYS_LIST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
        <p className="text-[9px] text-black/20 uppercase font-black tracking-widest">Locked for Cycle {displayWeekRange(weekId)}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-slate-50 border border-slate-100 text-center">
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
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-slate-50 border border-slate-100 text-center">
        <p className="text-[10px] font-black uppercase text-black/30 tracking-[0.2em]">Matrix Cycle Closed</p>
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
           <p className="text-[11px] font-bold text-black uppercase tracking-tight">Window Open for Cycle {displayWeekRange(config.weekId)}.</p>
           <Link href="/employee/book-off" className="block">
              <Button className="w-full bg-secondary text-white font-black uppercase text-[10px] tracking-[0.15em] rounded-lg md:rounded-xl h-12 shadow-[0_10px_30px_-10px_rgba(59,130,246,0.5)] hover:scale-[1.02] transition-all">
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
      <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-amber-500/5 border-2 border-amber-500/20 text-center space-y-4">
        <p className="text-[8px] md:text-[10px] font-black uppercase text-amber-600 tracking-[0.4em] animate-pulse">Pool Live In</p>
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
    <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-slate-50 border border-slate-100 text-center space-y-3">
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
  
  const [rosterData, setRosterData] = useState<Record<string, { assignments: any[], published: boolean }>>({});
  const [rosterLoading, setRosterLoading] = useState(true);
  const [activeConfig, setActiveConfig] = useState<any>(null);

  // Dynamic Institutional Range Calculation
  const weeks = useMemo(() => {
    const now = new Date();
    const currentStart = startOfISOWeek(now);
    
    const getWeekId = (date: Date) => {
      const start = startOfISOWeek(date);
      const end = endOfISOWeek(date);
      return `${format(start, 'yyyyMMdd')}-${format(end, 'yyyyMMdd')}`;
    };

    return [
      getWeekId(subWeeks(currentStart, 2)), // Previous 2
      getWeekId(subWeeks(currentStart, 1)), // Previous 1
      getWeekId(currentStart),              // Current
      getWeekId(addWeeks(currentStart, 1))   // Upcoming
    ];
  }, []);

  const currentWeekId = weeks[2];

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const { data: shifts } = useCollection(shiftQuery);
  
  const bookingId = profile?.employeeId ? `${currentWeekId}_${profile.employeeId}` : null;
  const { data: userBooking } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

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

  // Centering Carousel on Current Week
  useEffect(() => {
    if (api && weeks.length > 0) {
      api.scrollTo(2);
    }
  }, [api, weeks]);

  if (userLoading || rosterLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-12 md:size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] text-black/40">Syncing System Link</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayShift = rosterData[currentWeekId]?.assignments.find(a => a.dayOfWeek === today);
  const todayShiftDetails = shifts?.find(s => s.id === todayShift?.shiftId);

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 md:space-y-12 pb-32 md:pb-40 px-2 sm:px-6 pt-4 md:pt-6 animate-in text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex items-center gap-4">
          <div className="size-12 md:size-14 rounded-2xl bg-primary flex items-center justify-center shadow-xl shrink-0">
             <User className="size-6 md:size-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase leading-none truncate max-w-[200px] md:max-w-none">
              {profile?.displayName?.split(' ')[0] || 'Professional'}
            </h1>
            <Badge className="bg-secondary text-white border-none font-black text-[7px] md:text-[9px] uppercase tracking-widest py-1 px-3 rounded-full mt-2 shadow-lg">
              {profile?.office?.replace('_', ' ')} Center
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-10">
          <Card className="border-none bg-[#0F172A] text-white shadow-2xl rounded-[2rem] md:rounded-[3rem] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-12 opacity-10 transform group-hover:scale-110 duration-1000 hidden md:block"><Zap size={260} /></div>
             <CardContent className="p-8 md:p-14 relative z-10 text-center md:text-left">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">Today's Pulse</p>
                <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none italic mt-2">{today}</h2>
                {todayShift ? (
                   <div className="flex flex-col md:flex-row items-center gap-3 mt-6">
                      <Badge className="bg-emerald-500 text-white text-[10px] font-black uppercase px-6 py-2 rounded-xl">
                         {todayShiftDetails?.name || todayShift.shiftId}
                      </Badge>
                      <span className="text-[14px] font-black tracking-widest text-white/60">
                         {todayShiftDetails?.startTime} — {todayShiftDetails?.endTime}
                      </span>
                   </div>
                ) : (
                  <p className="text-lg font-bold text-white/40 uppercase tracking-widest mt-6">No Duty Assigned</p>
                )}
             </CardContent>
          </Card>

          <Carousel setApi={setApi} className="w-full">
            <CarouselContent>
              {weeks.map((week) => {
                const weekData = rosterData[week] || { assignments: [], published: false };
                const isCurrent = week === currentWeekId;
                const weekDates = getDatesForWeek(week);
                
                return (
                  <CarouselItem key={week}>
                    <Card className={cn(
                      "border-none shadow-2xl overflow-hidden rounded-[2rem] md:rounded-[3rem] bg-white transition-all",
                      isCurrent ? "ring-2 ring-secondary/20" : ""
                    )}>
                      <CardHeader className="p-8 md:p-10 bg-slate-50 border-b">
                         <CardTitle className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center justify-between">
                            <span className="flex items-center gap-3">
                              {isCurrent && <div className="size-2 rounded-full bg-secondary animate-pulse" />}
                              Clinical Cycle
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-black uppercase px-4 py-1.5 rounded-lg border-secondary/20",
                              isCurrent ? "bg-secondary text-white border-none" : "text-secondary bg-secondary/5"
                            )}>
                              {displayWeekRange(week)}
                            </Badge>
                         </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 md:p-10">
                        <div className="grid grid-cols-1 gap-3">
                          {DAYS_LIST.map((day, idx) => {
                            const date = weekDates[idx];
                            const dateStr = date ? format(date, 'MMM dd') : '-- --';
                            const assignment = weekData.assignments.find(a => a.dayOfWeek === day);
                            const shift = shifts?.find(s => s.id === assignment?.shiftId);

                            return (
                              <div key={day} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-100 hover:border-secondary/20 transition-all group">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 text-center border-r border-slate-100 pr-4">
                                       <p className="text-[9px] font-black uppercase text-black/30 leading-none">{day.substring(0,3)}</p>
                                       <p className="text-[11px] font-black text-black mt-1 tabular-nums">{dateStr.split(' ')[1]}</p>
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="text-[10px] font-black uppercase tracking-widest text-primary leading-tight">{day}</span>
                                       {weekData.published ? (
                                          shift ? (
                                            <span className="text-[8px] font-bold text-secondary uppercase tracking-wider mt-0.5">{shift.name} ({shift.startTime} - {shift.endTime})</span>
                                          ) : (
                                            <span className="text-[8px] font-bold text-black/20 uppercase tracking-widest italic mt-0.5">No Duty Assigned</span>
                                          )
                                       ) : (
                                          <span className="text-[8px] font-bold text-black/10 uppercase tracking-widest italic mt-0.5">Pending Publication</span>
                                       )}
                                    </div>
                                 </div>
                                 {weekData.published && shift && <CheckCircle2 className="size-4 text-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity" />}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                )
              })}
            </CarouselContent>
          </Carousel>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <Card className="bg-white shadow-2xl border-none rounded-[2.5rem] border border-slate-100">
            <CardHeader className="p-10 pb-4 border-b border-slate-50">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] flex items-center gap-4 text-secondary">
                <Activity className="size-5" /> Institutional Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="p-10 pt-8 space-y-12">
               <WeekOffMatrixStatus config={activeConfig} userBooking={userBooking} weekId={currentWeekId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
