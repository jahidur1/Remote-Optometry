
'use client';

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc, where } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CalendarDays, MessageCircle, AlertCircle, CheckCircle2, ArrowRight, Loader2, Info, Bell, Settings, MapPin } from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"

export default function EmployeePortal() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Current operational week
  const currentWeek = '2024-52'; 

  // Fetch active booking window
  useEffect(() => {
    const q = query(collection(db, 'weekoff_configs'), orderBy('weekId', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setActiveConfig(snapshot.docs[0].data());
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

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
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Cloud Records</p>
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
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
            Remote Optometry Centre • Clinical Unit <MapPin className="size-3 text-secondary" />
          </p>
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
            <Card className="bg-secondary shadow-xl shadow-secondary/10 border-none rounded-[1.5rem] overflow-hidden">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                    <p className="text-[11px] font-black uppercase text-white/50 tracking-[0.2em]">Roster Cycle</p>
                    <p className="text-2xl font-black text-white uppercase tracking-tighter">{currentWeek}</p>
                </CardContent>
            </Card>
            <Card className={userBooking ? "bg-white shadow-xl border-2 border-emerald-500/20 rounded-[1.5rem]" : "bg-white shadow-xl border-2 border-accent/20 rounded-[1.5rem]"}>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                    <p className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Weekly-Off</p>
                    <p className="text-2xl font-black text-foreground uppercase tracking-tighter">
                        {userBooking?.dayOfWeek || <span className="opacity-20">PENDING</span>}
                    </p>
                </CardContent>
            </Card>
          </div>

          {/* Published Roster Card */}
          <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2rem]">
             <CardHeader className="bg-primary p-8 text-primary-foreground border-none">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                       <CardTitle className="text-xl flex items-center gap-3 font-black uppercase tracking-tight">
                          <Clock className="size-6 text-secondary" /> Authorized Schedule
                       </CardTitle>
                       <CardDescription className="text-[11px] uppercase font-black text-white/40 tracking-widest">Confirmed Assignments for {currentWeek}</CardDescription>
                   </div>
                   {publishedRoster && (
                      <Badge className="bg-secondary text-[10px] font-black tracking-widest shadow-xl px-4 py-1.5 rounded-full border-none">
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
                      <div key={i} className="flex items-center justify-between p-6 rounded-[1.5rem] bg-white hover:bg-muted/50 transition-all border-2 border-transparent hover:border-secondary/10 shadow-sm group">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-lg uppercase tracking-tighter text-foreground">{a.dayOfWeek}</span>
                          <span className="text-[12px] font-black text-secondary uppercase tracking-widest">{shift?.name || a.shiftId}</span>
                          <span className="text-[11px] text-muted-foreground font-bold tracking-widest mt-1 px-3 py-1 bg-muted rounded-full w-fit">
                             {shift?.startTime} — {shift?.endTime} IST
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                            <Link href={`/employee/swaps?date=${a.dayOfWeek}`}>
                                <Button variant="outline" size="sm" className="h-9 px-6 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl hover:bg-secondary hover:text-white transition-all shadow-sm">
                                    Propose Swap
                                </Button>
                            </Link>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-20 bg-muted/20 rounded-[2rem] border-4 border-dashed border-muted">
                     <CalendarDays className="size-20 text-muted-foreground/10 mx-auto mb-6" />
                     <p className="text-lg font-black text-muted-foreground uppercase tracking-tight">Official Roster Pending</p>
                     <p className="text-[10px] text-muted-foreground/60 uppercase mt-2 max-w-[240px] mx-auto leading-relaxed font-black tracking-widest">Assignments will appear here once authorized by clinical administration.</p>
                  </div>
                )}
             </CardContent>
          </Card>

          {/* FCFS Weekly-Off Section */}
          {activeConfig && !userBooking && (
            <Card className="border-none bg-accent/5 shadow-2xl rounded-[2rem] animate-in overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 font-black text-[11px] uppercase tracking-[0.25em] text-accent-foreground">
                  <CalendarDays className="text-accent" size={20} />
                  Immediate Action: Slot Reservation
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                  <div className="space-y-6 py-2">
                    <div className="flex items-center gap-6">
                       <div className="size-16 rounded-[1.5rem] bg-accent/10 flex items-center justify-center shrink-0 shadow-inner">
                          <Clock className="size-8 text-accent-foreground opacity-60" />
                       </div>
                       <div>
                          <p className="text-lg font-black text-accent-foreground uppercase tracking-tight">
                            {isWindowOpen 
                              ? "FCFS Window is NOW LIVE" 
                              : `Opens ${new Date(activeConfig.bookingOpen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2 leading-relaxed opacity-60">
                             Atomic reservations active. Secure your priority slot as soon as the window opens.
                          </p>
                       </div>
                    </div>
                    {isWindowOpen && (
                      <Link href="/employee/book-off" className="block">
                        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-black uppercase tracking-[0.2em] group shadow-xl shadow-accent/10 h-14 rounded-2xl transition-all">
                          Access Booking Matrix <ArrowRight className="ml-2 size-5 group-hover:translate-x-2 transition-transform" />
                        </Button>
                      </Link>
                    )}
                  </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden relative rounded-[2rem]">
            <div className="absolute top-0 right-0 p-8">
               <Bell className="size-24 text-white opacity-5" />
            </div>
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.25em] flex items-center gap-3 text-secondary">
                <MessageCircle className="size-5" /> Communication Hub
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="space-y-3">
                <p className="text-[12px] font-black tracking-widest text-white/90">Channel: {profile?.whatsappNumber ? 'WhatsApp Linked' : 'Missing Target'}</p>
                <p className="text-[10px] text-white/50 leading-relaxed uppercase font-black tracking-[0.1em]">Shift briefings are dispatched daily at 22:00 Asia/Kolkata using enterprise Cloud API.</p>
              </div>
              <Link href="/employee/profile" className="block">
                  <Button variant="outline" className="w-full bg-white/5 hover:bg-white/10 border-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] h-11 rounded-xl" size="sm">
                    Configure Notification Channel
                  </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-xl border-none rounded-[2rem]">
            <CardHeader className="p-8 pb-4">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-3">
                <AlertCircle className="size-4 text-secondary" /> Institutional Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="flex gap-4">
                 <div className="size-2 rounded-full bg-secondary mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                 <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-black tracking-widest opacity-80">Published assignments are binding. Overrides require Clinical Lead verification.</p>
              </div>
              <div className="flex gap-4">
                 <div className="size-2 rounded-full bg-accent mt-1.5 shrink-0 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                 <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-black tracking-widest opacity-80">Swap requests are provisional until mutually verified by both parties.</p>
              </div>
            </CardContent>
          </Card>

          <div className="p-8 rounded-[2rem] bg-muted/40 border-2 border-dashed text-center space-y-3">
              <Info className="size-8 text-muted-foreground/20 mx-auto" />
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Platform Architecture</p>
              <p className="text-[9px] font-black text-muted-foreground/40 leading-loose uppercase tracking-[0.1em]">
                  ROC Workforce Infrastructure v1.2.5<br/>
                  Precision Sync Enabled
              </p>
          </div>
        </div>
      </div>
    </div>
  )
}
