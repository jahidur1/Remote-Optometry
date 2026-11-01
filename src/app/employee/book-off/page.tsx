
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock, CheckCircle2, AlertTriangle, Loader2, Info, Lock } from "lucide-react";
import { bookWeeklyOff } from '@/lib/booking';
import { DemoBadge } from '@/components/ui/demo-badge';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function BookOffPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Real-time subscription to the active booking window
  useEffect(() => {
    const q = query(collection(db, 'weekoff_configs'), orderBy('weekId', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveConfig(snapshot.docs[0].data());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  // Check if current user already has a booking for this week
  const bookingId = useMemo(() => {
    if (!activeConfig || !profile?.employeeId) return null;
    return `${activeConfig.weekId}_${profile.employeeId}`;
  }, [activeConfig, profile]);

  const bookingRef = useMemo(() => {
    if (!db || !bookingId) return null;
    return doc(db, 'weekoff_bookings', bookingId);
  }, [db, bookingId]);

  const { data: userBooking, loading: bookingLoading } = useDoc(bookingRef);

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
      toast({
        title: "Reservation Secured",
        description: result.message,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Booking Failed",
        description: result.message,
      });
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

  if (loading || bookingLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!activeConfig) {
    return (
      <Card className="max-w-md mx-auto mt-12 text-center border-dashed">
        <CardHeader>
          <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>No Active Windows</CardTitle>
          <CardDescription>There are currently no scheduled booking windows for the upcoming roster cycle.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-primary font-headline uppercase">
              Weekly-Off Reservation
            </h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">
            Week Cycle: <span className="text-foreground font-bold">{activeConfig.weekId}</span> • 
            Status: {isWindowOpen ? <span className="text-emerald-500 font-bold ml-1 animate-pulse">LIVE</span> : <span className="text-muted-foreground font-bold ml-1">LOCKED</span>}
          </p>
        </div>
      </div>

      {userBooking ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4">
             <Lock className="size-12 text-emerald-500 opacity-10" />
          </div>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-emerald-700">Booking Confirmed & Protected</CardTitle>
                <CardDescription className="text-emerald-600/80">
                  Your clinical off-day has been secured for Week {activeConfig.weekId}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 p-6 rounded-2xl bg-white/50 border border-emerald-500/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground mb-1">Assigned Day</p>
                  <p className="text-4xl font-black text-primary uppercase">{userBooking.dayOfWeek}</p>
                </div>
                <Badge className="bg-emerald-500 px-4 py-1 font-black">LOCKED</Badge>
              </div>
              <div className="md:w-64 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Audit Details</p>
                <div className="text-[10px] space-y-1 font-medium">
                   <p className="flex justify-between"><span>Confirmed At:</span> <span>{new Date(userBooking.timestamp?.toDate()).toLocaleTimeString('en-IN')}</span></p>
                   <p className="flex justify-between"><span>Priority Rank:</span> <span className="text-emerald-600">Verified</span></p>
                   <p className="flex justify-between"><span>Roster Status:</span> <span>Pending Publication</span></p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-emerald-500/10 py-3 flex gap-2">
            <Info className="size-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">
              PROTECTED RECORD: Changes require Super Admin override with documented justification.
            </p>
          </CardFooter>
        </Card>
      ) : !isWindowOpen ? (
        <Card className="border-secondary/20 bg-secondary/5 shadow-inner">
          <CardHeader className="text-center">
            <div className="mx-auto size-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4">
              <Clock className="size-8 text-secondary" />
            </div>
            <CardTitle className="text-secondary uppercase font-black">Booking Window Not Open</CardTitle>
            <CardDescription className="font-bold">
              FCFS Opens: {new Date(activeConfig.bookingOpen).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-md mx-auto text-center pb-12">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Slots are assigned based on the exact time of successful transaction completion. 
              Please refresh this page precisely at the opening time to secure your preferred day.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-black text-secondary tracking-widest uppercase">Live FCFS Booking Pulse Active</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Clock className="size-3" />
              Closes: {new Date(activeConfig.bookingClose).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="grid gap-3">
            {DAYS.map((day) => {
              const status = getDayStatus(day);
              if (!status) return null;

              return (
                <Card key={day} className="group hover:border-secondary hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-4">
                        <span className="font-black text-xl min-w-[120px] uppercase tracking-tighter">{day}</span>
                        <Badge 
                          variant={status.color === 'default' ? 'outline' : 'default'} 
                          className={cn(
                            "font-black text-[10px] tracking-widest px-3",
                            status.color === 'destructive' ? 'bg-destructive' : status.color === 'secondary' ? 'bg-secondary' : 'border-secondary/20 text-secondary'
                          )}
                        >
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex-1 max-w-xs">
                            <Progress value={status.percent} className="h-1.5 bg-muted" />
                         </div>
                         <span className={cn(
                           "text-[10px] font-black uppercase tracking-wider",
                           status.remaining === 0 ? "text-destructive" : "text-muted-foreground"
                         )}>
                            {status.remaining} slots remaining
                         </span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleBook(day)} 
                      disabled={status.disabled || bookingInProgress}
                      className={cn(
                        "font-black uppercase tracking-widest sm:min-w-[140px] h-11",
                        status.disabled ? "bg-muted text-muted-foreground" : "bg-primary shadow-lg shadow-primary/10 hover:shadow-primary/20"
                      )}
                    >
                      {bookingInProgress ? <Loader2 className="size-4 animate-spin" /> : "Secure Slot"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-start">
             <div className="size-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm border">
                <Info className="size-5 text-secondary" />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-black text-primary uppercase tracking-wider">The "Final Slot" Guarantee</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Priority is verified by the ROC Workforce atomic engine using server-side transaction order. 
                  In the event of a simultaneous collision for the final available slot, only the single 
                  earliest verified commit will be processed. All other attempts will be automatically 
                  cancelled and availability refreshed.
                </p>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
