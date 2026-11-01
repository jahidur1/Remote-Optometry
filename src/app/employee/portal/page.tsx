
'use client';

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc, where } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CalendarDays, MessageCircle, AlertCircle, CheckCircle2, ArrowRight, Loader2, Info, Bell, Settings } from "lucide-react"
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
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">
              Namaste, {profile?.displayName?.split(' ')[0] || 'Professional'}
            </h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Remote Optometry Centre • Clinical Workforce</p>
        </div>
        <div className="flex gap-2">
            <Link href="/employee/profile">
                <Button variant="outline" size="icon" className="rounded-full">
                    <Settings className="size-4" />
                </Button>
            </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-secondary/10 border-none shadow-none">
                <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
                    <p className="text-[10px] font-black uppercase text-secondary/60 tracking-widest">Upcoming Week</p>
                    <p className="text-xl font-black text-secondary uppercase tracking-tighter">{currentWeek}</p>
                </CardContent>
            </Card>
            <Card className="bg-emerald-500/10 border-none shadow-none">
                <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
                    <p className="text-[10px] font-black uppercase text-emerald-600/60 tracking-widest">Weekly-Off</p>
                    <p className="text-xl font-black text-emerald-600 uppercase tracking-tighter">{userBooking?.dayOfWeek || 'Pending'}</p>
                </CardContent>
            </Card>
          </div>

          {/* Published Roster Card */}
          <Card className="border-l-4 border-l-primary shadow-md overflow-hidden bg-card">
             <CardHeader className="bg-muted/5 border-b py-4">
                <div className="flex items-center justify-between">
                   <div>
                       <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="size-4 text-primary" /> Active Assignments
                       </CardTitle>
                       <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Week Cycle: {currentWeek}</CardDescription>
                   </div>
                   {publishedRoster && (
                      <Badge className="bg-emerald-500 text-[9px] font-black tracking-widest shadow-sm">
                         V{publishedRoster.version.toString().slice(-4)} LIVE
                      </Badge>
                   )}
                </div>
             </CardHeader>
             <CardContent className="pt-4 space-y-3">
                {myAssignments.length > 0 ? (
                  myAssignments.sort((a: any, b: any) => {
                    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                    return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                  }).map((a: any, i: number) => {
                    const shift = shifts?.find(s => s.id === a.shiftId);
                    return (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all border-l-4 border-l-secondary shadow-sm">
                        <div className="flex flex-col">
                          <span className="font-black text-sm uppercase tracking-tight text-foreground">{a.dayOfWeek}</span>
                          <span className="text-[11px] font-bold text-secondary uppercase mt-0.5">{shift?.name || a.shiftId}</span>
                          <span className="text-[10px] text-muted-foreground font-mono mt-1 font-bold tracking-wider">{shift?.startTime} — {shift?.endTime}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5">
                               Authorized
                            </Badge>
                            <Link href={`/employee/swaps?date=${a.dayOfWeek}`}>
                                <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-secondary">
                                    Swap Request
                                </Button>
                            </Link>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-16 bg-muted/5 rounded-2xl border border-dashed">
                     <CalendarDays className="size-16 text-muted-foreground/10 mx-auto mb-4" />
                     <p className="text-sm font-bold text-muted-foreground">Official Roster Awaiting Publication</p>
                     <p className="text-[10px] text-muted-foreground/60 uppercase mt-2 max-w-[200px] mx-auto leading-relaxed">Your assignments will appear here once authorized by clinical administration.</p>
                  </div>
                )}
             </CardContent>
          </Card>

          {/* FCFS Weekly-Off Section */}
          {activeConfig && !userBooking && (
            <Card className="border-secondary/20 bg-secondary/5 shadow-md animate-in fade-in slide-in-from-bottom-4">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-secondary">
                  <CalendarDays className="text-secondary" size={16} />
                  Action Required: FCFS Booking
                </div>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                          <Clock className="size-6 text-secondary" />
                       </div>
                       <div>
                          <p className="text-sm font-black text-secondary uppercase">
                            {isWindowOpen 
                              ? "FCFS Window is NOW LIVE" 
                              : `Opens ${new Date(activeConfig.bookingOpen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mt-1">
                             Reservations are processed atomically on a first-come, first-served basis.
                          </p>
                       </div>
                    </div>
                    {isWindowOpen && (
                      <Link href="/employee/book-off" className="block">
                        <Button className="w-full bg-secondary font-black uppercase tracking-widest group shadow-xl shadow-secondary/20 h-12">
                          Reserve Weekly-Off <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    )}
                  </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6">
               <Bell className="size-16 text-white opacity-5" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-accent">
                <MessageCircle className="size-4" /> Notification Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-white/90">WhatsApp Status: {profile?.whatsappNumber ? 'Connected' : 'Not Linked'}</p>
                <p className="text-[10px] text-white/60 leading-relaxed uppercase font-medium tracking-tight">Shift updates are dispatched daily at 10:00 PM IST to your linked number.</p>
              </div>
              <Link href="/employee/profile" className="block">
                  <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white font-black text-[10px] uppercase tracking-widest h-9" size="sm">
                    Configure Alerts
                  </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-dashed shadow-sm">
            <CardHeader className="pb-2">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <AlertCircle className="size-3 text-secondary" /> System Governance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex gap-3">
                 <div className="size-1.5 rounded-full bg-secondary mt-1.5 shrink-0" />
                 <p className="text-[9px] text-muted-foreground leading-relaxed uppercase font-bold">Assignments are locked once published. Contact Admin for corrections.</p>
              </div>
              <div className="flex gap-3">
                 <div className="size-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                 <p className="text-[9px] text-muted-foreground leading-relaxed uppercase font-bold">Swap requests must be mutually accepted before final Admin review.</p>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-2xl bg-muted/50 border border-dashed text-center space-y-2">
              <Info className="size-6 text-muted-foreground/30 mx-auto" />
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Version Tracker</p>
              <p className="text-[9px] font-medium text-muted-foreground leading-snug">
                  ROC Workforce Platform v1.0.2<br/>
                  Intelligent Solver Build 942
              </p>
          </div>
        </div>
      </div>
    </div>
  )
}
