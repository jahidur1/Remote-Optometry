
"use client"

import { useMemo, useState, useEffect } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { useOffice } from "@/context/office-context"
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
  CalendarDays,
  Target,
  AlertTriangle
} from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { DemoBadge } from "@/components/ui/demo-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { getSolverHealthAction } from "@/services/solver-actions"
import { cn } from "@/lib/utils"

export default function AdminDashboard() {
  const db = useFirestore();
  const { selectedOffice, authorizedOffices } = useOffice();
  const [solverHealth, setSolverHealth] = useState<{ status: string; latency?: number } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);

  // Scoped Queries based on selected office context
  const empQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'employees'), where('office', '==', selectedOffice), where('status', '==', 'Active'));
  }, [db, selectedOffice]);

  const rosterQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'published_rosters'), where('office', '==', selectedOffice), orderBy('publishedAt', 'desc'), limit(1));
  }, [db, selectedOffice]);

  const leavesQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'employee_leaves'), where('office', '==', selectedOffice), where('status', '==', 'approved'));
  }, [db, selectedOffice]);

  const bookingsQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'weekoff_bookings'), where('office', '==', selectedOffice), limit(100));
  }, [db, selectedOffice]);

  const swapQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'shift_swaps'), where('office', '==', selectedOffice), where('status', '==', 'pending'));
  }, [db, selectedOffice]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: rosters, loading: rosterLoading } = useCollection(rosterQuery);
  const { data: leaves } = useCollection(leavesQuery);
  const { data: currentBookings } = useCollection(bookingsQuery);
  const { data: pendingSwaps } = useCollection(swapQuery);

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
  const officeName = authorizedOffices.find(o => o.officeId === selectedOffice)?.officeName || "---";

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
      pendingRequests: (pendingSwaps?.length || 0) + (leaves?.filter(l => l.status === 'pending').length || 0)
    };
  }, [employees, leaves, currentBookings, activeWeek, pendingSwaps]);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Zap className="size-8 text-secondary fill-secondary/20" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Command Center</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  {officeName} • Week {activeWeek} <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Solver Pulse</label>
              <div className="flex items-center gap-2">
                 <div className={cn("size-2 rounded-full", solverHealth?.status === 'healthy' ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-destructive animate-pulse')} />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">
                   {checkingHealth ? 'SYNCHING...' : solverHealth?.status?.toUpperCase() || 'OFFLINE'}
                 </span>
              </div>
           </div>
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Regional Scoping</label>
              <div className="flex items-center gap-2">
                 <ShieldCheck className="size-3 text-emerald-500" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ENFORCED</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Clinical Pool', value: stats.totalActive, sub: 'Authorized Staff', icon: Users, color: 'text-primary' },
          { label: 'Active Capacity', value: stats.availableToday, sub: 'Eligible Today', icon: TrendingUp, color: 'text-secondary' },
          { label: 'Deployment', value: latestRoster ? `V${latestRoster.version.toString().slice(-4)}` : '---', sub: 'Production Node', icon: CheckCircle2, color: 'text-secondary' },
          { label: 'Pending Pulse', value: stats.pendingRequests, sub: 'Needs Review', icon: Activity, color: 'text-destructive' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {empLoading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /> : (
                <>
                  <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Load Matrix</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase mt-2 text-muted-foreground tracking-[0.2em]">Daily Deployment Pulse.</CardDescription>
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
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.05)" />
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
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-[1.25rem] border-2 bg-white p-5 shadow-2xl border-slate-100 animate-in zoom-in-95">
                              <p className="text-[10px] font-black uppercase text-secondary tracking-widest mb-3 border-b border-slate-50 pb-3">{payload[0].payload.day} Assignments</p>
                              <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-black text-black tracking-tighter">{payload[0].value}</span>
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
                           fill={index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} 
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

        <div className="lg:col-span-3 space-y-8">
          <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white border-l-4 border-l-secondary">
             <CardHeader className="p-10 pb-6 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-4">
                  <Activity className="size-6 text-secondary" /> Node Health
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 text-muted-foreground">Cluster Specific Delta.</CardDescription>
             </CardHeader>
             <CardContent className="p-10 space-y-10">
                <div className="grid grid-cols-2 gap-6">
                   <div className="p-8 rounded-[1.75rem] bg-secondary/5 border border-secondary/10 flex flex-col items-center justify-center text-center group hover:bg-secondary/10 transition-all cursor-default">
                      <p className="text-4xl font-black text-secondary tracking-tighter group-hover:scale-110 transition-transform">{stats.onWeekOffToday}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-3">Reserved Off</p>
                   </div>
                   <div className="p-8 rounded-[1.75rem] bg-primary/5 border border-primary/10 flex flex-col items-center justify-center text-center group hover:bg-primary/10 transition-all cursor-default">
                      <p className="text-4xl font-black text-primary tracking-tighter group-hover:scale-110 transition-transform">{stats.onLeaveToday}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mt-3">Absences</p>
                   </div>
                </div>

                <div className="space-y-6">
                   <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center justify-between">
                      Operational Alerts <Clock className="size-4 text-secondary opacity-40" />
                   </h5>
                   <div className="space-y-3">
                      {!latestRoster && (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                           <AlertTriangle className="size-4 text-destructive" />
                           <span className="text-[10px] font-black uppercase text-destructive tracking-widest">No Active Roster Pulse</span>
                        </div>
                      )}
                      <div className="flex items-center gap-5 p-5 rounded-2xl bg-slate-50 border border-slate-100 group cursor-default hover:bg-slate-100 transition-all">
                        <div className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[12px] font-black uppercase text-black tracking-tight">Identity Registry</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">SYNCED</span>
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
