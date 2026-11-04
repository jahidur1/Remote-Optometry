
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock, CheckCircle2, Loader2, Zap, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { bookWeeklyOff } from '@/lib/booking';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Institutional Countdown Matrix
 * Specifically optimized for IST synchronization and 3-minute alerting.
 */
function CountdownTimer({ targetDate, label }: { targetDate: string, label: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(targetDate).getTime() - now;
      
      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft('PULSE LIVE');
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-black uppercase text-black/30 tracking-[0.4em]">{label}</span>
      <span className="font-black tabular-nums text-6xl tracking-tighter text-black">{timeLeft}</span>
    </div>
  );
}

export default function BookOffPage() {
  const db = useFirestore();
  const { profile, loading: profileLoading } = useUser();
  const { toast } = useToast();
  
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Stable Config Query
  const configQuery = useMemo(() => {
    if (!profile?.office) return null;
    return query(
      collection(db, 'weekoff_configs'), 
      where('office', '==', profile.office),
      orderBy('weekId', 'desc'), 
      limit(1)
    );
  }, [db, profile?.office]);

  const { data: configs, loading: configLoading } = useCollection(configQuery);
  const activeConfig = configs?.[0] || null;

  // Stable Booking Doc
  const bookingId = activeConfig && profile?.employeeId ? `${activeConfig.weekId}_${profile.employeeId}` : null;
  const { data: userBooking, loading: bookingLoading } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

  const handleBook = async (day: string) => {
    if (!profile?.employeeId || !activeConfig) return;
    
    setBookingInProgress(true);
    const result = await bookWeeklyOff(
      db, 
      activeConfig.id, 
      profile.employeeId, 
      day, 
      profile.uid
    );

    if (result.success) {
      toast({ title: "Reservation Locked", description: result.message });
    } else {
      toast({ variant: "destructive", title: "Conflict Encountered", description: result.message });
    }
    setBookingInProgress(false);
  };

  const getDayStatus = (day: string) => {
    if (!activeConfig) return null;
    const quota = activeConfig.quotas?.[day] || 0;
    const booked = activeConfig.booked?.[day] || 0;
    const remaining = Math.max(0, quota - booked);
    const percent = quota > 0 ? (booked / quota) * 100 : 100;

    if (remaining === 0) return { label: "FULL", color: "destructive", disabled: true, remaining, percent };
    if (percent > 80) return { label: "CRITICAL", color: "secondary", disabled: false, remaining, percent };
    return { label: "AVAILABLE", color: "default", disabled: false, remaining, percent };
  };

  const openTime = useMemo(() => activeConfig ? new Date(activeConfig.bookingOpen) : null, [activeConfig]);
  const closeTime = useMemo(() => activeConfig ? new Date(activeConfig.bookingClose) : null, [activeConfig]);
  
  const isWindowOpen = useMemo(() => {
    if (!openTime || !closeTime) return false;
    return now >= openTime && now <= closeTime;
  }, [openTime, closeTime, now]);

  const diffMins = useMemo(() => {
    if (!openTime) return 0;
    return (openTime.getTime() - now.getTime()) / (1000 * 60);
  }, [openTime, now]);

  if (profileLoading || configLoading || bookingLoading) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
      <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
      <p className="text-[11px] font-black uppercase tracking-[0.4em] text-black/40 animate-pulse">Syncing Clinical Registry</p>
    </div>
  );

  if (!activeConfig) return (
    <div className="max-w-xl mx-auto mt-24 text-center space-y-10 p-16 rounded-[3rem] bg-white shadow-2xl border-2 border-dashed border-slate-200 relative overflow-hidden">
      <CalendarDays className="size-24 mx-auto text-black/5" />
      <div className="space-y-4">
         <h2 className="text-3xl font-black text-black uppercase tracking-tight">Window Inactive</h2>
         <p className="text-[11px] text-black/40 leading-relaxed px-12 font-medium uppercase tracking-widest">
            No live week-off preference pool available for your ROC Center at this time.
         </p>
      </div>
      <Link href="/employee/portal">
        <Button variant="outline" className="h-14 px-12 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border-2 hover:bg-slate-50 transition-all">
           Return to Hub
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-40 pt-8 px-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div className="flex items-center gap-8">
          <Link href="/employee/portal">
             <Button variant="ghost" size="icon" className="rounded-2xl border-2 hover:bg-slate-50 size-14 shadow-sm">
                <ArrowLeft className="size-7 text-black" />
             </Button>
          </Link>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-5xl font-black tracking-tighter text-black uppercase leading-none">Slot Reservation</h1>
            </div>
            <div className="flex items-center gap-5 mt-4">
               <Badge className="bg-secondary text-white font-black text-[10px] uppercase px-5 py-1.5 rounded-full shadow-lg shadow-secondary/20">Cycle: {activeConfig.weekId}</Badge>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-black/40">ROC Cluster: {profile?.office?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {userBooking ? (
        <Card className="border-none bg-emerald-500 text-white shadow-[0_40px_80px_-15px_rgba(16,185,129,0.4)] rounded-[3.5rem] overflow-hidden relative group animate-in zoom-in-95">
          <div className="absolute top-0 right-0 p-12 transform group-hover:scale-110 transition-transform duration-1000"><Sparkles className="size-56 text-white opacity-20" /></div>
          <CardHeader className="p-14 pb-8">
            <div className="flex items-center gap-10">
              <div className="size-24 rounded-[2.25rem] bg-white/20 flex items-center justify-center shadow-inner border border-white/20">
                <CheckCircle2 className="size-14 text-white" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-4xl font-black uppercase tracking-tight leading-none">Reservation Secured</CardTitle>
                <CardDescription className="text-white/60 font-black uppercase text-[11px] tracking-[0.3em]">Audit Trace Locked: {new Date(userBooking.timestamp?.toDate?.() || Date.now()).toLocaleTimeString()}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-14 pt-0">
            <div className="p-12 rounded-[3rem] bg-white/10 shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="text-center md:text-left space-y-2">
                <p className="text-[11px] uppercase tracking-[0.5em] font-black text-white/50">Protected Clinical Off-Day</p>
                <p className="text-8xl font-black uppercase tracking-tighter italic text-white leading-none">{userBooking.dayOfWeek}</p>
              </div>
              <div className="flex flex-col items-center gap-5">
                 <Badge className="bg-white text-emerald-600 px-12 py-4 text-[14px] font-black uppercase tracking-[0.4em] shadow-2xl rounded-2xl">Verified Hub</Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-black/10 p-10 flex gap-8">
            <div className="size-10 rounded-full bg-white/10 flex items-center justify-center shrink-0"><Zap className="size-5 text-emerald-200" /></div>
            <p className="text-[14px] font-bold text-white/90 uppercase leading-relaxed tracking-tight max-w-3xl">
              Institutional commitment established. Manual modification is restricted to clinical leads via audit override.
            </p>
          </CardFooter>
        </Card>
      ) : !isWindowOpen ? (
        <Card className="border-none bg-white shadow-2xl rounded-[3.5rem] overflow-hidden group border-2 border-slate-100">
          <CardHeader className="text-center p-24 space-y-12 relative overflow-hidden">
            <div className="mx-auto size-40 rounded-[3rem] bg-secondary/5 flex items-center justify-center shadow-inner border-2 border-secondary/10 group-hover:scale-105 transition-all duration-700">
               <Clock className="size-20 text-secondary animate-pulse" />
            </div>
            <div className="space-y-8 relative z-10">
               {diffMins > 0 && diffMins <= 3 ? (
                 <CountdownTimer targetDate={activeConfig.bookingOpen} label="Clinical Window Initiates In" />
               ) : (
                 <div className="space-y-4">
                   <CardTitle className="text-5xl font-black text-black uppercase tracking-tight leading-none">Pulse Scheduled</CardTitle>
                   <p className="text-xl font-bold text-secondary uppercase tracking-widest">
                     Live pool available at {openTime?.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })} IST
                   </p>
                 </div>
               )}
               <p className="text-[11px] text-black/40 uppercase font-black tracking-[0.4em] mt-6 leading-relaxed max-w-sm mx-auto">
                 Atomic FCFS synchronization begins at precisely the opening second. Secure your preferences early.
               </p>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="p-10 rounded-[2.5rem] bg-primary shadow-2xl shadow-primary/20 flex flex-col md:flex-row items-center justify-between gap-10 border-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:rotate-12 transition-transform duration-700"><Zap size={180} /></div>
            <div className="flex items-center gap-8 relative z-10">
              <div className="size-5 rounded-full bg-secondary animate-ping shadow-[0_0_20px_hsl(var(--secondary))]" />
              <div className="space-y-1">
                 <span className="text-sm font-black text-white tracking-[0.5em] uppercase">FCFS Pulse: Active</span>
                 <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Server Synchronized (IST)</p>
              </div>
            </div>
            <div className="flex items-center gap-5 text-[13px] font-black text-white uppercase tracking-[0.3em] bg-white/10 px-10 py-4 rounded-[1.75rem] border border-white/10 backdrop-blur-md">
              <Clock className="size-5 text-secondary" /> Closes: {closeTime?.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="grid gap-6">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
              const status = getDayStatus(day);
              if (!status) return null;
              return (
                <Card key={day} className={cn(
                  "group overflow-hidden rounded-[3rem] border-2 transition-all hover:shadow-2xl bg-white",
                  status.disabled ? "opacity-60 grayscale border-slate-100" : "border-slate-100 hover:border-secondary active:scale-[0.98]"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center p-10 gap-14">
                    <div className="flex-1 space-y-8">
                      <div className="flex items-center gap-10">
                        <span className="font-black text-5xl uppercase tracking-tighter text-black group-hover:translate-x-3 transition-transform w-[220px]">{day}</span>
                        <Badge className={cn(
                          "font-black text-[11px] uppercase tracking-[0.3em] px-8 py-2.5 rounded-xl shadow-sm border-none", 
                          status.color === 'destructive' ? "bg-destructive text-white" : "bg-secondary/10 text-secondary"
                        )}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-10">
                         <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                            <div className={cn(
                              "h-full transition-all duration-[2s] cubic-bezier(0.4, 0, 0.2, 1)", 
                              status.color === 'destructive' ? 'bg-destructive' : 'bg-secondary'
                            )} style={{ width: `${status.percent}%` }} />
                         </div>
                         <div className="flex flex-col items-end min-w-[140px]">
                            <span className="text-[14px] font-black text-black tracking-tighter leading-none">{status.remaining} Slots</span>
                            <span className="text-[9px] font-black text-black/40 uppercase tracking-widest mt-1">Available Pulse</span>
                         </div>
                      </div>
                    </div>
                    <Button 
                       onClick={() => handleBook(day)} 
                       disabled={status.disabled || bookingInProgress} 
                       className={cn(
                         "h-24 px-14 font-black uppercase tracking-[0.4em] text-[15px] rounded-[2rem] shadow-2xl transition-all group/btn sm:min-w-[280px]",
                         status.disabled ? "bg-slate-200 text-black/20 shadow-none border-none" : "bg-primary hover:bg-secondary text-white hover:scale-105 active:scale-95"
                       )}
                    >
                      {bookingInProgress ? <Loader2 className="size-8 animate-spin" /> : (
                        <>Reserve Day <ArrowRight className="ml-5 size-7 group-hover/btn:translate-x-4 transition-transform" /></>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
