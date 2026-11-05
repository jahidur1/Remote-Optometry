
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, doc, onSnapshot, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Target, 
  Save, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Database,
  Building2,
  Clock,
  Loader2,
  CalendarDays
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { saveQuotaAction } from '@/services/quota-actions';
import { getDatesForWeek, formatWeekId, displayWeekRange, getCurrentWeekId } from '@/lib/date-utils';

export default function QuotaConfiguration() {
  const [weekId, setWeekId] = useState(getCurrentWeekId());
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  const officesQuery = useMemo(() => query(collection(db, 'offices'), where('status', '==', 'Active')), [db]);
  const { data: registryOffices, loading: registryLoading } = useCollection(officesQuery);

  const authorizedOffices = useMemo(() => {
    if (!profile || !registryOffices) return [];
    if (profile.role === 'super_admin') return registryOffices;
    
    const allowedIds = profile.officeIds || (profile.office ? [profile.office] : []);
    return registryOffices.filter(o => allowedIds.includes(o.officeId));
  }, [profile, registryOffices]);

  useEffect(() => {
    if (authorizedOffices.length > 0 && !selectedOffice) {
      setSelectedOffice(authorizedOffices[0].officeId);
    }
  }, [authorizedOffices, selectedOffice]);

  const activeDays = useMemo(() => {
    if (!weekId) return [];
    return getDatesForWeek(weekId).map(d => format(d, 'EEEE'));
  }, [weekId]);

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const { data: shifts, loading: shiftsLoading } = useCollection(shiftQuery);

  useEffect(() => {
    if (!db || !weekId || !selectedOffice) return;
    
    const localizedId = `${weekId}_${selectedOffice}`;
    const unsub = onSnapshot(doc(db, 'roster_quotas', localizedId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setQuotas(data.quotas || {});
      } else {
        setQuotas({});
      }
    });
    return () => unsub();
  }, [db, weekId, selectedOffice]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setWeekId(formatWeekId(date));
  };

  const handleQuotaChange = (day: string, shiftId: string, val: string) => {
    const num = parseInt(val) || 0;
    if (num < 0) return;
    setQuotas(prev => ({ ...prev, [`${day}_${shiftId}`]: num }));
  };

  const handleSave = async () => {
    if (!selectedOffice || !weekId) return;
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const result = await saveQuotaAction(idToken, {
        weekId,
        officeId: selectedOffice,
        quotas,
      });
      
      if (result.success) {
        toast({ title: "Configuration Secured" });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Target className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Shift Quotas</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cluster</label>
              <Select value={selectedOffice} onValueChange={setSelectedOffice}>
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
                    <span className="text-[14px] uppercase">{weekId ? displayWeekRange(weekId) : 'Select Start'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus />
                </PopoverContent>
              </Popover>
           </div>
           <Button className="bg-secondary text-white h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl" onClick={handleSave} disabled={saving || !selectedOffice || !weekId}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            SAVE MATRIX
           </Button>
        </div>
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between">
           <CardTitle className="text-2xl uppercase font-black tracking-tight leading-none">Assignment Hub</CardTitle>
           <Badge variant="outline" className="px-6 py-2 rounded-xl font-black text-[10px] uppercase border-secondary/20 text-secondary bg-secondary/5">
              {weekId ? displayWeekRange(weekId) : 'CYCLE_PENDING'}
           </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          {!weekId ? (
            <div className="py-40 text-center opacity-30 italic font-black uppercase text-xs tracking-[0.4em]">Select a start date to initiate matrix configuration.</div>
          ) : (
            <Table className="border-collapse min-w-[1000px]">
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Shift Type</TableHead>
                  {activeDays.map(day => (
                    <TableHead key={day} className="text-center px-4 py-8 border-r border-slate-100 last:border-0">
                      <span className="text-[10px] uppercase font-black text-black/40">{day.substring(0,3)}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftsLoading ? (
                  Array(6).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7} className="p-10"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : shifts?.map((shift) => (
                  <TableRow key={shift.id} className="hover:bg-slate-50 border-b last:border-0 transition-colors">
                    <TableCell className="pl-10 py-6 border-r border-slate-100 font-black uppercase">{shift.name}</TableCell>
                    {activeDays.map(day => (
                      <TableCell key={day} className="text-center px-4 py-6 border-r border-slate-100 last:border-0">
                        <Input 
                          type="number" 
                          className="w-16 mx-auto h-10 text-center font-black bg-slate-50 border-2 rounded-xl focus:border-secondary"
                          value={quotas[`${day}_${shift.id}`] || 0}
                          onChange={(e) => handleQuotaChange(day, shift.id, e.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
