
"use client"

import { useState, useEffect } from "react"
import { collection, query, orderBy, limit, onSnapshot, doc } from "firebase/firestore"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Clock, MapPin, CalendarDays, MessageCircle, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { DemoBadge } from "@/components/ui/demo-badge"

export default function EmployeePortal() {
  const db = useFirestore();
  const { profile } = useUser();
  const [activeConfig, setActiveConfig] = useState<any>(null);

  // Fetch active booking window
  useEffect(() => {
    const q = query(collection(db, 'weekoff_configs'), orderBy('weekId', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setActiveConfig(snapshot.docs[0].data());
    });
    return () => unsubscribe();
  }, [db]);

  // Check user's booking for active week
  const bookingId = activeConfig && profile?.employeeId ? `${activeConfig.weekId}_${profile.employeeId}` : null;
  const bookingRef = bookingId ? doc(db, 'weekoff_bookings', bookingId) : null;
  const { data: userBooking } = useDoc(bookingRef);

  const upcomingShifts = [
    { day: "Today", shift: "Morning Optom", time: "08:00 - 16:00", location: "Remote Station 4" },
    { day: "Tomorrow", shift: "Mid-Day Optom", time: "11:00 - 19:00", location: "Main Center" },
  ];

  const isWindowOpen = activeConfig && new Date() >= new Date(activeConfig.bookingOpen) && new Date() <= new Date(activeConfig.bookingClose);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6 p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">
            Welcome back, {profile?.displayName?.split(' ')[0] || 'Professional'}
          </h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground">Manage your clinical shifts and weekly-off status.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Shifts</CardTitle>
              <CardDescription>Confirmed schedule for clinical duties.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingShifts.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Clock className="size-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-bold">{s.shift}</p>
                      <p className="text-xs text-muted-foreground">{s.day} • {s.time}</p>
                      <p className="text-xs flex items-center gap-1 mt-1">
                        <MapPin className="size-3" /> {s.location}
                      </p>
                    </div>
                  </div>
                  <Badge variant={i === 0 ? "default" : "secondary"}>
                    {i === 0 ? "Today" : "Confirmed"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {activeConfig && (
            <Card className={userBooking ? "border-accent bg-accent/5" : "border-secondary/20 bg-secondary/5"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CalendarDays className={userBooking ? "text-accent" : "text-secondary"} />
                    Weekly-Off Status (Week {activeConfig.weekId})
                  </div>
                  {userBooking && <Badge className="bg-emerald-500">Confirmed</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                {userBooking ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Your assigned weekly off is</p>
                      <p className="text-2xl font-black text-primary uppercase">{userBooking.dayOfWeek}</p>
                    </div>
                    <CheckCircle2 className="size-10 text-emerald-500 opacity-20" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {isWindowOpen 
                        ? "The FCFS booking window is now LIVE. Reserve your slot immediately." 
                        : `Booking opens on ${new Date(activeConfig.bookingOpen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                    {isWindowOpen && (
                      <Link href="/employee/book-off" className="block">
                        <Button className="w-full bg-secondary group">
                          Book Weekly-Off <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
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
          <Card className="bg-secondary text-secondary-foreground shadow-lg shadow-secondary/10">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageCircle className="size-4" /> Shift Swap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs mb-4 opacity-90">Request a swap for a confirmed shift with a colleague.</p>
              <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white" size="sm">
                Initiate Swap
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="size-4 text-accent" /> Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                • Confirmed weekly-offs are immutable once booked.<br/>
                • One shift per employee per day is the clinical standard.<br/>
                • Respect the 10:00 PM notification quiet window.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
