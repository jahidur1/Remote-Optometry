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
import { Target, Save, Copy, AlertTriangle, Info, Users, ArrowRightLeft, CheckCircle2 } from "lucide-react";
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

  const isInfeasible = useMemo(() => {
    return DAYS.some(day => (dailyQuotaTotals[day] || 0) !== (dailyAvailability[day] || 0));
  }, [dailyQuotaTotals, dailyAvailability]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Shift Quota Matrix</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Define EXACT required employee counts per shift. Solver requires exact matches.</p>
        </div>
        <div className="flex items-center gap-2">
           <Label className="text-xs font-bold text-muted-foreground uppercase">Target Week</Label>
           <Input 
             className="w-32 h-9 font-bold text-secondary" 
             value={weekId} 
             onChange={(e) => setWeekId(e.target.value)}
           />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3 shadow-md border-t-4 border-t-primary overflow-hidden">
          <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="size-5 text-primary" /> Daily Exact Headcounts
              </CardTitle>
              <CardDescription>All assignments must be accounted for. Totals must match available staff.</CardDescription>
            </div>
            {isInfeasible && (
              <Badge variant="destructive" className="animate-pulse uppercase font-black text-[10px]">
                <AlertTriangle className="size-3 mr-1" /> Imbalance Detected
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[180px]">Operational Shift</TableHead>
                  {DAYS.map(day => (
                    <TableHead key={day} className="text-center">
                      <div className="flex flex-col items-center group">
                        <span className="text-[10px] uppercase font-black tracking-widest">{day.substring(0,3)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-6 opacity-40 hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyDay(day)}
                          title={`Clone ${day} to all days`}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftsLoading ? (
                  Array(6).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : shifts?.map((shift) => (
                  <TableRow key={shift.id} className="group hover:bg-muted/10">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{shift.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono uppercase">{shift.startTime}—{shift.endTime}</span>
                      </div>
                    </TableCell>
                    {DAYS.map(day => (
                      <TableCell key={day} className="text-center">
                        <Input 
                          type="number" 
                          className="w-16 mx-auto h-9 text-center font-bold bg-background/50 border-primary/20 focus:border-primary transition-all"
                          value={quotas[`${day}_${shift.id}`] || 0}
                          onChange={(e) => handleQuotaChange(day, shift.id, e.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                
                <TableRow className="bg-muted/30 font-black border-t-2">
                  <TableCell className="text-xs uppercase tracking-widest">Available Professionals</TableCell>
                  {DAYS.map(day => (
                    <TableCell key={day} className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-primary text-lg">{dailyAvailability[day] || 0}</span>
                        <span className="text-[9px] text-muted-foreground">ELG. STAFF</span>
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-primary/5 font-black">
                  <TableCell className="text-xs uppercase tracking-widest">Total Planned Assignments</TableCell>
                  {DAYS.map(day => {
                    const diff = (dailyAvailability[day] || 0) - (dailyQuotaTotals[day] || 0);
                    return (
                      <TableCell key={day} className="text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-lg ${diff !== 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                            {dailyQuotaTotals[day] || 0}
                          </span>
                          <span className={`text-[9px] uppercase ${diff !== 0 ? 'text-destructive' : 'text-emerald-600/60'}`}>
                            {diff === 0 ? 'MATCHED' : diff > 0 ? `SURPLUS: ${diff}` : `SHORT: ${Math.abs(diff)}`}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="bg-muted/5 p-4 border-t flex justify-between items-center">
             <div className="flex gap-4 items-center">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                   <Info className="size-3" /> Exact headcount matching required for OR-Tools execution.
                </div>
             </div>
             <Button className="bg-primary shadow-lg shadow-primary/10" onClick={handleSave} disabled={saving}>
               <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Commit Quota Matrix'}
             </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-1 shadow-md border-t-4 border-t-secondary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="size-5 text-secondary" />
              <CardTitle className="text-lg">Diversity Targets</CardTitle>
            </div>
            <CardDescription>Soft objectives for gender balance (per shift).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {shifts?.map(shift => (
                <div key={shift.id} className="space-y-3 pb-4 border-b last:border-0">
                  <p className="text-xs font-black uppercase tracking-tighter text-foreground">{shift.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase opacity-60">Men Target</Label>
                      <Select 
                        value={genderTargets[shift.id]?.male || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'male', val)}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase opacity-60">Women Target</Label>
                      <Select 
                        value={genderTargets[shift.id]?.female || "1"} 
                        onValueChange={(val) => handleGenderChange(shift.id, 'female', val)}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_BANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/5 py-4">
             <div className="flex gap-2 items-start opacity-70">
                <Info className="size-4 shrink-0 mt-0.5 text-secondary" />
                <p className="text-[9px] font-medium leading-normal uppercase">
                   Optimization engine prioritizes hard staffing quotas over these balance objectives.
                </p>
             </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}