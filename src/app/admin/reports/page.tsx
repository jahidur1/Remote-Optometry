
'use client';

import { useState } from 'react';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, BarChart3, Users, Clock, ShieldCheck, Download, Search, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';
import { exportRosterReport, exportToCSV } from '@/lib/export-utils';
import { logAudit } from '@/lib/audit';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [weekId, setWeekId] = useState('2024-52');
  const [exporting, setExporting] = useState(false);

  // Fetch data for reports
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: publishedRosters, loading: rosterLoading } = useCollection(
    query(collection(db, 'published_rosters'), where('weekId', '==', weekId), orderBy('publishedAt', 'desc'))
  );
  const { data: shifts } = useCollection(query(collection(db, 'shift_master'), orderBy('displayOrder')));
  const { data: logs } = useCollection(query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc')));
  const { data: bookings } = useCollection(query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)));

  const activeRoster = publishedRosters?.[0];

  const handleExportRoster = async () => {
    if (!activeRoster || !employees || !shifts || !bookings) {
      toast({ title: "Insufficient Data", description: "No published roster or professional records found for this week.", variant: "destructive" });
      return;
    }

    setExporting(true);
    try {
      exportRosterReport(`ROC_Enterprise_Roster_Week_${weekId}`, activeRoster.assignments, employees, shifts, bookings);
      logAudit(db, profile?.uid || 'system', 'EXPORT_ROSTER_REPORT', weekId, { format: 'xlsx', version: activeRoster.version });
      toast({ title: "Export Complete", description: "Standardized roster report downloaded successfully." });
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
        ActorID: d.data().actorId,
        Action: d.data().action,
        TargetID: d.data().targetId,
        Timestamp: d.data().timestamp?.toDate?.()?.toISOString() || d.data().timestamp,
        Metadata: JSON.stringify(d.data().details || {})
      }));
      exportToCSV(`ROC_Audit_Trail`, auditData);
      logAudit(db, profile?.uid || 'system', 'EXPORT_AUDIT_LOG', 'enterprise');
      toast({ title: "Export Complete", description: "Authorized audit trail downloaded." });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Enterprise Reporting Hub</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Authorized clinical analytics and workforce data extraction.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Target Cycle</label>
             <Input 
               className="w-32 h-10 font-black text-secondary bg-white border-2 border-secondary/20" 
               value={weekId} 
               onChange={(e) => setWeekId(e.target.value)}
             />
           </div>
           <Button className="bg-secondary shadow-lg shadow-secondary/10 h-10 mt-auto font-black uppercase tracking-widest px-6" onClick={handleExportRoster} disabled={exporting || rosterLoading}>
             <FileSpreadsheet className="mr-2 h-4 w-4" /> {exporting ? 'Generating...' : 'Export Excel'}
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-md border-t-4 border-t-primary overflow-hidden">
          <CardHeader className="bg-muted/5 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Shift Distribution Load
            </CardTitle>
            <CardDescription className="text-[10px] font-bold">Assignment volume per shift for Week {weekId}.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
             <div className="space-y-4">
               {shifts?.map(shift => {
                 const count = activeRoster?.assignments?.filter((a: any) => a.shiftId === shift.id).length || 0;
                 return (
                   <div key={shift.id} className="space-y-1.5">
                     <div className="flex items-center justify-between text-[11px] font-black uppercase">
                       <span className="text-muted-foreground">{shift.name}</span>
                       <span className="text-secondary">{count} slots</span>
                     </div>
                     <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${(count / (employees?.length || 1)) * 100}%` }}
                        />
                     </div>
                   </div>
                 );
               })}
             </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-t-4 border-t-secondary">
          <CardHeader className="bg-muted/5 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="size-4 text-secondary" /> System Governance
            </CardTitle>
            <CardDescription className="text-[10px] font-bold">Audit and communication performance metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
             <div className="p-4 rounded-xl bg-muted/20 border border-dashed space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Notification Success</span>
                  <Badge className="bg-emerald-500 font-black text-[10px] px-3">
                    {logs?.filter(l => l.status === 'success').length || 0} API OK
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Active Professionals</span>
                  <span className="text-sm font-black text-primary">{employees?.length || 0} AUTHORIZED</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dashed">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">FCFS Reservations</span>
                  <span className="text-sm font-black text-secondary">{bookings?.length || 0} CONFIRMED</span>
                </div>
             </div>
             <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest h-10 border-2 hover:bg-muted" onClick={handleExportAudit}>
               <FileDown className="mr-2 h-4 w-4" /> Download Audit Trail
             </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md border-t-4 border-t-accent bg-accent/5">
          <CardHeader className="bg-white/50 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-accent-foreground">
              <Clock className="size-4 text-accent" /> Schedule Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 text-center">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Version</p>
                <p className="text-3xl font-black text-primary italic tracking-tighter">
                  {activeRoster ? `V${activeRoster.version.toString().slice(-4)}` : 'DRAFT ONLY'}
                </p>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Publication IST</p>
                <p className="text-sm font-bold text-foreground/80">
                  {activeRoster ? new Date(activeRoster.publishedAt).toLocaleString('en-IN') : 'N/A'}
                </p>
             </div>
             <div className="pt-2">
                <Badge variant={activeRoster ? "default" : "destructive"} className={`text-[10px] font-black uppercase tracking-widest px-6 py-1 ${activeRoster ? 'bg-accent text-accent-foreground' : ''}`}>
                  {activeRoster ? 'LIVE ON PORTAL' : 'AWAITING APPROVAL'}
                </Badge>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md overflow-hidden border-2 border-muted">
        <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
           <div>
              <CardTitle className="text-base uppercase font-black tracking-tight">Professional Availability Ledger</CardTitle>
              <CardDescription className="text-[10px] font-bold">Snapshot of active clinical capacity vs system-protected records.</CardDescription>
           </div>
           <AlertCircle className="size-5 text-muted-foreground/30" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50 border-b">
              <TableRow className="uppercase text-[10px] font-black tracking-[0.1em]">
                <TableHead className="pl-6">Professional</TableHead>
                <TableHead>Clinical Pool</TableHead>
                <TableHead>Weekly-Off Status</TableHead>
                <TableHead>Roster Status</TableHead>
                <TableHead className="text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="py-4"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
              ) : employees?.map(emp => {
                const hasOff = bookings?.some(b => b.employeeId === emp.id);
                const hasAssignments = activeRoster?.assignments?.some((a: any) => a.employeeId === emp.id);

                return (
                  <TableRow key={emp.id} className="hover:bg-muted/5 group transition-colors border-b last:border-0">
                    <TableCell className="pl-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-[13px] tracking-tight text-foreground">{emp.fullName}</span>
                        <span className="text-[10px] font-black text-muted-foreground uppercase">{emp.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-muted-foreground/20 text-muted-foreground">
                        {emp.department || 'CLINICAL'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       {hasOff ? (
                         <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase tracking-widest">
                            <Clock className="size-3" /> Reserved
                         </div>
                       ) : (
                         <span className="text-[9px] font-black uppercase text-muted-foreground/40 italic">Not Booked</span>
                       )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                         <div className={`size-2 rounded-full ${hasAssignments ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted'}`} />
                         <span className="text-[10px] font-black uppercase text-foreground/70">
                            {hasAssignments ? 'AUTHORIZED' : 'STANDBY'}
                         </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                        View History
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
