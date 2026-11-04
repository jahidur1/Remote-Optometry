
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  Search, 
  History, 
  User, 
  Activity, 
  Download, 
  Info, 
  Zap, 
  Terminal, 
  Database, 
  Clock,
  Filter,
  Server
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

export default function AuditLogs() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const q = useMemo(() => query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(200)), [db]);
  const { data: logs, loading } = useCollection(q);

  const filteredLogs = useMemo(() => {
    return logs?.filter(log => {
      const text = `${log.actorId} ${log.action} ${log.targetId} ${JSON.stringify(log.details)}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    });
  }, [logs, searchTerm]);

  const stats = useMemo(() => {
    if (!logs) return { total: 0, actors: 0, actions: 0 };
    const uniqueActors = new Set(logs.map(l => l.actorId)).size;
    return {
      total: logs.length,
      actors: uniqueActors,
    };
  }, [logs]);

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4">
      {/* Precision Header Hub */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <History className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Institutional Logs</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Immutable Trace Ledger <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Protocol Status</label>
              <div className="flex items-center gap-3">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ENFORCED</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Registry Sync</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ACTIVE PULSE</span>
              </div>
           </div>
           <Button 
             variant="outline"
             className="bg-white border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl transition-all hover:bg-slate-50 shadow-sm" 
           >
            <Download className="size-4 mr-2" /> EXPORT JSON
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Trace Volume', value: stats.total, sub: 'Cached Events', icon: Database, color: 'text-primary' },
          { label: 'Active Actors', value: stats.actors, sub: 'Authorized IDs', icon: User, color: 'text-secondary' },
          { label: 'Sync Integrity', value: '100%', sub: 'Compliance Verified', icon: ShieldCheck, color: 'text-secondary' },
          { label: 'Protocol Hub', value: 'V2.0', sub: 'Enterprise Standard', icon: Zap, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /> : (
                <>
                  <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
              <Terminal className="size-8 text-secondary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-black leading-none">Ledger Matrix</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                 Real-time administrative transaction tracing.
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-4 w-full max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-secondary transition-colors" />
              <Input 
                placeholder="Search Identity or Event Pulse..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-secondary transition-all shadow-inner text-black placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50/30">
              <tr className="border-b border-slate-100">
                <th className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left">Actor Identity</th>
                <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left px-8">Administrative Action</th>
                <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left px-8">Target Hub</th>
                <th className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Execution Pulse (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array(10).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={4} className="py-8 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></td>
                  </tr>
                ))
              ) : filteredLogs?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-40 text-center">
                    <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No matching compliance records found in ledger.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0">
                    <td className="pl-10 py-8 border-r border-slate-100">
                       <div className="flex items-center gap-4">
                          <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-secondary/10 transition-all shadow-inner">
                             <User className="size-5 text-secondary" />
                          </div>
                          <div className="flex flex-col gap-1">
                             <span className="font-black text-[14px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{log.actorId}</span>
                             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{log.details?.platform || 'SYS_AUTH'}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 border-r border-slate-100">
                       <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5 px-4 py-1.5 rounded-lg tracking-widest shadow-inner group-hover:bg-secondary group-hover:text-white transition-all">
                          {log.action.replace(/_/g, ' ')}
                       </Badge>
                    </td>
                    <td className="px-8 border-r border-slate-100">
                       <div className="flex items-center gap-3">
                          <code className="text-secondary font-black text-[11px] bg-secondary/5 px-3 py-1 rounded-md border border-secondary/10 tracking-tighter">
                             {log.targetId}
                          </code>
                          <Zap className="size-3 text-accent opacity-30" />
                       </div>
                    </td>
                    <td className="text-right pr-12 py-8">
                       <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                             <Clock className="size-3.5 text-slate-300" />
                             <span className="text-[13px] font-black text-black/80 tabular-nums">
                                {log.timestamp?.toDate?.()?.toLocaleTimeString() || new Date(log.timestamp).toLocaleTimeString()}
                             </span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                             {log.timestamp?.toDate?.()?.toLocaleDateString() || new Date(log.timestamp).toLocaleDateString()}
                          </span>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><ShieldCheck size={280} className="text-primary" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Registry Protocol Hub</p>
               <p className="text-lg font-bold text-black/80 leading-relaxed max-w-4xl tracking-tight">
                  "Audit logs are immutably linked to the clinical cluster pulse. Every administrative transaction—including 
                  roster publication and session revocation—is strictly recorded with temporal integrity markers."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
