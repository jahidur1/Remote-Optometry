
'use client';

import { useState, useEffect } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc } from "firebase/firestore"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, CalendarDays, MessageCircle, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"

export default function EmployeePortal() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
  const { data: userBooking, loading: bookingLoading } = useDoc(bookingRef);

  const upcomingShifts = [
    { day: "Today", shift: "Morning Optom", time: "08:00 - 16:00", location: "Remote Station 4" },
    { day: "Tomorrow", shift: "Mid-Day Optom", time: "11:00 - 19:00", location: "Main Center" },
  ];

  const isWindowOpen = activeConfig && new Date() >= new Date(activeConfig.bookingOpen) && new Date() <= new Date(activeConfig.bookingClose);

  if (userLoading || loading) {
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
          {/* Booking Pulse Card */}
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
              {userBooking && (
                <CardFooter className="pt-0 pb-4">
                   <Link href="/employee/book-off" className="text-[10px] font-black text-emerald-600 uppercase hover:underline">
                      View Reservation Details →
                   </Link>
                </CardFooter>
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Schedule</CardTitle>
              <CardDescription>Published clinical shifts for the next 48 hours.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingShifts.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all border-l-4 border-l-primary">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-lg bg-primary/5 flex items-center justify-center">
                      <Clock className="size-5 text-primary opacity-60" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{s.shift}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{s.day} • {s.time}</p>
                      <p className="text-[10px] flex items-center gap-1 mt-1 text-primary/70 font-medium">
                        <MapPin className="size-3" /> {s.location}
                      </p>
                    </div>
                  </div>
                  <Badge variant={i === 0 ? "default" : "secondary"} className="text-[10px] font-bold">
                    {i === 0 ? "LIVE" : "CONFIRMED"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground shadow-xl border-none">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageCircle className="size-4 text-accent" /> Professional Hub
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-white/90">Shift Swap Portal</p>
                <p className="text-[10px] text-white/60 leading-relaxed">Initiate a request to exchange a confirmed shift with a colleague.</p>
              </div>
              <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs" size="sm">
                Request Swap
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-dashed">
            <CardHeader className="pb-2">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <AlertCircle className="size-3 text-secondary" /> Clinical Standards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-primary">Immutable Bookings</p>
                <p className="text-[9px] text-muted-foreground leading-relaxed">Weekly-off records are protected once secured. Overrides require Super Admin clearance.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-primary">Notification Hygiene</p>
                <p className="text-[9px] text-muted-foreground leading-relaxed">WhatsApp shift alerts are dispatched daily at 22:00 IST. Please maintain updated contact details.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
