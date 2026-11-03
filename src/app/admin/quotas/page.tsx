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
import { 
  Target, 
  Save, 
  Copy, 
  AlertTriangle, 
  Info, 
  Users, 
  CheckCircle2, 
  Activity, 
  ShieldCheck, 
  Zap, 
  ArrowUpRight,
  Database,
  ChevronRight,
  Clock
} from "lucide-react";
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

  // Stable Authoritative Fetch
  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const empQuery = useMemo(() => query(collection(db, 'employees'), where('status', '==', 'Active')), [db]);
  const bookQuery = useMemo(() => query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)), [db, weekId]);
  const leaveQuery = useMemo(() => query(collection(db, 'employee_leaves'), where('status', '==', 'approved')), [db]);

  const { data: shifts, loading: shiftsLoading } = useCollection(shiftQuery);
  const { data: employees } = useCollection(empQuery);
  const { data: bookings } = useCollection(bookQuery);
  const { data: leaves } = useCollection(leaveQuery);

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
      avail[day] = Math.max(0, employees.length - offCount - leaveCount);
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
    toast({ title: "Quotas Synchronized", description: `Targets from ${fromDay} applied across all nodes.` });
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
      toast({ title: "Configuration Secured", description: "Roster engine targets updated in clinical registry." });
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
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
                  Staffing Optimization Node <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 border-r border-white/5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <div className="flex items-center gap-2">
                 <Input 
                  className="w-24 h-6 font-black text-white border-none bg-transparent focus-visible:ring-0 p-0 text-[16px]" 
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
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">LIVE SYNC</span>
              </div>
           </div>
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleSave} 
             disabled={saving}
           >
            {saving ? <Zap className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2 group-hover:rotate-12 transition-transform" />}
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
                  <CardTitle className="text-2xl uppercase font-black tracking-tight text-white leading-none">Assignment Hub</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                     Staffing requirements per daily clinical node.
                  </CardDescription>
                </div>
              </div>
              {DAYS.some(d => !dayStatus(d).ok) && (
                <Badge variant="destructive" className="animate-pulse px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl border-none">
                  <AlertTriangle className="size-3.5 mr-2" /> Shortfall Detected
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse min-w-[1000px]">
                <TableHeader className="bg-white/[0.02]">
                  <TableRow>
                    <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Clinical Unit Nodes</TableHead>
                    {DAYS.map(day => (
                      <TableHead key={day} className="text-center px-4 py-8 border-r border-white/5 last:border-0 group/head">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[10px] uppercase font-black tracking-[0.3em] text-white/40">{day.substring(0,3)}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 rounded-xl border border-white/5 hover:bg-secondary/20 hover:text-secondary transition-all opacity-0 group-hover/head:opacity-100"
                            onClick={() => handleCopyDay(day)}
                            title={`Clone ${day} to all other days`}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftsLoading ? (
                    Array(6).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={8} className="py-10 px-10"><Skeleton className="h-12 w-full rounded-xl opacity-10 bg-white" /></TableCell></TableRow>
                    ))
                  ) : shifts?.map((shift) => (
                    <TableRow key={shift.id} className="hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                      <TableCell className="pl-10 py-6 border-r border-white/5">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-[15px] text-white tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{shift.name}</span>
                          <div className="flex items-center gap-2">
                             <Badge variant="outline" className="text-[8px] font-black text-secondary border-secondary/20 uppercase px-2 py-0.5 rounded-md">{shift.id}</Badge>
                             <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{shift.startTime}—{shift.endTime}</span>
                          </div>
                        </div>
                      </TableCell>
                      {DAYS.map(day => (
                        <TableCell key={day} className="text-center px-4 py-6 border-r border-white/5 last:border-0">
                          <Input 
                            type="number" 
                            className="w-16 mx-auto h-10 text-center font-black text-lg bg-white/[0.02] border-2 border-white/10 rounded-xl focus:border-secondary focus:bg-secondary/5 transition-all text-white tabular-nums"
                            value={quotas[`${day}_${shift.id}`] || 0}
                            onChange={(e) => handleQuotaChange(day, shift.id, e.target.value)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  
                  {/* Status Pulse Rows */}
                  <TableRow className="bg-white/[0.02] border-t-2 border-white/10">
                    <TableCell className="pl-10 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 border-r border-white/5">Active Pool Availability</TableCell>
                    {DAYS.map(day => (
                      <TableCell key={day} className="text-center px-4 py-6 border-r border-white/5 last:border-0">
                        <div className="flex flex-col items-center">
                          <span className="text-white font-black text-xl tabular-nums">{dailyAvailability[day] || 0}</span>
                          <span className="text-[8px] font-black uppercase text-white/20 tracking-widest">ELIGIBLE</span>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-secondary/5 border-t-4 border-secondary/40 shadow-2xl">
                    <TableCell className="pl-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-secondary border-r border-white/5">Net Requirement Gap</TableCell>
                    {DAYS.map(day => {
                      const status = dayStatus(day);
                      return (
                        <TableCell key={day} className="text-center px-4 py-8 border-r border-white/5 last:border-0">
                          <div className="flex flex-col items-center gap-2">
                            <span className={cn(
                              "text-3xl font-black tabular-nums drop-shadow-xl",
                              status.ok ? 'text-emerald-500' : 'text-destructive'
                            )}>
                              {status.req}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border-none",
                              status.ok ? 'bg-emerald-500 text-white' : 'bg-destructive text-white'
                            )}>
                              {status.ok ? 'MATCHED' : status.diff > 0 ? `SURPLUS ${status.diff}` : `SHORT ${Math.abs(status.diff)}`}
                            </Badge>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="bg-white/[0.02] p-8 border-t border-white/5">
               <div className="flex items-center gap-8">
                  <div className="size-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                     <Info className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Solver Validation Protocol</p>
                    <p className="text-[12px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                      Staffing quotas are treated as absolute **hard constraints** for the deterministic optimization node. 
                      Any shortfall between the net requirement and available clinical pool will trigger a mathematical conflict (INFEASIBLE).
                    </p>
                  </div>
               </div>
            </CardFooter>
          </Card>
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card border-l-4 border-l-secondary">
            <CardHeader className="p-8 pb-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <Target className="size-6 text-secondary" />
                <CardTitle className="text-lg font-black uppercase tracking-tight text-white leading-none">Pod Diversity</CardTitle>
              </div>
              <CardDescription className="text-[9px] font-bold uppercase tracking-widest mt-2 text-white/30">Soft Optimization Objectives</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {shifts?.map(shift => (
                <div key={shift.id} className="space-y-4 pb-6 border-b border-white/5 last:border-0 last:pb-0 group">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                      <ChevronRight className="size-3 text-secondary" /> {shift.id} Node
                    </p>
                    <span className="text-[9px] font-mono font-black text-white/20 uppercase">{shift.startTime}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[8px] font-black uppercase text-white/40 tracking-widest ml-1">Male Target</Label>
                      <Select 
                        value={genderTargets[shift.id]?.male || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'male', val)}
                      >
                        <SelectTrigger className="h-9 text-[10px] font-black rounded-lg border-2 border-white/5 bg-white/[0.02] hover:border-secondary transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl bg-slate-900/95 backdrop-blur-xl p-2">
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[10px] font-bold rounded-lg uppercase py-2.5">{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[8px] font-black uppercase text-white/40 tracking-widest ml-1">Female Target</Label>
                      <Select 
                        value={genderTargets[shift.id]?.female || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'female', val)}
                      >
                        <SelectTrigger className="h-9 text-[10px] font-black rounded-lg border-2 border-white/5 bg-white/[0.02] hover:border-accent transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl bg-slate-900/95 backdrop-blur-xl p-2">
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[10px] font-bold rounded-lg uppercase py-2.5">{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-8 space-y-6 group border-l-4 border-l-secondary shadow-2xl">
             <div className="space-y-3">
                <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-105 transition-transform">
                   <ShieldCheck className="size-6" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary">Integrity Protocol</p>
                   <p className="text-lg font-black text-white uppercase tracking-tight">Deterministic Core</p>
                </div>
             </div>
             
             <p className="text-[12px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
               "Staffing quotas are treated as absolute headcount requirements. Soft objectives, such as gender targets, 
               are optimized only after 100% quota fulfillment is mathematically proven by the CP-SAT engine."
             </p>
             
             <div className="pt-4 border-t border-white/10 flex items-center gap-3">
                <Zap className="size-4 text-secondary" />
                <p className="text-[9px] font-black uppercase text-secondary tracking-[0.2em]">Institutional Access Guard Active</p>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
