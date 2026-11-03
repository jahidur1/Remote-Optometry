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
import { 
  CalendarRange, 
  Save, 
  Clock, 
  Info, 
  ShieldCheck, 
  History, 
  MapPin, 
  Loader2, 
  Zap, 
  Activity, 
  ArrowUpRight,
  Database,
  Lock
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const OFFICES = [
  { id: "KOLKATA_ROC", name: "KOLKATA ROC" },
  { id: "GURGAON_ROC", name: "GURGAON ROC" },
  { id: "LUCKNOW_ROC", name: "LUCKNOW ROC" }
];

export default function WeekOffConfiguration() {
  const [weekId, setWeekId] = useState('2024-52');
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
      toast({ title: "Validation Error", description: "All unit parameters must be defined.", variant: "destructive" });
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

      toast({ title: "Pulse Matrix Established", description: `FCFS window for ${office} secured in the registry.` });
    } catch (e: any) {
      toast({ title: "Sync Failure", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <CalendarRange className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Weekly-Off Matrix</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  FCFS Preference Control <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Week</label>
              <Input 
                className="w-32 h-8 font-black text-secondary border-none bg-transparent focus-visible:ring-0 p-0 text-xl" 
                value={weekId} 
                onChange={(e) => setWeekId(e.target.value)}
              />
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-12 px-10 font-black uppercase tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleSave} 
             disabled={loading}
           >
            {loading ? <Zap className="size-5 animate-spin mr-3" /> : <Save className="size-5 mr-3 group-hover:rotate-12 transition-transform" />}
            {loading ? 'SYNCING...' : 'PUBLISH WINDOW'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Configuration Hub */}
        <div className="lg:col-span-4 space-y-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-l-4 border-l-secondary">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-[1.25rem] bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                  <MapPin className="size-7" />
                </div>
                <div>
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-white">Unit Parameters</CardTitle>
                  <CardDescription className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">Cluster Node Configuration</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] ml-1">Target ROC Cluster</Label>
                <Select value={office} onValueChange={setOffice}>
                  <SelectTrigger className="h-14 text-sm font-black rounded-2xl border-2 border-white/10 bg-white/[0.02] shadow-sm hover:border-secondary transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl bg-slate-900/95 backdrop-blur-xl p-2">
                    {OFFICES.map(o => <SelectItem key={o.id} value={o.id} className="font-bold text-[11px] py-3 rounded-xl">{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Clock className="size-3 text-secondary" /> Booking Opens (IST)
                  </Label>
                  <Input 
                    type="datetime-local" 
                    className="h-14 font-black border-2 border-white/10 bg-white/[0.02] rounded-2xl px-6 text-white focus:border-secondary transition-all" 
                    value={openTime} 
                    onChange={e => setOpenTime(e.target.value)} 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Clock className="size-3 text-accent" /> Booking Closes (IST)
                  </Label>
                  <Input 
                    type="datetime-local" 
                    className="h-14 font-black border-2 border-white/10 bg-white/[0.02] rounded-2xl px-6 text-white focus:border-accent transition-all" 
                    value={closeTime} 
                    onChange={e => setCloseTime(e.target.value)} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground premium-card relative overflow-hidden group border border-white/5 shadow-2xl">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-110 transition-transform duration-1000 opacity-[0.03]">
               <ShieldCheck size={280} />
            </div>
            <CardContent className="p-10 space-y-8 relative z-10">
               <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                  <Lock className="size-8 text-white" />
               </div>
               <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Atomic Protocol</p>
                  <p className="text-lg font-black text-white uppercase tracking-tight leading-tight">FCFS Integrity Guard</p>
               </div>
               <p className="text-[13px] font-medium leading-relaxed opacity-70 uppercase tracking-tight">
                 "Slot reservations are processed via server-side atomic transactions. Once a slot is secured, it is mathematically locked and cannot be double-booked by other professionals."
               </p>
            </CardContent>
          </Card>
        </div>

        {/* Quotas & History Hub */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-accent">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-white/10">
                  <Activity className="size-8 text-accent" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl uppercase font-black tracking-tight text-white leading-none">Clinical Quotas</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                     Maximum professional reservations permitted per weekday.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="px-6 py-2 rounded-xl font-black text-[10px] uppercase border-accent/20 text-accent bg-accent/5">
                Target Week: {weekId}
              </Badge>
            </CardHeader>
            <CardContent className="p-10">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-5">
                {DAYS.map((day) => (
                  <div key={day} className="space-y-4 group">
                    <div className="text-center">
                      <Label className="text-[9px] uppercase tracking-[0.3em] font-black text-white/40 group-hover:text-accent transition-colors">{day.substring(0, 3)}</Label>
                    </div>
                    <div className="relative">
                      <Input 
                        type="number" 
                        className="h-16 font-black text-center text-2xl border-2 border-white/10 bg-white/[0.02] rounded-2xl focus:border-accent focus:bg-accent/5 transition-all shadow-inner text-white tabular-nums"
                        value={quotas[day]}
                        onChange={(e) => setQuotas({ ...quotas, [day]: parseInt(e.target.value) || 0 })}
                      />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-accent/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between">
               <div className="flex items-center gap-6">
                  <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                    <History className="size-8 text-secondary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black uppercase tracking-tight text-white leading-none">Pulse Ledger</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-2">Historical FCFS window tracking.</CardDescription>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="flex items-center gap-3 px-6 py-2 bg-white/5 rounded-xl border border-white/10">
                     <Database className="size-4 text-secondary" />
                     <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{configs.length} Records</span>
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse min-w-[800px]">
                <TableHeader className="bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground border-b border-white/5">
                  <TableRow>
                    <TableHead className="py-6 px-10 border-r border-white/5">ROC Cluster</TableHead>
                    <TableHead className="px-10 border-r border-white/5">Cycle Week</TableHead>
                    <TableHead className="px-10 border-r border-white/5">Execution Window (IST)</TableHead>
                    <TableHead className="px-10 text-right pr-12">Institutional Node</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {fetching ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={4} className="p-10"><Skeleton className="h-10 w-full rounded-2xl opacity-10 bg-white" /></TableCell></TableRow>
                    ))
                  ) : configs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-24 text-center opacity-10 italic font-black uppercase text-xs tracking-[0.3em]">No configuration history in cluster.</TableCell>
                    </TableRow>
                  ) : configs.map((c) => (
                    <TableRow key={c.id} className="hover:bg-white/[0.04] transition-all group">
                      <TableCell className="py-8 px-10 border-r border-white/5">
                         <div className="flex items-center gap-4">
                            <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <span className="font-black text-[14px] text-white tracking-tight uppercase">{c.office?.replace('_', ' ')}</span>
                         </div>
                      </TableCell>
                      <TableCell className="px-10 border-r border-white/5">
                        <Badge variant="outline" className="font-black text-[11px] border-white/10 text-white/60 bg-white/5 px-4 py-1 rounded-lg">W{c.weekId}</Badge>
                      </TableCell>
                      <TableCell className="px-10 border-r border-white/5">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-black text-white/80 tabular-nums">
                            {new Date(c.bookingOpen).toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                             <ArrowUpRight className="size-3 text-secondary" /> TO {new Date(c.bookingClose).toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-12">
                         <div className="flex items-center justify-end gap-3">
                            <span className="text-[9px] font-black text-secondary uppercase tracking-widest">NODE_ACTIVE</span>
                            <Badge className="bg-secondary text-white border-none font-black text-[9px] py-1 px-3">PROD</Badge>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="bg-white/[0.02] p-10 border-t border-white/5">
               <div className="flex items-center gap-10">
                  <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                     <Info className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Configuration Standard</p>
                    <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                      Windows are cluster-isolated. Only professionals assigned to the target ROC cluster can see or interact with the active Pulse matrix.
                    </p>
                  </div>
               </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
