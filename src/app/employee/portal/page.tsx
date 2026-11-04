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
  Zap, 
  User, 
  ChevronLeft,
  ChevronRight,
  History,
  ArrowRightLeft,
  Lock
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

export default function EmployeePortal() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  
  const [rosterData, setRosterData] = useState<Record<string, { assignments: any[], published: boolean }>>({});
  const [rosterLoading, setRosterLoading] = useState(true);

  // Cycle Configuration: 4-week analytical lookback/lookahead
  const upcomingWeek = '2025-01';
  const currentWeek = '2024-52'; 
  const prev1Week = '2024-51';
  const prev2Weeks = '2024-50';
  const weeks = [upcomingWeek, currentWeek, prev1Week, prev2Weeks];

  const { data: shifts } = useCollection(query(collection(db, 'shift_master'), orderBy('displayOrder')));
  
  const bookingId = profile?.employeeId ? `${currentWeek}_${profile.employeeId}` : null;
  const { data: userBooking } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

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
  }, [auth.currentUser, currentWeek]);

  if (userLoading || rosterLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-black/40 animate-pulse">Establishing Secure Node Link</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayShift = rosterData[currentWeek]?.assignments.find(a => a.dayOfWeek === today);
  const todayShiftDetails = shifts?.find(s => s.id === todayShift?.shiftId);

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
                {profile?.displayName?.split(' ')[0] || 'Professional'}
              </h1>
              <div className="flex items-center gap-4 mt-2">
                 <Badge className="bg-secondary text-white border-none font-black text-[9px] uppercase tracking-widest py-1.5 px-5 rounded-full shadow-lg">
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
              <Button variant="outline" className="rounded-2xl h-14 px-8 border-2 border-slate-100 font-black uppercase text-[10px] tracking-widest bg-white hover:bg-slate-50 shadow-sm transition-all group">
                  <ArrowRightLeft className="size-4 mr-3 group-hover:rotate-12 transition-transform text-secondary" /> Shift Swaps
              </Button>
          </Link>
          <Link href="/employee/profile">
              <Button variant="outline" className="rounded-2xl h-14 px-8 border-2 border-slate-100 font-black uppercase text-[10px] tracking-widest bg-white hover:bg-slate-50 shadow-sm transition-all group">
                  <Settings className="size-4 mr-3 group-hover:rotate-90 transition-transform text-secondary" /> Account
              </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-10">
          {/* Today's Pulse */}
          <Card className="border-none bg-[#0F172A] text-white shadow-2xl rounded-[3rem] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-12 opacity-10 transform group-hover:scale-110 transition-transform duration-1000"><Zap size={260} /></div>
             <CardContent className="p-14 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                   <div className="space-y-4 text-center md:text-left">
                      <p className="text-[11px] font-black uppercase tracking-[0.5em] text-secondary">Today's Deployment Pulse</p>
                      <h2 className="text-7xl font-black uppercase tracking-tighter leading-none italic">{today}</h2>
                      {todayShift ? (
                         <div className="flex items-center gap-5 justify-center md:justify-start pt-4">
                            <Badge className="bg-emerald-500 text-white text-[12px] font-black uppercase px-6 py-2 rounded-xl">
                               {todayShiftDetails?.name || todayShift.shiftId}
                            </Badge>
                            <span className="text-[16px] font-black tabular-nums tracking-widest text-white/60">
                               {todayShiftDetails?.startTime} — {todayShiftDetails?.endTime} IST
                            </span>
                         </div>
                      ) : (
                        <p className="text-xl font-bold text-white/40 uppercase tracking-widest pt-4">No Duty Assigned / Weekly-Off</p>
                      )}
                   </div>
                   <div className="size-32 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl">
                      <Clock className="size-16 text-secondary" />
                   </div>
                </div>
             </CardContent>
          </Card>

          {/* Swipeable Roster Carousel */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <History className="size-5 text-secondary" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-black">Personal Roster Ledger</h3>
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
                  const isCurrent = week === currentWeek;
                  const isUpcoming = week === upcomingWeek;
                  
                  return (
                    <CarouselItem key={week}>
                      <Card className={cn(
                        "border-none shadow-2xl overflow-hidden rounded-[3rem] bg-white",
                        !isCurrent && "opacity-90"
                      )}>
                        <CardHeader className={cn(
                          "p-10 border-none relative overflow-hidden",
                          isUpcoming ? "bg-primary" : isCurrent ? "bg-secondary" : "bg-slate-100"
                        )}>
                           <div className="flex items-center justify-between relative z-10">
                              <div className="space-y-1">
                                  <CardTitle className={cn(
                                    "text-2xl flex items-center gap-5 font-black uppercase tracking-tight leading-none",
                                    (!isUpcoming && !isCurrent) ? "text-black" : "text-white"
                                  )}>
                                     {isUpcoming ? 'Upcoming Week' : isCurrent ? 'Active Cycle' : 'Historical Node'}
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
                             weekData.assignments.length > 0 ? (
                               weekData.assignments.sort((a, b) => {
                                 const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                                 return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                               }).map((a, i) => {
                                 const shift = shifts?.find(s => s.id === a.shiftId);
                                 return (
                                   <div key={i} className="flex items-center justify-between p-8 rounded-[2rem] bg-white border-2 border-slate-50 hover:border-secondary/20 shadow-sm transition-all group">
                                     <div className="flex flex-col gap-1.5">
                                       <span className="font-black text-3xl uppercase tracking-tighter text-black group-hover:translate-x-2 transition-transform">{a.dayOfWeek}</span>
                                       <div className="flex items-center gap-4">
                                          <Badge variant="outline" className="text-[10px] font-black text-secondary border-secondary/20 uppercase px-4 py-1 rounded-lg">{shift?.name || a.shiftId}</Badge>
                                          <span className="text-[11px] text-black/40 font-black tracking-widest uppercase">{shift?.startTime} — {shift?.endTime}</span>
                                       </div>
                                     </div>
                                     <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                        <CheckCircle2 className="size-5 text-emerald-500" />
                                     </div>
                                   </div>
                                 )
                               })
                             ) : (
                               <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                  <CalendarDays className="size-16 text-black/5 mx-auto mb-4" />
                                  <p className="text-[11px] text-black/30 uppercase font-black tracking-[0.3em]">No Duty Node Found</p>
                               </div>
                             )
                           ) : (
                             <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                                <Lock className="size-20 text-black/5 mx-auto mb-8" />
                                <p className="text-xl font-black text-black/20 uppercase tracking-tight">Roster Node Pending</p>
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

        {/* Governance Sidebar */}
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
                   Daily briefings dispatched via Meta Cloud API at **22:00 IST**. All assignments are mathematically optimized for clinical pod-balance.
                </p>
              </div>

              <div className="pt-10 border-t border-white/10 space-y-8">
                 {userBooking ? (
                    <div className="p-8 rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500/20 space-y-3">
                       <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">FCFS Confirmed</p>
                       <p className="text-4xl font-black text-white uppercase tracking-tighter italic">{userBooking.dayOfWeek}</p>
                    </div>
                 ) : (
                    <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
                       <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">Weekly-Off Matrix</p>
                       <p className="text-sm font-bold text-white uppercase tracking-tight">No reservation secured for Cycle {currentWeek}.</p>
                       <Link href="/employee/book-off" className="block">
                          <Button className="w-full bg-secondary text-white font-black uppercase text-[10px] tracking-widest rounded-xl h-10 shadow-lg">Enter Pulse Matrix</Button>
                       </Link>
                    </div>
                 )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-2xl border-none rounded-[3.5rem] overflow-hidden p-12 space-y-8 group border-2 border-slate-100">
             <div className="size-20 rounded-[2.25rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                <User className="size-10" />
             </div>
             <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-black/40">Professional Identity</p>
                <p className="text-2xl font-black text-black uppercase tracking-tight truncate">{profile?.displayName}</p>
                <Badge variant="outline" className="text-[10px] font-black text-secondary border-secondary/20 bg-secondary/5 px-4 py-1 rounded-full w-fit mt-3 uppercase tracking-widest">ID: {profile?.employeeId}</Badge>
             </div>
             <Link href="/employee/profile" className="block pt-6 border-t border-slate-100">
                <Button variant="ghost" className="w-full text-black font-black uppercase text-[10px] tracking-[0.3em] h-14 hover:bg-slate-50 rounded-2xl transition-all">
                   Manage Profile Node
                </Button>
             </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
