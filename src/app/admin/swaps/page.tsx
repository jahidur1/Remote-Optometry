
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
  Clock, 
  User, 
  Filter, 
  Search, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Database, 
  ArrowUpRight,
  Info,
  CalendarDays
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

  const { data: swaps, loading: swapsLoading } = useCollection(
    query(collection(db, 'shift_swaps'), orderBy('createdAt', 'desc'))
  );
  
  const { data: employees } = useCollection(query(collection(db, 'employees')));

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

  const filteredSwaps = swaps?.filter(s => {
    const requester = employees?.find(e => e.id === s.requesterId);
    const target = employees?.find(e => e.id === s.targetEmployeeId);
    const text = `${requester?.fullName} ${target?.fullName} ${s.requesterId} ${s.targetEmployeeId}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  const pendingCount = swaps?.filter(s => s.status === 'pending').length || 0;
  const approvedCount = swaps?.filter(s => s.status === 'approved').length || 0;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <ArrowRightLeft className="size-8 text-secondary" />
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
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Registry Pulse</label>
              <div className="flex items-center gap-3">
                 <span className="font-black text-secondary uppercase tracking-widest text-lg">ACTIVE SYNC</span>
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             variant="outline"
             className="bg-white/5 border-white/10 text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-xl transition-all hover:bg-secondary/20 hover:border-secondary" 
           >
            <Database className="size-4 mr-3" /> EXPORT TRACE
           </Button>
        </div>
      </div>

      {/* KPI Ledger */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Pending Pulse</CardTitle>
            <Zap className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{pendingCount}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Awaiting Validation</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">Approved Exchanges</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent tracking-tighter">{approvedCount}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Registry Committed</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Exchange Velocity</CardTitle>
            <Activity className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">100%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Cluster Efficiency</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Security Mode</CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-500 opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">GATE</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Auth Required</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Policy Panel */}
        <div className="lg:col-span-4">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary sticky top-24">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-[1.25rem] bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20 shadow-inner">
                  <ShieldCheck className="size-7" />
                </div>
                <div>
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-white leading-none">Protocol Deck</CardTitle>
                  <CardDescription className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                     Bilateral Validation Requirements.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
               <div className="space-y-6">
                  <p className="text-[13px] text-white/60 leading-relaxed font-medium uppercase tracking-tight">
                    Every exchange request undergoes strict mathematical validation to ensure clinical pod-balance is maintained.
                  </p>
                  <div className="space-y-4">
                    {[
                      { label: 'Bilateral Acceptance', icon: User },
                      { label: 'Quota Integrity Check', icon: Zap },
                      { label: 'Admin Final Authorization', icon: ShieldCheck }
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-secondary/5 transition-all cursor-default">
                        <div className="size-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                          <step.icon className="size-4" />
                        </div>
                        <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{step.label}</span>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="pt-8 border-t border-white/10 space-y-4">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <Info className="size-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Registry Note</span>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed font-bold uppercase tracking-tighter">
                    Approving an exchange modifies the shift registry but does not automatically re-publish the roster node.
                  </p>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Exchange Ledger */}
        <div className="lg:col-span-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                  <ArrowRightLeft className="size-8 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">Exchange Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                     Verified bilateral shift exchange tracing.
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-4 w-full max-w-md">
                <div className="relative w-full group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-white/20 group-focus-within:text-secondary transition-colors" />
                  <Input 
                    placeholder="Search Requester or Target..." 
                    className="pl-12 h-12 font-black uppercase text-[11px] tracking-widest bg-white/[0.02] border-2 border-white/10 rounded-xl focus:border-secondary transition-all text-white placeholder:text-white/10 shadow-inner"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse">
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-b border-white/5">
                    <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Requester Node</TableHead>
                    <TableHead className="w-[280px] py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Target Colleague</TableHead>
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
                        <p className="text-white/10 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No exchange requests found in cluster.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSwaps?.map((s) => {
                      const requester = employees?.find(e => e.id === s.requesterId);
                      const target = employees?.find(e => e.id === s.targetEmployeeId);
                      return (
                        <TableRow key={s.id} className="hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                          <TableCell className="pl-10 py-8 border-r border-white/5">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-black text-[15px] text-white tracking-tight group-hover:translate-x-1 transition-transform leading-none">{requester?.fullName || s.requesterId}</span>
                              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit">{s.requesterId}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="py-8 border-r border-white/5">
                            <div className="flex flex-col gap-1.5">
                               <span className="font-black text-[15px] text-white/80 tracking-tight leading-none">{target?.fullName || s.targetEmployeeId}</span>
                               <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{s.targetEmployeeId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-8 border-r border-white/5 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                               <CalendarDays className="size-4 text-secondary/40" />
                               <span className="font-black text-[11px] text-white/80 uppercase tracking-widest">{s.date}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-8 border-r border-white/5 text-center">
                             {s.status === 'approved' ? (
                               <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-emerald-500/20">AUTHORIZED</Badge>
                             ) : s.status === 'rejected' ? (
                               <Badge className="bg-destructive text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-destructive/20">REJECTED</Badge>
                             ) : (
                               <Badge className="bg-secondary text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-secondary/20 animate-pulse">PENDING</Badge>
                             )}
                          </TableCell>
                          <TableCell className="text-right pr-10 py-8">
                             <div className="flex justify-end gap-3">
                                {s.status === 'pending' ? (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-inner border border-emerald-500/20" 
                                      onClick={() => handleUpdateStatus(s.id, 'approved')}
                                    >
                                      <CheckCircle2 className="size-5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="size-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-inner border border-destructive/20" 
                                      onClick={() => handleUpdateStatus(s.id, 'rejected')}
                                    >
                                      <XCircle className="size-5" />
                                    </Button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2 text-[9px] font-black text-white/20 uppercase tracking-widest">
                                     <ShieldCheck className="size-3" /> Audit Logged
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
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Audit Protocol</p>
                    <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                      Exchanges represent bilateral agreements. Once authorized, the professional identity records are updated within the cycle context. 
                      Mandatory audit trails ensure 100% traceability of all registry modifications.
                    </p>
                  </div>
               </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Governance Footer */}
      <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-[0.03]">
               <ArrowRightLeft size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <ShieldCheck className="size-8 text-white" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Registry Protocol</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Professional transfers are immutably linked to the clinical cluster pulse. Every modification is audited 
                    and logged to ensure complete traceability within the workforce management lifecycle.
                  </p>
                </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-12 space-y-10 group border-l-4 border-l-secondary shadow-2xl">
             <div className="space-y-4">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                   <Activity className="size-8" />
                </div>
                <div className="space-y-1">
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Operational Pulse</p>
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Exchange Sync</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 The CP-SAT engine re-validates authorized swaps during the next optimization cycle. Swaps that violate hard headcount 
                 quotas or clinical pod-balance targets are automatically flagged for administrative override.
               </p>
               <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                  <Zap className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Deterministic Node Control Active</p>
               </div>
             </div>
          </Card>
      </div>
    </div>
  );
}
