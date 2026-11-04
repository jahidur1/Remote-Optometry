'use client';

import { useState, useEffect } from 'react';
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
  CalendarDays, 
  MapPin, 
  ShieldCheck, 
  Loader2, 
  Database, 
  FileSpreadsheet,
  AlertTriangle,
  Info
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
  Pie,
  Legend
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
      if (!idToken) throw new Error("Session expired. Please re-authenticate.");

      // Fetch all regional segments in parallel for performance
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
    if (profile?.role === 'SUPER_ADMIN') {
      fetchRegionalPulse();
    }
  }, [weekId, profile]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const handleExport = () => {
    if (!comparison.length) return;
    const filename = `ROC_Regional_Ledger_${weekId}`;
    const ledgerData = comparison.map(c => ({
      'Office Name': c.officeName,
      'Short Code': c.shortCode,
      'Active Staff': c.staffCount,
      'Required Shifts': c.requiredCount,
      'Scheduled Assignments': c.assignedCount,
      'Roster Coverage %': c.coverage === null ? 'CONFIG_MISSING' : `${c.coverage}%`,
      'Staffing Shortfall': c.shortfall,
      'FCFS Bookings': c.bookingsCount,
      'Registry Status': c.status
    }));
    exportToCSV(filename, ledgerData);
    toast({ title: "Ledger Dispatched", description: "Consolidated regional data exported for institutional review." });
  };

  if (profile?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-[80vh] items-center justify-center p-10">
         <Card className="max-w-md border-destructive/20 bg-destructive/5 p-10 text-center space-y-6 rounded-[2rem]">
            <AlertTriangle className="size-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-black uppercase text-primary tracking-tighter">Privileged Node Restricted</h2>
            <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed text-balance">
              Regional Multi-ROC Analytics are restricted to active Super Administrative accounts only.
            </p>
         </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* Institutional Regional Header */}
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
                  Multi-ROC Governance Hub <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cycle</label>
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
            className="bg-secondary text-white h-10 px-6 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl shadow-xl shadow-secondary/20 group" 
            onClick={handleExport}
           >
             <FileSpreadsheet className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" /> EXPORT REGIONAL LEDGER
           </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
           <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-12 animate-spin text-secondary opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Aggregating Regional Performance Pulse</p>
           </div>
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-10">
          <TabsList className="h-16 bg-white border-2 border-slate-100 rounded-2xl p-1.5 shadow-sm overflow-x-auto no-scrollbar">
            <TabsTrigger value="overview" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <BarChart3 className="size-3.5 mr-3" /> Executive Pulse
            </TabsTrigger>
            <TabsTrigger value="comparison" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <Activity className="size-3.5 mr-3" /> Cluster Comparison
            </TabsTrigger>
            <TabsTrigger value="roster" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <CalendarDays className="size-3.5 mr-3" /> Roster Intelligence
            </TabsTrigger>
            <TabsTrigger value="leaves" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <PieChartIcon className="size-3.5 mr-3" /> Workforce Pressure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-10 animate-in">
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
               {[
                 { label: 'Registered Nodes', value: stats?.totalOffices, sub: `${stats?.activeOffices} Active`, icon: MapPin, color: 'text-primary' },
                 { label: 'Workforce Pool', value: stats?.activeEmployees, sub: `Of ${stats?.totalEmployees} Professionals`, icon: Users, color: 'text-secondary' },
                 { label: 'Global Deployment', value: stats?.totalAssignments, sub: 'Scheduled Shifts', icon: Zap, color: 'text-secondary' },
                 { label: 'Awaiting Audit', value: stats?.totalDrafts, sub: 'Draft Rosters', icon: ShieldCheck, color: 'text-black' }
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
                    <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Regional Coverage Heatmap</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase mt-2 text-muted-foreground tracking-[0.2em]">Institutional Quota Fulfillment across the ROC Network (Cycle {weekId}).</CardDescription>
                  </CardHeader>
                  <CardContent className="p-10">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparison} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.05)" />
                          <XAxis dataKey="shortCode" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(0,0,0,0.4)' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: 'rgba(0,0,0,0.4)' }} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-white p-4 border rounded-xl shadow-2xl border-slate-100">
                                            <p className="text-[10px] font-black uppercase text-secondary mb-2">{data.officeName}</p>
                                            <div className="space-y-1">
                                                <p className="text-[12px] font-bold">Coverage: {data.coverage !== null ? `${data.coverage}%` : 'N/A'}</p>
                                                <p className="text-[11px] text-muted-foreground">Assignments: {data.assignedCount}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                          />
                          <Bar dataKey="coverage" radius={[12, 12, 0, 0]} barSize={48}>
                             {comparison.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.coverage === null ? '#cbd5e1' : COLORS[index % COLORS.length]} />
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
                          <TrendingUp className="size-6 text-secondary" /> Staffing Shortfall
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 text-muted-foreground">Gap identification per Node.</CardDescription>
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
                                )}>
                                    {c.shortfall > 0 ? `-${c.shortfall}` : 'BALANCED'}
                                </span>
                                <Badge variant="outline" className={cn(
                                  "text-[9px] font-black uppercase border-secondary/20 px-3 py-1",
                                  c.coverage === null ? "text-muted-foreground bg-muted/20" : "text-secondary bg-secondary/5"
                                )}>
                                   {c.coverage === null ? 'CONFIG_MISSING' : `${c.coverage}%`}
                                </Badge>
                             </div>
                          </div>
                        ))}
                     </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="comparison" className="animate-in">
             <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
                   <CardTitle className="text-2xl font-black uppercase tracking-tight text-black">Registry Performance Matrix</CardTitle>
                   <CardDescription className="text-[11px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Detailed comparative ledger of all clinical cluster nodes.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto no-scrollbar">
                   <table className="w-full border-collapse">
                      <thead className="bg-slate-50/30">
                        <tr className="border-b border-slate-100">
                          <th className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left">ROC Node</th>
                          <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Active Pool</th>
                          <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Quotas</th>
                          <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Assigned</th>
                          <th className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Coverage Pulse</th>
                        </tr>
                      </thead>
                      <tbody>
                         {comparison.map((c, i) => (
                           <tr key={i} className="hover:bg-slate-50 transition-all border-b last:border-0 group">
                              <td className="pl-10 py-8 border-r border-slate-100">
                                 <div className="flex flex-col">
                                    <span className="font-black text-[15px] text-black uppercase group-hover:translate-x-1 transition-transform">{c.officeName}</span>
                                    <code className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">{c.officeId}</code>
                                 </div>
                              </td>
                              <td className="py-8 border-r border-slate-100 text-center font-black text-lg text-black/60 tabular-nums">{c.staffCount}</td>
                              <td className="py-8 border-r border-slate-100 text-center font-black text-lg text-black/60 tabular-nums">{c.requiredCount}</td>
                              <td className="py-8 border-r border-slate-100 text-center font-black text-lg text-black/60 tabular-nums">{c.assignedCount}</td>
                              <td className="text-right pr-12 py-8">
                                 <div className="flex flex-col items-end gap-1.5">
                                    {c.coverage === null ? (
                                      <Badge variant="outline" className="text-[10px] font-black uppercase text-muted-foreground bg-muted/5 border-dashed">CONFIG_MISSING</Badge>
                                    ) : (
                                      <>
                                        <span className={cn(
                                          "text-2xl font-black tabular-nums tracking-tighter",
                                          c.coverage < 90 ? "text-destructive" : "text-emerald-500"
                                        )}>{c.coverage}%</span>
                                        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                                           <div className={cn("h-full transition-all duration-1000", c.coverage < 90 ? "bg-destructive" : "bg-emerald-500")} style={{ width: `${c.coverage}%` }} />
                                        </div>
                                      </>
                                    )}
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="roster" className="animate-in">
             <div className="grid gap-8 lg:grid-cols-2">
                <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
                      <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Regional Daily Intensity</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Aggregated staffing requirements vs. scheduled assignments.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-10">
                      <div className="h-[400px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rosterData?.dailyStats || []}>
                               <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.05)" />
                               <XAxis dataKey="short" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900 }} />
                               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800 }} />
                               <Tooltip 
                                 contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
                               />
                               <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', textTransform: 'uppercase', fontSize: '9px', fontWeight: 900 }} />
                               <Bar name="Regional Demand" dataKey="required" fill="rgba(15, 23, 42, 0.05)" radius={[8, 8, 0, 0]} barSize={24} />
                               <Bar name="Actual Deployment" dataKey="assigned" fill="#3B82F6" radius={[8, 8, 0, 0]} barSize={24} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </CardContent>
                </Card>

                <div className="space-y-8">
                   <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white p-10 flex gap-8 items-start">
                      <div className="size-16 rounded-[1.5rem] bg-primary flex items-center justify-center shrink-0 shadow-xl shadow-primary/10">
                         <Info className="size-8 text-white" />
                      </div>
                      <div className="space-y-2">
                         <p className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">Roster Rule Node</p>
                         <p className="text-[14px] font-bold text-black/60 leading-relaxed uppercase tracking-tight">
                            "Scheduled assignments" reflect professionals assigned to duty in published rosters. 
                            Attendance and punctuality data nodes are not linked to this management matrix.
                         </p>
                      </div>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="leaves" className="animate-in">
             <div className="grid gap-8 lg:grid-cols-2">
                <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 text-center">
                      <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Regional Unavailability Pulse</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Absence status breakdown across all cluster nodes.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-10 flex flex-col items-center">
                      <div className="h-[300px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie
                                 data={[
                                   { name: 'Approved', value: leaveStats?.statusBreakdown?.approved || 0 },
                                   { name: 'Pending', value: leaveStats?.statusBreakdown?.pending || 0 },
                                   { name: 'Rejected', value: leaveStats?.statusBreakdown?.rejected || 0 }
                                 ]}
                                 innerRadius={80}
                                 outerRadius={110}
                                 paddingAngle={10}
                                 dataKey="value"
                               >
                                  <Cell fill="#10B981" />
                                  <Cell fill="#F59E0B" />
                                  <Cell fill="#EF4444" />
                               </Pie>
                               <Tooltip />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="flex gap-12 mt-10">
                         <div className="flex items-center gap-3"><div className="size-3 rounded-full bg-[#10B981] shadow-lg shadow-emerald-500/20" /> <span className="text-[11px] font-black uppercase tracking-widest">Approved</span></div>
                         <div className="flex items-center gap-3"><div className="size-3 rounded-full bg-[#F59E0B] shadow-lg shadow-amber-500/20" /> <span className="text-[11px] font-black uppercase tracking-widest">Pending</span></div>
                         <div className="flex items-center gap-3"><div className="size-3 rounded-full bg-[#EF4444] shadow-lg shadow-destructive/20" /> <span className="text-[11px] font-black uppercase tracking-widest">Rejected</span></div>
                      </div>
                   </CardContent>
                </Card>

                <div className="space-y-8">
                   <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-[#0F172A] text-white p-12 space-y-10 group relative">
                      <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000"><ShieldCheck size={200} /></div>
                      <ShieldCheck className="size-12 text-secondary" />
                      <div className="space-y-4 relative z-10">
                         <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Privacy Protocol Node</p>
                         <p className="text-xl font-bold leading-relaxed uppercase tracking-tight">
                            "Regional analytics leverage server-side aggregation (Admin SDK) to ensure individual professional 
                            PII remains siloed. Sub-second queries are enforced via composite indexing."
                         </p>
                         <div className="pt-8 flex items-center gap-4 text-secondary">
                            <Database className="size-4" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Data Integrity Verified</span>
                         </div>
                      </div>
                   </Card>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      )}

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><Database size={240} className="text-slate-200" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-primary tracking-[0.4em]">Regional Governance node</p>
               <p className="text-lg font-bold text-black/70 leading-relaxed max-w-4xl tracking-tight">
                  "The Regional Command Hub consolidates clinical deployment metrics across the ROC network. 
                  Calculations for 'Roster Coverage' explicitly identify nodes where weekly cycle configurations 
                  are absent to maintain institutional compliance standards."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}