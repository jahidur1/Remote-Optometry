
'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCcw, Info, ShieldCheck, Target, Building2 } from "lucide-react";
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
    <div className="space-y-8 max-w-[1400px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-none">Shift Master Registry</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
             Permanent Clinical Identifiers • Zero-Trust Access <Building2 className="size-3 text-secondary" />
          </p>
        </div>
        <Button variant="outline" onClick={handleInitialize} disabled={loading} className="bg-white border-2 border-secondary/20 text-secondary font-black uppercase text-[11px] tracking-widest h-12 px-8 rounded-2xl transition-all hover:bg-secondary/5">
          <RefreshCcw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> 
          Reset to Standards
        </Button>
      </div>

      <div className="grid gap-8 px-4">
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
          <CardHeader className="bg-muted/10 border-b p-8">
            <div className="flex items-center gap-6">
              <div className="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner">
                <Clock className="size-7" />
              </div>
              <div>
                <CardTitle className="text-xl uppercase font-black tracking-tight">Institutional Standards</CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">
                   Locked definitions utilized by the CP-SAT mathematical optimization engine.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-8 space-y-6">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-32 bg-muted/5">
                <p className="text-muted-foreground font-black uppercase text-xs tracking-[0.2em] mb-8">No authorized shift records detected in cluster.</p>
                <Button onClick={handleInitialize} className="bg-secondary text-white shadow-2xl shadow-secondary/20 h-14 px-12 font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all">Provision Shift Master</Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <TableHead className="w-48 pl-10 py-6">Identity Key</TableHead>
                    <TableHead className="py-6">Clinical Category</TableHead>
                    <TableHead className="py-6">Execution Window (IST)</TableHead>
                    <TableHead className="text-right pr-12 py-6">Governance Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 group">
                      <TableCell className="pl-10 py-6">
                         <code className="text-secondary font-black text-[13px] bg-secondary/5 px-4 py-2 rounded-xl border-2 border-secondary/10 shadow-sm">{shift.id}</code>
                      </TableCell>
                      <TableCell className="py-6">
                        <span className="font-black text-[15px] text-primary tracking-tight">{shift.name}</span>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex items-center gap-3">
                           <Clock className="size-4 text-muted-foreground/40" />
                           <span className="font-black text-[14px] text-foreground/80 tracking-tighter">{shift.startTime} — {shift.endTime}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-12 py-6">
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-600 bg-emerald-500/5 px-6 py-1.5 rounded-full shadow-sm">
                          <ShieldCheck className="size-3 mr-2" /> System Locked
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground premium-card relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:rotate-12 transition-transform duration-700">
               <Info size={180} />
            </div>
            <CardContent className="p-10 space-y-6 relative z-10">
                <div className="size-14 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <Building2 className="size-7 text-white" />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">Distribution Policy</p>
                  <p className="text-[14px] leading-relaxed font-medium opacity-80 max-w-md">
                    Every assigned professional must strictly map to one of these six nodes. IDs are reserved for mathematical optimization. 
                    Closing (C1) and Closing 2 (C2) operate on distinct quotas to ensure pod balance during evening peaks.
                  </p>
                </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-2xl rounded-[2.5rem] border-none group overflow-hidden border-2 border-secondary/5">
            <CardContent className="p-10 space-y-6">
                <div className="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center shadow-inner">
                    <ShieldCheck className="size-7 text-secondary" />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">Integrity Protocol</p>
                  <p className="text-[14px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight">
                    Super Closing (SC) timings are architected to ensure complete lock-up coverage until 10:00 PM. 
                    The CP-SAT engine prioritizes mandatory coverage targets over professional soft preferences.
                  </p>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
