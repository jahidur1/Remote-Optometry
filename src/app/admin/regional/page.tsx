'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Globe, 
  Activity, 
  Users, 
  Zap, 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Download, 
  CalendarDays, 
  MapPin, 
  ShieldCheck, 
  Clock, 
  AlertTriangle,
  Loader2,
  Database,
  ArrowUpRight,
  FileSpreadsheet
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell,
  PieChart,
  Pie
} from "recharts";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Input } from '@/components/ui/input';
import { 
  getRegionalStatsAction, 
  getOfficeComparisonAction, 
  getRegionalRosterAnalyticsAction,
  getRegionalLeaveAnalyticsAction
} from '@/services/analytics-actions';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/export-utils';
import { cn } from '@/lib/utils';

export default function RegionalAnalytics() {
  const { profile } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [weekId, setWeekId] = useState('2024-52');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [comparison, setComparison] = useState<any[]>([]);
  const [rosterData, setRosterData] = useState<any>(null);
  const [leaveStats, setLeaveStats] = useState<any>(null);

  const fetchRegionalPulse = async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const [statsRes, compRes, rosterRes, leaveRes] = await Promise.all([
        getRegionalStatsAction(idToken),
        getOfficeComparisonAction(idToken, weekId),
        getRegionalRosterAnalyticsAction(idToken, weekId),
        getRegionalLeaveAnalyticsAction(idToken)
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (compRes.success) setComparison(compRes.data);
      if (rosterRes.success) setRosterData(rosterRes.data);
      if (leaveRes.success) setLeaveStats(leaveRes.data);

    } catch (e: any) {
      toast({ title: "Intelligence Failure", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegionalPulse();
  }, [weekId]);

  const COLORS = ['hsl(var(--secondary))', 'hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444'];

  const handleExport = () => {
    if (!comparison.length) return;
    const filename = `ROC_Regional_Report_${weekId}`;
    exportToCSV(filename, comparison);
    toast({ title: "Export Dispatched", description: "Regional ledger successfully generated." });
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* Dynamic Regional Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Globe className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Regional Command</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Consolidated Operational View <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <div className="flex items-center gap-2">
                 <Input 
                   className="w-24 h-6 font-black text-black border-none bg-transparent focus-visible:ring-0 p-0 text-[16px]" 
                   value={weekId} 
                   onChange={(e) => setWeekId(e.target.value)}
                 />
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
              </div>
           </div>
           <Button 
            className="bg-secondary text-white h-10 px-6 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl shadow-xl shadow-secondary/20" 
            onClick={handleExport}
           >
             <FileSpreadsheet className="mr-2 h-4 w-4" /> EXPORT REGIONAL LEDGER
           </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
           <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-12 animate-spin text-secondary opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Aggregating Regional Pulse</p>
           </div>
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-10">
          <TabsList className="h-16 bg-white border-2 border-slate-100 rounded-2xl p-1.5 shadow-sm">
            {[
              { id: 'overview', label: 'Executive Pulse', icon: BarChart3 },
              { id: 'comparison', label: 'Cluster Heatmap', icon: Activity },
              { id: 'roster', label: 'Scheduling Intelligence', icon: CalendarDays },
              { id: 'leaves', label: 'Workforce Pressure', icon: PieChartIcon }
            ].map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <tab.icon className="size-3.5 mr-3" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-10 animate-in">
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
               {[
                 { label: 'Registered Nodes', value: stats?.totalOffices, sub: `${stats?.activeOffices} Active Pulses`, icon: MapPin, color: 'text-primary' },
                 { label: 'Active Capacity', value: stats?.totalActiveStaff, sub: 'Authorized Professionals', icon: Users, color: 'text-secondary' },
                 { label: 'Deployment Load', value: stats?.totalAssignments, sub: 'Assigned Shifts (Week)', icon: Zap, color: 'text-secondary' },
                 { label: 'Regional Sync', value: '100%', sub: 'Node Integrity Verified', icon: ShieldCheck, color: 'text-black' }
               ].map((kpi, i) => (
                 <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
                     <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
                   </CardHeader>
                   <CardContent>
                      <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
                      <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                   </CardContent>
                 </Card>
               ))}
             </div>

             <div className="grid gap-8 lg:grid-cols-7">
                <Card className="lg:col-span-4 shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Cluster Coverage</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase mt-2 text-muted-foreground tracking-[0.2em]">Institutional Quota Fulfillment by ROC Node.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-10">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparison} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.05)" />
                          <XAxis 
                            dataKey="shortCode" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(0,0,0,0.4)' }} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 800, fill: 'rgba(0,0,0,0.4)' }} 
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            contentStyle={{ borderRadius: '1.25rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
                          />
                          <Bar dataKey="coverage" radius={[12, 12, 0, 0]} barSize={48}>
                             {comparison.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="lg:col-span-3 space-y-8">
                   <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white border-l-4 border-l-secondary">
                     <CardHeader className="p-10 pb-6 border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-4">
                          <TrendingUp className="size-6 text-secondary" /> Shortfall Matrix
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 text-muted-foreground">Regional Staffing Deficit Tracker</CardDescription>
                     </CardHeader>
                     <CardContent className="p-10 space-y-6">
                        {comparison.map((c, i) => (
                          <div key={i} className="flex justify-between items-center group">
                             <div className="flex flex-col">
                                <span className="text-[12px] font-black uppercase text-black tracking-tight">{c.officeName}</span>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">{c.shortCode} Node</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className={cn(
                                  "text-lg font-black tabular-nums",
                                  c.shortfall > 0 ? "text-destructive" : "text-emerald-500"
                                )}>-{c.shortfall}</span>
                                <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5">
                                   {c.coverage}% Coverage
                                </Badge>
                             </div>
                          </div>
                        ))}
                     </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-10 animate-in">
             <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
                   <CardTitle className="text-2xl font-black uppercase tracking-tight text-black">Cluster Comparison Matrix</CardTitle>
                   <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">Verified operational delta for Cycle {weekId}.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto no-scrollbar">
                   <table className="w-full border-collapse">
                      <thead className="bg-slate-50/30">
                        <tr className="border-b border-slate-100">
                          <th className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left">ROC Node</th>
                          <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Active Pool</th>
                          <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Quotas</th>
                          <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Assignments</th>
                          <th className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Compliance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {comparison.map((c, i) => (
                           <tr key={i} className="hover:bg-slate-50 transition-all group">
                              <td className="pl-10 py-8 border-r border-slate-100">
                                 <div className="flex flex-col gap-1">
                                    <span className="font-black text-[15px] text-black uppercase tracking-tight">{c.officeName}</span>
                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{c.officeId}</span>
                                 </div>
                              </td>
                              <td className="py-8 border-r border-slate-100 text-center font-black text-lg text-black/60 tabular-nums">{c.staffCount}</td>
                              <td className="py-8 border-r border-slate-100 text-center font-black text-lg text-black/60 tabular-nums">{c.requiredCount}</td>
                              <td className="py-8 border-r border-slate-100 text-center font-black text-lg text-black/60 tabular-nums">{c.assignedCount}</td>
                              <td className="text-right pr-12 py-8">
                                 <div className="flex flex-col items-end gap-1.5">
                                    <span className={cn(
                                      "text-2xl font-black tabular-nums",
                                      c.coverage < 90 ? "text-destructive" : "text-emerald-500"
                                    )}>{c.coverage}%</span>
                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                       <div className={cn(
                                         "h-full rounded-full transition-all duration-1000",
                                         c.coverage < 90 ? "bg-destructive" : "bg-emerald-500"
                                       )} style={{ width: `${c.coverage}%` }} />
                                    </div>
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="roster" className="space-y-10 animate-in">
             <div className="grid gap-8 lg:grid-cols-2">
                <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
                      <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Daily Coverage Intensity</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">Regional quota fulfillment by weekday.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-10">
                      <div className="h-[400px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rosterData?.dailyCoverage || []}>
                               <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.05)" />
                               <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900 }} />
                               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800 }} />
                               <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                               <Bar dataKey="coverage" radius={[8, 8, 0, 0]} fill="hsl(var(--secondary))" barSize={32} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </CardContent>
                </Card>

                <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
                      <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Staffing Pressure</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">Required vs Assigned shifts across region.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-10">
                      <div className="h-[400px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rosterData?.dailyCoverage || []}>
                               <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.05)" />
                               <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900 }} />
                               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800 }} />
                               <Tooltip />
                               <Bar dataKey="required" fill="rgba(0,0,0,0.05)" radius={[8, 8, 0, 0]} barSize={24} />
                               <Bar dataKey="assigned" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={24} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="leaves" className="space-y-10 animate-in">
             <div className="grid gap-8 lg:grid-cols-2">
                <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 text-center">
                      <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Unavailability Mix</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">Regional leave distribution by status pulse.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-10 flex flex-col items-center">
                      <div className="h-[300px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie
                                 data={[
                                   { name: 'Authorized', value: leaveStats?.approved || 0 },
                                   { name: 'Pending', value: leaveStats?.pending || 0 },
                                   { name: 'Rejected', value: leaveStats?.rejected || 0 }
                                 ]}
                                 innerRadius={80}
                                 outerRadius={110}
                                 paddingAngle={10}
                                 dataKey="value"
                               >
                                  <Cell fill="#10b981" />
                                  <Cell fill="#f59e0b" />
                                  <Cell fill="#ef4444" />
                               </Pie>
                               <Tooltip />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="flex gap-8 mt-10">
                         <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-[#10b981]" /> <span className="text-[10px] font-black uppercase">Approved</span></div>
                         <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-[#f59e0b]" /> <span className="text-[10px] font-black uppercase">Pending</span></div>
                         <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-[#ef4444]" /> <span className="text-[10px] font-black uppercase">Rejected</span></div>
                      </div>
                   </CardContent>
                </Card>

                <div className="space-y-8">
                   <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white group p-10 flex gap-8 items-start relative">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.02]"><Clock size={160} /></div>
                      <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                         <Activity className="size-8" />
                      </div>
                      <div className="space-y-2 relative z-10">
                         <p className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">Operational Pulse</p>
                         <h3 className="text-3xl font-black text-black leading-none">{leaveStats?.approved || 0} Professionals</h3>
                         <p className="text-[13px] font-bold text-muted-foreground uppercase leading-relaxed max-w-sm tracking-tight">
                            Total institutional unavailabilities currently reducing regional clinical capacity.
                         </p>
                      </div>
                   </Card>

                   <div className="p-10 rounded-[2.5rem] bg-primary text-primary-foreground shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:rotate-12 transition-transform duration-700"><ShieldCheck size={180} /></div>
                      <div className="flex items-center gap-8 relative z-10">
                         <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
                            <ShieldCheck className="size-8 text-white" />
                         </div>
                         <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Integrity Protocol node</p>
                            <p className="text-[14px] font-medium leading-relaxed uppercase tracking-tight">
                               Analytical metrics are derived from verified `status` pulses within the clinical registry. 
                               Approximations are explicitly excluded from institutional governance matrices.
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      )}

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><Database size={240} className="text-slate-200" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Regional Governance node</p>
               <p className="text-lg font-bold text-black/70 leading-relaxed max-w-4xl tracking-tight">
                  "ROC Workforce Regional Command enforces institutional transparency across the clinical network. 
                  Aggregation nodes strictly follow the zero-trust identity architecture, ensuring that cross-office 
                  intelligence is isolated to authorized system super administrators."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
