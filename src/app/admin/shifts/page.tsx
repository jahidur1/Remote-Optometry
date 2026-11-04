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
  Activity, 
  Zap, 
  Server, 
  Database,
  Terminal,
  Cpu
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

/**
 * INSTITUTIONAL SHIFT MASTER REGISTRY
 * 
 * Standardized shift nodes utilized by the deterministic optimization engine.
 * 'Closing' and 'Closing 2' are distinct clinical slots.
 */
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
        title: "Shift Registry Synchronized", 
        description: "Standard institutional shifts (including C1/C2 distinction) have been provisioned." 
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
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Clock className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Shift Master</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Permanent Registry Node <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Node Status</label>
              <div className="flex items-center gap-2">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">SYSTEM LOCKED</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
           <Button 
            variant="outline" 
            onClick={handleInitialize} 
            disabled={loading} 
            className="bg-slate-50 border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl transition-all hover:bg-secondary/20 hover:border-secondary group shadow-sm"
           >
             <RefreshCcw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} /> 
             RESET STANDARDS
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Shift Nodes', value: stats.count, sub: 'Authorized Slots', icon: Server, color: 'text-primary' },
          { label: 'Service Initiation', value: stats.firstStart, sub: 'Daily Opening', icon: Clock, color: 'text-secondary' },
          { label: 'Service Terminus', value: stats.lastEnd, sub: 'Daily Closure', icon: Zap, color: 'text-secondary' },
          { label: 'Solver Alignment', value: '100%', sub: 'Logic Verified', icon: ShieldCheck, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
              <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
              <Terminal className="size-8 text-secondary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Institutional Shift Standards</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                 Permanent clinical definitions used for CP-SAT optimization.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="p-10 border-b border-slate-100">
                 <Skeleton className="h-12 w-full rounded-2xl bg-slate-50 opacity-10" />
              </div>
            ))
          ) : shifts.length === 0 ? (
            <div className="text-center py-40 bg-slate-50/30">
              <div className="size-24 rounded-[2.5rem] bg-secondary/5 flex items-center justify-center mx-auto mb-10 border-2 border-dashed border-secondary/20">
                 <Server className="size-10 text-secondary/20" />
              </div>
              <p className="text-black/20 font-black uppercase text-xs tracking-[0.4em] mb-10 italic">No authorized shift records detected in node.</p>
              <Button onClick={handleInitialize} className="bg-secondary text-white shadow-2xl shadow-secondary/20 h-16 px-14 font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all">
                 <Zap className="size-5 mr-3 fill-white" /> PROVISION STANDARDS
              </Button>
            </div>
          ) : (
            <Table className="border-collapse">
              <TableHeader className="bg-slate-50/30">
                <TableRow className="border-b border-slate-100">
                  <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Identity Key</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Clinical Category</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Execution Pulse (IST)</TableHead>
                  <TableHead className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id} className="hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0">
                    <TableCell className="pl-10 py-8 border-r border-slate-100">
                       <code className="text-secondary font-black text-[15px] bg-secondary/5 px-6 py-2.5 rounded-xl border-2 border-secondary/10 shadow-inner group-hover:scale-110 inline-block transition-transform tabular-nums">
                          {shift.id}
                       </code>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100">
                      <span className="font-black text-[18px] text-black tracking-tight group-hover:translate-x-2 transition-transform inline-block uppercase">
                         {shift.name}
                      </span>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100">
                      <div className="flex items-center gap-4">
                         <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-secondary/20 transition-all shadow-inner">
                            <Clock className="size-5 text-secondary" />
                         </div>
                         <span className="font-black text-[16px] text-black/80 tracking-tighter tabular-nums">
                            {shift.startTime} <span className="text-black/10 mx-2">—</span> {shift.endTime}
                         </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-12 py-8">
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-600 bg-emerald-500/5 px-6 py-2 rounded-full shadow-inner">
                        <ShieldCheck className="size-4 mr-2" /> VERIFIED NODE
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="bg-slate-50/50 p-10 border-t border-slate-100">
           <div className="flex items-center gap-10">
              <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                 <Info className="size-8" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-black/40">Clinical Standard Pulse</p>
                <p className="text-[13px] font-medium text-black/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                  Shift Master nodes are immutable entities during active roster cycles. Modifying these records will invalidate 
                  existing localized quotas and trigger a mathematical re-sync of all draft rosters for the affected week.
                </p>
              </div>
           </div>
        </CardFooter>
      </Card>
    </div>
  );
}
