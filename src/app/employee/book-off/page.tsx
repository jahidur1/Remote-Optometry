'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock, CheckCircle2, AlertTriangle, Loader2, Info, Lock, Sparkles, Zap, ArrowRight } from "lucide-react";
import { bookWeeklyOff } from '@/lib/booking';
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-black uppercase text-secondary/60 tracking-[0.3em]">{label}</span>
      <span className="font-black tabular-nums text-4xl tracking-tighter text-primary">{timeLeft}</span>
    </div>
  );
}

export default function BookOffPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    // Verified Office Isolation: Only fetch window for user'sROC cluster
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
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, profile?.office]);

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

  const isWindowOpen = useMemo(() => {
    if (!activeConfig) return false;
    const now = new Date();
    return now >= new Date(activeConfig.bookingOpen) && now <= new Date(activeConfig.bookingClose);
  }, [activeConfig]);

  if (loading || bookingLoading) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
      <Loader2 className="size-14 animate-spin text-secondary opacity-20" />
      <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Syncing Clinical Grid</p>
    </div>
  );

  if (!activeConfig) return (
    <div className="max-w-xl mx-auto mt-24 text-center space-y-10 p-16 rounded-[3rem] bg-white shadow-2xl border-2 border-dashed border-muted relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      <CalendarDays className="size-24 mx-auto opacity-10 text-primary" />
      <div className="space-y-4">
         <h2 className="text-3xl font-black text-primary uppercase tracking-tight">Window Inactive</h2>
         <p className="text-sm text-muted-foreground leading-relaxed px-12 font-medium">
            There are no active FCFS reservation cycles scheduled for your clinical node at this time.
         </p>
      </div>
      <Button variant="outline" className="h-12 px-12 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border-2 hover:bg-muted transition-all" onClick={() => window.location.reload()}>
         Refresh Hub Data
      </Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-32 pt-8 px-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-black tracking-tighter text-primary uppercase leading-none">Slot Reservation</h1>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-4 mt-4">
             <Badge className="bg-secondary text-white font-black text-[10px] uppercase px-4 py-1.5 rounded-full shadow-lg shadow-secondary/20">Cycle: {activeConfig.weekId}</Badge>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Cluster: {profile?.office?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {userBooking ? (
        <Card className="border-none bg-emerald-600 text-white shadow-[0_40px_80px_-15px_rgba(16,185,129,0.3)] rounded-[3rem] overflow-hidden relative group animate-in zoom-in-95 duration-700">
          <div className="absolute top-0 right-0 p-12 transform group-hover:scale-110 transition-transform duration-1000"><Sparkles className="size-48 text-white opacity-10" /></div>
          <CardHeader className="p-12 pb-6">
            <div className="flex items-center gap-8">
              <div className="size-20 rounded-[1.75rem] bg-white/20 flex items-center justify-center shadow-inner border border-white/20">
                <CheckCircle2 className="size-12 text-white" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-black uppercase tracking-tight leading-none">Reservation Secured</CardTitle>
                <CardDescription className="text-emerald-100/60 font-black uppercase text-[11px] tracking-[0.25em]">Audit Locked: {new Date(userBooking.timestamp?.toDate?.() || Date.now()).toLocaleTimeString()}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-12 pt-0">
            <div className="p-10 rounded-[2.5rem] bg-white/10 shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="text-center md:text-left space-y-2">
                <p className="text-[11px] uppercase tracking-[0.4em] font-black text-white/50">Protected Clinical Off-Day</p>
                <p className="text-7xl font-black uppercase tracking-tighter italic text-white">{userBooking.dayOfWeek}</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                 <Badge className="bg-white text-emerald-700 px-10 py-3 text-[12px] font-black uppercase tracking-[0.3em] shadow-2xl rounded-2xl">Congratulations!</Badge>
                 <p className="text-[9px] font-black uppercase text-white/40 tracking-[0.2em]">Validated by ROC Node</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-black/5 p-8 flex gap-6">
            <div className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"><Zap className="size-4 text-emerald-200" /></div>
            <p className="text-[12px] font-bold text-white/80 uppercase leading-relaxed tracking-tight max-w-2xl">
              "CONGRATULATIONS! YOUR WEEKLY OFF IS CONFIRMED!" This record is server-locked. Manual modification is restricted to institutional clinical leads via mandatory audit override.
            </p>
          </CardFooter>
        </Card>
      ) : !isWindowOpen ? (
        <Card className="border-none bg-white shadow-2xl rounded-[3rem] overflow-hidden group border-2 border-secondary/5">
          <CardHeader className="text-center p-20 space-y-10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            <div className="mx-auto size-32 rounded-[2.5rem] bg-secondary/5 flex items-center justify-center shadow-inner border-2 border-secondary/10 group-hover:scale-105 transition-all duration-700">
               <Clock className="size-16 text-secondary animate-pulse" />
            </div>
            <div className="space-y-6 relative z-10">
               <CardTitle className="text-4xl font-black text-primary uppercase tracking-tight leading-none">Pulse Opening Soon</CardTitle>
               <div className="flex flex-col items-center gap-6">
                  <div className="px-10 py-5 bg-muted/30 rounded-3xl border-2 shadow-inner">
                     <CountdownTimer targetDate={activeConfig.bookingOpen} label="Clinical Window Initiates In" />
                  </div>
                  <p className="text-[11px] text-muted-foreground uppercase font-black tracking-[0.2em] mt-4 leading-relaxed max-w-sm">
                    Atomic FCFS synchronization begins at precisely the opening second. Secure your preferences early.
                  </p>
               </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="p-8 rounded-[2rem] bg-primary shadow-2xl shadow-primary/20 flex flex-col md:flex-row items-center justify-between gap-8 border-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:rotate-12 transition-transform duration-700"><Zap size={140} /></div>
            <div className="flex items-center gap-6 relative z-10">
              <div className="size-4 rounded-full bg-secondary animate-ping shadow-[0_0_20px_hsl(var(--secondary))]" />
              <div className="space-y-0.5">
                 <span className="text-xs font-black text-white tracking-[0.4em] uppercase">FCFS Pulse: Active</span>
                 <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Server Synchronized (IST)</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-black text-white uppercase tracking-[0.2em] bg-white/5 px-8 py-3 rounded-2xl border border-white/10 backdrop-blur-md">
              <Clock className="size-4 text-secondary" /> Closes: {new Date(activeConfig.bookingClose).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="grid gap-6">
            {DAYS.map((day) => {
              const status = getDayStatus(day);
              if (!status) return null;
              return (
                <Card key={day} className={cn(
                  "group overflow-hidden rounded-[2.5rem] border-2 transition-all hover:shadow-2xl bg-white",
                  status.disabled ? "opacity-60 grayscale border-muted" : "hover:border-secondary active:scale-[0.98]"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center p-8 gap-10">
                    <div className="flex-1 space-y-6">
                      <div className="flex items-center gap-8">
                        <span className="font-black text-4xl uppercase tracking-tighter text-primary group-hover:translate-x-2 transition-transform w-[180px]">{day}</span>
                        <Badge className={cn(
                          "font-black text-[10px] uppercase tracking-[0.2em] px-6 py-2 rounded-xl shadow-sm border-none", 
                          status.color === 'destructive' ? "bg-destructive text-white" : "bg-secondary/10 text-secondary"
                        )}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-8">
                         <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden shadow-inner border border-muted">
                            <div className={cn(
                              "h-full transition-all duration-[2s] cubic-bezier(0.4, 0, 0.2, 1)", 
                              status.color === 'destructive' ? 'bg-destructive' : 'bg-secondary'
                            )} style={{ width: `${status.percent}%` }} />
                         </div>
                         <div className="flex flex-col items-end min-w-[120px]">
                            <span className="text-[12px] font-black text-primary tracking-tighter leading-none">{status.remaining} Slots</span>
                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Available</span>
                         </div>
                      </div>
                    </div>
                    <Button 
                       onClick={() => handleBook(day)} 
                       disabled={status.disabled || bookingInProgress} 
                       className={cn(
                         "h-20 px-12 font-black uppercase tracking-[0.3em] text-[13px] rounded-3xl shadow-2xl transition-all group/btn sm:min-w-[240px]",
                         status.disabled ? "bg-muted text-muted-foreground shadow-none" : "bg-primary hover:bg-secondary text-white hover:scale-105 active:scale-95"
                       )}
                    >
                      {bookingInProgress ? <Loader2 className="size-6 animate-spin" /> : (
                        <>Reserve Day <ArrowRight className="ml-4 size-6 group-hover/btn:translate-x-2 transition-transform" /></>
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
