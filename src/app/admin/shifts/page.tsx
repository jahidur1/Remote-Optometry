
'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCcw, Info } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

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

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'shift_master'), orderBy('displayOrder'));
      const querySnapshot = await getDocs(q);
      const shiftData = querySnapshot.docs.map(doc => doc.data());
      setShifts(shiftData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleInitialize = async () => {
    setLoading(true);
    try {
      for (const shift of DEFAULT_SHIFTS) {
        await setDoc(doc(db, 'shift_master', shift.id), shift);
      }
      toast({ title: "Shift Master Initialized", description: "The 6 core shifts have been provisioned." });
      fetchShifts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Shift Master</h1>
          <p className="text-muted-foreground">Permanent definitions of the six core ROC shifts.</p>
        </div>
        <Button variant="outline" onClick={handleInitialize} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Reset to Defaults
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-secondary" />
              <CardTitle>Core Shift Records</CardTitle>
            </div>
            <CardDescription>
              Closing and Closing 2 are maintained as separate entities for quota and reporting accuracy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {shifts.length === 0 && !loading ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No shift records found.</p>
                <Button onClick={handleInitialize}>Provision Shift Master</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift ID</TableHead>
                    <TableHead>Shift Name</TableHead>
                    <TableHead>Timings (Start - End)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-mono text-xs font-bold text-secondary">{shift.id}</TableCell>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {shift.startTime} - {shift.endTime}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Permanent</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="size-5 text-accent mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Shift Identity Rule</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every shift must match exactly one of the six authorized records. Modifications to timings or IDs 
                  require Super Admin intervention to prevent data corruption in the Roster Solver.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
