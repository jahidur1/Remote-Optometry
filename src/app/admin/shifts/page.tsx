
'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCcw, Info, ShieldCheck, Target } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DemoBadge } from '@/components/ui/demo-badge';

const DEFAULT_SHIFTS = [
  { id: "SO", name: "Super Opening", startTime: "09:30", endTime: "18:30", displayOrder: 1 },
  { id: "OP", name: "Opening", startTime: "10:00", endTime: "19:00", displayOrder: 2 },
  { id: "MD", name: "Mid Shift", startTime: "11:00", endTime: "20:00", displayOrder: 3 },
  { id: "C1", name: "Closing", startTime: "12:00", endTime: "21:00", displayOrder: 4 },
  { id: "C2", name: "Closing 2", startTime: "12:00", endTime: "21:00", displayOrder: 5 },
  { id: "SC", name: "Super Closing", startTime: "12:30", endTime: "22:00", displayOrder: 6 },
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Shift Master Registry</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium mt-1">Permanent clinical shift definitions for the ROC workforce.</p>
        </div>
        <Button variant="outline" onClick={handleInitialize} disabled={loading} className="border-secondary text-secondary font-black uppercase text-[10px] tracking-widest h-10 px-6">
          <RefreshCcw className="mr-2 h-4 w-4" /> Reset to Standards
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-md border-t-4 border-t-secondary rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                <Clock className="size-6" />
              </div>
              <div>
                <CardTitle className="text-lg uppercase font-black tracking-tight">Clinical Shift Standards</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                   Locked definitions used by the CP-SAT optimization engine.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-24 bg-muted/5">
                <p className="text-muted-foreground font-bold uppercase text-xs tracking-[0.2em] mb-6">No authorized shift records detected.</p>
                <Button onClick={handleInitialize} className="bg-secondary font-black uppercase tracking-widest h-12 px-8">Provision Shift Master</Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="text-[10px] font-black uppercase tracking-widest">
                    <TableHead className="w-32 pl-8">Shift ID</TableHead>
                    <TableHead>Clinical Identity</TableHead>
                    <TableHead>Execution Time (IST)</TableHead>
                    <TableHead className="text-right pr-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 group">
                      <TableCell className="pl-8">
                         <code className="text-secondary font-black text-xs bg-secondary/5 px-3 py-1 rounded-lg border border-secondary/10">{shift.id}</code>
                      </TableCell>
                      <TableCell>
                        <span className="font-black text-[13px] text-primary tracking-tight">{shift.name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <Clock className="size-3 text-muted-foreground" />
                           <span className="font-bold text-sm text-foreground/80">{shift.startTime} — {shift.endTime}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-600 bg-emerald-500/5 px-4 py-1">
                          System Locked
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-muted/30 border-dashed border-2 rounded-3xl">
            <CardContent className="pt-8 pb-8">
              <div className="flex gap-4 items-start">
                <div className="size-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-muted">
                    <Info className="size-6 text-accent" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-primary uppercase tracking-widest">Identity & Distribution Policy</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-semibold uppercase tracking-tight">
                    Every assigned shift must strictly map to one of these six records. IDs are reserved for mathematical solving. 
                    Closing (C1) and Closing 2 (C2) have identical timings but separate quota buckets to balance workloads between ROC pods.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-secondary/20 border-2 rounded-3xl">
            <CardContent className="pt-8 pb-8">
              <div className="flex gap-4 items-start">
                <div className="size-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-secondary/10">
                    <ShieldCheck className="size-6 text-secondary" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-secondary uppercase tracking-widest">Mathematical Integrity</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-semibold uppercase tracking-tight">
                    Timings for Super Closing (SC) are offset to ensure lock-up coverage until 10:00 PM. 
                    The CP-SAT engine prioritizes coverage until close over soft employee preferences for earlier departure.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
