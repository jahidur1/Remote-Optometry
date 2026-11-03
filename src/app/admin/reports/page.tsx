'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, Users, Clock, ShieldCheck, Download, 
  Search, FileSpreadsheet, MapPin, Activity, Zap, 
  Database, ArrowUpRight, CheckCircle2, Globe, Filter, AlertCircle,
  CalendarDays
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';
import { exportRosterReport, exportToCSV } from '@/lib/export-utils';
import { logAudit } from '@/lib/audit';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [weekId, setWeekId] = useState('2024-52');
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Stable Authoritative Fetch
  const empQuery = useMemo(() => query(collection(db, 'employees'), where('status', '==', 'Active')), [db]);
  const rosterQuery = useMemo(() => query(collection(db, 'published_rosters'), where('weekId', '==', weekId), orderBy('publishedAt', 'desc')), [db, weekId]);
  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const logQuery = useMemo(() => query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc')), [db]);
  const bookQuery = useMemo(() => query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)), [db, weekId]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: publishedRosters, loading: rosterLoading } = useCollection(rosterQuery);
  const { data: shifts } = useCollection(shiftQuery);
  const { data: logs } = useCollection(logQuery);
  const { data: bookings } = useCollection(bookQuery);

  const activeRoster = publishedRosters?.[0];

  const distributionData = useMemo(() => {
    if (!shifts || !activeRoster) return [];
    return shifts.map(s => ({
      name: s.name,
      count: activeRoster.assignments.filter((a: any) => a.shiftId === s.id).length
    }));
  }, [shifts, activeRoster]);

  const officeStats = useMemo(() => {
    if (!employees) return [];
    const offices = ["KOLKATA_ROC", "GURGAON_ROC", "LUCKNOW_ROC"];
    return offices.map(office => ({
      name: office.replace('_', ' '),
      value: employees.filter(e => e.office === office).length
    }));
  }, [employees]);

  const COLORS = ['hsl(var(--secondary))', 'hsl(var(--accent))', '#3B82F6', '#14B8A6'];

  const stats = useMemo(() => {
    const totalEmp = employees?.length || 0;
    const confirmedOffs = bookings?.length || 0;
    const apiSuccess = logs?.filter(l => l.status === 'success').length || 0;
    const successRate = logs && logs.length > 0 ? Math.round((apiSuccess / logs.length) * 100) : 100;

    return {
      totalEmp,
      confirmedOffs,
      successRate,
      deploymentCount: activeRoster?.assignments?.length || 0
    };
  }, [employees, bookings, logs, activeRoster]);

  const handleExportRoster = async () => {
    if (!activeRoster || !employees || !shifts || !bookings) {
      toast({ title: "Insufficient Data", description: "Publish a roster and ensure FCFS bookings exist first.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      exportRosterReport(`ROC_Institutional_Roster_W${weekId}`, activeRoster.assignments, employees, shifts, bookings);
      logAudit(db, profile?.uid || 'system', 'EXPORT_ROSTER_REPORT', weekId);
      toast({ title: "Export Successful", description: "Excel report generated and downloaded." });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAudit = async () => {
    setExporting(true);
    try {
      const auditSnap = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc')));
      const auditData = auditSnap.docs.map(d => ({
        LogID: d.id, Actor: d.data().actorId, Action: d.data().action,
        Target: d.data().targetId, Timestamp: d.data().timestamp?.toDate?.()?.toISOString() || d.data().timestamp
      }));
      exportToCSV(`ROC_Audit_Trail_Export`, auditData);
      logAudit(db, profile?.uid || 'system', 'EXPORT_AUDIT_LOG', 'enterprise');
      toast({ title: "Audit Trail Exported" });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const filteredEmployees = employees?.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-10 animate-in max-w-[1600px] mx-auto pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <BarChart3 className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Analytics Hub</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Intelligence Node <Activity className="size-3 text-secondary animate-pulse" />
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
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">LIVE SYNC</span>
              </div>
           </div>
           <Button 
            className="bg-secondary text-white shadow-xl shadow-secondary/20 h-10 px-6 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
            onClick={handleExportRoster} 
            disabled={exporting || rosterLoading}
           >
             <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Clinical Pool', value: stats.totalEmp, sub: 'Authorized Staff', icon: Users, color: 'text-primary' },
          { label: 'Confirmed Week-Offs', value: stats.confirmedOffs, sub: 'FCFS Secured', icon: CalendarDays, color: 'text-secondary' },
          { label: 'Deployment Rate', value: stats.deploymentCount, sub: 'Active Shifts', icon: Zap, color: 'text-secondary' },
          { label: 'API Efficiency', value: `${stats.successRate}%`, sub: 'Transmission Rate', icon: Globe, color: 'text-black' }
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

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
          <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.25em] text-black">Shift Load distribution</CardTitle>
              <CardDescription className="text-[9px] font-black uppercase mt-1 text-muted-foreground tracking-widest">Assignment frequency per node.</CardDescription>
            </div>
            <BarChart3 className="size-5 text-secondary opacity-50" />
          </CardHeader>
          <CardContent className="p-8 h-[360px]">
             {activeRoster ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={distributionData} layout="vertical" margin={{ left: 10, right: 30 }}>
                   <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                   <XAxis type="number" hide />
                   <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontBold: 900, fill: 'rgba(0,0,0,0.5)' }} 
                    width={80} 
                   />
                   <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }} 
                    contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 900, color: '#000', textTransform: 'uppercase' }}
                   />
                   <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="hsl(var(--secondary))" barSize={18} />
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex flex-col items-center justify-center opacity-10 space-y-4">
                  <Clock className="size-16 animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Pulse Data</p>
               </div>
             )}
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
          <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.25em] text-black">Cluster footprint</CardTitle>
              <CardDescription className="text-[9px] font-black uppercase mt-1 text-muted-foreground tracking-widest">Staff proportional distribution.</CardDescription>
            </div>
            <MapPin className="size-5 text-accent opacity-50" />
          </CardHeader>
          <CardContent className="p-8 h-[360px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={officeStats} innerRadius={70} outerRadius={105} paddingAngle={10} dataKey="value" stroke="none">
                   {officeStats.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                   ))}
                 </Pie>
                 <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '1rem' }} />
                 <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', paddingTop: '20px', letterSpacing: '0.1em' }} />
               </PieChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card flex flex-col">
          <CardHeader className="bg-primary p-8 text-primary-foreground border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5"><ShieldCheck size={160} /></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="size-10 rounded-xl bg-secondary flex items-center justify-center shadow-2xl">
                <ShieldCheck className="size-5 text-white" />
              </div>
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary">Governance Pulse</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8 flex-1 flex flex-col justify-between space-y-8">
             <div className="space-y-4">
                <div className="flex justify-between items-center p-5 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-slate-100 transition-all">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Notification Pulse</p>
                      <p className="text-xl font-black text-emerald-600 tracking-tighter">{logs?.filter(l => l.status === 'success').length || 0} API OK</p>
                   </div>
                   <Badge className="bg-emerald-500 text-white font-black text-[8px] uppercase px-3 py-1 rounded-full shadow-lg animate-pulse">Live</Badge>
                </div>
                <div className="flex justify-between items-center p-5 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-slate-100 transition-all">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">FCFS Reservations</p>
                      <p className="text-xl font-black text-secondary tracking-tighter">{bookings?.length || 0} SECURED</p>
                   </div>
                   <div className="size-8 rounded-lg bg-secondary/10 flex items-center justify-center"><CheckCircle2 className="size-4 text-secondary" /></div>
                </div>
             </div>
             <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-[0.25em] h-12 border-slate-200 hover:bg-slate-50 text-black rounded-xl transition-all" onClick={handleExportAudit}>
               <Download className="mr-2 h-4 w-4" /> Export Complete Audit Trail
             </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
                <Database className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black uppercase tracking-tight text-black leading-none">Availability Ledger</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-2">Verified cluster capacity vs secured off-days.</CardDescription>
              </div>
           </div>
           <div className="flex gap-4 w-full max-w-md">
              <div className="relative w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300 group-focus-within:text-secondary transition-colors" />
                <Input 
                  placeholder="Filter Professional Identity..." 
                  className="pl-12 h-12 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-xl focus:border-secondary transition-all text-black placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/30 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground border-b border-slate-100">
                <th className="py-6 px-10 text-left border-r border-slate-100">Professional Identity</th>
                <th className="px-10 text-left border-r border-slate-100">Unit / Designation</th>
                <th className="px-10 text-center border-r border-slate-100">FCFS Record</th>
                <th className="px-10 text-center border-r border-slate-100">Roster Status</th>
                <th className="px-10 text-right pr-12">Institutional Node</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="p-10"><Skeleton className="h-10 w-full rounded-2xl bg-slate-50" /></td></tr>
                ))
              ) : filteredEmployees?.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center opacity-10 italic font-black uppercase text-xs">No matching records found.</td></tr>
              ) : (
                filteredEmployees?.map(emp => {
                  const hasOff = bookings?.some(b => b.employeeId === emp.id);
                  const hasAssignments = activeRoster?.assignments?.some((a: any) => a.employeeId === emp.id);
                  return (
                    <tr key={emp.id} className="group hover:bg-slate-50 transition-all duration-300">
                      <td className="py-8 px-10 border-r border-slate-100">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-[16px] text-black tracking-tight group-hover:translate-x-2 transition-transform leading-none">{emp.fullName}</span>
                          <span className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-60">{emp.id}</span>
                        </div>
                      </td>
                      <td className="px-10 border-r border-slate-100">
                        <div className="flex flex-col gap-1.5">
                           <span className="text-[12px] font-black text-black/80 uppercase tracking-tight">{emp.office?.replace('_', ' ')}</span>
                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{emp.department}</span>
                        </div>
                      </td>
                      <td className="px-10 border-r border-slate-100 text-center">
                         {hasOff ? (
                           <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase px-5 py-1.5 rounded-full">SECURED</Badge>
                         ) : (
                           <span className="text-[10px] font-black text-destructive/40 uppercase tracking-widest italic opacity-40">PENDING</span>
                         )}
                      </td>
                      <td className="px-10 border-r border-slate-100">
                        <div className="flex items-center justify-center gap-4">
                           <div className={cn("size-2.5 rounded-full transition-all duration-500", hasAssignments ? 'bg-secondary shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-slate-100')} />
                           <span className="text-[10px] font-black uppercase text-black/60 tracking-widest">{hasAssignments ? 'DEPLOYED' : 'UNASSIGNED'}</span>
                        </div>
                      </td>
                      <td className="px-10 text-right pr-12">
                        <Badge variant="outline" className="text-[9px] font-mono font-black border-slate-100 text-black/30 uppercase px-4 py-1.5 rounded-xl">NODE_{emp.office?.substring(0,3)}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><ShieldCheck size={280} className="text-primary" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ArrowUpRight className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Institutional Data Integrity</p>
               <p className="text-lg font-bold text-black/80 leading-relaxed max-w-4xl tracking-tight">
                  "Analytics are synchronized across all ROC nodes in real-time. Every data point represents a 
                  verified transaction within the clinical registry, including FCFS slot reservations and 
                  deterministic CP-SAT optimization results."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}