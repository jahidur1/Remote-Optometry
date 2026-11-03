'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, doc, setDoc, onSnapshot, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Save, Copy, AlertTriangle, Info, Users, CheckCircle2, ChevronRight, Activity, ShieldCheck } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoBadge } from '@/components/ui/demo-badge';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const GENDER_BANDS = ["0-1", "1", "1-2", "2", "2-3", "3"];

export default function QuotaConfiguration() {
  const [weekId, setWeekId] = useState('2024-52');
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [genderTargets, setGenderTargets] = useState<Record<string, { male: string; female: string }>>({});
  const [saving, setSaving] = useState(false);

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  const { data: shifts, loading: shiftsLoading } = useCollection(query(collection(db, 'shift_master'), orderBy('displayOrder')));
  const { data: employees } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: bookings } = useCollection(query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)));
  const { data: leaves } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));

  useEffect(() => {
    if (!db || !weekId) return;
    const unsub = onSnapshot(doc(db, 'roster_quotas', weekId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setQuotas(data.quotas || {});
        setGenderTargets(data.genderTargets || {});
      } else {
        setQuotas({});
        setGenderTargets({});
      }
    });
    return () => unsub();
  }, [db, weekId]);

  const dailyAvailability = useMemo(() => {
    if (!employees || !weekId) return {};
    const weekDates = getDatesForWeek(weekId);
    if (weekDates.length === 0) return {};

    const avail: Record<string, number> = {};
    DAYS.forEach((day, index) => {
      const date = weekDates[index];
      const offCount = bookings?.filter(b => b.dayOfWeek === day).length || 0;
      const leaveCount = leaves?.filter(l => isDateInRange(date, l.startDate, l.endDate)).length || 0;
      avail[day] = employees.length - offCount - leaveCount;
    });
    return avail;
  }, [employees, weekId, bookings, leaves]);

  const dailyQuotaTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    DAYS.forEach(day => {
      let dayTotal = 0;
      shifts?.forEach(shift => {
        dayTotal += quotas[`${day}_${shift.id}`] || 0;
      });
      totals[day] = dayTotal;
    });
    return totals;
  }, [quotas, shifts]);

  const handleQuotaChange = (day: string, shiftId: string, val: string) => {
    const num = parseInt(val) || 0;
    if (num < 0) return;
    setQuotas(prev => ({ ...prev, [`${day}_${shiftId}`]: num }));
  };

  const handleGenderChange = (shiftId: string, gender: 'male' | 'female', val: string) => {
    setGenderTargets(prev => ({
      ...prev,
      [shiftId]: {
        ...(prev[shiftId] || { male: "1", female: "1" }),
        [gender]: val
      }
    }));
  };

  const handleCopyDay = (fromDay: string) => {
    const newQuotas = { ...quotas };
    DAYS.forEach(toDay => {
      if (toDay === fromDay) return;
      shifts?.forEach(shift => {
        newQuotas[`${toDay}_${shift.id}`] = quotas[`${fromDay}_${shift.id}`] || 0;
      });
    });
    setQuotas(newQuotas);
    toast({ title: "Quotas Cloned", description: `Staffing levels from ${fromDay} applied to all other weekdays.` });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'roster_quotas', weekId);
      const payload = {
        weekId,
        quotas,
        genderTargets,
        updatedAt: new Date().toISOString(),
        actorId: profile?.uid
      };
      await setDoc(docRef, payload);
      logAudit(db, profile?.uid || 'system', 'CONFIGURE_ROSTER_QUOTAS', weekId, { quotaCount: Object.keys(quotas).length });
      toast({ title: "Configuration Saved", description: "Roster engine targets updated successfully." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dayStatus = (day: string) => {
    const avail = dailyAvailability[day] || 0;
    const req = dailyQuotaTotals[day] || 0;
    const diff = avail - req;
    return { avail, req, diff, ok: diff === 0 };
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-none">Quota Configuration</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
             Mathematical Optimization Engine • Live Coverage Tracking <Activity className="size-3 text-secondary" />
          </p>
        </div>
        <div className="flex items-center gap-4 bg-card p-2 rounded-2xl border-2 shadow-sm">
           <Label className="text-[10px] font-black uppercase text-muted-foreground px-4">Target Cycle</Label>
           <Input 
             className="w-40 h-11 font-black text-secondary border-none bg-background focus-visible:ring-0 text-lg rounded-xl" 
             value={weekId} 
             onChange={(e) => setWeekId(e.target.value)}
           />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4 px-4">
        <Card className="lg:col-span-3 shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
          <CardHeader className="bg-muted/10 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.5rem] bg-primary flex items-center justify-center text-primary-foreground shadow-2xl">
                <Users className="size-8" />
              </div>
              <div>
                <CardTitle className="text-2xl uppercase font-black tracking-tight">Daily Assignment Hub</CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                   Total assignments MUST match eligible clinical pool for solver execution.
                </CardDescription>
              </div>
            </div>
            {DAYS.some(d => !dayStatus(d).ok) && (
              <Badge variant="destructive" className="animate-pulse px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-destructive/20 border-none">
                <AlertTriangle className="size-4 mr-2" /> Coverage Imbalance
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-72 pl-10 py-6 sticky left-0 z-20 bg-background border-r">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Clinical Shift Master</span>
                  </TableHead>
                  {DAYS.map(day => (
                    <TableHead key={day} className="text-center px-4 py-6">
                      <div className="flex flex-col items-center group">
                        <span className="text-[10px] uppercase font-black tracking-widest text-primary mb-2 opacity-80">{day.substring(0,3)}</span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="size-10 rounded-xl border-2 hover:bg-secondary/20 hover:text-secondary hover:border-secondary transition-all shadow-sm"
                          onClick={() => handleCopyDay(day)}
                          title={`Clone ${day} to all other days`}
                        >
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftsLoading ? (
                  Array(6).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8} className="py-8"><Skeleton className="h-10 w-full rounded-2xl" /></TableCell></TableRow>
                  ))
                ) : shifts?.map((shift) => (
                  <TableRow key={shift.id} className="hover:bg-muted/10 group border-b border-border/50">
                    <TableCell className="pl-10 py-6 sticky left-0 z-10 bg-background border-r group-hover:bg-muted/20 transition-colors shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-[15px] text-primary tracking-tight">{shift.name}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-80">{shift.startTime}—{shift.endTime}</span>
                      </div>
                    </TableCell>
                    {DAYS.map(day => (
                      <TableCell key={day} className="text-center px-4 py-6">
                        <Input 
                          type="number" 
                          className="w-20 mx-auto h-12 text-center font-black text-xl bg-card border-2 border-primary/10 rounded-2xl focus:border-secondary transition-all shadow-inner"
                          value={quotas[`${day}_${shift.id}`] || 0}
                          onChange={(e) => handleQuotaChange(day, shift.id, e.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                
                <TableRow className="bg-muted/50 font-black">
                  <TableCell className="pl-10 py-8 text-[11px] uppercase tracking-widest text-muted-foreground border-r">Clinical Eligibility</TableCell>
                  {DAYS.map(day => (
                    <TableCell key={day} className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-primary text-2xl font-black tracking-tighter">{dailyAvailability[day] || 0}</span>
                        <span className="text-[9px] font-black uppercase text-primary/60 tracking-widest">POOL</span>
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-primary/10 font-black border-t-4 border-primary/40 shadow-2xl">
                  <TableCell className="pl-10 py-8 text-[11px] uppercase tracking-widest text-primary border-r">Required Target</TableCell>
                  {DAYS.map(day => {
                    const status = dayStatus(day);
                    return (
                      <TableCell key={day} className="text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-2xl font-black tracking-tighter ${status.ok ? 'text-emerald-500' : 'text-destructive'}`}>
                            {status.req}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${status.ok ? 'text-emerald-400' : 'text-destructive/80'}`}>
                            {status.ok ? 'MATCHED' : status.diff > 0 ? `+${status.diff} SURPLUS` : `${status.diff} SHORT`}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="bg-muted/5 p-10 border-t flex flex-col md:flex-row justify-between items-center gap-8">
             <div className="flex items-center gap-6 max-w-xl">
                <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                   <Info className="size-6" />
                </div>
                <p className="text-[12px] font-bold text-muted-foreground uppercase leading-relaxed tracking-tight">
                  Validation Gate Active: Solve execution is blocked until daily coverage imbalances are neutralized. Quotas represent EXACT headcount requirements.
                </p>
             </div>
             <Button className="bg-primary text-primary-foreground h-16 px-14 font-black uppercase tracking-[0.25em] rounded-2xl shadow-2xl hover:scale-105 transition-all group shrink-0" onClick={handleSave} disabled={saving}>
               <Save className="mr-4 h-6 w-6 group-hover:rotate-12 transition-transform" /> {saving ? 'Syncing...' : 'Save Matrix'}
             </Button>
          </CardFooter>
        </Card>

        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card border-2 border-secondary/20">
            <CardHeader className="p-8 pb-6 border-b bg-muted/5">
              <div className="flex items-center gap-4">
                <Target className="size-6 text-secondary" />
                <CardTitle className="text-lg font-black uppercase tracking-tight">Diversity Targets</CardTitle>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-80">Soft objectives for pod gender balance.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {shifts?.map(shift => (
                <div key={shift.id} className="space-y-4 pb-6 border-b border-secondary/10 last:border-0 last:pb-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-3">
                    <ChevronRight className="size-3 text-secondary opacity-60" /> {shift.name}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] px-1">Male Band</Label>
                      <Select 
                        value={genderTargets[shift.id]?.male || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'male', val)}
                      >
                        <SelectTrigger className="h-10 text-[11px] font-black rounded-xl border-2 border-secondary/20 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-2xl border-none">
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[11px] font-bold">{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] px-1">Female Band</Label>
                      <Select 
                        value={genderTargets[shift.id]?.female || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'female', val)}
                      >
                        <SelectTrigger className="h-10 text-[11px] font-black rounded-xl border-2 border-secondary/20 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-2xl border-none">
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[11px] font-bold">{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground premium-card relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 transform group-hover:scale-110 transition-transform duration-1000 opacity-10">
               <ShieldCheck size={220} />
            </div>
            <CardContent className="p-8 space-y-4 relative z-10">
               <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl">
                  <ShieldCheck className="size-6 text-white" />
               </div>
               <p className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">Solver Integrity</p>
               <p className="text-[13px] font-medium leading-relaxed opacity-90">
                 The CP-SAT engine prioritizes HARD staffing quotas. Gender targets are treated as soft objectives to avoid infeasibility during clinical peaks.
               </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
