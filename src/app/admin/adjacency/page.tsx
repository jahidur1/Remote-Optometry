
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, doc, setDoc, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Search, Target, Info, Loader2, CalendarDays, BarChart3, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { DemoBadge } from '@/components/ui/demo-badge';
import { formatWeekId, displayWeekRange } from '@/lib/date-utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FREQUENCY_RANGES = [
  { label: '0-1', min: 0, max: 1 },
  { label: '1-2', min: 1, max: 2 },
  { label: '2-3', min: 2, max: 3 },
  { label: '3-4', min: 3, max: 4 },
  { label: '4-5', min: 4, max: 5 },
  { label: '5-6', min: 5, max: 6 },
  { label: 'UNRESTRICTED', min: 0, max: 7 },
];

export default function ShiftAdjacencyManager() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [weekId, setWeekId] = useState('20241230-20250105'); 
  const [saving, setSaving] = useState<string | null>(null);

  // Stable Authoritative Fetches
  const empQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employees');
    return profile.role === 'super_admin' 
      ? query(q, where('status', '==', 'Active'), orderBy('fullName', 'asc'))
      : query(q, where('office', '==', profile.office), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, profile]);

  const rulesQuery = useMemo(() => {
    if (!profile || !weekId) return null;
    const q = collection(db, 'shift_adjacency_rules');
    return profile.role === 'super_admin'
      ? query(q, where('weekId', '==', weekId))
      : query(q, where('weekId', '==', weekId), where('office', '==', profile.office));
  }, [db, profile, weekId]);

  const bookingsQuery = useMemo(() => {
    if (!profile || !weekId) return null;
    const q = collection(db, 'weekoff_bookings');
    return profile.role === 'super_admin'
      ? query(q, where('weekId', '==', weekId))
      : query(q, where('weekId', '==', weekId), where('office', '==', profile.office));
  }, [db, profile, weekId]);

  const shiftsQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: shifts } = useCollection(shiftsQuery);
  const { data: rules } = useCollection(rulesQuery);
  const { data: bookings } = useCollection(bookingsQuery);

  const filteredEmployees = useMemo(() => {
      return employees?.filter(emp => 
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [employees, searchTerm]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setWeekId(formatWeekId(date));
  };

  const handleUpdateRule = async (employeeId: string, type: 'pre' | 'post', shiftId: string, checked: boolean) => {
    const emp = employees?.find(e => e.id === employeeId);
    if (!emp) return;

    const ruleId = `${weekId}_${employeeId}`;
    const existingRule = rules?.find(r => r.employeeId === employeeId) || {
      id: ruleId,
      employeeId,
      weekId,
      office: emp.office,
      allowedPreOffShifts: [],
      allowedPostOffShifts: [],
      frequencyLimits: {}
    };

    let updatedList = type === 'pre' ? [...(existingRule.allowedPreOffShifts || [])] : [...(existingRule.allowedPostOffShifts || [])];
    
    if (checked) {
      if (!updatedList.includes(shiftId)) updatedList.push(shiftId);
    } else {
      updatedList = updatedList.filter(id => id !== shiftId);
    }

    const payload = {
      ...existingRule,
      id: ruleId,
      weekId,
      employeeId,
      office: emp.office,
      [type === 'pre' ? 'allowedPreOffShifts' : 'allowedPostOffShifts']: updatedList,
      updatedAt: new Date().toISOString()
    };

    setSaving(employeeId);
    try {
      await setDoc(doc(db, 'shift_adjacency_rules', ruleId), payload, { merge: true });
      logAudit(db, profile?.uid || 'system', 'UPDATE_ADJACENCY_RULE', employeeId, { type, shiftId, checked, office: emp.office });
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateFrequency = async (employeeId: string, shiftId: string, rangeValue: string) => {
    const emp = employees?.find(e => e.id === employeeId);
    if (!emp) return;

    const range = FREQUENCY_RANGES.find(r => r.label === rangeValue);
    if (!range) return;

    const ruleId = `${weekId}_${employeeId}`;
    const existingRule = rules?.find(r => r.employeeId === employeeId) || {
      id: ruleId,
      employeeId,
      weekId,
      office: emp.office,
      allowedPreOffShifts: [],
      allowedPostOffShifts: [],
      frequencyLimits: {}
    };

    const updatedFrequency = {
      ...(existingRule.frequencyLimits || {}),
      [shiftId]: { min: range.min, max: range.max, label: range.label }
    };

    const payload = {
      ...existingRule,
      id: ruleId,
      weekId,
      employeeId,
      office: emp.office,
      frequencyLimits: updatedFrequency,
      updatedAt: new Date().toISOString()
    };

    setSaving(`${employeeId}-${shiftId}`);
    try {
      await setDoc(doc(db, 'shift_adjacency_rules', ruleId), payload, { merge: true });
      logAudit(db, profile?.uid || 'system', 'UPDATE_FREQUENCY_LIMIT', employeeId, { shiftId, range: rangeValue, office: emp.office });
      toast({ title: "Distribution Pulse Updated" });
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 text-black animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-primary font-headline uppercase leading-none">Clinical Matrix Hub</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Define institutional constraints before roster generation pulse.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
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
        </div>
      </div>

      <Tabs defaultValue="frequency" className="space-y-6">
        <TabsList className="h-14 bg-white border-2 border-slate-100 rounded-xl p-1.5 shadow-sm">
          <TabsTrigger value="frequency" className="h-full rounded-lg px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <BarChart3 className="size-3.5 mr-2" /> Shift Distribution
          </TabsTrigger>
          <TabsTrigger value="adjacency" className="h-full rounded-lg px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <ArrowRightLeft className="size-3.5 mr-2" /> Transition Eligibility
          </TabsTrigger>
        </TabsList>

        <TabsContent value="frequency">
          <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden border-t-8 border-t-secondary">
             <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                   <CardTitle className="text-xl font-black uppercase tracking-tight">Shift Frequency Matrix</CardTitle>
                   <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mandatory distribution ranges per professional per week.</CardDescription>
                </div>
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                    <Input placeholder="Search Professionals..." className="pl-12 h-11 text-[11px] font-bold rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
             </CardHeader>
             <CardContent className="p-0 overflow-x-auto no-scrollbar">
                <Table>
                   <TableHeader className="bg-slate-50/30">
                      <TableRow>
                         <TableHead className="w-[280px] pl-10 py-6 uppercase text-[10px] font-black tracking-[0.4em] border-r">Professional</TableHead>
                         {shifts?.map(s => (
                           <TableHead key={s.id} className="text-center py-6 uppercase text-[10px] font-black tracking-[0.3em] border-r">{s.id}</TableHead>
                         ))}
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {empLoading ? (
                        Array(5).fill(0).map((_, i) => (
                          <TableRow key={i}><TableCell colSpan={8} className="p-12"><Loader2 className="animate-spin mx-auto size-6" /></TableCell></TableRow>
                        ))
                      ) : filteredEmployees?.map(emp => {
                        const rule = rules?.find(r => r.employeeId === emp.id);
                        return (
                          <TableRow key={emp.id} className="hover:bg-slate-50 border-b last:border-0 group">
                             <TableCell className="pl-10 py-6 border-r">
                                <div className="flex flex-col">
                                   <span className="font-black text-[15px] text-black uppercase">{emp.fullName}</span>
                                   <code className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{emp.id}</code>
                                </div>
                             </TableCell>
                             {shifts?.map(s => {
                               const currentRange = rule?.frequencyLimits?.[s.id]?.label || 'UNRESTRICTED';
                               return (
                                 <TableCell key={s.id} className="p-4 border-r text-center">
                                    <Select value={currentRange} onValueChange={(val) => handleUpdateFrequency(emp.id, s.id, val)}>
                                       <SelectTrigger className={cn(
                                         "h-10 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all",
                                         currentRange !== 'UNRESTRICTED' ? "bg-secondary text-white border-none shadow-lg" : "bg-slate-50 border-2"
                                       )}>
                                          <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent className="rounded-xl p-2 border-none shadow-2xl">
                                          {FREQUENCY_RANGES.map(range => (
                                            <SelectItem key={range.label} value={range.label} className="font-bold text-[10px] uppercase py-2.5 rounded-lg">
                                               {range.label}
                                            </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </TableCell>
                               );
                             })}
                          </TableRow>
                        );
                      })}
                   </TableBody>
                </Table>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjacency">
           <div className="grid gap-6 lg:grid-cols-4">
               <Card className="bg-primary text-primary-foreground lg:col-span-1 shadow-2xl rounded-3xl overflow-hidden relative border-none">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><ArrowRightLeft size={120} /></div>
                  <CardHeader className="p-8"><CardTitle className="text-xs font-black uppercase tracking-[0.3em] text-secondary">Transition Guard</CardTitle></CardHeader>
                  <CardContent className="px-8 pb-8 space-y-6">
                     <p className="text-[13px] leading-relaxed opacity-70">Define which shifts a professional is authorized to work immediately before and after their clinical week-off.</p>
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center gap-3">
                           <ShieldCheck className="size-4 text-emerald-400" />
                           <span className="text-[10px] font-bold uppercase tracking-widest text-white">Logic Lock</span>
                        </div>
                        <p className="text-[10px] opacity-60 italic">Engines will strictly exclude any shifts not selected here during transition days.</p>
                     </div>
                  </CardContent>
               </Card>
               
               <Card className="lg:col-span-3 shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden border-t-8 border-t-primary">
                 <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="relative w-full max-w-md group">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                         <Input placeholder="Filter Professionals..." className="h-12 pl-12 text-[12px] font-bold bg-white border-2 border-slate-100 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>
                 </CardHeader>
                 <CardContent className="p-0 overflow-x-auto no-scrollbar">
                   <Table>
                     <TableHeader className="bg-slate-50/30">
                       <TableRow className="border-b border-slate-100">
                         <TableHead className="w-[240px] pl-8 py-6 uppercase text-[10px] font-black tracking-[0.3em] border-r">Professional</TableHead>
                         <TableHead className="w-[120px] py-6 uppercase text-[10px] font-black tracking-[0.3em] border-r text-center">Off-Day</TableHead>
                         <TableHead className="py-6 uppercase text-[10px] font-black tracking-[0.3em] border-r text-center">Pre-Off Options</TableHead>
                         <TableHead className="py-6 uppercase text-[10px] font-black tracking-[0.3em] text-center">Post-Off Options</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {filteredEmployees?.map(emp => {
                         const booking = bookings?.find(b => b.employeeId === emp.id);
                         const rule = rules?.find(r => r.employeeId === emp.id);
                         return (
                           <TableRow key={emp.id} className="hover:bg-slate-50/50 border-b last:border-0 group">
                             <TableCell className="pl-8 py-6 border-r">
                                <div className="flex flex-col">
                                   <span className="font-black text-[15px] text-black uppercase">{emp.fullName}</span>
                                   <code className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{emp.id}</code>
                                </div>
                             </TableCell>
                             <TableCell className="border-r text-center">
                                {booking ? <Badge className="bg-secondary text-white text-[10px] font-black px-4 py-1 rounded-full shadow-lg">{booking.dayOfWeek.toUpperCase()}</Badge> : <span className="text-[10px] font-black text-destructive/30 italic">UNSET</span>}
                             </TableCell>
                             <TableCell className="border-r py-6 px-6">
                                <div className="flex flex-wrap justify-center gap-3">
                                   {shifts?.map(s => {
                                     const isChecked = rule?.allowedPreOffShifts?.includes(s.id);
                                     return (
                                       <div key={s.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all", isChecked ? "bg-secondary/5 border-secondary/20 text-secondary" : "bg-slate-50 border-transparent opacity-30")} onClick={() => handleUpdateRule(emp.id, 'pre', s.id, !isChecked)}>
                                          <Checkbox checked={isChecked} className="data-[state=checked]:bg-secondary" />
                                          <label className="text-[10px] font-black uppercase cursor-pointer">{s.id}</label>
                                       </div>
                                     );
                                   })}
                                </div>
                             </TableCell>
                             <TableCell className="py-6 px-6">
                                <div className="flex flex-wrap justify-center gap-3">
                                   {shifts?.map(s => {
                                     const isChecked = rule?.allowedPostOffShifts?.includes(s.id);
                                     return (
                                       <div key={s.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all", isChecked ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" : "bg-slate-50 border-transparent opacity-30")} onClick={() => handleUpdateRule(emp.id, 'post', s.id, !isChecked)}>
                                          <Checkbox checked={isChecked} className="data-[state=checked]:bg-emerald-500" />
                                          <label className="text-[10px] font-black uppercase cursor-pointer">{s.id}</label>
                                       </div>
                                     );
                                   })}
                                </div>
                             </TableCell>
                           </TableRow>
                         );
                       })}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
