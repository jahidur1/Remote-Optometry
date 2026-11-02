
'use client';

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc, where } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CalendarDays, CheckCircle2, ArrowRight, Loader2, Building2, MapPin, Settings, AlertCircle } from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"

function Countdown({ targetDate, onComplete }: { targetDate: string, onComplete?: () => void }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(targetDate).getTime() - now;
      
      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft('LIVE');
        onComplete?.();
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

  return <span className="font-black tabular-nums">{timeLeft}</span>;
}

export default function EmployeePortal() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentWeek = '2024-52'; 

  const publishedQuery = useMemo(() => {
    return query(
      collection(db, 'published_rosters'),
      where('weekId', '==', currentWeek),
      where('status', '==', 'active'),
      orderBy('publishedAt', 'desc'),
      limit(1)
    );
  }, [currentWeek]);

  const { data: publishedRosters, loading: rosterLoading } = useCollection(publishedQuery);
  const { data: shifts } = useCollection(query(collection(db, 'shift_master')));
  
  const bookingId = profile?.employeeId ? `${currentWeek}_${profile.employeeId}` : null;
  const { data: userBooking } = useDoc(bookingId ? doc(db, 'weekoff_bookings', bookingId) : null);

  const myAssignments = useMemo(() => {
    if (!publishedRosters?.[0] || !profile?.employeeId) return [];
    return publishedRosters[0].assignments.filter((a: any) => a.employeeId === profile.employeeId);
  }, [publishedRosters, profile]);

  useEffect(() => {
    if (!profile?.office || !db) return;
    const q = query(
      collection(db, 'weekoff_configs'), 
      where('office', '==', profile.office),
      orderBy('weekId', 'desc'), 
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setActiveConfig(snapshot.docs[0].data());
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, profile]);

  const isWindowOpen = activeConfig && new Date() >= new Date(activeConfig.bookingOpen) && new Date() <= new Date(activeConfig.bookingClose);

  if (userLoading || loading || rosterLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Loader2 className="size-12 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Cluster Node</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-4 pt-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-primary font-headline leading-tight">
              Hello, {profile?.displayName?.split(' ')[0] || 'Professional'}
            </h1>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-4 mt-1">
             <Badge className="bg-secondary/10 text-secondary border-none font-black text-[9px] uppercase tracking-widest py-1 px-4 rounded-full">
                <Building2 className="size-3 mr-2" /> {profile?.office?.replace('_', ' ')}
             </Badge>
             <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                Unit {profile?.employeeId?.slice(-4)} <MapPin className="size-3 text-accent" />
             </p>
          </div>
        </div>
        <Link href="/employee/profile">
            <Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-2 bg-white hover:bg-muted shadow-sm transition-all">
                <Settings className="size-6 text-primary" />
            </Button>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        <div className="lg:col-span-4 space-y-8">
          <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2.5rem]">
             <CardHeader className="bg-primary p-8 text-primary-foreground border-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><CalendarDays size={180} /></div>
                <div className="flex items-center justify-between relative z-10">
                   <div className="space-y-1">
                       <CardTitle className="text-xl flex items-center gap-4 font-black uppercase tracking-tight leading-none">
                          <Clock className="size-8 text-secondary" /> Shift Deployment
                       </CardTitle>
                       <CardDescription className="text-[11px] uppercase font-black text-white/40 tracking-[0.2em] mt-2">Cycle: {currentWeek}</CardDescription>
                   </div>
                </div>
             </CardHeader>
             <CardContent className="p-8 space-y-4 bg-muted/5">
                {myAssignments.length > 0 ? (
                  myAssignments.sort((a: any, b: any) => {
                    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                    return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                  }).map((a: any, i: number) => {
                    const shift = shifts?.find(s => s.id === a.shiftId);
                    return (
                      <div key={i} className="flex items-center justify-between p-7 rounded-[2rem] bg-white border-2 border-transparent hover:border-secondary/10 shadow-sm transition-all group">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-2xl uppercase tracking-tighter text-primary group-hover:translate-x-1 transition-transform">{a.dayOfWeek}</span>
                          <div className="flex items-center gap-3">
                             <Badge variant="outline" className="text-[10px] font-black text-secondary border-secondary/20 uppercase px-3">
                                {shift?.name || a.shiftId}
                             </Badge>
                             <span className="text-[10px] text-muted-foreground font-black tracking-widest uppercase opacity-60">
                                {shift?.startTime} — {shift?.endTime} IST
                             </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-20 bg-muted/20 rounded-[2.5rem] border-4 border-dashed border-muted transition-all">
                     <CalendarDays className="size-20 text-muted-foreground/10 mx-auto mb-6 animate-pulse" />
                     <p className="text-lg font-black text-muted-foreground uppercase tracking-tight">Schedule Pending</p>
                     <p className="text-[9px] text-muted-foreground/50 uppercase mt-2 max-w-[240px] mx-auto leading-relaxed font-black tracking-[0.2em]">Administrative review in progress for this ROC node.</p>
                  </div>
                )}
             </CardContent>
          </Card>

          {activeConfig && !userBooking && (
            <Card className="border-none bg-accent/5 shadow-2xl rounded-[2.5rem] overflow-hidden border-2 border-accent/10">
              <CardHeader className="p-10 pb-4">
                <div className="flex items-center gap-4 font-black text-[12px] uppercase tracking-[0.3em] text-accent-foreground">
                  <div className="size-2 rounded-full bg-accent animate-ping" />
                  Priority Action: Week-Off Pulse
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                  <div className="space-y-8 py-4 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-8">
                       <div className="size-20 rounded-[2rem] bg-accent/10 flex items-center justify-center shrink-0 shadow-inner">
                          <Clock className="size-10 text-accent-foreground opacity-60" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-2xl font-black text-accent-foreground uppercase tracking-tight leading-none">
                            {isWindowOpen 
                              ? "PULSE LIVE" 
                              : <Countdown targetDate={activeConfig.bookingOpen} />}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed opacity-70 mt-2">
                             Atomic FCFS reservation for {profile?.office?.replace('_', ' ')}. 
                             Slots are claimed in real-time by cluster professionals.
                          </p>
                       </div>
                    </div>
                    {isWindowOpen && (
                      <Link href="/employee/book-off" className="block">
                        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-black uppercase tracking-[0.3em] h-16 rounded-[1.5rem] shadow-2xl shadow-accent/20 transition-all hover:scale-[1.02]">
                          Enter Location Matrix <ArrowRight className="ml-3 size-6" />
                        </Button>
                      </Link>
                    )}
                  </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3 space-y-8">
          <Card className={cn("shadow-2xl border-none rounded-[2.5rem] overflow-hidden transition-all", userBooking ? "bg-emerald-600" : "bg-primary")}>
            <CardHeader className="p-8 pb-4 text-center">
               <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">Institutional Off-Day</p>
            </CardHeader>
            <CardContent className="p-8 pt-0 flex flex-col items-center text-center space-y-6">
                <div className="p-10 rounded-[2rem] bg-white/10 border-2 border-white/10 w-full shadow-inner">
                    <p className="text-5xl font-black text-white uppercase tracking-tighter italic">
                        {userBooking?.dayOfWeek || <span className="opacity-20 italic">UNSET</span>}
                    </p>
                </div>
                {userBooking ? (
                   <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-center gap-3 text-[11px] text-white/90 font-black uppercase tracking-widest">
                         <CheckCircle2 className="size-4 text-white" /> Secured & Locked
                      </div>
                      <p className="text-[12px] font-bold text-white text-center leading-snug mt-2">
                        Congratulations! You have secured your preference for Week {currentWeek}.
                      </p>
                   </div>
                ) : (
                   <div className="flex items-center gap-3 text-[11px] text-white/60 font-bold uppercase tracking-widest">
                      <AlertCircle className="size-4 text-accent animate-pulse" /> Pending Pulse Action
                   </div>
                )}
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden rounded-[2.5rem]">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 text-secondary">
                Clinical Health Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                   <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                   <p className="text-[12px] font-black tracking-widest text-white/90 uppercase">Cluster Verified</p>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed uppercase font-black tracking-[0.1em]">
                   Rosters are optimized per pod. Shift-briefings via WhatsApp occur at 22:00 IST for published cycles.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
