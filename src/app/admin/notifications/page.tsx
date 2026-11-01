
'use client';

import { useState } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, BellRing, AlertCircle, RefreshCcw, CheckCircle2, XCircle, Search, Filter, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';

export default function NotificationDashboard() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const logsQuery = query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(50));
  const { data: logs, loading } = useCollection(logsQuery);
  const { data: employees } = useCollection(query(collection(db, 'employees')));

  const filteredLogs = logs?.filter(log => {
    const emp = employees?.find(e => e.id === log.employeeId);
    return emp?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           log.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Notification Hub</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Monitoring automated WhatsApp shift briefings via Meta Cloud API.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="bg-white border-secondary/20 text-secondary">
                <RefreshCcw className="size-4 mr-2" /> Sync Delivery Status
            </Button>
            <Button className="bg-secondary shadow-lg shadow-secondary/10">
                <BellRing className="size-4 mr-2" /> Trigger Manual Broadcast
            </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Successful Dispatches</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-black text-emerald-600">{logs?.filter(l => l.status === 'success').length || 0}</div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Last 24 Hours</p>
              </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Failed Deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-black text-destructive">{logs?.filter(l => l.status === 'failed').length || 0}</div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Requires Attention</p>
              </CardContent>
          </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-secondary" />
            <CardTitle className="text-lg">Delivery Logs (Meta Cloud API)</CardTitle>
          </div>
          <div className="flex gap-2 w-full max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter by professional..." 
                  className="pl-8 h-9 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="uppercase text-[10px] font-black tracking-widest">
                <TableHead>Professional</TableHead>
                <TableHead>Masked Number</TableHead>
                <TableHead>Shift Date</TableHead>
                <TableHead>Roster Ver.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Timestamp (IST)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">No dispatches recorded in the current window.</TableCell>
                </TableRow>
              ) : (
                filteredLogs?.map((log, i) => {
                  const emp = employees?.find(e => e.id === log.employeeId);
                  return (
                    <TableRow key={i} className="hover:bg-muted/5 group">
                      <TableCell>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm">{emp?.fullName || log.employeeId}</span>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{log.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.maskedPhone}</TableCell>
                      <TableCell className="text-xs font-bold">{log.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-black uppercase">V{log.rosterVersion.slice(-4)}</Badge>
                      </TableCell>
                      <TableCell>
                         {log.status === 'success' ? (
                           <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase">
                              <CheckCircle2 className="size-3" /> Delivered
                           </div>
                         ) : (
                           <div className="flex items-center gap-1.5 text-destructive font-black text-[10px] uppercase">
                              <XCircle className="size-3" /> Failed
                           </div>
                         )}
                      </TableCell>
                      <TableCell className="text-right text-[10px] font-medium text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="p-4 rounded-xl bg-muted/50 border border-dashed flex gap-4 items-start">
         <AlertCircle className="size-5 text-muted-foreground shrink-0 mt-0.5" />
         <div className="space-y-1">
            <p className="text-xs font-black text-primary uppercase">Automated Dispatch Policy</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Briefings are dispatched daily at 22:00 Asia/Kolkata using the most recent **Authorized Publication**. 
              If a correction version is published after 22:00, manual sync is required to notify affected professionals. 
              Duplicate prevention is enforced via roster version idempotency keys.
            </p>
         </div>
      </div>
    </div>
  );
}
