'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  RefreshCcw, 
  Info, 
  ShieldCheck, 
  Target, 
  Building2, 
  Activity, 
  Zap, 
  Server, 
  Database,
  ArrowUpRight,
  Lock,
  Terminal,
  Cpu
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

const DEFAULT_SHIFTS = [
  { id: "SO", name: "Super Opening", startTime: "09:30 AM", endTime: "06:30 PM", displayOrder: 1 },
  { id: "OP", name: "Opening", startTime: "10:00 AM", endTime: "07:00 PM", displayOrder: 2 },
  { id: "MD", name: "Mid Shift", startTime: "11:00 AM", endTime: "08:00 PM", displayOrder: 3 },
  { id: "C1", name: "Closing", startTime: "12:00 PM", endTime: "09:00 PM", displayOrder: 4 },
  { id: "C2", name: "Closing 2", startTime: "12:30 PM", endTime: "09:30 PM", displayOrder: 5 },
  { id: "SC", name: "Super Closing", startTime: "01:00 PM", endTime: "10:00 PM", displayOrder: 6 },
];

export default function ShiftMaster() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const db = useFirestore();
  const { toast } = useToast();

  const shiftsQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);

  useEffect(() => {
    const unsubscribe = onSnapshot(shiftsQuery, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => doc.data());
      setShifts(shiftData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [shiftsQuery]);

  const handleInitialize = async () => {
    setLoading(true);
    try {
      for (const shift of DEFAULT_SHIFTS) {
        await setDoc(doc(db, 'shift_master', shift.id), shift);
      }
      toast({ 
        title: "Shift Master Synchronized", 
        description: "Standard institutional shifts have been provisioned in the registry." 
      });
    } catch (e: any) {
      toast({ title: "Registry Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    count: shifts.length,
    firstStart: shifts[0]?.startTime || '--:--',
    lastEnd: shifts[shifts.length - 1]?.endTime || '--:--',
  }), [shifts]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* Institutional Pulse Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Clock className="size-8 text-secondary fill-secondary/20" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Shift Master</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Permanent Registry Node <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 border-r border-white/5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Node Status</label>
              <div className="flex items-center gap-2">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">SYSTEM LOCKED</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
           <Button 
            variant="outline" 
            onClick={handleInitialize} 
            disabled={loading} 
            className="bg-white/5 border-2 border-white/10 text-white font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl transition-all hover:bg-secondary/20 hover:border-secondary group"
           >
             <RefreshCcw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} /> 
             RESET STANDARDS
           </Button>
        </div>
      </div>

      {/* KPI Ledger */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Permanent Nodes</CardTitle>
            <Server className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{stats.count}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Authorized Slots</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">Service Window</CardTitle>
            <Clock className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent tracking-tighter">{stats.firstStart.split(':')[0]}a</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Clinical Initiation</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Terminus Node</CardTitle>
            <Zap className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{stats.lastEnd.split(':')[0]}p</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Registry Closure</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Solver Pulse</CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-500 opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">100%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Logic Verified</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8">
        {/* Main Registry Hub */}
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                <Terminal className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl uppercase font-black tracking-tight text-white leading-none">Institutional Standards</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                   Permanent shift definitions utilized by the CP-SAT engine.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto no-scrollbar">
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="p-10 border-b border-white/5">
                   <Skeleton className="h-12 w-full rounded-2xl opacity-10 bg-white" />
                </div>
              ))
            ) : shifts.length === 0 ? (
              <div className="text-center py-40 bg-white/[0.01]">
                <div className="size-24 rounded-[2.5rem] bg-secondary/5 flex items-center justify-center mx-auto mb-10 border-2 border-dashed border-secondary/20">
                   <Server className="size-10 text-secondary/20" />
                </div>
                <p className="text-white/20 font-black uppercase text-xs tracking-[0.4em] mb-10 italic">No authorized shift records detected in cluster node.</p>
                <Button onClick={handleInitialize} className="bg-secondary text-white shadow-2xl shadow-secondary/20 h-16 px-14 font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all">
                   <Zap className="size-5 mr-3 fill-white" /> PROVISION REGISTRY
                </Button>
              </div>
            ) : (
              <Table className="border-collapse">
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-b border-white/5">
                    <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Identity Key</TableHead>
                    <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Clinical Category</TableHead>
                    <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Execution Window (IST)</TableHead>
                    <TableHead className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Governance Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id} className="hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                      <TableCell className="pl-10 py-8 border-r border-white/5">
                         <code className="text-secondary font-black text-[15px] bg-secondary/10 px-6 py-2.5 rounded-xl border-2 border-secondary/20 shadow-inner group-hover:scale-110 inline-block transition-transform tabular-nums">
                            {shift.id}
                         </code>
                      </TableCell>
                      <TableCell className="py-8 border-r border-white/5">
                        <span className="font-black text-[18px] text-white tracking-tight group-hover:translate-x-2 transition-transform inline-block uppercase">
                           {shift.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-8 border-r border-white/5">
                        <div className="flex items-center gap-4">
                           <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-secondary/20 transition-all">
                              <Clock className="size-5 text-secondary" />
                           </div>
                           <span className="font-black text-[16px] text-white/80 tracking-tighter tabular-nums">
                              {shift.startTime} <span className="text-white/20 mx-2">—</span> {shift.endTime}
                           </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-12 py-8">
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-400 bg-emerald-500/5 px-6 py-2 rounded-full shadow-2xl">
                          <ShieldCheck className="size-4 mr-2" /> VERIFIED NODE
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="bg-white/[0.02] p-10 border-t border-white/5">
             <div className="flex items-center gap-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                   <Info className="size-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Solver Requirement Pulse</p>
                  <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                    Shift Master records are architected as static entities for mathematical stability. 
                    Modifying these nodes requires re-validating all active clinical quotas and historical fairness scores.
                  </p>
                </div>
             </div>
          </CardFooter>
        </Card>
      </div>

      {/* Governance Footer */}
      <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-[0.03]">
               <Target size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <Building2 className="size-8 text-white" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Distribution Policy</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Every assigned professional must strictly map to one of these six nodes. IDs are reserved for mathematical optimization. 
                    Closing (C1) and Closing 2 (C2) operate on distinct quotas to ensure pod balance during peak evening windows.
                  </p>
                </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-12 space-y-10 group border-l-4 border-l-secondary shadow-2xl">
             <div className="space-y-4">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                   <Lock className="size-8" />
                </div>
                <div className="space-y-1">
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Integrity Protocol</p>
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Locked Architecture</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 Super Closing (SC) timings are architected to ensure complete lock-up coverage until 10:00 PM IST. 
                 The CP-SAT engine prioritizes mandatory coverage targets over professional soft preferences to ensure institutional security.
               </p>
               <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                  <Cpu className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Deterministic Node Control Active</p>
               </div>
             </div>
          </Card>
      </div>
    </div>
  );
}
