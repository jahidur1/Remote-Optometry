
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
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function BookOffPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);

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

  const bookingId = useMemo(() => {
    if (!activeConfig || !profile?.employeeId) return null;
    return `${activeConfig.weekId}_${profile.employeeId}`;
  }, [activeConfig, profile]);

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

  if (loading || bookingLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!activeConfig) return (
    <Card className="max-w-md mx-auto mt-12 text-center border-dashed">
      <CardHeader>
        <CardTitle>No Active Windows</CardTitle>
        <CardDescription>There are currently no scheduled booking windows for the upcoming roster cycle.</CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-primary font-headline uppercase">Weekly-Off Reservation</h1>
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
          <div className="absolute top-0 right-0 p-4"><Lock className="size-12 text-emerald-500 opacity-10" /></div>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-emerald-700 font-headline uppercase">Congratulations! 🎉</CardTitle>
                <CardDescription className="text-emerald-600/80">You have successfully secured your off-day.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-6 rounded-2xl bg-white/50 border border-emerald-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground mb-1">Assigned Day</p>
                <p className="text-4xl font-black text-primary uppercase">{userBooking.dayOfWeek}</p>
              </div>
              <Badge className="bg-emerald-500 px-4 py-1 font-black">LOCKED</Badge>
            </div>
          </CardContent>
          <CardFooter className="bg-emerald-500/10 py-3 flex gap-2">
            <Info className="size-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">
              PROTECTED RECORD: Changes require Super Admin override.
            </p>
          </CardFooter>
        </Card>
      ) : !isWindowOpen ? (
        <Card className="border-secondary/20 bg-secondary/5 shadow-inner">
          <CardHeader className="text-center">
            <div className="mx-auto size-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4"><Clock className="size-8 text-secondary" /></div>
            <CardTitle className="text-secondary uppercase font-black">Booking Window Not Open</CardTitle>
            <CardDescription className="font-bold">FCFS Opens: {new Date(activeConfig.bookingOpen).toLocaleString('en-IN')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4 animate-in">
          <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-black text-secondary tracking-widest uppercase">Live FCFS Pulse Active</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Clock className="size-3" /> Closes: {new Date(activeConfig.bookingClose).toLocaleTimeString()}
            </div>
          </div>

          <div className="grid gap-3">
            {DAYS.map((day) => {
              const status = getDayStatus(day);
              if (!status) return null;
              return (
                <Card key={day} className="group hover:border-secondary transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-4">
                        <span className="font-black text-xl min-w-[120px] uppercase tracking-tighter">{day}</span>
                        <Badge variant={status.color === 'default' ? 'outline' : 'default'} className={cn("font-black text-[10px]", status.color === 'destructive' ? 'bg-destructive' : 'text-secondary')}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex-1 max-w-xs"><Progress value={status.percent} className="h-1 bg-muted" /></div>
                         <span className="text-[10px] font-black uppercase">{status.remaining} slots left</span>
                      </div>
                    </div>
                    <Button onClick={() => handleBook(day)} disabled={status.disabled || bookingInProgress} className="font-black uppercase tracking-widest sm:min-w-[140px]">
                      {bookingInProgress ? <Loader2 className="size-4 animate-spin" /> : "Secure Slot"}
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
