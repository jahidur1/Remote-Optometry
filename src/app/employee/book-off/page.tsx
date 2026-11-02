
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock, CheckCircle2, AlertTriangle, Loader2, Info, Lock } from "lucide-react";
import { bookWeeklyOff } from '@/lib/booking';
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function BookOffPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Fetch the latest active window
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'weekoff_configs'), orderBy('weekId', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveConfig(snapshot.docs[0].data());
      } else {
        setActiveConfig(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  // Check if user already has a booking for the active week
  const bookingId = activeConfig && profile?.employeeId ? `${activeConfig.weekId}_${profile.employeeId}` : null;
  const { data: userBooking, loading: bookingLoading } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

  const handleBook = async (day: string) => {
    if (!profile?.employeeId || !activeConfig) return;
    
    setBookingInProgress(true);
    const result = await bookWeeklyOff(
      db, 
      activeConfig.weekId, 
      profile.employeeId, 
      day, 
      profile.uid
    );

    if (result.success) {
      toast({ title: "Reservation Secured", description: result.message });
    } else {
      toast({ variant: "destructive", title: "Booking Failed", description: result.message });
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
    if (percent > 85) return { label: "ALMOST FULL", color: "secondary", disabled: false, remaining, percent };
    return { label: "AVAILABLE", color: "default", disabled: false, remaining, percent };
  };

  const isWindowOpen = useMemo(() => {
    if (!activeConfig) return false;
    const now = new Date();
    return now >= new Date(activeConfig.bookingOpen) && now <= new Date(activeConfig.bookingClose);
  }, [activeConfig]);

  if (loading || bookingLoading) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
      <Loader2 className="size-10 animate-spin text-secondary" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Syncing Grid Nodes</p>
    </div>
  );

  if (!activeConfig) return (
    <div className="max-w-xl mx-auto mt-20 text-center space-y-8 p-12 rounded-[2.5rem] bg-muted/20 border-4 border-dashed border-muted transition-all">
      <CalendarDays className="size-20 mx-auto opacity-10 text-primary" />
      <div className="space-y-2">
         <h2 className="text-2xl font-black text-primary uppercase tracking-tight">No Active Windows</h2>
         <p className="text-sm text-muted-foreground leading-relaxed px-8">
            There are currently no scheduled FCFS booking windows. Check back later for Cycle updates.
         </p>
      </div>
      <Button variant="outline" className="h-11 px-8 rounded-xl font-bold uppercase text-[10px] tracking-widest border-2" onClick={() => window.location.reload()}>
         Refresh Sync Pulse
      </Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 pt-4 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-primary font-headline uppercase leading-none">Slot Reservation</h1>
            <DemoBadge />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-3">
            Institutional Week Cycle: <span className="text-secondary">{activeConfig.weekId}</span>
          </p>
        </div>
      </div>

      {userBooking ? (
        <Card className="border-none bg-emerald-500/5 shadow-2xl rounded-[2.5rem] overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 transform group-hover:scale-110 transition-transform duration-700"><Lock className="size-32 text-emerald-500 opacity-5" /></div>
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.5rem] bg-emerald-500/20 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="size-10 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black text-emerald-700 uppercase tracking-tight leading-none">Reservation Secured</CardTitle>
                <CardDescription className="text-emerald-600/60 font-black uppercase text-[10px] tracking-widest">Audit Timestamp: {new Date(userBooking.timestamp?.toDate?.() || Date.now()).toLocaleString()}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="p-8 rounded-[2rem] bg-white shadow-xl border-2 border-emerald-500/10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-left space-y-1">
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Official Clinical Off-Day</p>
                <p className="text-5xl font-black text-primary uppercase tracking-tighter italic">{userBooking.dayOfWeek}</p>
              </div>
              <Badge className="bg-emerald-500 text-white px-8 py-2 text-[11px] font-black uppercase tracking-[0.25em] shadow-lg rounded-full">Atomic Lock Active</Badge>
            </div>
          </CardContent>
          <CardFooter className="bg-emerald-500/10 p-6 flex gap-4">
            <Info className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-emerald-700 uppercase leading-relaxed tracking-tight">
              PROTECTED RECORD: This reservation is server-locked for Week {activeConfig.weekId}. Any manual modification requires Clinical Lead authorization via Audit override.
            </p>
          </CardFooter>
        </Card>
      ) : !isWindowOpen ? (
        <Card className="border-none bg-secondary/5 shadow-2xl rounded-[2.5rem] overflow-hidden transition-all hover:bg-secondary/10 group">
          <CardHeader className="text-center p-12 space-y-8">
            <div className="mx-auto size-24 rounded-[2rem] bg-white flex items-center justify-center shadow-xl border-4 border-secondary/10 group-hover:scale-110 transition-all duration-500">
               <Clock className="size-12 text-secondary animate-pulse" />
            </div>
            <div className="space-y-3">
               <CardTitle className="text-3xl font-black text-primary uppercase tracking-tight">Window Opening Soon</CardTitle>
               <div className="flex flex-col items-center gap-2">
                  <Badge variant="outline" className="border-secondary/40 text-secondary text-[11px] font-black uppercase tracking-widest px-6 h-9">
                    Starts: {new Date(activeConfig.bookingOpen).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mt-2 leading-relaxed opacity-60 max-w-sm">
                    Atomic FCFS pulse will initiate at precisely the opening second. Secure your preference immediately.
                  </p>
               </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="p-6 rounded-[1.5rem] bg-secondary shadow-2xl shadow-secondary/20 flex flex-col md:flex-row items-center justify-between gap-6 border-none">
            <div className="flex items-center gap-5">
              <div className="size-3 rounded-full bg-white animate-ping shadow-[0_0_15px_white]" />
              <span className="text-xs font-black text-white tracking-[0.3em] uppercase">FCFS Pulse: LIVE & ACTIVE</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black text-white/70 uppercase tracking-widest bg-black/10 px-4 py-2 rounded-full">
              <Clock className="size-3.5" /> Closes in: {Math.max(0, Math.floor((new Date(activeConfig.bookingClose).getTime() - new Date().getTime()) / 60000))} Minutes
            </div>
          </div>

          <div className="grid gap-4">
            {DAYS.map((day) => {
              const status = getDayStatus(day);
              if (!status) return null;
              return (
                <Card key={day} className="group overflow-hidden rounded-3xl border-2 transition-all hover:border-secondary hover:shadow-2xl bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center p-6 gap-8">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-6">
                        <span className="font-black text-3xl uppercase tracking-tighter text-primary group-hover:scale-105 transition-all w-[160px]">{day}</span>
                        <Badge className={cn("font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-full", 
                          status.color === 'destructive' ? 'bg-destructive' : 'bg-secondary')}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6">
                         <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden shadow-inner">
                            <div className={cn("h-full transition-all duration-1000", status.color === 'destructive' ? 'bg-destructive' : 'bg-secondary')} style={{ width: `${status.percent}%` }} />
                         </div>
                         <span className="text-[11px] font-black uppercase text-muted-foreground w-32 tracking-tighter">{status.remaining} slots available</span>
                      </div>
                    </div>
                    <Button 
                       onClick={() => handleBook(day)} 
                       disabled={status.disabled || bookingInProgress} 
                       className="h-16 px-10 font-black uppercase tracking-[0.25em] text-sm rounded-2xl bg-primary hover:bg-secondary shadow-xl hover:scale-105 transition-all group/btn sm:min-w-[200px]"
                    >
                      {bookingInProgress ? <Loader2 className="size-5 animate-spin" /> : "SECURE SLOT"}
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
