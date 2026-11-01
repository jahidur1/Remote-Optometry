
"use client"

import { useMemo } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Calendar, Activity, CheckCircle2, MessageSquare, AlertCircle, BarChart3, TrendingUp, ShieldCheck, ArrowUpRight } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { DemoBadge } from "@/components/ui/demo-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function AdminDashboard() {
  const db = useFirestore();

  // Fetch operational data
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
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()];
    const offsToday = currentBookings?.filter(b => b.dayOfWeek === todayName && b.weekId === activeWeek).length || 0;

    const totalActive = employees?.length || 0;
    const available = Math.max(0, totalActive - leavesToday - offsToday);

    return {
      totalActive,
      availableToday: available,
      onLeaveToday: leavesToday,
      onWeekOffToday: offsToday,
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
    <div className="space-y-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Workforce Command Center</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
            Institutional Roster Node • Week Cycle {activeWeek} <Activity className="size-3 text-emerald-500 animate-pulse" />
          </p>
        </div>
        <Badge variant="outline" className="h-8 px-4 border-2 font-black uppercase text-[10px] tracking-widest bg-white">
          <ShieldCheck className="size-3 mr-2 text-emerald-600" /> System Integrity: Secured
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-4 border-t-primary shadow-lg group hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Clinical Pool</CardTitle>
            <Users className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            {empLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-4xl font-black text-primary tracking-tighter">{stats.totalActive}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Authorized Professionals</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-emerald-500 shadow-lg group hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Actual Capacity</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-emerald-600 tracking-tighter">{stats.availableToday}</div>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[9px] text-muted-foreground uppercase font-bold">Active Today</span>
               <Badge className="bg-emerald-500 text-[8px] h-3.5 px-1 font-black">LIVE</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-secondary shadow-lg group hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Roster Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-secondary group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-secondary tracking-tighter">{latestRoster ? 'LIVE' : '---'}</div>
            <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary/20 text-secondary">
                    V{latestRoster?.version.toString().slice(-4) || '---'}
                </Badge>
                <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest italic">Authorized IST</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-accent shadow-lg group hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-foreground">Briefing Sync</CardTitle>
            <MessageSquare className="h-4 w-4 text-accent group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-accent tracking-tighter">{stats.apiHealth}%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-1">Meta Cloud API Pulse</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-xl border-none overflow-hidden glass-card">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs uppercase font-black tracking-[0.2em]">Active Deployment Load</CardTitle>
                <CardDescription className="text-[10px] font-bold">Assignments per operational day for cycle {activeWeek}.</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-white shadow-sm border">
                <BarChart3 className="size-4 text-primary opacity-50" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[320px]">
              {latestRoster ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: 'hsl(var(--primary))' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--secondary)/0.05)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-2xl border-2 bg-background p-4 shadow-2xl border-primary/10 animate-in zoom-in-95">
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 border-b pb-2">{payload[0].payload.day} Assignment</p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-foreground tracking-tighter">{payload[0].value}</span>
                                <span className="text-[10px] font-black text-muted-foreground uppercase">Professionals</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="scheduled" radius={[6, 6, 0, 0]} barSize={44}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} className="transition-all duration-500 hover:opacity-80" />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 space-y-4">
                   <Calendar className="size-20 opacity-10" />
                   <p className="text-[11px] font-black uppercase tracking-widest">Awaiting Publication for Cycle {activeWeek}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-xl border-none glass-card">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Operational Integrity</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            <div className="space-y-4">
               <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <TrendingUp className="size-3" /> Availability Delta (Today)
               </h5>
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-secondary/5 border-2 border-secondary/10 flex flex-col items-center justify-center text-center">
                     <p className="text-2xl font-black text-secondary">{stats.onWeekOffToday}</p>
                     <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">Confirmed Off</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-accent/5 border-2 border-accent/10 flex flex-col items-center justify-center text-center">
                     <p className="text-2xl font-black text-accent-foreground">{stats.onLeaveToday}</p>
                     <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">Approved Leave</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-between">
                  Optimization Engine Events <Activity className="size-3" />
               </h5>
               <div className="space-y-3">
                  {solverLogs?.map((log, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white transition-all border border-transparent hover:border-muted-foreground/10 hover:shadow-sm">
                      <div className={`size-2.5 rounded-full shrink-0 ${log.solverStatus === 'OPTIMAL' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-secondary'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-black uppercase text-primary tracking-tight truncate">Cycle {log.weekId}</span>
                          <span className="text-[9px] text-muted-foreground font-black uppercase">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <Badge variant="ghost" className="text-[8px] h-4 px-2 font-black tracking-widest bg-muted/40 uppercase text-primary/70">{log.solverStatus}</Badge>
                      </div>
                    </div>
                  ))}
                  {solverLogs?.length === 0 && (
                    <div className="text-center py-10 opacity-30">
                       <Activity className="size-10 mx-auto mb-2" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No Recent Engine Activity</p>
                    </div>
                  )}
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-10 rounded-[2.5rem] bg-primary text-primary-foreground shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-10 transform translate-x-4 -translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-1000 ease-in-out">
            <ShieldCheck size={280} />
         </div>
         <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-4">
               <Badge className="bg-accent text-accent-foreground text-[10px] font-black uppercase px-4 py-1 tracking-widest">Enterprise Standard</Badge>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Node 01 • APAC Region South</span>
            </div>
            <p className="text-2xl md:text-3xl leading-tight font-black tracking-tighter max-w-3xl">
              "Ensuring 100% adherence to clinical staffing quotas through atomic FCFS reservations and mathematical optimization."
            </p>
            <div className="pt-8 flex flex-wrap gap-12 border-t border-white/10 mt-6">
               <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2"><Activity className="size-3" /> Processing Latency</span>
                  <p className="text-lg font-black tracking-tight">42ms Verified <ArrowUpRight className="inline size-4 text-emerald-400 opacity-50" /></p>
               </div>
               <div className="space-y-2 border-l border-white/10 pl-12">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2"><ShieldCheck className="size-3" /> Security Protocol</span>
                  <p className="text-lg font-black tracking-tight">AES-256 System-wide</p>
               </div>
               <div className="space-y-2 border-l border-white/10 pl-12">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2"><Calendar className="size-3" /> Version Integrity</span>
                  <p className="text-lg font-black tracking-tight">Immutable History v1.4.2</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
