
'use client';

import { useState } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, BellRing, AlertCircle, RefreshCcw, CheckCircle2, XCircle, Search, Filter, Loader2, ArrowRight } from "lucide-react";
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
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Notification Hub</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Monitoring automated WhatsApp shift briefings via Meta Cloud API.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="bg-white border-secondary/20 text-secondary font-black uppercase text-[10px] tracking-widest">
                <RefreshCcw className="size-4 mr-2" /> Sync Delivery
            </Button>
            <Button className="bg-secondary shadow-lg shadow-secondary/10 font-black uppercase text-[10px] tracking-widest">
                <BellRing className="size-4 mr-2" /> Manual Broadcast
            </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Dispatched (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-3xl font-black text-emerald-600 tracking-tighter">
                    {logs?.filter(l => l.status === 'success').length || 0}
                  </div>
                  <Badge variant="outline" className="text-[8px] font-black uppercase mt-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                    Meta Verified
                  </Badge>
              </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Undelivered (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-3xl font-black text-destructive tracking-tighter">
                    {logs?.filter(l => l.status === 'failed').length || 0}
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black mt-1">Requires Validation</p>
              </CardContent>
          </Card>
          <Card className="md:col-span-2 bg-muted/20 border-dashed">
            <CardContent className="pt-6">
                <div className="flex gap-4 items-start">
                    <Info className="size-5 text-secondary mt-1 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">Dispatch Logic: 22:00 Asia/Kolkata</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                            System fetches tomorrow's shift from the **latest authorized roster**. 
                            If a newer version is published after 22:00, manual sync is recommended.
                            Duplicates are prevented via unique idempotency keys.
                        </p>
                    </div>
                </div>
            </CardContent>
          </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-secondary" />
            <CardTitle className="text-lg font-black uppercase tracking-tight">Meta Cloud API Logs</CardTitle>
          </div>
          <div className="flex gap-2 w-full max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter by professional name or ID..." 
                  className="pl-8 h-9 text-[11px] font-bold bg-white"
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
                <TableHead>Masked Endpoint</TableHead>
                <TableHead>Shift Target</TableHead>
                <TableHead>Ver.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Dispatch (IST)</TableHead>
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
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground italic font-medium uppercase text-xs tracking-widest">
                        No delivery logs found in the current window.
                    </TableCell>
                </TableRow>
              ) : (
                filteredLogs?.map((log, i) => {
                  const emp = employees?.find(e => e.id === log.employeeId);
                  return (
                    <TableRow key={i} className="hover:bg-muted/5 group border-b last:border-0 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                            <span className="font-black text-[13px] text-foreground tracking-tight">{emp?.fullName || log.employeeId}</span>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">{log.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] font-bold text-muted-foreground">{log.maskedPhone}</TableCell>
                      <TableCell className="text-[11px] font-black uppercase text-secondary">{log.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-secondary/20 text-secondary">
                            V{log.rosterVersion.slice(-4)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                         {log.status === 'success' ? (
                           <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase tracking-widest">
                              <CheckCircle2 className="size-3" /> Sent
                           </div>
                         ) : (
                           <div className="flex items-center gap-1.5 text-destructive font-black text-[9px] uppercase tracking-widest">
                              <XCircle className="size-3" /> Failed
                           </div>
                         )}
                      </TableCell>
                      <TableCell className="text-right text-[10px] font-black text-muted-foreground">
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

      <div className="p-6 rounded-2xl bg-primary text-primary-foreground shadow-xl relative overflow-hidden">
         <AlertCircle className="absolute -right-4 -bottom-4 size-32 opacity-5" />
         <div className="space-y-2 relative z-10">
            <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-accent">Automated Failure Mitigation</h5>
            <p className="text-[13px] leading-relaxed opacity-90 max-w-2xl">
              System automatically retries transient API failures (Code 500-503) up to three times with exponential backoff. 
              Persistent failures (Code 400, Invalid Recipient) trigger an administrative alert to human resources.
            </p>
         </div>
      </div>
    </div>
  );
}
