
'use client';

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc, where } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CalendarDays, MessageCircle, AlertCircle, CheckCircle2, ArrowRight, Loader2, Info } from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"

export default function EmployeePortal() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Current operational week (In production, this would be dynamic)
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

  // Fetch ONLY the latest published roster for the week
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
    // Only show assignments for the logged-in employee
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">
            Welcome, {profile?.displayName?.split(' ')[0] || 'Professional'}
          </h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground">Clinical Workforce Hub • Remote Optometry Centre</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Published Roster Card */}
          <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden">
             <CardHeader className="bg-muted/5">
                <div className="flex items-center justify-between">
                   <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="size-5 text-primary" /> Weekly Schedule
                   </CardTitle>
                   {publishedRoster && (
                      <Badge className="bg-emerald-500 uppercase text-[9px] font-black tracking-widest">
                         Published V{publishedRoster.version.toString().slice(-4)}
                      </Badge>
                   )}
                </div>
                <CardDescription>Officially authorized clinical assignments for Week {currentWeek}.</CardDescription>
             </CardHeader>
             <CardContent className="pt-6 space-y-3">
                {myAssignments.length > 0 ? (
                  myAssignments.sort((a: any, b: any) => {
                    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                    return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                  }).map((a: any, i: number) => {
                    const shift = shifts?.find(s => s.id === a.shiftId);
                    return (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all border-l-4 border-l-secondary">
                        <div>
                          <p className="font-bold text-sm uppercase tracking-tight">{a.dayOfWeek}</p>
                          <p className="text-[11px] font-bold text-secondary uppercase mt-0.5">{shift?.name || a.shiftId}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-1">{shift?.startTime} — {shift?.endTime}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary">
                           Confirmed
                        </Badge>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12 bg-muted/5 rounded-2xl border border-dashed">
                     <CalendarDays className="size-12 text-muted-foreground/20 mx-auto mb-4" />
                     <p className="text-sm font-bold text-muted-foreground">No authorized assignments found.</p>
                     <p className="text-[10px] text-muted-foreground/60 uppercase mt-1">Assignments are visible only after Admin publication.</p>
                  </div>
                )}
             </CardContent>
          </Card>

          {/* FCFS Weekly-Off Section */}
          {activeConfig && (
            <Card className={userBooking ? "border-emerald-500/20 bg-emerald-500/5 shadow-sm" : "border-secondary/20 bg-secondary/5 shadow-sm"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-muted-foreground">
                    <CalendarDays className={userBooking ? "text-emerald-500" : "text-secondary"} size={16} />
                    Weekly-Off Protection (Week {activeConfig.weekId})
                  </div>
                  {userBooking && <Badge className="bg-emerald-500 font-bold">Confirmed</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                {userBooking ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Your secured off-day</p>
                      <p className="text-3xl font-black text-primary uppercase">{userBooking.dayOfWeek}</p>
                    </div>
                    <CheckCircle2 className="size-12 text-emerald-500 opacity-20" />
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-4">
                       <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                          <Clock className="size-5 text-secondary" />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-secondary">
                            {isWindowOpen 
                              ? "The FCFS booking window is now LIVE." 
                              : `Booking opens on ${new Date(activeConfig.bookingOpen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight mt-0.5">
                             Slots are reserved atomically on a first-come, first-served basis.
                          </p>
                       </div>
                    </div>
                    {isWindowOpen && (
                      <Link href="/employee/book-off" className="block">
                        <Button className="w-full bg-secondary font-black uppercase tracking-widest group shadow-lg shadow-secondary/10">
                          Access Booking Matrix <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground shadow-xl border-none overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4">
               <Info className="size-12 text-white opacity-5" />
            </div>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageCircle className="size-4 text-accent" /> Professional Hub
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-white/90">Clinical Support</p>
                <p className="text-[10px] text-white/60 leading-relaxed">Reach out for roster technical support or clinical emergencies.</p>
              </div>
              <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs" size="sm">
                Open Support Ticket
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-dashed">
            <CardHeader className="pb-2">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <AlertCircle className="size-3 text-secondary" /> Roster Governance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-primary">Authorized Publication</p>
                <p className="text-[9px] text-muted-foreground leading-relaxed">Only Admin-approved rosters are displayed here. Versions are tracked for transparency.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-primary">Constraint Integrity</p>
                <p className="text-[9px] text-muted-foreground leading-relaxed">Assignments strictly respect confirmed Weekly Offs and Approved Leaves.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
