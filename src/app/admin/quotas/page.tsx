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

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  
  // Filtered queries to satisfy hardened matchesOffice rules
  const empQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employees');
    return profile.role === 'SUPER_ADMIN'
      ? query(q, where('status', '==', 'Active'))
      : query(q, where('office', '==', profile.office), where('status', '==', 'Active'));
  }, [db, profile]);

  const bookQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'weekoff_bookings');
    return profile.role === 'SUPER_ADMIN'
      ? query(q, where('weekId', '==', weekId))
      : query(q, where('weekId', '==', weekId), where('office', '==', profile.office));
  }, [db, weekId, profile]);

  const { data: shifts, loading: shiftsLoading } = useCollection(shiftQuery);
  const { data: employees } = useCollection(empQuery);
  const { data: bookings } = useCollection(bookQuery);

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
      avail[day] = Math.max(0, employees.length - offCount);
    });
    return avail;
  }, [employees, weekId, bookings]);

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
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Target className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Shift Quotas</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Staffing Optimization Node <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <div className="flex items-center gap-2">
                 <Input 
                  className="w-24 h-6 font-black text-black border-none bg-transparent focus-visible:ring-0 p-0 text-[16px]" 
                  value={weekId} 
                  onChange={(e) => setWeekId(e.target.value)}
                />
              </div>
           </div>
           <Button 
             className="bg-secondary text-white h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl group" 
             onClick={handleSave} 
             disabled={saving}
           >
            {saving ? <Zap className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            {saving ? 'SYNCING...' : 'SAVE MATRIX'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-9">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-slate-100">
                  <Users className="size-8 text-secondary" />
                </div>
                <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Assignment Hub</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse min-w-[1000px]">
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Clinical Unit Nodes</TableHead>
                    {DAYS.map(day => (
                      <TableHead key={day} className="text-center px-4 py-8 border-r border-slate-100 last:border-0 group/head">
                        <span className="text-[10px] uppercase font-black tracking-[0.3em] text-black/40">{day.substring(0,3)}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftsLoading ? (
                    Array(6).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={8} className="py-10 px-10"><Skeleton className="h-12 w-full rounded-xl bg-slate-50 opacity-10" /></TableCell></TableRow>
                    ))
                  ) : shifts?.map((shift) => (
                    <TableRow key={shift.id} className="hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0">
                      <TableCell className="pl-10 py-6 border-r border-slate-100">
                        <span className="font-black text-[15px] text-black uppercase">{shift.name}</span>
                      </TableCell>
                      {DAYS.map(day => (
                        <TableCell key={day} className="text-center px-4 py-6 border-r border-slate-100 last:border-0">
                          <Input 
                            type="number" 
                            className="w-16 mx-auto h-10 text-center font-black text-lg bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-secondary transition-all"
                            value={quotas[`${day}_${shift.id}`] || 0}
                            onChange={(e) => handleQuotaChange(day, shift.id, e.target.value)}
                          />
                        </TableCell>
                      ))}
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