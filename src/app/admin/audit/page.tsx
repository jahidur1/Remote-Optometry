'use client';

import { useState } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, Filter, History, User, Activity, Download, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBadge } from '@/components/ui/demo-badge';

export default function AuditLogs() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: logs, loading } = useCollection(
    query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(200))
  );

  const filteredLogs = logs?.filter(log => {
    const text = `${log.actorId} ${log.action} ${log.targetId} ${JSON.stringify(log.details)}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8 pb-24 max-w-[1600px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary font-headline uppercase leading-none">Institutional Logs</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
             Immutable Trace Ledger • Security Compliance <ShieldCheck className="size-3 text-secondary" />
          </p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" className="bg-white border-2 border-primary/10 font-black uppercase text-[11px] tracking-widest h-12 px-8 rounded-xl hover:bg-muted transition-all">
                <Download className="size-4 mr-2" /> Export JSON Archive
            </Button>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
        <CardHeader className="bg-muted/30 border-b p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
               <History className="size-6" />
            </div>
            <CardTitle className="text-xl font-black uppercase tracking-tight">Compliance Ledger</CardTitle>
          </div>
          <div className="flex gap-3 w-full max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/40" />
                <Input 
                  placeholder="Search logs by actor or action..." 
                  className="pl-11 h-11 text-[11px] font-bold bg-white border-none shadow-inner rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="py-5 px-8 text-left">Actor Identity</th>
                <th className="px-8 text-left">Administrative Action</th>
                <th className="px-8 text-left">Target ID</th>
                <th className="px-8 text-right pr-12">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/30">
              {loading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={4} className="p-8"><Skeleton className="h-8 w-full rounded-xl" /></td></tr>
                ))
              ) : filteredLogs?.length === 0 ? (
                <tr><td colSpan={4} className="py-32 text-center opacity-20 italic font-black uppercase text-xs tracking-widest">No matching audit records found.</td></tr>
              ) : (
                filteredLogs?.map((log) => (
                  <tr key={log.id} className="group hover:bg-muted/10 transition-colors">
                    <td className="py-6 px-8">
                       <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                             <User className="size-4" />
                          </div>
                          <span className="font-black text-[12px] text-primary tracking-tight">{log.actorId}</span>
                       </div>
                    </td>
                    <td className="px-8">
                       <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5 px-3 py-1">
                          {log.action.replace(/_/g, ' ')}
                       </Badge>
                    </td>
                    <td className="px-8">
                       <code className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                          {log.targetId}
                       </code>
                    </td>
                    <td className="px-8 text-right pr-12 text-[10px] font-black text-muted-foreground tabular-nums">
                       {log.timestamp?.toDate?.()?.toLocaleString() || new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="p-8 rounded-[2rem] bg-primary text-primary-foreground relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <ShieldCheck size={180} />
         </div>
         <div className="flex gap-8 items-start relative z-10">
            <div className="size-16 rounded-[1.25rem] bg-secondary flex items-center justify-center shadow-2xl shrink-0">
               <Info className="size-8 text-white" />
            </div>
            <div className="space-y-3">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.3em]">Governance Protocol</p>
               <p className="text-sm font-medium leading-relaxed opacity-70 max-w-2xl uppercase tracking-tight">
                  "Audit logs are immutable server-side records. Every administrative transaction, 
                  including roster publication and session revocation, is strictly recorded with 
                  temporal integrity markers."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
