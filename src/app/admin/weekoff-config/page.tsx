
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, doc, setDoc, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
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
  Lock,
  Server,
  Terminal
} from "lucide-react";
import { useToast } from "@/toast-hooks";
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeekOffConfiguration() {
  const [weekId, setWeekId] = useState('2024-52');
  const [office, setOffice] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [quotas, setQuotas] = useState<Record<string, number>>(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: 15 }), {})
  );
  const [loading, setLoading] = useState(false);

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  // Dynamic Office Registry Subscription
  const { data: registryOffices, loading: registryLoading } = useCollection(
    query(collection(db, 'offices'), where('status', '==', 'Active'))
  );

  const authorizedOffices = useMemo(() => {
    if (!profile || !registryOffices) return [];
    if (profile.role === 'SUPER_ADMIN') return registryOffices;
    
    const allowedIds = profile.officeIds || (profile.office ? [profile.office] : []);
    return registryOffices.filter(o => allowedIds.includes(o.officeId));
  }, [profile, registryOffices]);

  useEffect(() => {
    if (authorizedOffices.length > 0 && !office) {
      setOffice(authorizedOffices[0].officeId);
    }
  }, [authorizedOffices, office]);

  const configsQuery = useMemo(() => {
    if (!office) return null;
    return query(
      collection(db, 'weekoff_configs'), 
      where('office', '==', office),
      orderBy('weekId', 'desc')
    );
  }, [db, office]);

  const { data: configs, loading: fetching } = useCollection(configsQuery);

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
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <CalendarRange className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Off Matrix</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  FCFS Pulse Control <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cluster</label>
              <Select value={office} onValueChange={setOffice}>
                <SelectTrigger className="h-6 w-48 font-black text-black border-none bg-transparent focus:ring-0 p-0 text-[14px]">
                  <SelectValue placeholder={registryLoading ? "Syncing..." : "Select Node..."} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                  {authorizedOffices.map(o => (
                    <SelectItem key={o.officeId} value={o.officeId} className="font-bold text-[11px] py-2.5 rounded-lg uppercase">
                      {o.officeName} [{o.shortCode}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <div className="flex items-center gap-2">
                 <Input 
                  className="w-24 h-6 font-black text-black border-none bg-transparent focus-visible:ring-0 p-0 text-[16px]" 
                  value={weekId} 
                  onChange={(e) => setWeekId(e.target.value)}
                />
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">LIVE SYNC</span>
              </div>
           </div>
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleSave} 
             disabled={loading || !office}
           >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2 group-hover:rotate-12 transition-transform" />}
            {loading ? 'SYNCING...' : 'PUBLISH WINDOW'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-8">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-2xl bg-primary flex items-center justify-center text-secondary border border-secondary/20 shadow-inner">
                  <MapPin className="size-7" />
                </div>
                <div>
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Unit Parameters</CardTitle>
                  <CardDescription className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-2">Node Assignment</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Clock className="size-3 text-secondary" /> Pulse Initiation (IST)
                  </Label>
                  <Input 
                    type="datetime-local" 
                    className="h-12 font-black border-2 border-slate-100 bg-slate-50 rounded-xl px-6 text-black focus:border-secondary transition-all shadow-inner" 
                    value={openTime} 
                    onChange={e => setOpenTime(e.target.value)} 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Clock className="size-3 text-secondary" /> Pulse Termination (IST)
                  </Label>
                  <Input 
                    type="datetime-local" 
                    className="h-12 font-black border-2 border-slate-100 bg-slate-50 rounded-xl px-6 text-black focus:border-secondary transition-all shadow-inner" 
                    value={closeTime} 
                    onChange={e => setCloseTime(e.target.value)} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden p-10 space-y-8 group border-l-4 border-l-secondary bg-white">
             <div className="space-y-3">
                <div className="size-12 rounded-[1.25rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-105 transition-transform">
                   <ShieldCheck className="size-6" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary">Atomic Protocol</p>
                   <p className="text-2xl font-black text-black uppercase tracking-tight leading-none">FCFS Integrity</p>
                </div>
             </div>
             <p className="text-[13px] text-muted-foreground leading-relaxed font-black uppercase tracking-widest">
               Slot reservations are processed via server-side atomic transactions. Once secured, they are mathematically locked for the solver.
             </p>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-slate-100">
                  <Terminal className="size-8 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Reservation Matrix</CardTitle>
                  <CardDescription className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                     Maximum daily FCFS slot limits for {authorizedOffices.find(o => o.officeId === office)?.officeName || '---'}.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="px-6 py-2 rounded-xl font-black text-[10px] uppercase border-secondary/20 text-secondary bg-secondary/5 shadow-inner">
                CYCLE {weekId}
              </Badge>
            </CardHeader>
            <CardContent className="p-10">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-5">
                {DAYS.map((day) => (
                  <div key={day} className="space-y-4 group">
                    <div className="text-center">
                      <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-black/40 group-hover:text-secondary transition-colors">{day.substring(0, 3)}</Label>
                    </div>
                    <div className="relative">
                      <Input 
                        type="number" 
                        className="h-16 font-black text-center text-2xl border-2 border-slate-100 bg-slate-50 rounded-2xl focus:border-secondary focus:bg-white transition-all shadow-inner text-black tabular-nums"
                        value={quotas[day]}
                        onChange={(e) => setQuotas({ ...quotas, [day]: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
               <div className="flex items-center gap-5">
                  <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <History className="size-6" />
                  </div>
                  <CardTitle className="text-base font-black uppercase tracking-[0.15em] text-black">Pulse Ledger</CardTitle>
               </div>
               <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-slate-200 text-black/30">Registry History</Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse">
                <TableHeader className="bg-slate-50/30">
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="py-6 px-10 text-left border-r border-slate-100 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">ROC Cluster</TableHead>
                    <TableHead className="px-10 text-left border-r border-slate-100 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Cycle</TableHead>
                    <TableHead className="px-10 text-left border-r border-slate-100 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Execution Window (IST)</TableHead>
                    <TableHead className="px-10 text-right pr-12 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Node Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {fetching ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={4} className="p-10"><Skeleton className="h-10 w-full rounded-2xl bg-slate-50 opacity-10" /></TableCell></TableRow>
                    ))
                  ) : configs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-32 text-center opacity-40 italic font-black uppercase text-xs tracking-[0.3em] text-black">No history in cluster ledger.</TableCell>
                    </TableRow>
                  ) : configs?.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50 transition-all group">
                      <TableCell className="py-8 px-10 border-r border-slate-100">
                         <div className="flex items-center gap-4">
                            <div className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                            <span className="font-black text-[14px] text-black tracking-tight uppercase group-hover:translate-x-1 transition-transform">{authorizedOffices.find(o => o.officeId === c.office)?.officeName || c.office}</span>
                         </div>
                      </TableCell>
                      <TableCell className="px-10 border-r border-slate-100">
                        <Badge variant="outline" className="font-black text-[10px] border-slate-200 text-black/60 bg-white px-4 py-1.5 rounded-lg">WEEK {c.weekId}</Badge>
                      </TableCell>
                      <TableCell className="px-10 border-r border-slate-100">
                        <div className="flex flex-col gap-1">
                          <span className="text-[12px] font-black text-black/80 tabular-nums">
                            {new Date(c.bookingOpen).toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                             <ArrowUpRight className="size-3 text-secondary" /> TO {new Date(c.bookingClose).toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-12">
                         <div className="flex items-center justify-end gap-3">
                            <span className="text-[9px] font-black text-secondary uppercase tracking-widest">ACTIVE_SYNC</span>
                            <div className="size-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200 shadow-inner">
                               <Server className="size-4 text-black/20" />
                            </div>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
