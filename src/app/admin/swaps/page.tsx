
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowRightLeft, 
  CheckCircle2, 
  XCircle, 
  Search, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Database, 
  ArrowUpRight,
  Info,
  CalendarDays,
  Terminal,
  Server,
  Filter,
  User,
  Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { DemoBadge } from '@/components/ui/demo-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function AdminSwapsManager() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Stable Authoritative Fetch
  const swapsQuery = useMemo(() => query(
    collection(db, 'shift_swaps'), 
    orderBy('createdAt', 'desc')
  ), [db]);
  
  const empQuery = useMemo(() => query(collection(db, 'employees')), [db]);

  const { data: swaps, loading: swapsLoading } = useCollection(swapsQuery);
  const { data: employees } = useCollection(empQuery);

  const handleUpdateStatus = async (swapId: string, status: 'approved' | 'rejected') => {
    try {
      const swapRef = doc(db, 'shift_swaps', swapId);
      await updateDoc(swapRef, {
        status,
        updatedAt: serverTimestamp(),
        actionedBy: profile?.uid
      });

      logAudit(db, profile?.uid || 'system', `SWAP_${status.toUpperCase()}`, swapId, { status });
      
      toast({ 
        title: `Exchange ${status.charAt(0).toUpperCase() + status.slice(1)}`, 
        description: `The bilateral agreement has been updated in the clinical registry.` 
      });
    } catch (e: any) {
      toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
    }
  };

  const filteredSwaps = useMemo(() => {
    return swaps?.filter(s => {
      const requester = employees?.find(e => e.id === s.requesterId);
      const target = employees?.find(e => e.id === s.targetEmployeeId);
      const text = `${requester?.fullName} ${target?.fullName} ${s.requesterId} ${s.targetEmployeeId}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    });
  }, [swaps, employees, searchTerm]);

  const stats = useMemo(() => {
    const pending = swaps?.filter(s => s.status === 'pending').length || 0;
    const approved = swaps?.filter(s => s.status === 'approved').length || 0;
    return { pending, approved };
  }, [swaps]);

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in duration-200 pb-40 px-4">
      {/* Precision Header Node */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <ArrowRightLeft className="size-8 text-secondary fill-secondary/20" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Exchange Hub</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Bilateral Transfer Matrix <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 border-r border-white/5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Registry Pulse</label>
              <div className="flex items-center gap-3">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">IMMUTABLE LEDGER</span>
              </div>
           </div>
        </div>
      </div>

      {/* KPI Ledger Matrix */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pending Pulse', value: stats.pending, sub: 'Awaiting Validation', icon: Zap, color: 'text-primary' },
          { label: 'Approved Exchanges', value: stats.approved, sub: 'Registry Committed', icon: CheckCircle2, color: 'text-secondary' },
          { label: 'Exchange Velocity', value: '100%', sub: 'Cluster Efficiency', icon: Activity, color: 'text-accent' },
          { label: 'Security Mode', value: 'GATE', sub: 'Admin Authorized', icon: ShieldCheck, color: 'text-white' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {swapsLoading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /> : (
                <>
                  <div className="text-5xl font-black text-white tracking-tighter">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Exchange Ledger */}
      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
        <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
              <ArrowRightLeft className="size-8 text-secondary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">Exchange Ledger</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                 Verified bilateral shift exchange tracing for clinical ROC nodes.
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-4 w-full max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-white/20 group-focus-within:text-secondary transition-colors" />
              <Input 
                placeholder="Search Requester or Target Node..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white/[0.02] border-2 border-white/10 rounded-2xl focus:border-secondary focus:bg-secondary/5 transition-all shadow-inner text-white placeholder:text-white/10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-14 w-14 shrink-0 border-2 border-white/10 rounded-2xl hover:bg-secondary/20 hover:border-secondary transition-all">
                <Filter className="size-5 text-white/40" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <Table className="border-collapse">
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-b border-white/5">
                <TableHead className="w-[300px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Requester Node</TableHead>
                <TableHead className="w-[300px] py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Target Colleague</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Exchange Window</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Status Pulse</TableHead>
                <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {swapsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-b border-white/5"><TableCell colSpan={5} className="py-10 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /></TableCell></TableRow>
                ))
              ) : filteredSwaps?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-40 text-center">
                    <p className="text-white/10 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No authorized exchange requests found in cluster.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSwaps?.map((s) => {
                  const requester = employees?.find(e => e.id === s.requesterId);
                  const target = employees?.find(e => e.id === s.targetEmployeeId);
                  return (
                    <TableRow key={s.id} className={cn(
                      "hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0",
                      s.status !== 'pending' && "opacity-60"
                    )}>
                      <TableCell className="pl-10 py-8 border-r border-white/5">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-[16px] text-white tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{requester?.fullName || 'Unknown'}</span>
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit tabular-nums">{s.requesterId}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-white/5">
                        <div className="flex flex-col gap-1.5">
                           <span className="font-black text-[16px] text-white/80 tracking-tight leading-none uppercase">{target?.fullName || 'Unknown'}</span>
                           <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest tabular-nums">{s.targetEmployeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-white/5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                           <div className="flex items-center gap-2">
                              <CalendarDays className="size-3.5 text-secondary/40" />
                              <span className="font-black text-[13px] text-white/80 uppercase tracking-widest">{s.date}</span>
                           </div>
                           <span className="text-[8px] font-bold text-white/20 uppercase tracking-tighter">Cycle Context</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-white/5 text-center">
                         <div className="flex flex-col items-center">
                            {s.status === 'approved' ? (
                              <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-emerald-500/20">AUTHORIZED</Badge>
                            ) : s.status === 'rejected' ? (
                              <Badge className="bg-destructive text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-destructive/20">REJECTED</Badge>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <Badge className="bg-secondary text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-secondary/20 animate-pulse">PENDING</Badge>
                                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Awaiting Admin</span>
                              </div>
                            )}
                         </div>
                      </TableCell>
                      <TableCell className="text-right pr-10 py-8">
                         <div className="flex justify-end gap-3">
                            {s.status === 'pending' ? (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="size-11 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-inner border border-emerald-500/20" 
                                  onClick={() => handleUpdateStatus(s.id, 'approved')}
                                >
                                  <CheckCircle2 className="size-5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="size-11 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-inner border border-destructive/20" 
                                  onClick={() => handleUpdateStatus(s.id, 'rejected')}
                                >
                                  <XCircle className="size-5" />
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-3">
                                 <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Audit Traced</span>
                                    <span className="text-[8px] font-mono text-white/10 uppercase">{s.id.slice(-6)}</span>
                                 </div>
                                 <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                    <ShieldCheck className="size-5 text-white/20" />
                                 </div>
                              </div>
                            )}
                         </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="bg-white/[0.02] p-10 border-t border-white/5">
           <div className="flex items-center gap-10">
              <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                 <Info className="size-8" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Operational Protocol</p>
                <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-5xl">
                  Exchanges represent bilateral clinical agreements. Once authorized, the shift registry is modified within the cycle context. 
                  Approving an exchange does not automatically re-publish the roster node; manual validation of staffing quotas is mandatory.
                </p>
              </div>
           </div>
        </CardFooter>
      </Card>

      {/* Institutional Protocol Matrix */}
      <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-[0.03]">
               <Terminal size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <ShieldCheck className="size-8 text-white" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Registry Protocol</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Professional transfers are immutably linked to the clinical cluster pulse. Every modification—including 
                    rejection rationale—is audited and logged with administrative identity markers for 100% traceability.
                  </p>
                </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-12 space-y-10 group border-l-4 border-l-secondary shadow-2xl relative">
             <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
                <Server size={240} />
             </div>
             <div className="space-y-4">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                   <Zap className="size-8" />
                </div>
                <div className="space-y-1">
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Sync Intelligence</p>
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Bilateral Guard</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 The CP-SAT engine re-validates authorized swaps during the next optimization cycle. Transfers that violate hard 
                 headcount quotas or historical fairness objectives are automatically flagged for clinical review.
               </p>
               <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                  <ShieldCheck className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Deterministic Node Control Active</p>
               </div>
             </div>
          </Card>
      </div>
    </div>
  );
}
