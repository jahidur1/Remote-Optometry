'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCcw, Info, ShieldCheck, Target, Building2, Activity, Zap, Server } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DemoBadge } from '@/components/ui/demo-badge';

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

  useEffect(() => {
    const q = query(collection(db, 'shift_master'), orderBy('displayOrder'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => doc.data());
      setShifts(shiftData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  const handleInitialize = async () => {
    setLoading(true);
    try {
      for (const shift of DEFAULT_SHIFTS) {
        await setDoc(doc(db, 'shift_master', shift.id), shift);
      }
      toast({ 
        title: "Shift Master Synchronized", 
        description: "Standard institutional shifts have been provisioned." 
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-32 px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Clock className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Shift Master Registry</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Permanent clinical identifiers <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Governance Status</label>
              <div className="flex items-center gap-3">
                 <span className="font-black text-secondary uppercase tracking-widest text-lg">SYSTEM LOCKED</span>
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
            variant="outline" 
            onClick={handleInitialize} 
            disabled={loading} 
            className="bg-white border-2 border-secondary/20 text-secondary font-black uppercase text-[11px] tracking-widest h-12 px-8 rounded-xl transition-all hover:bg-secondary/5 group"
           >
             <RefreshCcw className={loading ? "mr-3 h-4 w-4 animate-spin" : "mr-3 h-4 w-4 group-hover:rotate-180 transition-transform duration-700"} /> 
             Reset to Standards
           </Button>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Main Registry Hub */}
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                <Server className="size-8 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-2xl uppercase font-black tracking-tight text-white leading-none">Institutional Standards</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                   Definitions utilized by the CP-SAT mathematical optimization engine.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-2 bg-white/5 rounded-xl border border-white/10">
               <Building2 className="size-4 text-secondary" />
               <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{shifts.length} Permanent Nodes</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto no-scrollbar">
            {loading ? (
              <div className="p-10 space-y-6">
                <Skeleton className="h-16 w-full rounded-2xl opacity-10" />
                <Skeleton className="h-16 w-full rounded-2xl opacity-10" />
                <Skeleton className="h-16 w-full rounded-2xl opacity-10" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-40">
                <p className="text-muted-foreground font-black uppercase text-xs tracking-[0.3em] mb-10">No authorized shift records detected in cluster.</p>
                <Button onClick={handleInitialize} className="bg-secondary text-white shadow-2xl shadow-secondary/20 h-16 px-14 font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all">Provision Registry</Button>
              </div>
            ) : (
              <Table className="border-collapse">
                <TableHeader className="bg-white/[0.02]">
                  <TableRow>
                    <TableHead className="w-[240px] pl-10 py-10 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Identity Key</TableHead>
                    <TableHead className="py-10 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Clinical Category</TableHead>
                    <TableHead className="py-10 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Execution Window (IST)</TableHead>
                    <TableHead className="text-right pr-12 py-10 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Governance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id} className="hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                      <TableCell className="pl-10 py-8 border-r border-white/5">
                         <code className="text-secondary font-black text-[15px] bg-secondary/10 px-6 py-2.5 rounded-xl border-2 border-secondary/20 shadow-inner group-hover:scale-110 inline-block transition-transform">{shift.id}</code>
                      </TableCell>
                      <TableCell className="py-8 border-r border-white/5">
                        <span className="font-black text-[18px] text-white tracking-tight group-hover:translate-x-2 transition-transform inline-block">{shift.name}</span>
                      </TableCell>
                      <TableCell className="py-8 border-r border-white/5">
                        <div className="flex items-center gap-4">
                           <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-secondary/20 transition-all">
                              <Clock className="size-5 text-secondary" />
                           </div>
                           <span className="font-black text-[16px] text-white/80 tracking-tighter tabular-nums">{shift.startTime} — {shift.endTime}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-12 py-8">
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-400 bg-emerald-500/5 px-6 py-2 rounded-full shadow-2xl">
                          <ShieldCheck className="size-4 mr-2" /> Verified Node
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Policy Section */}
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
                   <ShieldCheck className="size-8" />
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
                  <Zap className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Deterministic Node Control Active</p>
               </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}