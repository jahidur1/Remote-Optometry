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
  Clock,
  Building2
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoBadge } from '@/components/ui/demo-badge';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ALL_OFFICES = [
  { id: "KOLKATA_ROC", name: "KOLKATA ROC" },
  { id: "GURGAON_ROC", name: "GURGAON ROC" },
  { id: "LUCKNOW_ROC", name: "LUCKNOW ROC" }
];

export default function QuotaConfiguration() {
  const [weekId, setWeekId] = useState('2024-52');
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [genderTargets, setGenderTargets] = useState<Record<string, { male: string; female: string }>>({});
  const [saving, setSaving] = useState(false);

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  // 1. Authorized Office List Calculation
  const authorizedOffices = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'SUPER_ADMIN') return ALL_OFFICES;
    
    // For ADMIN: Check officeIds array (introduced in Phase 2.2) 
    // fallback to single office string for legacy compatibility
    const allowedIds = profile.officeIds || (profile.office ? [profile.office] : []);
    return ALL_OFFICES.filter(o => allowedIds.includes(o.id));
  }, [profile]);

  // Set default office once profile is loaded
  useEffect(() => {
    if (authorizedOffices.length > 0 && !selectedOffice) {
      setSelectedOffice(authorizedOffices[0].id);
    }
  }, [authorizedOffices, selectedOffice]);

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  
  // Filtered queries to satisfy hardened matchesOffice rules
  const empQuery = useMemo(() => {
    if (!profile || !selectedOffice) return null;
    return query(
      collection(db, 'employees'), 
      where('office', '==', selectedOffice), 
      where('status', '==', 'Active')
    );
  }, [db, profile, selectedOffice]);

  const bookQuery = useMemo(() => {
    if (!profile || !selectedOffice || !weekId) return null;
    return query(
      collection(db, 'weekoff_bookings'),
      where('weekId', '==', weekId),
      where('office', '==', selectedOffice)
    );
  }, [db, weekId, selectedOffice, profile]);

  const { data: shifts, loading: shiftsLoading } = useCollection(shiftQuery);
  const { data: employees } = useCollection(empQuery);
  const { data: bookings } = useCollection(bookQuery);

  // 2. Localized Quota Subscription: {weekId}_{officeId}
  useEffect(() => {
    if (!db || !weekId || !selectedOffice) return;
    
    const localizedId = `${weekId}_${selectedOffice}`;
    const unsub = onSnapshot(doc(db, 'roster_quotas', localizedId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setQuotas(data.quotas || {});
        setGenderTargets(data.genderTargets || {});
      } else {
        // Handle unconfigured state: Reset to 0
        setQuotas({});
        setGenderTargets({});
      }
    });
    return () => unsub();
  }, [db, weekId, selectedOffice]);

  const dailyAvailability = useMemo(() => {
    if (!employees || !weekId) return {};
    const weekDates = getDatesForWeek(weekId);
    if (weekDates.length === 0) return {};

    const avail: Record<string, number> = {};
    DAYS.forEach((day, index) => {
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

  const handleSave = async () => {
    if (!selectedOffice) return;
    setSaving(true);
    try {
      const localizedId = `${weekId}_${selectedOffice}`;
      const docRef = doc(db, 'roster_quotas', localizedId);
      
      const payload = {
        weekId,
        officeId: selectedOffice,
        quotas,
        genderTargets,
        updatedAt: new Date().toISOString(),
        actorId: profile?.uid
      };
      
      await setDoc(docRef, payload);
      logAudit(db, profile?.uid || 'system', 'CONFIGURE_ROSTER_QUOTAS_OFFICE', localizedId, { quotaCount: Object.keys(quotas).length });
      toast({ title: "Configuration Secured", description: `${selectedOffice.replace('_', ' ')} targets updated in registry.` });
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cluster</label>
              <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                <SelectTrigger className="h-6 w-40 font-black text-black border-none bg-transparent focus:ring-0 p-0 text-[14px]">
                  <SelectValue placeholder="Select Node..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                  {authorizedOffices.map(o => <SelectItem key={o.id} value={o.id} className="font-bold text-[11px] py-2.5 rounded-lg uppercase">{o.name}</SelectItem>)}
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
              </div>
           </div>
           <Button 
             className="bg-secondary text-white h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl group" 
             onClick={handleSave} 
             disabled={saving || !selectedOffice}
           >
            {saving ? <Zap className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            {saving ? 'SYNCING...' : 'SAVE MATRIX'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-9">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-slate-100">
                  <Users className="size-8 text-secondary" />
                </div>
                <div>
                   <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Assignment Hub</CardTitle>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2 flex items-center gap-2">
                      <Building2 className="size-3" /> {selectedOffice?.replace('_', ' ') || 'NODE_PENDING'}
                   </p>
                </div>
              </div>
              <Badge variant="outline" className="px-6 py-2 rounded-xl font-black text-[10px] uppercase border-secondary/20 text-secondary bg-secondary/5 shadow-inner">
                 Capacity: {employees?.length || 0} Authorized
              </Badge>
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
                  <TableRow className="bg-slate-50/50">
                    <TableCell className="pl-10 py-6 border-r border-slate-100">
                       <span className="font-black text-[11px] text-primary/40 uppercase tracking-widest">Daily Requirements</span>
                    </TableCell>
                    {DAYS.map(day => (
                      <TableCell key={day} className="text-center px-4 py-6 border-r border-slate-100 last:border-0">
                         <span className="text-lg font-black text-primary/60 tabular-nums">{dailyQuotaTotals[day] || 0}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-8">
           <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white border-l-4 border-l-secondary">
             <CardHeader className="p-10 pb-6 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-4">
                  <ShieldCheck className="size-6 text-secondary" /> Guard Node
                </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-8">
                {DAYS.map(day => {
                   const status = dayStatus(day);
                   return (
                     <div key={day} className="flex justify-between items-center group">
                        <span className="text-[11px] font-black uppercase text-black/40 group-hover:text-black transition-colors">{day}</span>
                        <Badge className={cn(
                          "font-black text-[10px] tracking-widest px-4 py-1 rounded-lg border-none",
                          status.diff < 0 ? 'bg-destructive text-white' : 'bg-emerald-500/10 text-emerald-600'
                        )}>
                           {status.req} / {status.avail}
                        </Badge>
                     </div>
                   )
                })}
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );

  function dayStatus(day: string) {
    const avail = dailyAvailability[day] || 0;
    const req = dailyQuotaTotals[day] || 0;
    const diff = avail - req;
    return { avail, req, diff, ok: diff >= 0 };
  }
}
