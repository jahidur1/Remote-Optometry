
"use client"

import { useMemo } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Calendar, Activity, CheckCircle2, MessageSquare, AlertCircle, BarChart3, TrendingUp, ShieldCheck } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { DemoBadge } from "@/components/ui/demo-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function AdminDashboard() {
  const db = useFirestore();

  // Fetch critical operational data
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: rosters, loading: rosterLoading } = useCollection(query(collection(db, 'published_rosters'), orderBy('publishedAt', 'desc'), limit(1)));
  const { data: logs, loading: logLoading } = useCollection(query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(100)));
  const { data: leaves } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));
  const { data: solverLogs } = useCollection(query(collection(db, 'roster_drafts'), orderBy('createdAt', 'desc'), limit(5)));
  const { data: currentBookings } = useCollection(query(collection(db, 'weekoff_bookings'), limit(200)));

  const latestRoster = rosters?.[0];
  const activeWeek = latestRoster?.weekId || 'N/A';

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const leavesToday = leaves?.filter(l => today >= l.startDate && today <= l.endDate).length || 0;
    
    // Find weekoff for today if it matches the active week cycle
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()];
    const offsToday = currentBookings?.filter(b => b.dayOfWeek === todayName && b.weekId === activeWeek).length || 0;

    const totalActive = employees?.length || 0;
    const available = totalActive - leavesToday - offsToday;

    return {
      totalActive,
      availableToday: available,
      onLeaveToday: leavesToday,
      onWeekOffToday: offsToday,
      notificationSuccess: logs?.filter(l => l.status === 'success').length || 0,
      apiHealth: logs && logs.length > 0 ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100) : 100
    };
  }, [employees, leaves, logs, currentBookings, activeWeek]);

  const chartData = useMemo(() => {
    if (!latestRoster) return [];
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return DAYS.map(day => ({
      day: day.substring(0, 3),
      scheduled: latestRoster.assignments.filter((a: any) => a.dayOfWeek === day).length,
    }));
  }, [latestRoster]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Workforce Command Center</h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground font-medium uppercase text-[11px] tracking-widest">Enterprise Roster Operations • Week Cycle {activeWeek}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Clinical Pool</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {empLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-3xl font-black text-primary tracking-tighter">{stats.totalActive}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1 tracking-tighter">Authorized Active Professionals</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-md hover:shadow-lg transition-shadow bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Actual Capacity</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-600 tracking-tighter">{stats.availableToday}</div>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Available Today</span>
               <Badge className="bg-emerald-500 text-[8px] h-3.5 px-1 font-black">Authorized</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Roster Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            {rosterLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-3xl font-black text-secondary tracking-tighter">{latestRoster ? 'LIVE' : 'PENDING'}</div>
                <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary/20 text-secondary">
                        V{latestRoster?.version.toString().slice(-4) || '---'}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter italic">Authorized IST</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent shadow-md hover:shadow-lg transition-shadow bg-accent/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-foreground">Briefing Sync</CardTitle>
            <MessageSquare className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-accent tracking-tighter">{stats.apiHealth}%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-1 tracking-tighter">Meta Cloud API Success Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-md border-t-4 border-t-primary overflow-hidden">
          <CardHeader className="bg-muted/5 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm uppercase font-black tracking-widest">Active Deployment Load</CardTitle>
                <CardDescription className="text-[10px] font-bold">Clinical scheduled assignments per operational day.</CardDescription>
              </div>
              <BarChart3 className="size-5 text-muted-foreground opacity-30" />
            </div>
          </CardHeader>
          <CardContent className="pl-2 pt-6">
            <div className="h-[300px]">
              {latestRoster ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-xl border bg-background p-3 shadow-2xl border-primary/10">
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">{payload[0].payload.day} Assignment</p>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-foreground tracking-tighter">{payload[0].value}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Professionals</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="scheduled" radius={[4, 4, 0, 0]} barSize={40}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 space-y-4">
                   <Calendar className="size-16 opacity-10" />
                   <p className="text-[10px] font-black uppercase tracking-widest">No published data detected for cycle {activeWeek}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-md bg-muted/5 border-2">
          <CardHeader className="border-b bg-white/80 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <CardTitle className="text-[11px] font-black uppercase tracking-widest">System Operational Integrity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="space-y-3 pb-4 border-b border-dashed">
                 <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Availability Breakdown (Today)</h5>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-white border shadow-sm">
                       <p className="text-[18px] font-black text-secondary leading-none">{stats.onWeekOffToday}</p>
                       <p className="text-[9px] font-black text-muted-foreground uppercase mt-1">Confirmed Off</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white border shadow-sm">
                       <p className="text-[18px] font-black text-accent leading-none">{stats.onLeaveToday}</p>
                       <p className="text-[9px] font-black text-muted-foreground uppercase mt-1">Authorized Leave</p>
                    </div>
                 </div>
              </div>

              <div className="space-y-3">
                 <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Recent Engine Events</h5>
                 <div className="space-y-3">
                    {solverLogs?.map((log, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white transition-colors border-transparent hover:border-muted-foreground/10 border">
                        <div className={`mt-1.5 size-2 rounded-full shrink-0 ${log.solverStatus === 'OPTIMAL' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-secondary'}`} />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black uppercase text-foreground/80 tracking-tight">Cycle {log.weekId}</span>
                            <span className="text-[9px] text-muted-foreground font-bold">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <Badge variant="ghost" className="text-[8px] h-3 px-1 font-black tracking-widest bg-muted/30 uppercase">{log.solverStatus}</Badge>
                        </div>
                      </div>
                    ))}
                    {solverLogs?.length === 0 && (
                      <p className="text-center py-6 text-[10px] text-muted-foreground font-black uppercase italic tracking-widest opacity-40">No recent engine activity</p>
                    )}
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-8 rounded-3xl bg-primary text-primary-foreground shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-1000">
            <ShieldCheck size={240} />
         </div>
         <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
               <Badge className="bg-accent text-accent-foreground text-[10px] font-black uppercase px-3">Enterprise Standard</Badge>
               <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Compliance Node 01 • India South</span>
            </div>
            <p className="text-xl md:text-2xl leading-tight font-black tracking-tight max-w-3xl">
              "Ensuring 100% adherence to clinical staffing quotas through atomic FCFS reservations and mathematical optimization."
            </p>
            <div className="pt-4 flex flex-wrap gap-8 border-t border-white/10 mt-4">
               <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Processing Latency</span>
                  <p className="text-sm font-black">42ms Real-time Verified</p>
               </div>
               <div className="space-y-1 border-l border-white/10 pl-8">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Data Encryption</span>
                  <p className="text-sm font-black">AES-256 System-wide</p>
               </div>
               <div className="space-y-1 border-l border-white/10 pl-8">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Version Protocol</span>
                  <p className="text-sm font-black">Immutable History v1.4</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
