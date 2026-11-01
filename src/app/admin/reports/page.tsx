
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, BarChart3, Users, Clock, ShieldCheck, Download, Search } from "lucide-react";
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

  const activeRoster = publishedRosters?.[0];

  const handleExportRoster = async () => {
    if (!activeRoster || !employees || !shifts) {
      toast({ title: "No Data", description: "No published roster found for this week.", variant: "destructive" });
      return;
    }

    setExporting(true);
    try {
      exportRosterReport(`ROC_Roster_Week_${weekId}`, activeRoster.assignments, employees, shifts);
      logAudit(db, profile?.uid || 'system', 'EXPORT_ROSTER_REPORT', weekId, { format: 'csv' });
      toast({ title: "Export Complete", description: "Roster report downloaded successfully." });
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
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.()?.toISOString() || d.data().timestamp
      }));
      exportToCSV('System_Audit_Log', auditData);
      logAudit(db, profile?.uid || 'system', 'EXPORT_AUDIT_LOG', 'system');
      toast({ title: "Export Complete", description: "Audit trail downloaded." });
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Enterprise Reporting</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Authorized clinical analytics and roster data exports.</p>
        </div>
        <div className="flex items-center gap-2">
           <Input 
             className="w-32 h-9 font-bold text-secondary" 
             value={weekId} 
             onChange={(e) => setWeekId(e.target.value)}
           />
           <Button className="bg-secondary shadow-lg shadow-secondary/10" onClick={handleExportRoster} disabled={exporting || rosterLoading}>
             <Download className="mr-2 h-4 w-4" /> {exporting ? 'Generating...' : 'Export Weekly Roster'}
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-md border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" /> Shift Distribution
            </CardTitle>
            <CardDescription>Assignment counts per shift type for Week {weekId}.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
               {shifts?.map(shift => {
                 const count = activeRoster?.assignments?.filter((a: any) => a.shiftId === shift.id).length || 0;
                 return (
                   <div key={shift.id} className="flex items-center justify-between">
                     <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{shift.name}</span>
                     <Badge variant="outline" className="font-black text-secondary">{count} slots</Badge>
                   </div>
                 );
               })}
             </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-t-4 border-t-secondary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="size-5 text-secondary" /> System Governance
            </CardTitle>
            <CardDescription>Audit trails and communication performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-4 rounded-xl bg-muted/20 border border-dashed space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Notification Success</span>
                  <span className="text-sm font-black text-emerald-600">
                    {logs?.filter(l => l.status === 'success').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Total Professionals</span>
                  <span className="text-sm font-black text-primary">{employees?.length || 0}</span>
                </div>
             </div>
             <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest" onClick={handleExportAudit}>
               <FileDown className="mr-2 h-4 w-4" /> Download Audit History
             </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md border-t-4 border-t-accent bg-accent/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-accent-foreground">
              <Clock className="size-5 text-accent" /> Roster Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Version</p>
                <p className="text-xl font-black text-primary italic">
                  {activeRoster ? `V${activeRoster.version.toString().slice(-4)}` : 'N/A'}
                </p>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Publication Date</p>
                <p className="text-sm font-bold text-foreground/80">
                  {activeRoster ? new Date(activeRoster.publishedAt).toLocaleDateString() : 'Draft Only'}
                </p>
             </div>
             <div className="pt-2">
                <Badge className="bg-accent text-[9px] font-black uppercase tracking-widest px-3">
                  {activeRoster ? 'LIVE ON PORTAL' : 'AWAITING APPROVAL'}
                </Badge>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md overflow-hidden">
        <CardHeader className="bg-muted/5 border-b">
           <CardTitle className="text-base uppercase font-black">Professional Availability Ledger</CardTitle>
           <CardDescription>Current snapshot of clinical capacity vs authorized leave.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="uppercase text-[10px] font-black tracking-widest">
                <TableHead>Professional</TableHead>
                <TableHead>Clinical Pool</TableHead>
                <TableHead>Roster Status</TableHead>
                <TableHead className="text-right">Action Log</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
              ) : employees?.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{emp.fullName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{emp.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter">
                      {emp.department || 'CLINICAL'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                       <span className="text-[10px] font-black uppercase text-foreground/70">AUTHORIZED</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      View History
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
