
"use client"

import { useMemo, useState, useEffect } from "react"
import { useUser, useAuth } from "@/firebase"
import { useOffice } from "@/context/office-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  Activity, 
  Zap, 
  Globe, 
  Database, 
  ShieldCheck, 
  PlaneTakeoff, 
  ArrowRightLeft,
  Loader2
} from "lucide-react"
import { DemoBadge } from "@/components/ui/demo-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getSolverHealthAction } from "@/services/solver-actions"
import { getRegionalStatsAction, getOfficeDashboardStatsAction } from "@/services/analytics-actions"
import { cn } from "@/lib/utils"

export default function AdminDashboard() {
  const auth = useAuth();
  const { profile } = useUser();
  const { selectedOffice, authorizedOffices } = useOffice();
  
  const [solverHealth, setSolverHealth] = useState<{ status: string } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const health = await getSolverHealthAction();
        setSolverHealth({ status: health.status });

        if (profile?.role === 'super_admin') {
          const res = await getRegionalStatsAction(idToken);
          if (res.success) setStats(res.data);
        } else if (selectedOffice) {
          const res = await getOfficeDashboardStatsAction(idToken, selectedOffice);
          if (res.success) setStats(res.data);
        }
      } catch (e) {
        console.error("Dashboard Pulse Failed:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [profile?.role, selectedOffice, auth.currentUser]);

  const isSuperAdmin = profile?.role === 'super_admin';
  const officeName = authorizedOffices.find(o => o.officeId === selectedOffice)?.officeName || "---";

  const kpis = useMemo(() => {
    if (!stats) return [];
    if (isSuperAdmin) {
      return [
        { label: 'Cluster Centers', value: stats.totalOffices, sub: `${stats.activeOffices} Active`, icon: Globe, color: 'text-primary' },
        { label: 'Workforce Pool', value: stats.totalEmployees, sub: `${stats.activeEmployees} Active`, icon: Users, color: 'text-secondary' },
        { label: 'Global Deployment', value: stats.totalAssignments, sub: 'Scheduled Shifts', icon: Zap, color: 'text-secondary' },
        { label: 'Pending Leaves', value: stats.pendingLeaves, sub: 'Awaiting Review', icon: PlaneTakeoff, color: 'text-destructive' }
      ];
    }
    return [
      { label: 'Authorized Staff', value: stats.totalEmployees, sub: `${stats.activeEmployees} Active`, icon: Users, color: 'text-primary' },
      { label: 'Assigned Shifts', value: stats.assignedCount, sub: `Pulse V${stats.rosterVersion?.toString().slice(-4) || '---'}`, icon: Zap, color: 'text-secondary' },
      { label: 'Pending Swaps', value: stats.pendingSwaps, sub: 'Request Ledger', icon: ArrowRightLeft, color: 'text-secondary' },
      { label: 'Pending Leaves', value: stats.pendingLeaves, sub: 'Center Overrides', icon: PlaneTakeoff, color: 'text-destructive' }
    ];
  }, [stats, isSuperAdmin]);

  return (
    <div className="space-y-6 md:space-y-10 animate-in max-w-[1600px] mx-auto pb-24 md:pb-40 px-2 sm:px-4">
      {/* Header Pulse */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pt-4 md:pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-secondary/10 rounded-xl md:rounded-2xl border border-secondary/20 shadow-inner">
              <Zap className="size-6 md:size-8 text-secondary fill-secondary/20" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight text-black uppercase leading-none">
                {isSuperAdmin ? "Regional Command" : "Command Center"}
              </h1>
              <div className="flex items-center gap-2 md:gap-3 mt-1.5 md:mt-2">
                <p className="text-muted-foreground font-black uppercase text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.25em] flex items-center gap-2">
                  {isSuperAdmin ? "Governance Hub" : `${officeName} Pulse`} <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4 bg-white p-1.5 md:p-2 rounded-xl md:rounded-2xl border border-slate-200 shadow-xl w-full lg:w-auto">
           <div className="px-4 md:px-6 py-1 border-r border-slate-100 flex-1 lg:flex-none">
              <label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">System Status</label>
              <div className="flex items-center gap-2">
                 <div className={cn("size-2 rounded-full", solverHealth?.status === 'healthy' ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-destructive animate-pulse')} />
                 <span className="font-black text-black uppercase tracking-widest text-[9px] md:text-[11px]">
                   {solverHealth?.status?.toUpperCase() || 'OFFLINE'}
                 </span>
              </div>
           </div>
           <div className="px-4 md:px-6 py-1 flex-1 lg:flex-none">
              <label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Matrix</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[9px] md:text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
        </div>
      </div>

      {/* KPI Responsive Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="border-none shadow-md overflow-hidden bg-white/50">
               <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-3 w-28" />
               </CardContent>
            </Card>
          ))
        ) : kpis.map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-4 md:size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-5xl font-black text-black tracking-tighter tabular-nums">{kpi.value}</div>
              <p className="text-[8px] md:text-[9px] text-muted-foreground uppercase font-black mt-1.5 md:mt-2 tracking-widest">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Institutional Insights */}
      <div className="grid gap-6 md:gap-8 lg:grid-cols-2">
        <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-white p-6 md:p-12 space-y-6 md:space-y-8 group">
           <div className="size-16 md:size-20 rounded-2xl md:rounded-[1.75rem] bg-primary flex items-center justify-center shadow-2xl shrink-0">
              <Activity className="size-8 md:size-10 text-white" />
           </div>
           <div className="space-y-3 md:space-y-4">
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none">Operational Oversight</h3>
              <p className="text-sm text-black/50 leading-relaxed font-medium">
                {isSuperAdmin 
                  ? "Consolidated regional metrics for institutional governance. Monitor global coverage and cluster center integrity."
                  : `Real-time management for ROC ${officeName}. Review assignments, swaps, and unavailability overrides.`}
              </p>
           </div>
           <div className="grid grid-cols-2 gap-3 md:gap-4 pt-2">
              <div className="p-4 md:p-6 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-slate-100 transition-all">
                 <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Requests</p>
                 <p className="text-xl md:text-2xl font-black text-black">{stats?.pendingLeaves + stats?.pendingSwaps || 0}</p>
              </div>
              <div className="p-4 md:p-6 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-slate-100 transition-all">
                 <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Sync Efficiency</p>
                 <p className="text-xl md:text-2xl font-black text-secondary">100%</p>
              </div>
           </div>
        </Card>

        <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-[#0F172A] text-white p-6 md:p-12 space-y-6 md:space-y-8 relative group">
           <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000 hidden md:block"><ShieldCheck size={240} /></div>
           <ShieldCheck className="size-10 md:size-12 text-secondary" />
           <div className="space-y-3 md:space-y-4 relative z-10">
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none">Security Protocol Hub</h3>
              <p className="text-sm text-white/40 leading-relaxed font-medium">
                 Zero-Trust identity verification is enforced at the server layer. 
                 Institutional audit logs are trace-linked to specific administrative actors.
              </p>
           </div>
           <div className="pt-4 md:pt-8 flex flex-wrap items-center gap-3 md:gap-4 relative z-10">
              <div className="px-4 md:px-6 py-2 rounded-lg md:rounded-xl bg-white/10 border border-white/10 font-black uppercase text-[8px] md:text-[10px] tracking-widest">Level 4 Secure</div>
              <div className="px-4 md:px-6 py-2 rounded-lg md:rounded-xl bg-secondary/20 border border-secondary/20 font-black uppercase text-[8px] md:text-[10px] tracking-widest text-secondary">Audit Active</div>
           </div>
        </Card>
      </div>
    </div>
  )
}
