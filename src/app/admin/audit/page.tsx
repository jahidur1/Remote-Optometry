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
  ArrowUpRight,
  Clock,
  Filter
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
    const uniqueActions = new Set(logs.map(l => l.action)).size;
    return {
      total: logs.length,
      actors: uniqueActors,
      actions: uniqueActions
    };
  }, [logs]);

  return (
    <div className="space-y-8 pb-40 max-w-[1600px] mx-auto animate-in px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <History className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Institutional Logs</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Immutable Trace Ledger <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Protocol Status</label>
              <div className="flex items-center gap-3">
                 <span className="font-black text-secondary uppercase tracking-widest text-lg">ENFORCED</span>
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             variant="outline"
             className="bg-white/5 border-white/10 text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-xl transition-all hover:bg-secondary/20 hover:border-secondary" 
           >
            <Download className="size-4 mr-3" /> EXPORT JSON
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Trace Volume</CardTitle>
            <Database className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{stats.total}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Cached Transactions</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">Active Actors</CardTitle>
            <User className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent tracking-tighter">{stats.actors}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Unique Identities</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Sync Integrity</CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-500 opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">100%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Compliance Verified</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Protocol Version</CardTitle>
            <Zap className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">V2.0</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Enterprise Standard</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
        <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
              <Terminal className="size-8 text-secondary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">Ledger Matrix</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                 Real-time administrative transaction tracing.
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-4 w-full max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-white/20 group-focus-within:text-secondary transition-colors" />
              <Input 
                placeholder="Search Identity or Event Pulse..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white/[0.02] border-2 border-white/10 rounded-2xl focus:border-secondary focus:bg-secondary/5 transition-all shadow-inner text-white placeholder:text-white/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-14 w-14 shrink-0 border-2 border-white/10 rounded-2xl hover:bg-secondary/20 hover:border-secondary transition-all">
                <Filter className="size-5 text-white/40" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse">
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/5">
                <th className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-left">Actor Identity</th>
                <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-left px-8">Administrative Action</th>
                <th className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-left px-8">Target Node</th>
                <th className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Execution Pulse (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(10).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td colSpan={4} className="py-8 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /></td>
                  </tr>
                ))
              ) : filteredLogs?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-40 text-center">
                    <p className="text-white/10 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No matching compliance records found in ledger.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                    <td className="pl-10 py-8 border-r border-white/5">
                       <div className="flex items-center gap-4">
                          <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-secondary/20 transition-all shadow-inner">
                             <User className="size-5 text-secondary" />
                          </div>
                          <div className="flex flex-col gap-1">
                             <span className="font-black text-[14px] text-white tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{log.actorId}</span>
                             <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{log.details?.platform || 'NODE_SYS'}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 border-r border-white/5">
                       <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5 px-4 py-1.5 rounded-lg tracking-widest shadow-inner group-hover:bg-secondary group-hover:text-white transition-all">
                          {log.action.replace(/_/g, ' ')}
                       </Badge>
                    </td>
                    <td className="px-8 border-r border-white/5">
                       <div className="flex items-center gap-3">
                          <code className="text-[11px] font-black text-white/60 bg-white/5 px-3 py-1 rounded-md border border-white/5 tracking-tighter">
                             {log.targetId}
                          </code>
                          <Zap className="size-3 text-accent opacity-30" />
                       </div>
                    </td>
                    <td className="text-right pr-12 py-8">
                       <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                             <Clock className="size-3.5 text-white/20" />
                             <span className="text-[13px] font-black text-white/80 tabular-nums">
                                {log.timestamp?.toDate?.()?.toLocaleTimeString() || new Date(log.timestamp).toLocaleTimeString()}
                             </span>
                          </div>
                          <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">
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

      <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-[0.03]">
               <ShieldCheck size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <ShieldCheck className="size-8 text-white" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Registry Protocol</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Audit logs are immutably linked to the clinical cluster pulse. Every administrative transaction—including 
                    roster publication and session revocation—is strictly recorded with temporal integrity markers.
                  </p>
                </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-12 space-y-10 group border-l-4 border-l-secondary shadow-2xl">
             <div className="space-y-4">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                   <Info className="size-8" />
                </div>
                <div className="space-y-1">
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Compliance Mode</p>
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Immutable Trace</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 The registry control node ensures 100% traceability for all workforce modifications. Access to the trace ledger 
                 is restricted to authorized administrative nodes and strictly protected via IAM OIDC identity tokens.
               </p>
               <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                  <Zap className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Institutional Access Guard Active</p>
               </div>
             </div>
          </Card>
      </div>
    </div>
  );
}
