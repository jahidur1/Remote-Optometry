
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock, CheckCircle2, AlertTriangle, Loader2, Info } from "lucide-react";
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

  // Fetch the latest/current booking window
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
        title: "Booking Confirmed",
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

  const getStatus = (day: string) => {
    if (!activeConfig) return null;
    const quota = activeConfig.quotas?.[day] || 0;
    const booked = activeConfig.booked?.[day] || 0;
    const remaining = Math.max(0, quota - booked);
    const percent = quota > 0 ? (booked / quota) * 100 : 100;

    if (remaining === 0) return { label: "Full", color: "destructive", disabled: true, remaining };
    if (percent > 80) return { label: "Almost Full", color: "secondary", disabled: false, remaining };
    return { label: "Available", color: "default", disabled: false, remaining };
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
      <Card className="max-w-md mx-auto mt-12 text-center">
        <CardHeader>
          <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>No Active Window</CardTitle>
          <CardDescription>There are currently no scheduled weekly-off booking windows.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Weekly-Off Booking</h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground">Reserve your preferred off-day for Week {activeConfig.weekId}.</p>
      </div>

      {userBooking ? (
        <Card className="border-accent bg-accent/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <div>
                <CardTitle className="text-emerald-600">Booking Confirmed</CardTitle>
                <CardDescription>Your weekly off is protected and locked for Week {activeConfig.weekId}.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-xl bg-background border flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Confirmed Day</p>
                <p className="text-2xl font-black text-primary uppercase">{userBooking.dayOfWeek}</p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-4 py-1 text-sm">
                LOCKED
              </Badge>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex gap-2">
            <Info className="size-3" />
            Changes require Super Admin authorization and mandatory justification.
          </CardFooter>
        </Card>
      ) : !isWindowOpen ? (
        <Card className="border-secondary/20 bg-secondary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="size-8 text-secondary" />
              <div>
                <CardTitle className="text-secondary">Booking Window Closed</CardTitle>
                <CardDescription>
                  Opens: {new Date(activeConfig.bookingOpen).toLocaleString('en-IN')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-center py-8">
            <p className="text-sm text-muted-foreground italic">
              Please check back when the window is live. Slots are assigned on a first-come, first-served basis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-secondary font-bold text-sm">
              <AlertTriangle className="size-4 animate-pulse" />
              LIVE FCFS BOOKING IN PROGRESS
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Window closes: {new Date(activeConfig.bookingClose).toLocaleTimeString('en-IN')}
            </div>
          </div>

          <div className="grid gap-3">
            {DAYS.map((day) => {
              const status = getStatus(day);
              if (!status) return null;

              return (
                <Card key={day} className="overflow-hidden hover:border-secondary transition-all">
                  <div className="flex items-center p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg min-w-[100px]">{day}</span>
                        <Badge variant={status.color === 'default' ? 'outline' : 'default'} className={status.color === 'destructive' ? 'bg-destructive' : status.color === 'secondary' ? 'bg-secondary' : ''}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4">
                         <div className="flex-1 max-w-[200px]">
                            <Progress value={((activeConfig.quotas[day] - status.remaining) / activeConfig.quotas[day]) * 100} className="h-1" />
                         </div>
                         <span className="text-xs text-muted-foreground font-bold">
                            {status.remaining} SLOTS LEFT
                         </span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleBook(day)} 
                      disabled={status.disabled || bookingInProgress}
                      className={status.disabled ? "bg-muted" : "bg-primary min-w-[120px]"}
                    >
                      {bookingInProgress ? <Loader2 className="size-4 animate-spin" /> : "Book Slot"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-6">
          <div className="flex gap-3 text-xs text-muted-foreground">
             <Info className="size-4 shrink-0" />
             <p className="leading-relaxed">
               <strong>Strict Priority Policy:</strong> Slots are confirmed based on server-side transaction commit time. 
               If multiple employees select the final slot simultaneously, only the first transaction verified 
               by the ROC Workforce engine will be processed.
             </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
