
'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Save, Clock, Info, ShieldCheck, History, AlertTriangle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
      toast({ title: "Validation Error", description: "Week ID and window timings are mandatory.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const configRef = doc(db, 'weekoff_configs', weekId);
      
      const payload = {
        id: weekId,
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
        weekId,
        openTime,
        quotas
      });

      toast({ 
        title: "Configuration Published", 
        description: `FCFS Booking window for Week ${weekId} successfully established.` 
      });
      
      setWeekId('');
      setOpenTime('');
      setCloseTime('');
    } catch (e: any) {
      toast({ title: "Publication Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const handleQuotaChange = (day: string, val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    setQuotas({ ...quotas, [day]: num });
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase leading-tight">Weekly-Off Pulse Control</h1>
        <p className="text-muted-foreground font-medium">Establish atomic FCFS booking windows and clinical capacity limits (Asia/Kolkata).</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-xl border-t-4 border-t-secondary overflow-hidden">
            <CardHeader className="bg-muted/5 border-b">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <CardTitle className="text-lg uppercase font-black">Window Parameters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Roster Cycle (YYYY-WW)</Label>
                <Input 
                  placeholder="e.g. 2024-52" 
                  className="h-11 font-bold border-2 focus:border-secondary transition-all"
                  value={weekId}
                  onChange={(e) => setWeekId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Window Opens (IST)</Label>
                <Input 
                  type="datetime-local" 
                  className="h-11 font-bold border-2"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Window Closes (IST)</Label>
                <Input 
                  type="datetime-local" 
                  className="h-11 font-bold border-2"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground shadow-2xl rounded-[1.5rem] border-none overflow-hidden relative group transition-all hover:scale-[1.02]">
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                <ShieldCheck size={80} />
             </div>
             <CardContent className="pt-8 pb-8 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Atomic Integrity Guard</p>
                <p className="text-[13px] font-medium leading-relaxed opacity-80">
                   The system uses **Firestore Transactions** to enforce strict FCFS priority. 
                   Booking order is determined by the server's commit millisecond, not the client clock.
                </p>
             </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-xl border-t-4 border-t-accent">
          <CardHeader className="bg-muted/5 border-b">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent" />
              <CardTitle className="text-lg uppercase font-black">Daily Clinical Quotas</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Maximum allowed absences per operational day.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
              {DAYS.map((day) => (
                <div key={day} className="space-y-3 p-4 rounded-2xl border-2 border-muted bg-white text-center hover:border-accent/30 transition-all shadow-sm">
                  <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground block">{day.substring(0, 3)}</Label>
                  <Input 
                    type="number" 
                    className="h-10 font-black text-center border-none bg-muted/30 focus:ring-accent transition-all text-lg"
                    value={quotas[day]}
                    onChange={(e) => handleQuotaChange(day, e.target.value)}
                  />
                </div>
              ))}
            </div>
            
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-3 px-1">
                <History className="size-4 text-muted-foreground" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.1em] text-primary">Configuration History</h3>
              </div>
              <div className="rounded-[1.5rem] border-2 overflow-hidden bg-white shadow-inner">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Roster Week</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Window (IST)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fetching ? (
                      Array(3).fill(0).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={3} className="py-4"><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                      ))
                    ) : configs.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 group">
                        <TableCell className="pl-6 py-4">
                           <span className="font-black text-[13px] text-primary tracking-tight">Week {c.weekId}</span>
                        </TableCell>
                        <TableCell className="text-[11px] font-bold text-muted-foreground">
                          {new Date(c.bookingOpen).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} — {new Date(c.bookingClose).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                           <Badge variant="outline" className="text-[8px] font-black uppercase border-emerald-500/20 text-emerald-600 bg-emerald-500/5 px-3">
                              Active Node
                           </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/5 p-6 flex justify-end">
            <Button className="bg-secondary h-12 px-10 font-black uppercase tracking-widest shadow-xl shadow-secondary/10 transition-all hover:scale-105" onClick={handleSave} disabled={loading}>
              <Save className="mr-3 h-5 w-5" /> {loading ? 'Rollout in Progress...' : 'Establish Window'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
