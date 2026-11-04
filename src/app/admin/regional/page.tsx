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
  CalendarDays, 
  MapPin, 
  ShieldCheck, 
  Loader2, 
  Database, 
  FileSpreadsheet,
  AlertTriangle
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
} from "recharts";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, getISOWeek, getISOWeekYear } from 'date-fns';
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
    if (profile?.role === 'super_admin') {
      fetchRegionalPulse();
    }
  }, [weekId, profile]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const year = getISOWeekYear(date);
    const week = getISOWeek(date);
    const formattedWeek = `${year}-${week.toString().padStart(2, '0')}`;
    setWeekId(formattedWeek);
  };

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
      'Status': c.status
    }));
    exportToCSV(filename, ledgerData);
    toast({ title: "Ledger Dispatched", description: "Consolidated regional data exported." });
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex h-[80vh] items-center justify-center p-10">
         <Card className="max-w-md border-destructive/20 bg-destructive/5 p-10 text-center space-y-6 rounded-[2rem]">
            <AlertTriangle className="size-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-black uppercase text-primary tracking-tighter">Privileged Hub Restricted</h2>
            <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed text-balance">
              Regional Analytics are restricted to active Super Administrative accounts only.
            </p>
         </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4 text-black">
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
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cycle</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-6 p-0 flex items-center gap-2 font-black text-black hover:bg-transparent">
                    <CalendarDays className="size-4 text-secondary" />
                    <span className="text-[16px]">{weekId}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar
                    mode="single"
                    onSelect={handleDateSelect}
                    initialFocus
                    className="bg-white"
                  />
                </PopoverContent>
              </Popover>
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
                 { label: 'Registered Hubs', value: stats?.totalOffices, sub: `${stats?.activeOffices} Active`, icon: MapPin, color: 'text-primary' },
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
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 text-muted-foreground">Gap identification per Hub.</CardDescription>
                     </CardHeader>
                     <CardContent className="p-10 space-y-6">
                        {comparison.map((c, i) => (
                          <div key={i} className="flex justify-between items-center group">
                             <div className="flex flex-col">
                                <span className="text-[12px] font-black uppercase text-black tracking-tight">{c.officeName}</span>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">{c.shortCode} Hub</span>
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
                   <CardDescription className="text-[11px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Detailed comparative ledger of all clinical cluster hubs.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto no-scrollbar">
                   <table className="w-full border-collapse">
                      <thead className="bg-slate-50/30">
                        <tr className="border-b border-slate-100">
                          <th className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left">ROC Hub</th>
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
        </Tabs>
      )}

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><Database size={240} className="text-slate-200" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-primary tracking-[0.4em]">Regional Governance Hub</p>
               <p className="text-lg font-bold text-black/70 leading-relaxed max-w-4xl tracking-tight">
                  "The Regional Command Center consolidates clinical deployment metrics across the ROC network. 
                  Calculations for 'Roster Coverage' explicitly identify centers where weekly cycle configurations 
                  are absent to maintain institutional compliance standards."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
