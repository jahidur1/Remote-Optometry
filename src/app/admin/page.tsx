
"use client"

import { useMemo, useState, useEffect } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection, useUser, useAuth } from "@/firebase"
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
  CalendarDays,
  Target,
  AlertTriangle,
  MapPin,
  Loader2
} from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { DemoBadge } from "@/components/ui/demo-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { getSolverHealthAction } from "@/services/solver-actions"
import { getRegionalStatsAction } from "@/services/analytics-actions"
import { cn } from "@/lib/utils"

export default function AdminDashboard() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { selectedOffice, authorizedOffices } = useOffice();
  
  const [solverHealth, setSolverHealth] = useState<{ status: string; latency?: number } | null>(null);
  const [regionalStats, setRegionalStats] = useState<any>(null);
  const [loadingRegional, setLoadingRegional] = useState(false);

  // Scoped Queries based on selected office context (for ADMIN)
  const empQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'employees'), where('office', '==', selectedOffice), where('status', '==', 'Active'));
  }, [db, selectedOffice]);

  const rosterQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'published_rosters'), where('office', '==', selectedOffice), orderBy('publishedAt', 'desc'), limit(1));
  }, [db, selectedOffice]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: rosters, loading: rosterLoading } = useCollection(rosterQuery);

  useEffect(() => {
    async function verifyNode() {
      try {
        const health = await getSolverHealthAction();
        setSolverHealth({ status: health.status });
      } catch (e) {
        setSolverHealth({ status: 'offline' });
      }
    }
    
    async function fetchRegional() {
      if (profile?.role !== 'SUPER_ADMIN') return;
      setLoadingRegional(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          const res = await getRegionalStatsAction(idToken);
          if (res.success) setRegionalStats(res.data);
        }
      } catch (e) {
        console.error("Regional Pulse Failed:", e);
      } finally {
        setLoadingRegional(false);
      }
    }

    verifyNode();
    fetchRegional();
  }, [profile?.role, auth.currentUser]);

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
  const officeName = authorizedOffices.find(o => o.officeId === selectedOffice)?.officeName || "---";

  // Dashboard Metrics
  const stats = useMemo(() => {
    if (isSuperAdmin && regionalStats) {
      return {
        mainLabel: "Global Active Pool",
        mainValue: regionalStats.activeEmployees,
        subLabel: "Across ROC Network",
        secondaryLabel: "Registered Nodes",
        secondaryValue: regionalStats.totalOffices,
        thirdLabel: "Roster Deployment",
        thirdValue: regionalStats.totalAssignments,
        pendingLabel: "Global Pending Pulse",
        pendingValue: regionalStats.totalDrafts
      };
    }

    const latestRoster = rosters?.[0];
    const validAssignments = (latestRoster?.assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none').length;

    return {
      mainLabel: "Authorized Staff",
      mainValue: employees?.length || 0,
      subLabel: officeName,
      secondaryLabel: "Active Capacity",
      secondaryValue: employees?.length || 0, // Simplified for MVP
      thirdLabel: "Deployment Node",
      thirdValue: latestRoster ? `V${latestRoster.version.toString().slice(-4)}` : '---',
      pendingLabel: "Pending Pulse",
      pendingValue: 0
    };
  }, [isSuperAdmin, regionalStats, employees, officeName, rosters]);

  return (
    <div className="space-y-10 animate-in max-w-[1600px] mx-auto pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Zap className="size-8 text-secondary fill-secondary/20" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">
                {isSuperAdmin ? "Regional Command" : "Command Center"}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  {isSuperAdmin ? "Multi-ROC Governance Hub" : `${officeName} Pulse`} <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">System Pulse</label>
              <div className="flex items-center gap-2">
                 <div className={cn("size-2 rounded-full", solverHealth?.status === 'healthy' ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-destructive animate-pulse')} />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">
                   {solverHealth?.status?.toUpperCase() || 'OFFLINE'}
                 </span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: stats.mainLabel, value: stats.mainValue, sub: stats.subLabel, icon: Users, color: 'text-primary' },
          { label: stats.secondaryLabel, value: stats.secondaryValue, sub: 'Authorized Pulse', icon: TrendingUp, color: 'text-secondary' },
          { label: stats.thirdLabel, value: stats.thirdValue, sub: 'Production Node', icon: CheckCircle2, color: 'text-secondary' },
          { label: stats.pendingLabel, value: stats.pendingValue, sub: 'Needs Review', icon: Activity, color: 'text-destructive' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {empLoading || loadingRegional ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /> : (
                <>
                  <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isSuperAdmin ? (
        <div className="grid gap-8 lg:grid-cols-2">
           <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white p-12 space-y-8 group">
              <div className="size-20 rounded-[1.75rem] bg-primary flex items-center justify-center shadow-2xl">
                 <Globe className="size-10 text-white" />
              </div>
              <div className="space-y-4">
                 <h3 className="text-3xl font-black uppercase tracking-tight leading-none">Cluster Node Overview</h3>
                 <p className="text-sm text-black/50 leading-relaxed font-medium">
                    As a Super Administrator, you have oversight across all {regionalStats?.totalOffices || 0} ROC nodes. 
                    Manage the institutional registry and monitor global roster deployment coverage.
                 </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-slate-100 transition-all">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Pulses</p>
                    <p className="text-2xl font-black text-black">{regionalStats?.activeOffices || 0}</p>
                 </div>
                 <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-slate-100 transition-all">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Global Roster Coverage</p>
                    <p className="text-2xl font-black text-secondary">92%</p>
                 </div>
              </div>
           </Card>

           <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-[#0F172A] text-white p-12 space-y-8 relative group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000"><ShieldCheck size={240} /></div>
              <ShieldCheck className="size-12 text-secondary" />
              <div className="space-y-4 relative z-10">
                 <h3 className="text-3xl font-black uppercase tracking-tight leading-none">Security Protocol Node</h3>
                 <p className="text-sm text-white/40 leading-relaxed font-medium">
                    Multi-office isolation is enforced at the Firestore Security Rules level. 
                    Institutional audit logs are trace-linked to specific administrative actors.
                 </p>
              </div>
              <div className="pt-8 flex items-center gap-4 relative z-10">
                 <div className="px-6 py-2 rounded-xl bg-white/10 border border-white/10 font-black uppercase text-[10px] tracking-widest">Level 4 Secure</div>
                 <div className="px-6 py-2 rounded-xl bg-secondary/20 border border-secondary/20 font-black uppercase text-[10px] tracking-widest text-secondary">Audit Active</div>
              </div>
           </Card>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-7">
          <Card className="lg:col-span-4 shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Deployment Matrix</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase mt-2 text-muted-foreground tracking-[0.2em]">Today's Clinical Coverage.</CardDescription>
                </div>
                <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                  <BarChart3 className="size-6 text-secondary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 flex items-center justify-center min-h-[300px]">
               {rosters?.[0] ? (
                 <div className="text-center space-y-6">
                    <p className="text-6xl font-black text-black tracking-tighter">{(rosters[0].assignments || []).length}</p>
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground">Scheduled Assignments in Pulse V{rosters[0].version.toString().slice(-4)}</p>
                 </div>
               ) : (
                 <div className="text-center opacity-20 italic font-black uppercase text-xs tracking-widest">No Active Roster Pulse Detected</div>
               )}
            </CardContent>
          </Card>

          <div className="lg:col-span-3 space-y-8">
            <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white border-l-4 border-l-secondary">
               <CardHeader className="p-10 pb-6 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-4">
                    <Activity className="size-6 text-secondary" /> Node Integrity
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-10 space-y-8">
                  <div className="flex items-center gap-5 p-5 rounded-2xl bg-slate-50 border border-slate-100 group cursor-default hover:bg-slate-100 transition-all">
                    <div className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[12px] font-black uppercase text-black tracking-tight">Identity Registry</span>
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">SYNCED</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-black/40 font-bold uppercase leading-relaxed tracking-tight">
                    Cluster node {selectedOffice} is operating within institutional parameters. 
                    All administrative actions are ledgered for compliance review.
                  </p>
               </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
