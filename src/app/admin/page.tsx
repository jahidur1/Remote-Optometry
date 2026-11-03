"use client"

import { useMemo, useState, useEffect } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Users, 
  Activity, 
  CheckCircle2, 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  Zap, 
  Globe, 
  Database, 
  Cpu, 
  PlaneTakeoff, 
  CalendarDays 
} from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { DemoBadge } from "@/components/ui/demo-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { getSolverHealthAction } from "@/services/solver-actions"
import { cn } from "@/lib/utils"

export default function AdminDashboard() {
  const db = useFirestore();
  const [solverHealth, setSolverHealth] = useState<{ status: string; latency?: number } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);

  // Fetch operational data - useMemo to stabilize queries and prevent infinite loops
  const empQuery = useMemo(() => query(collection(db, 'employees'), where('status', '==', 'Active')), [db]);
  const rosterQuery = useMemo(() => query(collection(db, 'published_rosters'), orderBy('publishedAt', 'desc'), limit(1)), [db]);
  const logsQuery = useMemo(() => query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(100)), [db]);
  const leavesQuery = useMemo(() => query(collection(db, 'employee_leaves'), where('status', '==', 'approved')), [db]);
  const bookingsQuery = useMemo(() => query(collection(db, 'weekoff_bookings'), limit(200)), [db]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: rosters, loading: rosterLoading } = useCollection(rosterQuery);
  const { data: logs } = useCollection(logsQuery);
  const { data: leaves } = useCollection(leavesQuery);
  const { data: currentBookings } = useCollection(bookingsQuery);

  useEffect(() => {
    async function verifyNode() {
      try {
        const start = Date.now();
        const health = await getSolverHealthAction();
        setSolverHealth({ status: health.status, latency: Date.now() - start });
      } catch (e) {
        setSolverHealth({ status: 'offline' });
      } finally {
        setCheckingHealth(false);
      }
    }
    verifyNode();
  }, []);

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
    <div className="space-y-10 animate-in max-w-[1600px] mx-auto pb-40 px-4">
      {/* Refined Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Zap className="size-8 text-secondary fill-secondary/20" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Command Center</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Roster Node • Week {activeWeek} <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 border-r border-white/5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Solver Pulse</label>
              <div className="flex items-center gap-2">
                 <div className={cn("size-2 rounded-full", solverHealth?.status === 'healthy' ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-destructive animate-pulse')} />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">
                   {checkingHealth ? 'SYNCHING...' : solverHealth?.status?.toUpperCase() || 'OFFLINE'}
                 </span>
              </div>
           </div>
           <div className="px-6 py-1.5 border-r border-white/5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Meta Cloud API</label>
              <div className="flex items-center gap-2">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">ONLINE</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
        </div>
      </div>

      {/* Primary KPI Matrix */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Clinical Pool', value: stats.totalActive, sub: 'Authorized Staff', icon: Users, color: 'text-primary' },
          { label: 'Active Capacity', value: stats.availableToday, sub: 'Eligible Today', icon: TrendingUp, color: 'text-secondary' },
          { label: 'Deployment', value: latestRoster ? `V${latestRoster.version.toString().slice(-4)}` : '---', sub: 'Production Node', icon: CheckCircle2, color: 'text-accent' },
          { label: 'API Efficiency', value: `${stats.apiHealth}%`, sub: 'Transmission Rate', icon: Globe, color: 'text-white' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {empLoading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /> : (
                <>
                  <div className="text-5xl font-black text-white tracking-tighter">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        {/* Load Distribution Matrix */}
        <Card className="lg:col-span-4 shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl uppercase font-black tracking-tight text-white leading-none">Load Matrix</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase mt-2 text-white/30 tracking-[0.2em]">Daily Clinical Deployment Metrics.</CardDescription>
              </div>
              <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                <BarChart3 className="size-6 text-secondary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="h-[400px] w-full">
              {latestRoster ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-[1.25rem] border-2 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl border-white/10 animate-in zoom-in-95">
                              <p className="text-[10px] font-black uppercase text-secondary tracking-widest mb-3 border-b border-white/5 pb-3">{payload[0].payload.day} Assignments</p>
                              <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-black text-white tracking-tighter">{payload[0].value}</span>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Professionals</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="scheduled" radius={[12, 12, 0, 0]} barSize={48}>
                       {chartData.map((entry, index) => (
                         <Cell 
                           key={`cell-${index}`} 
                           fill={index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--accent))'} 
                           className="transition-all duration-500 hover:opacity-80" 
                         />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 space-y-6">
                   <CalendarDays className="size-24 opacity-5" />
                   <p className="text-[11px] font-black uppercase tracking-[0.3em]">Awaiting Cluster Authorization</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cluster Health Feed */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card border-l-4 border-l-secondary">
             <CardHeader className="p-10 pb-6 border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-4">
                  <Activity className="size-6 text-secondary" /> Cluster Health
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 text-white/30">Operational Delta Feed</CardDescription>
             </CardHeader>
             <CardContent className="p-10 space-y-10">
                <div className="grid grid-cols-2 gap-6">
                   <div className="p-8 rounded-[1.75rem] bg-secondary/5 border border-secondary/10 flex flex-col items-center justify-center text-center group hover:bg-secondary/10 transition-all cursor-default">
                      <p className="text-4xl font-black text-secondary tracking-tighter group-hover:scale-110 transition-transform">{stats.onWeekOffToday}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-3">Reserved Off</p>
                   </div>
                   <div className="p-8 rounded-[1.75rem] bg-accent/5 border border-accent/10 flex flex-col items-center justify-center text-center group hover:bg-accent/10 transition-all cursor-default">
                      <p className="text-4xl font-black text-accent tracking-tighter group-hover:scale-110 transition-transform">{stats.onLeaveToday}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-3">Absences</p>
                   </div>
                </div>

                <div className="space-y-6">
                   <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center justify-between">
                      Infrastructure Trace <Clock className="size-4 text-secondary opacity-40" />
                   </h5>
                   <div className="space-y-3">
                      <div className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.02] border border-white/5 group cursor-default hover:bg-white/[0.04] transition-all">
                        <div className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[12px] font-black uppercase text-white tracking-tight">Node Verified</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Active</span>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-black tracking-widest bg-white/5 uppercase text-secondary border-secondary/20">Deterministic CP-SAT</Badge>
                        </div>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>

      {/* Institutional Protocol Footnote */}
      <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-black border border-white/5 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><ShieldCheck size={240} /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Governance Protocol node</p>
               <p className="text-lg font-bold text-white/80 leading-relaxed max-w-4xl tracking-tight">
                  "ROC Workforce Command Center enforces 100% adherence to clinical staffing quotas through atomic transactions 
                  and deterministic CP-SAT mathematical optimization. All operational events are immutably logged to the institutional registry."
               </p>
            </div>
         </div>
      </div>
    </div>
  )
}
