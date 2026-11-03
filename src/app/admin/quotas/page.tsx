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
import { Target, Save, Copy, AlertTriangle, Info, Users, CheckCircle2, ChevronRight, Activity, ShieldCheck, Zap, ArrowUpRight } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoBadge } from '@/components/ui/demo-badge';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

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
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Target className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Shift Quotas</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Optimization Targets <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
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
             disabled={saving}
           >
            {saving ? <Zap className="size-5 animate-spin mr-3" /> : <Save className="size-5 mr-3 group-hover:rotate-12 transition-transform" />}
            {saving ? 'SYNCING...' : 'SAVE MATRIX'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main Assignment Hub */}
        <div className="lg:col-span-9">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-white/10">
                  <Users className="size-8 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl uppercase font-black tracking-tight text-white leading-none">Daily Assignment Hub</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                     Targets must match clinical pool for solver execution.
                  </CardDescription>
                </div>
              </div>
              {DAYS.some(d => !dayStatus(d).ok) && (
                <Badge variant="destructive" className="animate-pulse px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-destructive/20 border-none">
                  <AlertTriangle className="size-4 mr-2" /> Coverage Imbalance
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse min-w-[1200px]">
                <TableHeader className="bg-white/[0.02]">
                  <TableRow>
                    <TableHead className="w-[300px] pl-10 py-10 sticky left-0 z-30 bg-slate-900 border-r border-white/5">
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/60">Clinical Unit Nodes</span>
                    </TableHead>
                    {DAYS.map(day => (
                      <TableHead key={day} className="text-center px-4 py-8 border-r border-white/5 last:border-0">
                        <div className="flex flex-col items-center gap-4 group">
                          <span className="text-[10px] uppercase font-black tracking-[0.3em] text-white/40">{day.substring(0,3)}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-12 rounded-2xl border-2 border-white/5 hover:bg-secondary/20 hover:text-secondary hover:border-secondary transition-all shadow-sm group"
                            onClick={() => handleCopyDay(day)}
                            title={`Clone ${day} to all other days`}
                          >
                            <Copy className="size-5 group-hover:scale-110 transition-transform" />
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftsLoading ? (
                    Array(6).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={8} className="py-12 px-10"><Skeleton className="h-16 w-full rounded-2xl opacity-10" /></TableCell></TableRow>
                    ))
                  ) : shifts?.map((shift) => (
                    <TableRow key={shift.id} className="hover:bg-white/[0.02] group border-b border-white/5 last:border-0 transition-colors">
                      <TableCell className="pl-10 py-8 sticky left-0 z-20 bg-slate-900/95 backdrop-blur-md border-r border-white/5 group-hover:bg-white/[0.05] transition-colors shadow-[8px_0_15px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-[16px] text-white tracking-tight group-hover:translate-x-2 transition-transform leading-none">{shift.name}</span>
                          <div className="flex items-center gap-3">
                             <Badge variant="outline" className="text-[9px] font-black text-secondary border-secondary/20 uppercase tracking-widest px-2 py-0.5 rounded-lg">{shift.id}</Badge>
                             <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{shift.startTime}—{shift.endTime}</span>
                          </div>
                        </div>
                      </TableCell>
                      {DAYS.map(day => (
                        <TableCell key={day} className="text-center px-6 py-8 border-r border-white/5 last:border-0">
                          <div className="relative group/input">
                            <Input 
                              type="number" 
                              className="w-24 mx-auto h-16 text-center font-black text-3xl bg-white/[0.02] border-2 border-white/10 rounded-2xl focus:border-secondary focus:bg-secondary/5 focus:ring-0 transition-all shadow-inner text-white tabular-nums"
                              value={quotas[`${day}_${shift.id}`] || 0}
                              onChange={(e) => handleQuotaChange(day, shift.id, e.target.value)}
                            />
                            <div className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-secondary opacity-0 group-focus-within/input:opacity-100 transition-opacity animate-pulse shadow-[0_0_10px_blue]" />
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  
                  {/* Status Rows */}
                  <TableRow className="bg-white/[0.01] font-black border-t-2 border-white/10">
                    <TableCell className="pl-10 py-10 text-[11px] uppercase tracking-[0.4em] text-white/30 border-r border-white/5 sticky left-0 z-20 bg-slate-900/90">Clinical Pool Availability</TableCell>
                    {DAYS.map(day => (
                      <TableCell key={day} className="text-center px-6 py-10 border-r border-white/5 last:border-0">
                        <div className="flex flex-col items-center">
                          <span className="text-white text-3xl font-black tracking-tighter tabular-nums">{dailyAvailability[day] || 0}</span>
                          <span className="text-[9px] font-black uppercase text-white/20 tracking-widest mt-2">ELIGIBLE</span>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-secondary/5 font-black border-t-4 border-secondary/40 shadow-2xl">
                    <TableCell className="pl-10 py-12 text-[11px] uppercase tracking-[0.4em] text-secondary border-r border-white/5 sticky left-0 z-20 bg-slate-900">Final Target Requirement</TableCell>
                    {DAYS.map(day => {
                      const status = dayStatus(day);
                      return (
                        <TableCell key={day} className="text-center px-6 py-12 border-r border-white/5 last:border-0">
                          <div className="flex flex-col items-center gap-3">
                            <span className={cn(
                              "text-4xl font-black tracking-tighter tabular-nums drop-shadow-2xl",
                              status.ok ? 'text-emerald-500' : 'text-destructive'
                            )}>
                              {status.req}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-black uppercase tracking-[0.15em] px-4 py-1.5 rounded-xl border-2 transition-all duration-500",
                              status.ok ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 
                              status.diff > 0 ? 'border-secondary/20 text-secondary bg-secondary/5' :
                              'border-destructive/20 text-destructive bg-destructive/5'
                            )}>
                              {status.ok ? 'MATCHED' : status.diff > 0 ? `+${status.diff} SURPLUS` : `${status.diff} SHORTFALL`}
                            </Badge>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="bg-white/[0.02] p-10 border-t border-white/5">
               <div className="flex items-center gap-10">
                  <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                     <Info className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Solver Validation Protocol</p>
                    <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                      The CP-SAT node strictly enforces these quotas as hard constraints. 
                      Imbalanced targets will trigger a mathematical conflict (INFEASIBLE) during the optimization cycle.
                    </p>
                  </div>
               </div>
            </CardFooter>
          </Card>
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card border-l-4 border-l-secondary">
            <CardHeader className="p-10 pb-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <Target className="size-7 text-secondary" />
                <CardTitle className="text-xl font-black uppercase tracking-tight text-white">Pod Diversity</CardTitle>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 text-white/30">Soft objectives for gender balance.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              {shifts?.map(shift => (
                <div key={shift.id} className="space-y-6 pb-8 border-b border-white/5 last:border-0 last:pb-0 group">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-black uppercase tracking-widest text-secondary flex items-center gap-3">
                      <ChevronRight className="size-4 text-white/20 group-hover:translate-x-1 transition-transform" /> {shift.name}
                    </p>
                    <span className="text-[10px] font-mono font-black text-white/20">{shift.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] px-1 ml-1 flex items-center gap-2">
                        <ArrowUpRight className="size-3 text-secondary" /> Male Band
                      </Label>
                      <Select 
                        value={genderTargets[shift.id]?.male || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'male', val)}
                      >
                        <SelectTrigger className="h-12 text-[11px] font-black rounded-xl border-2 border-white/10 bg-white/[0.02] shadow-sm hover:border-secondary transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl bg-slate-900/95 backdrop-blur-xl p-2">
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[11px] font-bold rounded-lg uppercase py-3">{b} Required</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] px-1 ml-1 flex items-center gap-2">
                         <ArrowUpRight className="size-3 text-accent" /> Female Band
                      </Label>
                      <Select 
                        value={genderTargets[shift.id]?.female || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'female', val)}
                      >
                        <SelectTrigger className="h-12 text-[11px] font-black rounded-xl border-2 border-white/10 bg-white/[0.02] shadow-sm hover:border-accent transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl bg-slate-900/95 backdrop-blur-xl p-2">
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[11px] font-bold rounded-lg uppercase py-3">{b} Required</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground premium-card relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-110 transition-transform duration-1000 opacity-[0.03]">
               <ShieldCheck size={280} />
            </div>
            <CardContent className="p-10 space-y-8 relative z-10">
               <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                  <ShieldCheck className="size-8 text-white" />
               </div>
               <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Integrity Protocol</p>
                  <p className="text-lg font-black text-white uppercase tracking-tight leading-tight">Deterministic Core</p>
               </div>
               <p className="text-[13px] font-medium leading-relaxed opacity-70 uppercase tracking-tight">
                 "Staffing quotas are treated as absolute HEADCOUNT requirements. Soft objectives, such as gender targets, are optimized only after 100% quota fulfillment is mathematically proven."
               </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
