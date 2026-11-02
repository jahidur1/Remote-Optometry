
'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Save, Clock, Info, ShieldCheck, History } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function WeekOffConfiguration() {
  const [weekId, setWeekId] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [quotas, setQuotas] = useState<Record<string, number>>(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: 15 }), {})
  );
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'weekoff_configs'), orderBy('weekId', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setConfigs(data);
      setFetching(false);
    });
    return () => unsubscribe();
  }, [db]);

  const handleSave = async () => {
    if (!weekId || !openTime || !closeTime) {
      toast({ title: "Validation Error", description: "All window fields (Week, Open, Close) are required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const configRef = doc(db, 'weekoff_configs', weekId);
      const payload = {
        weekId,
        bookingOpen: openTime,
        bookingClose: closeTime,
        quotas,
        booked: DAYS.reduce((acc, day) => ({ ...acc, [day]: 0 }), {}),
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
        actorId: profile?.uid,
      };

      await setDoc(configRef, payload);

      logAudit(db, profile?.uid || 'system', 'CONFIGURE_WEEKOFF', weekId, {
        openTime,
        closeTime,
        quotas
      });

      toast({ 
        title: "Configuration Published", 
        description: `FCFS Booking window for ${weekId} has been successfully scheduled.` 
      });
      
      setWeekId('');
      setOpenTime('');
      setCloseTime('');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const handleQuotaChange = (day: string, val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    setQuotas({ ...quotas, [day]: num });
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'open': return <Badge className="bg-emerald-500">Live & Open</Badge>;
      case 'scheduled': return <Badge variant="secondary">Scheduled</Badge>;
      case 'closed': return <Badge variant="destructive">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Weekly-Off Control Panel</h1>
        <p className="text-muted-foreground">Establish the FCFS booking window and set daily staff-off limits (Asia/Kolkata).</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md border-t-4 border-t-secondary">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <CardTitle>Schedule Window</CardTitle>
              </div>
              <CardDescription>Determine when employees can start booking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weekId">Roster Week (YYYY-WW)</Label>
                <Input 
                  id="weekId" 
                  placeholder="e.g. 2024-52" 
                  value={weekId}
                  onChange={(e) => setWeekId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="open">Booking Opens</Label>
                <Input 
                  id="open" 
                  type="datetime-local" 
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close">Booking Closes</Label>
                <Input 
                  id="close" 
                  type="datetime-local" 
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-secondary/20 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <ShieldCheck className="size-5 text-secondary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-secondary">FCFS Enforcement</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Priority is strictly determined by server-side transaction commit time. Slot allocations are atomic 
                    to prevent overbooking.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-md border-t-4 border-t-accent">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent" />
              <CardTitle>Daily Slot Quotas</CardTitle>
            </div>
            <CardDescription>Maximum employees allowed to be OFF on eligible weekdays (Mon-Fri).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {DAYS.map((day) => (
                <div key={day} className="space-y-2 p-3 rounded-lg border bg-muted/20 text-center">
                  <Label className="text-[10px] uppercase tracking-wider font-bold opacity-70 block mb-1">{day.substring(0, 3)}</Label>
                  <Input 
                    type="number" 
                    className="h-9 font-bold text-center border-accent/20 focus:border-accent"
                    value={quotas[day]}
                    onChange={(e) => handleQuotaChange(day, e.target.value)}
                  />
                </div>
              ))}
            </div>
            
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-bold">Existing Configurations</h3>
              </div>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-xs">Week ID</TableHead>
                      <TableHead className="text-xs">Open Window</TableHead>
                      <TableHead className="text-xs text-right">Avg. Quota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fetching ? (
                      Array(3).fill(0).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                      ))
                    ) : configs.map((c) => (
                      <TableRow key={c.weekId} className="text-xs">
                        <TableCell className="font-bold">{c.weekId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(c.bookingOpen).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Math.round(Object.values(c.quotas as Record<string, number>).reduce((a, b) => a + b, 0) / 5)} / day
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/5 p-4 flex justify-end">
            <Button className="bg-secondary" onClick={handleSave} disabled={loading}>
              <Save className="mr-2 h-4 w-4" /> {loading ? 'Publishing...' : 'Publish Window'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
