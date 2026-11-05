
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, doc, setDoc, where, onSnapshot, deleteDoc } from 'firebase/firestore';
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
  ShieldCheck, 
  History, 
  MapPin, 
  Loader2, 
  Zap, 
  Activity, 
  Database,
  CalendarDays,
  Trash2,
  Terminal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getDatesForWeek, formatWeekId, displayWeekRange, getCurrentWeekId } from '@/lib/date-utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function WeekOffConfiguration() {
  const [weekId, setWeekId] = useState(getCurrentWeekId());
  const [office, setOffice] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [exists, setExists] = useState(false);
  const [currentBookedMap, setCurrentBookedMap] = useState<Record<string, number>>({});

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  const registryQuery = useMemo(() => query(collection(db, 'offices'), where('status', '==', 'Active')), [db]);
  const { data: registryOffices, loading: registryLoading } = useCollection(registryQuery);

  const authorizedOffices = useMemo(() => {
    if (!profile || !registryOffices) return [];
    if (profile.role === 'super_admin') return registryOffices;
    
    const allowedIds = profile.officeIds || (profile.office ? [profile.office] : []);
    return registryOffices.filter(o => allowedIds.includes(o.officeId));
  }, [profile, registryOffices]);

  useEffect(() => {
    if (authorizedOffices.length > 0 && !office) {
      setOffice(authorizedOffices[0].officeId);
    }
  }, [authorizedOffices, office]);

  const activeDays = useMemo(() => {
    if (!weekId) return [];
    const dates = getDatesForWeek(weekId);
    return dates.map(d => format(d, 'EEEE'));
  }, [weekId]);

  useEffect(() => {
    if (activeDays.length > 0) {
      setQuotas(prev => {
        const next: Record<string, number> = {};
        activeDays.forEach(day => {
          next[day] = prev[day] || 15;
        });
        return next;
      });
    }
  }, [activeDays]);

  useEffect(() => {
    if (!db || !weekId || !office) return;
    
    const configId = `${weekId}_${office}`;
    const unsub = onSnapshot(doc(db, 'weekoff_configs', configId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOpenTime(data.bookingOpen || '');
        setCloseTime(data.bookingClose || '');
        setQuotas(data.quotas || {});
        setCurrentBookedMap(data.booked || {});
        setExists(true);
      } else {
        setOpenTime('');
        setCloseTime('');
        setQuotas({});
        setCurrentBookedMap({});
        setExists(false);
      }
    });
    return () => unsub();
  }, [db, weekId, office]);

  const configsQuery = useMemo(() => {
    if (!office) return null;
    return query(
      collection(db, 'weekoff_configs'), 
      where('office', '==', office),
      orderBy('weekId', 'desc')
    );
  }, [db, office]);

  const { data: configs, loading: fetching } = useCollection(configsQuery);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setWeekId(formatWeekId(date));
  };

  const handleSave = async () => {
    if (!weekId || !openTime || !closeTime || !office) {
      toast({ title: "Validation Error", description: "All unit parameters must be defined.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const configId = `${weekId}_${office}`;
    const configRef = doc(db, 'weekoff_configs', configId);
    
    const finalBookedMap = { ...currentBookedMap };
    activeDays.forEach(day => {
      if (finalBookedMap[day] === undefined) finalBookedMap[day] = 0;
    });

    const payload = {
      id: configId,
      weekId,
      office,
      bookingOpen: openTime,
      bookingClose: closeTime,
      quotas,
      booked: finalBookedMap,
      status: 'scheduled',
      updatedAt: new Date().toISOString(),
      actorId: profile?.uid,
    };

    setDoc(configRef, payload, { merge: true })
      .then(() => {
        logAudit(db, profile?.uid || 'system', exists ? 'UPDATE_WEEKOFF_CONFIG' : 'CONFIGURE_WEEKOFF_OFFICE', configId, payload);
        toast({ title: exists ? "Registry Updated" : "Pulse Established", description: `FCFS window for ${office} secured.` });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: configRef.path,
          operation: 'write',
          requestResourceData: payload,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleDelete = async (targetConfigId?: string) => {
    const idToDelete = targetConfigId || `${weekId}_${office}`;
    if (!idToDelete) return;

    if (!confirm(`DECOMMISSION ALERT: Remove clinical cycle ${idToDelete}? This will purge all associated FCFS preferences.`)) return;

    setLoading(true);
    const docRef = doc(db, 'weekoff_configs', idToDelete);
    
    deleteDoc(docRef)
      .then(() => {
        logAudit(db, profile?.uid || 'system', 'DELETE_WEEKOFF_CONFIG', idToDelete, { office, weekId });
        toast({ title: "Registry Decommissioned" });
        
        if (!targetConfigId || targetConfigId === `${weekId}_${office}`) {
          setOpenTime('');
          setCloseTime('');
          setExists(false);
        }
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4 text-black">
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
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cluster</label>
              <Select value={office} onValueChange={setOffice}>
                <SelectTrigger className="h-6 w-48 font-black text-black border-none bg-transparent focus:ring-0 p-0 text-[14px]">
                  <SelectValue placeholder={registryLoading ? "Syncing..." : "Select Hub..."} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                  {authorizedOffices.map(o => (
                    <SelectItem key={o.officeId} value={o.officeId} className="font-bold text-[11px] py-2.5 rounded-lg uppercase">
                      {o.officeName} Hub
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Clinical Cycle</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-6 p-0 flex items-center gap-2 font-black text-black hover:bg-transparent">
                    <CalendarDays className="size-4 text-secondary" />
                    <span className="text-[14px] uppercase tracking-tight">{weekId ? displayWeekRange(weekId) : 'Select Start Date'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar
                    mode="single"
                    onSelect={handleDateSelect}
                    initialFocus
                    className="bg-white"
                  />
                </PopoverContent>
              </Popover>
           </div>
           <div className="flex gap-2">
              {exists && (
                <Button 
                  variant="outline"
                  className="bg-white border-2 border-destructive/20 text-destructive h-10 px-6 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl hover:bg-destructive hover:text-white"
                  onClick={() => handleDelete()}
                  disabled={loading || !office}
                >
                  <Trash2 className="size-4 mr-2" />
                  DECOMMISSION
                </Button>
              )}
              <Button 
                className="bg-secondary text-white shadow-xl shadow-secondary/20 h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
                onClick={handleSave} 
                disabled={loading || !office || !weekId}
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2 group-hover:rotate-12 transition-transform" />}
                {loading ? 'SYNCING...' : exists ? 'UPDATE MATRIX' : 'PUBLISH WINDOW'}
              </Button>
           </div>
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1 flex items-center gap-3">
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
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1 flex items-center gap-3">
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
               Slot reservations are strictly limited to one per professional per cycle.
             </p>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-slate-200">
                  <Terminal className="size-8 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Reservation Matrix</CardTitle>
                </div>
              </div>
              <Badge variant="outline" className="px-6 py-2 rounded-xl font-black text-[10px] uppercase border-secondary/20 text-secondary bg-secondary/5 shadow-inner">
                {weekId ? displayWeekRange(weekId) : 'CYCLE_PENDING'}
              </Badge>
            </CardHeader>
            <CardContent className="p-10">
              {!weekId ? (
                <div className="py-20 text-center opacity-30 italic font-black uppercase text-xs tracking-[0.3em]">Select a clinical start date to configure quotas.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-5">
                  {activeDays.map((day) => (
                    <div key={day} className="space-y-4 group">
                      <div className="text-center">
                        <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-black/40 group-hover:text-secondary transition-colors">{day.substring(0, 3)}</Label>
                      </div>
                      <Input 
                        type="number" 
                        className="h-16 font-black text-center text-2xl border-2 border-slate-100 bg-slate-50 rounded-2xl focus:border-secondary transition-all shadow-inner text-black"
                        value={quotas[day] || 0}
                        onChange={(e) => setQuotas({ ...quotas, [day]: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  ))}
                </div>
              )}
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
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse">
                <TableHeader className="bg-slate-50/30">
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="py-6 px-10 border-r border-slate-100 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">ROC Cluster</TableHead>
                    <TableHead className="px-10 border-r border-slate-100 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Clinical Cycle</TableHead>
                    <TableHead className="px-10 text-right pr-12 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fetching ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={3} className="p-10"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : configs?.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="py-32 text-center opacity-40 italic font-black uppercase text-xs tracking-[0.3em]">No history in cluster ledger.</TableCell></TableRow>
                  ) : configs?.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50 transition-all group">
                      <TableCell className="py-8 px-10 border-r border-slate-100">
                         <span className="font-black text-[14px] uppercase">{authorizedOffices.find(o => o.officeId === c.office)?.officeName || c.office}</span>
                      </TableCell>
                      <TableCell className="px-10 border-r border-slate-100">
                        <Badge variant="outline" className="font-black text-[10px] border-slate-200 text-black/60 bg-white px-4 py-1.5 rounded-lg">{displayWeekRange(c.weekId)}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-12">
                         <Button variant="ghost" size="icon" className="text-slate-300 hover:text-destructive transition-all" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="size-4" />
                         </Button>
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
