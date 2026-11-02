
'use client';

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc, where } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CalendarDays, MessageCircle, AlertCircle, CheckCircle2, ArrowRight, Loader2, Info, Bell, Settings, MapPin, Building2 } from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"

export default function EmployeePortal() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Current operational week
  const currentWeek = '2024-52'; 

  // Fetch active booking window FOR THE USER'S OFFICE
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

  // Check user's booking for active week
  const bookingId = activeConfig && profile?.employeeId ? `${activeConfig.weekId}_${profile.employeeId}` : null;
  const bookingRef = bookingId ? doc(db, 'weekoff_bookings', bookingId) : null;
  const { data: userBooking } = useDoc(bookingRef);

  // Fetch latest published roster
  const publishedQuery = useMemo(() => {
    return query(
      collection(db, 'published_rosters'),
      where('weekId', '==', currentWeek),
      orderBy('publishedAt', 'desc'),
      limit(1)
    );
  }, [currentWeek]);

  const { data: publishedRosters, loading: rosterLoading } = useCollection(publishedQuery);
  const publishedRoster = publishedRosters?.[0];
  const { data: shifts } = useCollection(query(collection(db, 'shift_master')));

  const myAssignments = useMemo(() => {
    if (!publishedRoster || !profile?.employeeId) return [];
    return publishedRoster.assignments.filter((a: any) => a.employeeId === profile.employeeId);
  }, [publishedRoster, profile]);

  const isWindowOpen = activeConfig && new Date() >= new Date(activeConfig.bookingOpen) && new Date() <= new Date(activeConfig.bookingClose);

  if (userLoading || loading || rosterLoading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="size-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Clinical Grid</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 px-4 pt-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-primary font-headline leading-tight">
              Namaste, {profile?.displayName?.split(' ')[0] || 'Professional'}
            </h1>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-4 mt-1">
             <Badge className="bg-secondary/10 text-secondary border-none font-black text-[9px] uppercase tracking-widest py-1 px-4 rounded-full">
                <Building2 className="size-3 mr-2" /> {profile?.office}
             </Badge>
             <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                Unit {profile?.employeeId?.slice(-4)} <MapPin className="size-3 text-accent" />
             </p>
          </div>
        </div>
        <div className="flex gap-3">
            <Link href="/employee/profile">
                <Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-2 shadow-sm bg-white hover:bg-muted transition-all">
                    <Settings className="size-6 text-primary" />
                </Button>
            </Link>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-8">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-primary shadow-2xl border-none rounded-[2rem] overflow-hidden group">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-2">
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">Institutional Cycle</p>
                    <p className="text-3xl font-black text-white uppercase tracking-tighter group-hover:scale-110 transition-all">{currentWeek}</p>
                </CardContent>
            </Card>
            <Card className={cn("shadow-2xl border-none rounded-[2rem] overflow-hidden group", userBooking ? "bg-emerald-600" : "bg-accent")}>
                <CardContent className="p-8 flex flex-col items-center text-center space-y-2">
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">Weekly-Off</p>
                    <p className="text-3xl font-black text-white uppercase tracking-tighter group-hover:scale-110 transition-all">
                        {userBooking?.dayOfWeek || <span className="opacity-30">PENDING</span>}
                    </p>
                </CardContent>
            </Card>
          </div>

          {/* Published Roster Card */}
          <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2.5rem]">
             <CardHeader className="bg-primary p-8 text-primary-foreground border-none">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                       <CardTitle className="text-xl flex items-center gap-4 font-black uppercase tracking-tight leading-none">
                          <Clock className="size-8 text-secondary" /> Authorized Schedule
                       </CardTitle>
                       <CardDescription className="text-[11px] uppercase font-black text-white/40 tracking-[0.2em] mt-2">Confirmed Deployments for Cycle {currentWeek}</CardDescription>
                   </div>
                   {publishedRoster && (
                      <Badge className="bg-secondary text-white text-[10px] font-black tracking-widest shadow-xl px-4 py-2 rounded-full border-none border-4 border-white/10">
                         V{publishedRoster.version.toString().slice(-4)} LIVE
                      </Badge>
                   )}
                </div>
             </CardHeader>
             <CardContent className="p-8 space-y-4 bg-muted/10">
                {myAssignments.length > 0 ? (
                  myAssignments.sort((a: any, b: any) => {
                    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                    return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                  }).map((a: any, i: number) => {
                    const shift = shifts?.find(s => s.id === a.shiftId);
                    return (
                      <div key={i} className="flex items-center justify-between p-8 rounded-[2rem] bg-white hover:bg-muted/30 transition-all border-2 border-transparent hover:border-secondary/10 shadow-sm group">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-2xl uppercase tracking-tighter text-primary group-hover:translate-x-1 transition-transform">{a.dayOfWeek}</span>
                          <div className="flex items-center gap-3">
                             <Badge variant="outline" className="text-[10px] font-black text-secondary border-secondary/20 uppercase tracking-widest px-3">
                                {shift?.name || a.shiftId}
                             </Badge>
                             <span className="text-[11px] text-muted-foreground font-black tracking-widest uppercase opacity-60">
                                {shift?.startTime} — {shift?.endTime} IST
                             </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                            <Link href={`/employee/swaps?date=${a.dayOfWeek}`}>
                                <Button variant="outline" size="sm" className="h-10 px-6 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-primary hover:text-white transition-all shadow-xl">
                                    Propose Swap
                                </Button>
                            </Link>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-24 bg-muted/20 rounded-[2.5rem] border-4 border-dashed border-muted transition-all hover:bg-muted/30">
                     <CalendarDays className="size-24 text-muted-foreground/10 mx-auto mb-8 animate-pulse" />
                     <p className="text-xl font-black text-muted-foreground uppercase tracking-tight leading-none">Roster Pending Authorization</p>
                     <p className="text-[10px] text-muted-foreground/50 uppercase mt-4 max-w-[280px] mx-auto leading-relaxed font-black tracking-[0.2em]">Deployments will manifest here once clinical administration validates the Cycle cluster.</p>
                  </div>
                )}
             </CardContent>
          </Card>

          {/* FCFS Weekly-Off Section */}
          {activeConfig && !userBooking && (
            <Card className="border-none bg-accent/5 shadow-2xl rounded-[2.5rem] animate-in overflow-hidden border-2 border-accent/10">
              <CardHeader className="p-10 pb-4">
                <div className="flex items-center gap-4 font-black text-[12px] uppercase tracking-[0.3em] text-accent-foreground">
                  <div className="size-2 rounded-full bg-accent animate-ping" />
                  Priority Action Required: Slot Reservation
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                  <div className="space-y-8 py-4">
                    <div className="flex items-center gap-8">
                       <div className="size-20 rounded-[2rem] bg-accent/10 flex items-center justify-center shrink-0 shadow-inner">
                          <Clock className="size-10 text-accent-foreground opacity-60" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-2xl font-black text-accent-foreground uppercase tracking-tight">
                            {isWindowOpen 
                              ? "FCFS Window is NOW LIVE" 
                              : `Opens ${new Date(activeConfig.bookingOpen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed opacity-70">
                             Location: <span className="text-accent-foreground">{profile?.office}</span> • Atomic reservations active. Secure your priority slot as soon as the window opens.
                          </p>
                       </div>
                    </div>
                    {isWindowOpen && (
                      <Link href="/employee/book-off" className="block">
                        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-black uppercase tracking-[0.3em] group shadow-2xl shadow-accent/20 h-16 rounded-[1.5rem] transition-all hover:scale-[1.02]">
                          Access Location Matrix <ArrowRight className="ml-3 size-6 group-hover:translate-x-3 transition-transform" />
                        </Button>
                      </Link>
                    )}
                  </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden relative rounded-[2.5rem] group">
            <div className="absolute top-0 right-0 p-8 transform group-hover:scale-125 transition-transform duration-1000">
               <Bell className="size-32 text-white opacity-5" />
            </div>
            <CardHeader className="p-8 pb-4 relative z-10">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-3 text-secondary">
                <MessageCircle className="size-5" /> Meta Cloud Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                   <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                   <p className="text-[13px] font-black tracking-widest text-white/90 uppercase">WhatsApp Verified</p>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed uppercase font-black tracking-[0.1em]">
                   Briefings are dispatched via Cloud API at 22:00 IST for confirmed assignments. 
                   Ensure endpoint target matches your verified mobile.
                </p>
              </div>
              <Link href="/employee/profile" className="block">
                  <Button variant="outline" className="w-full bg-white/5 hover:bg-white/10 border-white/20 text-white font-black text-[10px] uppercase tracking-[0.25em] h-12 rounded-2xl transition-all" size="sm">
                    Configure Target Endpoint
                  </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-2xl border-none rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-6 border-b border-muted">
               <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                <AlertCircle className="size-5 text-secondary" /> Workforce Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex gap-6 items-start">
                 <div className="size-3 rounded-full bg-secondary mt-1.5 shrink-0 shadow-lg shadow-secondary/50" />
                 <p className="text-[11px] text-muted-foreground leading-relaxed uppercase font-black tracking-widest opacity-80">Published assignments are binding. Manual overrides trigger board audit.</p>
              </div>
              <div className="flex gap-6 items-start">
                 <div className="size-3 rounded-full bg-accent mt-1.5 shrink-0 shadow-lg shadow-accent/50" />
                 <p className="text-[11px] text-muted-foreground leading-relaxed uppercase font-black tracking-widest opacity-80">Location FCFS slots are atomic. Transaction priority is server-timestamped.</p>
              </div>
            </CardContent>
          </Card>

          <div className="p-10 rounded-[2.5rem] bg-muted/40 border-4 border-dashed border-muted text-center space-y-4">
              <Info className="size-10 text-muted-foreground/20 mx-auto" />
              <div className="space-y-1">
                 <p className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.3em]">Cloud Infrastructure</p>
                 <p className="text-[10px] font-black text-muted-foreground/40 leading-loose uppercase tracking-[0.2em]">
                    ROC Precision Sync v1.3.0<br/>
                    Verified Cluster: {profile?.office?.split(' ')[0]}
                 </p>
              </div>
          </div>
        </div>
      </div>
    </div>
  )
}
