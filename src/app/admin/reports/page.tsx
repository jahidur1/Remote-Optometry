'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileDown, BarChart3, Users, Clock, ShieldCheck, Download, 
  Search, AlertCircle, FileSpreadsheet, TrendingUp, Filter, CalendarCheck, MapPin
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';
import { exportRosterReport, exportToCSV } from '@/lib/export-utils';
import { logAudit } from '@/lib/audit';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function ReportsPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [weekId, setWeekId] = useState('2024-52');
  const [exporting, setExporting] = useState(false);

  // Fetch Master Data
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: publishedRosters, loading: rosterLoading } = useCollection(
    query(collection(db, 'published_rosters'), where('weekId', '==', weekId), orderBy('publishedAt', 'desc'))
  );
  const { data: shifts } = useCollection(query(collection(db, 'shift_master'), orderBy('displayOrder')));
  const { data: logs } = useCollection(query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc')));
  const { data: bookings } = useCollection(query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)));

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
    const offices = ["Kolkata ROC", "Gurgaon ROC", "Lucknow ROC"];
    return offices.map(office => ({
      name: office,
      value: employees.filter(e => e.office === office).length
    }));
  }, [employees]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#94a3b8', '#64748b', '#475569'];

  const handleExportRoster = async () => {
    if (!activeRoster || !employees || !shifts || !bookings) {
      toast({ title: "Insufficient Data", description: "Publish a roster and ensure FCFS bookings exist first.", variant: "destructive" });
      return;
    }

    setExporting(true);
    try {
      exportRosterReport(`ROC_Institutional_Roster_W${weekId}`, activeRoster.assignments, employees, shifts, bookings);
      logAudit(db, profile?.uid || 'system', 'EXPORT_ROSTER_REPORT', weekId, { format: 'xlsx' });
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
        LogID: d.id,
        Actor: d.data().actorId,
        Action: d.data().action,
        Target: d.data().targetId,
        Timestamp: d.data().timestamp?.toDate?.()?.toISOString() || d.data().timestamp,
        Metadata: JSON.stringify(d.data().details || {})
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

  return (
    <div className="space-y-8 pb-24 max-w-[1600px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary font-headline uppercase leading-none">Institutional Analytics</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
             Authorized Workforce Node • Reporting Suite <TrendingUp className="size-3 text-secondary" />
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border shadow-sm">
           <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-muted-foreground px-2">Data Cycle</label>
              <Input 
                className="w-32 h-10 font-black text-secondary border-none bg-secondary/5 focus-visible:ring-0" 
                value={weekId} 
                onChange={(e) => setWeekId(e.target.value)}
              />
           </div>
           <Button className="bg-secondary shadow-xl shadow-secondary/20 h-10 px-8 font-black uppercase tracking-widest mt-auto transition-all hover:scale-105 active:scale-95" onClick={handleExportRoster} disabled={exporting || rosterLoading}>
             <FileSpreadsheet className="mr-3 h-5 w-5" /> {exporting ? 'Exporting...' : 'Export Excel'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] glass-card">
          <CardHeader className="bg-primary p-6 text-primary-foreground border-none">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
              <BarChart3 className="size-4 text-secondary" /> Shift Load distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 h-[360px]">
             {activeRoster ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={distributionData} layout="vertical" margin={{ left: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted))" />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: 'hsl(var(--primary))' }} width={80} />
                   <Tooltip cursor={{ fill: 'hsl(var(--secondary)/0.05)' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                   <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="hsl(var(--secondary))" barSize={20} />
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center opacity-20"><Clock className="size-16 animate-pulse" /></div>
             )}
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] glass-card">
          <CardHeader className="bg-primary p-6 text-primary-foreground border-none">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
              <MapPin className="size-4 text-secondary" /> Cluster footprint
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 h-[360px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={officeStats} innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">
                   {officeStats.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip />
                 <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
               </PieChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] glass-card flex flex-col">
          <CardHeader className="bg-primary p-6 text-primary-foreground border-none">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
              <ShieldCheck className="size-4 text-secondary" /> Governance Pulse
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex-1 flex flex-col justify-between">
             <div className="space-y-6">
                <div className="flex justify-between items-center p-4 rounded-2xl bg-muted/30 border border-dashed">
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Notification Success</p>
                      <p className="text-2xl font-black text-emerald-600">{logs?.filter(l => l.status === 'success').length || 0} API OK</p>
                   </div>
                   <Badge className="bg-emerald-500 font-black text-[9px] uppercase px-3 shadow-lg shadow-emerald-500/20">Live</Badge>
                </div>
                <div className="flex justify-between items-center p-4 rounded-2xl bg-muted/30 border border-dashed">
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">FCFS Reservations</p>
                      <p className="text-2xl font-black text-secondary">{bookings?.length || 0} CONFIRMED</p>
                   </div>
                   <CalendarCheck className="size-6 text-secondary opacity-30" />
                </div>
             </div>
             <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-[0.2em] h-12 border-2 rounded-xl hover:bg-primary hover:text-white transition-all" onClick={handleExportAudit}>
               <FileDown className="mr-3 h-4 w-4" /> Export Complete Audit Trail
             </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card mx-2">
        <CardHeader className="bg-muted/30 border-b p-8 flex flex-row items-center justify-between">
           <div className="space-y-1">
              <CardTitle className="text-xl font-black uppercase tracking-tight leading-none">Clinical Availability Ledger</CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest opacity-60">Comparative analysis of active clinical capacity vs secured off-days.</CardDescription>
           </div>
           <AlertCircle className="size-8 text-primary/10" />
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="py-5 px-8 text-left border-r">Clinical Professional</th>
                <th className="px-8 text-left border-r">Unit / Designation</th>
                <th className="px-8 text-center border-r">FCFS Record</th>
                <th className="px-8 text-center border-r">Roster Status</th>
                <th className="px-8 text-right pr-12">Institutional Node</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/30">
              {empLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="p-8"><Skeleton className="h-6 w-full rounded-full" /></td></tr>
                ))
              ) : employees?.map(emp => {
                const hasOff = bookings?.some(b => b.employeeId === emp.id);
                const hasAssignments = activeRoster?.assignments?.some((a: any) => a.employeeId === emp.id);

                return (
                  <tr key={emp.id} className="group hover:bg-muted/10 transition-colors">
                    <td className="py-6 px-8 border-r">
                      <div className="flex flex-col">
                        <span className="font-black text-[13px] tracking-tight text-primary group-hover:translate-x-1 transition-transform">{emp.fullName}</span>
                        <span className="text-[10px] font-black text-secondary uppercase opacity-70">{emp.id}</span>
                      </div>
                    </td>
                    <td className="px-8 border-r">
                      <div className="flex flex-col gap-1">
                         <span className="text-[11px] font-black text-foreground/80 uppercase">{emp.office}</span>
                         <span className="text-[9px] font-bold text-muted-foreground uppercase">{emp.department}</span>
                      </div>
                    </td>
                    <td className="px-8 text-center border-r">
                       {hasOff ? (
                         <Badge className="bg-emerald-500 font-black text-[9px] uppercase shadow-inner">SECURED</Badge>
                       ) : (
                         <span className="text-[10px] font-black text-destructive/30 italic">PENDING</span>
                       )}
                    </td>
                    <td className="px-8 border-r">
                      <div className="flex items-center justify-center gap-3">
                         <div className={`size-2.5 rounded-full ${hasAssignments ? 'bg-secondary shadow-[0_0_10px_blue]' : 'bg-muted'}`} />
                         <span className="text-[10px] font-black uppercase text-foreground/70">
                            {hasAssignments ? 'DEPLOYED' : 'UNASSIGNED'}
                         </span>
                      </div>
                    </td>
                    <td className="px-8 text-right pr-12">
                      <Badge variant="outline" className="text-[8px] font-mono font-black border-primary/10 text-primary/40 uppercase">NODE: {emp.office?.substring(0,3)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
