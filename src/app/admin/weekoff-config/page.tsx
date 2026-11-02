
'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Save, Clock, Info, ShieldCheck, History, MapPin, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const OFFICES = [
  { id: "KOLKATA_ROC", name: "Kolkata ROC" },
  { id: "GURGAON_ROC", name: "Gurgaon ROC" },
  { id: "LUCKNOW_ROC", name: "Lucknow ROC" }
];

export default function WeekOffConfiguration() {
  const [weekId, setWeekId] = useState('');
  const [office, setOffice] = useState('KOLKATA_ROC');
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
      setConfigs(snapshot.docs.map(doc => doc.data()));
      setFetching(false);
    });
    return () => unsubscribe();
  }, [db]);

  const handleSave = async () => {
    if (!weekId || !openTime || !closeTime || !office) {
      toast({ title: "Missing Information", description: "All fields are required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const configId = `${weekId}_${office}`;
      const configRef = doc(db, 'weekoff_configs', configId);
      
      const payload = {
        id: configId,
        weekId,
        office,
        bookingOpen: openTime,
        bookingClose: closeTime,
        quotas,
        booked: DAYS.reduce((acc, day) => ({ ...acc, [day]: 0 }), {}),
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
        actorId: profile?.uid,
      };

      await setDoc(configRef, payload);
      logAudit(db, profile?.uid || 'system', 'CONFIGURE_WEEKOFF_OFFICE', configId, payload);

      toast({ title: "Window Established", description: `FCFS window for ${office} (Week ${weekId}) is active.` });
      setWeekId('');
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">Office Preference Control</h1>
        <p className="text-muted-foreground font-medium">Create independent FCFS windows for ROC clusters.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-xl border-t-4 border-t-secondary">
            <CardHeader className="bg-muted/5 border-b">
              <CardTitle className="text-lg uppercase font-black flex items-center gap-2">
                <MapPin className="size-5 text-secondary" /> Unit Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Target Cluster</Label>
                <Select value={office} onValueChange={setOffice}>
                  <SelectTrigger className="h-11 font-bold border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICES.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Week Cycle (YYYY-WW)</Label>
                <Input placeholder="e.g. 2024-52" className="h-11 font-bold border-2" value={weekId} onChange={e => setWeekId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Booking Opens (IST)</Label>
                <Input type="datetime-local" className="h-11 font-bold border-2" value={openTime} onChange={e => setOpenTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Booking Closes (IST)</Label>
                <Input type="datetime-local" className="h-11 font-bold border-2" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-xl border-t-4 border-t-accent">
          <CardHeader className="bg-muted/5 border-b">
             <CardTitle className="text-lg uppercase font-black flex items-center gap-2">
               <CalendarDays className="size-5 text-accent" /> Clinical Quotas
             </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
              {DAYS.map((day) => (
                <div key={day} className="space-y-2 p-3 rounded-xl border-2 border-muted bg-white text-center shadow-sm">
                  <Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">{day.substring(0, 3)}</Label>
                  <Input 
                    type="number" 
                    className="h-9 font-black text-center border-none bg-muted/30 focus:ring-accent text-lg"
                    value={quotas[day]}
                    onChange={(e) => setQuotas({ ...quotas, [day]: parseInt(e.target.value) || 0 })}
                  />
                </div>
              ))}
            </div>
            
            <div className="mt-12 space-y-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <History className="size-4" /> Active Pulse History
              </h3>
              <div className="rounded-2xl border-2 overflow-hidden bg-white shadow-inner">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="text-[10px] font-black uppercase tracking-widest">
                      <TableHead className="pl-6">Cluster</TableHead>
                      <TableHead>Week</TableHead>
                      <TableHead>Window (IST)</TableHead>
                      <TableHead className="text-right pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fetching ? (
                      Array(3).fill(0).map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
                    ) : configs.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/5 transition-colors border-b last:border-0">
                        <TableCell className="pl-6 py-4">
                           <Badge variant="outline" className="text-[9px] font-black">{c.office}</Badge>
                        </TableCell>
                        <TableCell className="font-bold text-sm">W{c.weekId}</TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground">
                          {new Date(c.bookingOpen).toLocaleString()} — {new Date(c.bookingClose).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                           <Badge className="bg-emerald-500 text-[8px] font-black uppercase px-2 py-0.5">Live Node</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/5 p-6 flex justify-end">
            <Button className="bg-secondary h-12 px-10 font-black uppercase tracking-widest shadow-xl transition-all" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-3" /> : <Save className="mr-3" />}
              Publish Schedule
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
