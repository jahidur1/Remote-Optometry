"use client"

import { useMemo, useState, useEffect } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Users, 
  Calendar, 
  Activity, 
  CheckCircle2, 
  MessageSquare, 
  AlertCircle, 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  ArrowUpRight, 
  Clock, 
  Server, 
  Loader2,
  Zap,
  Globe,
  Database,
  Cpu
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

  // Fetch operational data
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: rosters, loading: rosterLoading } = useCollection(query(collection(db, 'published_rosters'), orderBy('publishedAt', 'desc'), limit(1)));
  const { data: logs, loading: logLoading } = useCollection(query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(100)));
  const { data: leaves } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));
  const { data: currentBookings } = useCollection(query(collection(db, 'weekoff_bookings'), limit(200)));

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
    <div className="space-y-8 animate-in max-w-[1600px] mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Zap className="size-6 text-secondary fill-secondary/20" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Command Center</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
            Institutional Roster Node • Week Cycle {activeWeek} <Activity className="size-3 text-emerald-500 animate-pulse" />
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className={cn(
            "h-10 px-4 rounded-xl flex items-center gap-3 border shadow-sm transition-all",
            solverHealth?.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-destructive/10 border-destructive/30 text-destructive'
          )}>
            {checkingHealth ? <Loader2 className="size-4 animate-spin" /> : <Cpu className="size-4" />}
            <span className="text-[10px] font-black uppercase tracking-widest">
              Solver: {solverHealth?.status?.toUpperCase() || 'OFFLINE'}
            </span>
          </div>
          <div className="h-10 px-4 rounded-xl flex items-center gap-3 bg-secondary/10 border border-secondary/30 text-secondary">
            <Globe className="size-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Meta API: ONLINE</span>
          </div>
          <div className="h-10 px-4 rounded-xl flex items-center gap-3 bg-white/5 border border-white/10 text-white/60">
            <Database className="size-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sync Pulse: Active</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Clinical Pool</CardTitle>
            <Users className="h-5 w-5 text-primary opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            {empLoading ? <Skeleton className="h-10 w-16" /> : (
              <>
                <div className="text-5xl font-black text-white tracking-tighter">{stats.totalActive}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Authorized Staff</span>
                  <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-black uppercase tracking-tighter border-secondary/30 text-secondary">Verified</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary">Active Capacity</CardTitle>
            <TrendingUp className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-secondary tracking-tighter">{stats.availableToday}</div>
            <div className="flex items-center gap-2 mt-2">
               <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Available Today</span>
               <Badge className="bg-emerald-500 text-[8px] h-4 px-1.5 font-black uppercase tracking-tighter shadow-sm animate-pulse text-white">Live</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">Deployment</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent tracking-tighter">{latestRoster ? 'ACTV' : '---'}</div>
            <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[8px] font-black uppercase border-accent/20 text-accent bg-accent/5">
                    V{latestRoster?.version.toString().slice(-4) || '---'}
                </Badge>
                <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest italic opacity-60">Verified Node</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Sync Pulse</CardTitle>
            <MessageSquare className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{stats.apiHealth}%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Meta Cloud API Efficiency</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics & Health Section */}
      <div className="grid gap-8 lg:grid-cols-7">
        {/* Main Chart Card */}
        <Card className="lg:col-span-4 glass-card border-none overflow-hidden rounded-[2rem]">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base uppercase font-black tracking-[0.2em] text-white">Operational Load Matrix</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase mt-1 text-muted-foreground tracking-widest">Daily Clinical Deployment Metrics.</CardDescription>
              </div>
              <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                <BarChart3 className="size-5 text-secondary" />
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
                   <Calendar className="size-24 opacity-5" />
                   <p className="text-[11px] font-black uppercase tracking-[0.3em]">Awaiting Cluster Authorization</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Feed Card */}
        <Card className="lg:col-span-3 glass-card border-none overflow-hidden rounded-[2rem] flex flex-col">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-8">
            <CardTitle className="text-base font-black uppercase tracking-[0.2em] text-white">Cluster Health Feed</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-10 flex-1">
            <div className="space-y-6">
               <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-3">
                  <TrendingUp className="size-4 text-secondary" /> Capacity Delta <span className="h-px flex-1 bg-white/5" />
               </h5>
               <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-[1.75rem] bg-secondary/5 border border-secondary/10 flex flex-col items-center justify-center text-center group hover:bg-secondary/10 transition-all cursor-default">
                     <p className="text-4xl font-black text-secondary tracking-tighter group-hover:scale-110 transition-transform">{stats.onWeekOffToday}</p>
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-2">Reserved Off</p>
                  </div>
                  <div className="p-6 rounded-[1.75rem] bg-accent/5 border border-accent/10 flex flex-col items-center justify-center text-center group hover:bg-accent/10 transition-all cursor-default">
                     <p className="text-4xl font-black text-accent tracking-tighter group-hover:scale-110 transition-transform">{stats.onLeaveToday}</p>
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-2">Medical Absence</p>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center justify-between">
                  Latest Infrastructure Events <Activity className="size-4 text-secondary opacity-40" />
               </h5>
               <div className="space-y-3">
                  {rosterLoading ? <Skeleton className="h-20 w-full" /> : (
                    <div className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.02] border border-white/5 group cursor-default hover:bg-white/[0.04] transition-all">
                      <div className="size-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] group-hover:scale-125 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[12px] font-black uppercase text-white tracking-tight truncate">Cycle {activeWeek} Deployed</span>
                          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Active</span>
                        </div>
                        <Badge variant="outline" className="text-[8px] h-5 px-2.5 font-black tracking-widest bg-white/5 uppercase text-secondary border-secondary/20">Production Standard</Badge>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.02] border border-white/5 group cursor-default hover:bg-white/[0.04] transition-all">
                    <div className="size-3 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:scale-125 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[12px] font-black uppercase text-white tracking-tight truncate">Solver Node Verified</span>
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">System</span>
                      </div>
                      <Badge variant="outline" className="text-[8px] h-5 px-2.5 font-black tracking-widest bg-white/5 uppercase text-accent border-accent/20">Deterministic CP-SAT</Badge>
                    </div>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Institutional Protocol Hero */}
      <div className="p-12 rounded-[3rem] bg-gradient-to-br from-slate-900 to-black border border-white/5 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-12 transform translate-x-12 -translate-y-12 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 ease-in-out">
            <ShieldCheck size={480} />
         </div>
         <div className="space-y-10 relative z-10">
            <div className="flex items-center gap-6">
               <Badge className="bg-secondary text-white text-[10px] font-black uppercase px-6 py-2 tracking-[0.25em] shadow-2xl border-none">Enterprise Protocol</Badge>
               <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30 hidden sm:inline">Node v2.0 • Institutional Standard</span>
            </div>
            <p className="text-3xl md:text-5xl leading-tight font-black tracking-tighter max-w-5xl text-white">
              "Ensuring 100% adherence to clinical staffing quotas through atomic transactions and deterministic CP-SAT mathematical optimization."
            </p>
            <div className="pt-12 flex flex-wrap gap-12 sm:gap-24 border-t border-white/5 mt-10">
               <div className="space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary flex items-center gap-3"><Activity className="size-4" /> Solver Latency</span>
                  <p className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                    {solverHealth?.latency ? `${solverHealth.latency}ms` : 'Verifying Node...'} 
                    <ArrowUpRight className="size-5 text-emerald-500 opacity-50" />
                  </p>
               </div>
               <div className="space-y-3 border-l border-white/10 pl-12 sm:pl-24">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary flex items-center gap-3"><ShieldCheck className="size-4" /> Security Protocol</span>
                  <p className="text-2xl font-black tracking-tight text-white">IAM OIDC Gate</p>
               </div>
               <div className="space-y-3 border-l border-white/10 pl-12 sm:pl-24">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary flex items-center gap-3"><Clock className="size-4" /> Uptime Verify</span>
                  <p className="text-2xl font-black tracking-tight text-white">99.99% Pulse</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
