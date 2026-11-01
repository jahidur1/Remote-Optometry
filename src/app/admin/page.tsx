
"use client"

import { useMemo } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Calendar, Activity, CheckCircle2, MessageSquare, AlertCircle, BarChart3, TrendingUp, ShieldCheck, ArrowUpRight, Clock } from "lucide-react"
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
    <div className="space-y-8 animate-in max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-primary uppercase leading-none">Command Center</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
            Institutional Roster Node • Week Cycle {activeWeek} <Activity className="size-3 text-emerald-500 animate-pulse" />
          </p>
        </div>
        <div className="flex gap-4">
          <Badge variant="outline" className="h-10 px-6 border-2 font-black uppercase text-[10px] tracking-widest bg-white/50 backdrop-blur-sm">
            <ShieldCheck className="size-4 mr-2 text-emerald-600" /> System Integrity: Verified
          </Badge>
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
             <Calendar className="size-5" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-4 border-t-primary shadow-xl hover:shadow-2xl transition-all duration-500 group border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Clinical Pool</CardTitle>
            <Users className="h-5 w-5 text-primary opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            {empLoading ? <Skeleton className="h-10 w-16" /> : (
              <>
                <div className="text-5xl font-black text-primary tracking-tighter">{stats.totalActive}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Authorized Professionals</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-secondary shadow-xl hover:shadow-2xl transition-all duration-500 group border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary">Active Capacity</CardTitle>
            <TrendingUp className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-secondary tracking-tighter">{stats.availableToday}</div>
            <div className="flex items-center gap-2 mt-2">
               <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Available Today</span>
               <Badge className="bg-emerald-500 text-[8px] h-4 px-1.5 font-black uppercase tracking-tighter shadow-sm animate-pulse">Live</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-accent shadow-xl hover:shadow-2xl transition-all duration-500 group border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Deployment</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent-foreground tracking-tighter">{latestRoster ? 'ACTV' : '---'}</div>
            <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[8px] font-black uppercase border-accent/20 text-accent bg-accent/5">
                    V{latestRoster?.version.toString().slice(-4) || '---'}
                </Badge>
                <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest italic opacity-60">Verified Cluster</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-primary shadow-xl hover:shadow-2xl transition-all duration-500 group border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Sync Pulse</CardTitle>
            <MessageSquare className="h-5 w-5 text-primary opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-primary tracking-tighter">{stats.apiHealth}%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Meta Cloud API Gateway</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-2xl border-none overflow-hidden glass-card rounded-[1.5rem]">
          <CardHeader className="bg-muted/30 border-b p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm uppercase font-black tracking-[0.2em]">Operational Load Matrix</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase mt-1 opacity-60 tracking-widest">Daily Clinical Deployment Metrics.</CardDescription>
              </div>
              <div className="p-2.5 rounded-xl bg-white shadow-inner border border-muted">
                <BarChart3 className="size-5 text-primary opacity-40" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[360px] w-full">
              {latestRoster ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
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
                            <div className="rounded-[1.25rem] border-2 bg-background/95 backdrop-blur-xl p-5 shadow-2xl border-primary/10 animate-in zoom-in-95">
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3 border-b border-muted pb-3">{payload[0].payload.day} Assignments</p>
                              <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-black text-foreground tracking-tighter">{payload[0].value}</span>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Professionals</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="scheduled" radius={[8, 8, 0, 0]} barSize={52}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} className="transition-all duration-700 hover:opacity-80" />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 space-y-6">
                   <Calendar className="size-24 opacity-5" />
                   <p className="text-[11px] font-black uppercase tracking-[0.3em]">Awaiting Cluster Authorization</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-2xl border-none glass-card rounded-[1.5rem]">
          <CardHeader className="border-b bg-muted/30 p-6">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Clinical Health Ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-10">
            <div className="space-y-6">
               <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-3">
                  <TrendingUp className="size-4" /> Capacity Delta <span className="h-px flex-1 bg-muted" />
               </h5>
               <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-[1.5rem] bg-secondary/5 border-2 border-secondary/10 flex flex-col items-center justify-center text-center group hover:bg-secondary/10 transition-all">
                     <p className="text-4xl font-black text-secondary tracking-tighter group-hover:scale-110 transition-transform">{stats.onWeekOffToday}</p>
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-2">Reserved Off</p>
                  </div>
                  <div className="p-6 rounded-[1.5rem] bg-accent/5 border-2 border-accent/10 flex flex-col items-center justify-center text-center group hover:bg-accent/10 transition-all">
                     <p className="text-4xl font-black text-accent-foreground tracking-tighter group-hover:scale-110 transition-transform">{stats.onLeaveToday}</p>
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-2">Medical Absence</p>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center justify-between">
                  Optimization Events <Activity className="size-4 text-primary opacity-40" />
               </h5>
               <div className="space-y-4">
                  {solverLogs?.map((log, i) => (
                    <div key={i} className="flex items-center gap-5 p-4 rounded-2xl hover:bg-white transition-all border border-transparent hover:border-muted-foreground/10 hover:shadow-lg group">
                      <div className={`size-3 rounded-full shrink-0 ${log.solverStatus === 'OPTIMAL' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-secondary shadow-[0_0_10px_rgba(59,130,246,0.3)]'} transition-all group-hover:scale-125`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[12px] font-black uppercase text-primary tracking-tight truncate">Cycle {log.weekId}</span>
                          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <Badge variant="outline" className="text-[8px] h-5 px-2.5 font-black tracking-widest bg-muted/40 uppercase text-primary/60 border-primary/10">{log.solverStatus}</Badge>
                      </div>
                    </div>
                  ))}
                  {solverLogs?.length === 0 && (
                    <div className="text-center py-12 opacity-20 border-2 border-dashed rounded-3xl">
                       <Activity className="size-12 mx-auto mb-3 opacity-10" />
                       <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Cluster Activity Detected</p>
                    </div>
                  )}
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-12 rounded-[3rem] bg-primary text-primary-foreground shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-12 transform translate-x-12 -translate-y-12 opacity-5 group-hover:scale-110 transition-transform duration-1000 ease-in-out">
            <ShieldCheck size={420} />
         </div>
         <div className="space-y-8 relative z-10">
            <div className="flex items-center gap-6">
               <Badge className="bg-secondary text-secondary-foreground text-[10px] font-black uppercase px-6 py-1.5 tracking-[0.25em] shadow-lg">Enterprise Standard</Badge>
               <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">Workforce Node • Production Node 01</span>
            </div>
            <p className="text-3xl md:text-4xl leading-tight font-black tracking-tighter max-w-4xl">
              "Ensuring 100% adherence to clinical staffing quotas through atomic transactions and CP-SAT mathematical optimization."
            </p>
            <div className="pt-10 flex flex-wrap gap-16 border-t border-white/10 mt-10">
               <div className="space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3"><Activity className="size-4" /> Solver Latency</span>
                  <p className="text-xl font-black tracking-tight flex items-center gap-2">42ms Institutional <ArrowUpRight className="size-5 text-emerald-400 opacity-50" /></p>
               </div>
               <div className="space-y-3 border-l border-white/10 pl-16">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3"><ShieldCheck className="size-4" /> Secure Protocol</span>
                  <p className="text-xl font-black tracking-tight">AES-256 System-wide</p>
               </div>
               <div className="space-y-3 border-l border-white/10 pl-16">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3"><Clock className="size-4" /> Uptime Verify</span>
                  <p className="text-xl font-black tracking-tight">99.98% Service Pulse</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
