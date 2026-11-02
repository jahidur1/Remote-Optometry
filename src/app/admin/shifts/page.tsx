'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCcw, Info, ShieldCheck } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_SHIFTS = [
  { id: "SO", name: "Super Opening", startTime: "09:30", endTime: "18:30", displayOrder: 1 },
  { id: "OP", name: "Opening", startTime: "10:00", endTime: "19:00", displayOrder: 2 },
  { id: "MD", name: "Mid Shift", startTime: "11:00", endTime: "20:00", displayOrder: 3 },
  { id: "C1", name: "Closing", startTime: "12:00", endTime: "21:00", displayOrder: 4 },
  { id: "C2", name: "Closing 2", startTime: "12:30", endTime: "21:30", displayOrder: 5 },
  { id: "SC", name: "Super Closing", startTime: "13:00", endTime: "22:00", displayOrder: 6 },
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
        description: "The six core shifts have been provisioned to standard enterprise timings." 
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
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Shift Master Registry</h1>
          <p className="text-muted-foreground">Permanent definitions of the six core ROC operational shifts.</p>
        </div>
        <Button variant="outline" onClick={handleInitialize} disabled={loading} className="border-secondary text-secondary hover:bg-secondary/5">
          <RefreshCcw className="mr-2 h-4 w-4" /> Reset to Standards
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-md border-t-4 border-t-secondary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-secondary" />
              <CardTitle>Operational Shift Records</CardTitle>
            </div>
            <CardDescription>
              Closing (C1) and Closing 2 (C2) are distinct entities for quota management and reporting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/5">
                <p className="text-muted-foreground mb-4">No authorized shift records detected in the master repository.</p>
                <Button onClick={handleInitialize} className="bg-secondary">Provision Shift Master</Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-24">ID</TableHead>
                    <TableHead>Shift Identity</TableHead>
                    <TableHead>Timings (24-Hour)</TableHead>
                    <TableHead>Target Total</TableHead>
                    <TableHead className="text-right">Access Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-mono text-xs font-bold text-secondary">{shift.id}</TableCell>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono bg-background">
                          {shift.startTime} — {shift.endTime}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground italic">Defined by Quota Matrix</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">System Permanent</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-muted/30 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="size-5 text-accent mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-accent-foreground">Identity & Quota Policy</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every assigned shift must strictly map to one of these six records. IDs (SO, OP, MD, C1, C2, SC) are reserved for mathematical solving and reporting.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <ShieldCheck className="size-5 text-secondary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-secondary">Mathematical Integrity</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Closing timings are identical for C1 and C2, but the CP-SAT engine treats them as separate capacity buckets to ensure workload balancing across ROC pods.
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