
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
import { Target, Save, Copy, AlertTriangle, Info, Users, CheckCircle2, ChevronRight } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Shift Quota Matrix</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Define EXACT staffing counts. Solver requires an exact match for execution.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border shadow-sm">
           <Label className="text-[10px] font-black uppercase text-muted-foreground px-3">Roster Week</Label>
           <Input 
             className="w-32 h-9 font-black text-secondary border-none bg-secondary/5 focus-visible:ring-0" 
             value={weekId} 
             onChange={(e) => setWeekId(e.target.value)}
           />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3 shadow-md border-t-4 border-t-primary rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between py-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="size-6" />
              </div>
              <div>
                <CardTitle className="text-lg uppercase font-black">Daily Assignment Hub</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                   Total Assignments MUST match available staff for every day.
                </CardDescription>
              </div>
            </div>
            {DAYS.some(d => !dayStatus(d).ok) && (
              <Badge variant="destructive" className="animate-pulse px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest">
                <AlertTriangle className="size-3 mr-2" /> Headcount Imbalance
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-56 pl-8">Operational Shift</TableHead>
                  {DAYS.map(day => (
                    <TableHead key={day} className="text-center px-2">
                      <div className="flex flex-col items-center group py-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-primary mb-1">{day.substring(0,3)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7 rounded-lg opacity-20 hover:opacity-100 hover:bg-secondary/10 hover:text-secondary transition-all"
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
                    <TableRow key={i}><TableCell colSpan={8} className="py-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : shifts?.map((shift) => (
                  <TableRow key={shift.id} className="hover:bg-muted/5 group border-b last:border-0">
                    <TableCell className="pl-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-primary tracking-tight">{shift.name}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-60">{shift.startTime}—{shift.endTime}</span>
                      </div>
                    </TableCell>
                    {DAYS.map(day => (
                      <TableCell key={day} className="text-center px-2">
                        <Input 
                          type="number" 
                          className="w-16 mx-auto h-10 text-center font-black text-lg bg-background border-2 border-primary/10 rounded-xl focus:border-secondary transition-all"
                          value={quotas[`${day}_${shift.id}`] || 0}
                          onChange={(e) => handleQuotaChange(day, shift.id, e.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                
                <TableRow className="bg-muted/40 font-black">
                  <TableCell className="pl-8 py-6 text-[10px] uppercase tracking-widest text-muted-foreground">Clinical Eligibility</TableCell>
                  {DAYS.map(day => (
                    <TableCell key={day} className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-primary text-xl font-black tracking-tighter">{dailyAvailability[day] || 0}</span>
                        <span className="text-[8px] font-black uppercase text-primary/40 tracking-tighter">STAFF</span>
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-primary/5 font-black border-t-2 border-primary/20">
                  <TableCell className="pl-8 py-6 text-[10px] uppercase tracking-widest text-primary">Required Target</TableCell>
                  {DAYS.map(day => {
                    const status = dayStatus(day);
                    return (
                      <TableCell key={day} className="text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-xl font-black tracking-tighter ${status.ok ? 'text-emerald-600' : 'text-destructive'}`}>
                            {status.req}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-tighter ${status.ok ? 'text-emerald-600/60' : 'text-destructive/60'}`}>
                            {status.ok ? 'MATCHED' : status.diff > 0 ? `SURPLUS: ${status.diff}` : `SHORT: ${Math.abs(status.diff)}`}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="bg-muted/5 p-6 border-t flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shadow-sm">
                   <Info className="size-4" />
                </div>
                <p className="text-[10px] font-black text-muted-foreground uppercase leading-tight max-w-sm tracking-tight">
                  Pre-feasibility validation active. Solve execution is blocked until staffing shortage/surplus is zeroed out for all weekdays.
                </p>
             </div>
             <Button className="bg-primary h-14 px-10 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 transition-all" onClick={handleSave} disabled={saving}>
               <Save className="mr-3 h-5 w-5" /> {saving ? 'Committing...' : 'Save Matrix'}
             </Button>
          </CardFooter>
        </Card>

        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md border-t-4 border-t-secondary rounded-2xl overflow-hidden bg-secondary/5">
            <CardHeader className="py-6 border-b bg-white/50">
              <div className="flex items-center gap-3">
                <Target className="size-5 text-secondary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest">Diversity Targets</CardTitle>
              </div>
              <CardDescription className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-60">Soft optimization targets for gender balance.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {shifts?.map(shift => (
                <div key={shift.id} className="space-y-3 pb-4 border-b border-secondary/10 last:border-0 last:pb-0">
                  <p className="text-[10px] font-black uppercase tracking-tight text-primary flex items-center gap-2">
                    <ChevronRight className="size-3 opacity-30" /> {shift.name}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest px-1">Male Band</Label>
                      <Select 
                        value={genderTargets[shift.id]?.male || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'male', val)}
                      >
                        <SelectTrigger className="h-8 text-[10px] font-black rounded-lg border-2 border-secondary/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[10px] font-bold">{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest px-1">Female Band</Label>
                      <Select 
                        value={genderTargets[shift.id]?.female || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'female', val)}
                      >
                        <SelectTrigger className="h-8 text-[10px] font-black rounded-lg border-2 border-secondary/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b} className="text-[10px] font-bold">{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground rounded-2xl shadow-xl border-none overflow-hidden group">
            <CardContent className="p-6 space-y-4">
               <div className="size-8 rounded-lg bg-secondary flex items-center justify-center group-hover:rotate-12 transition-transform duration-500">
                  <ShieldCheck className="size-5 text-white" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Solver Integrity</p>
               <p className="text-[12px] font-medium leading-relaxed opacity-70">
                 The CP-SAT engine prioritizes HARD staffing quotas. Gender targets are treated as soft objectives to avoid infeasible results.
               </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
