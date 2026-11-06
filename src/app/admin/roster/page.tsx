'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, doc, onSnapshot, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BrainCircuit, 
  ShieldCheck, 
  Activity, 
  ChevronRight, 
  Play, 
  Wand2,
  Search,
  ArrowLeft,
  CalendarDays,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Target,
  Users,
  Terminal,
  Server,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAudit } from '@/lib/audit';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { formatWeekId, displayWeekRange, getCurrentWeekId, getDatesForWeek } from '@/lib/date-utils';
import { runLocalRosterEngineAction } from '@/services/roster-engine';
import { saveQuotaAction } from '@/services/quota-actions';
import { format } from 'date-fns';

const FREQUENCY_RANGES = [
  { label: '0-1', min: 0, max: 1 },
  { label: '1-2', min: 1, max: 2 },
  { label: '2-3', min: 2, max: 3 },
  { label: '3-4', min: 3, max: 4 },
  { label: '4-5', min: 4, max: 5 },
  { label: '5-6', min: 5, max: 6 },
  { label: 'UNRESTRICTED', min: 0, max: 7 },
];

export default function RosterSolver() {
  const [weekId, setWeekId] = useState('');
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [status, setStatus] = useState<"idle" | "config" | "running" | "success" | "conflict">("idle");
  const [progress, setProgress] = useState(0);
  const [solverResult, setSolverResult] = useState<any>(null);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [savingMatrix, setSavingMatrix] = useState(false);

  // Integrated Unified State
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [globalFreq, setGlobalFreq] = useState<Record<string, { min: number, max: number, label: string }>>({});
  const [globalPreOff, setGlobalPreOff] = useState<string[]>([]);
  const [globalPostOff, setGlobalPostOff] = useState<string[]>([]);

  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    setWeekId(getCurrentWeekId());
  }, []);

  const registryQuery = useMemo(() => query(collection(db, 'offices'), where('status', '==', 'Active')), [db]);
  const { data: registryOffices, loading: registryLoading } = useCollection(registryQuery);

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

  // Unified Singleton Listener
  useEffect(() => {
    if (!db || !weekId || !selectedOffice) return;
    const localizedId = `${weekId}_${selectedOffice}`;
    
    // Load Quotas
    const unsubQuota = onSnapshot(doc(db, 'roster_quotas', localizedId), (snap) => {
      if (snap.exists()) setQuotas(snap.data().quotas || {});
      else setQuotas({});
    });

    return () => unsubQuota();
  }, [db, weekId, selectedOffice]);

  const empQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'employees'), where('office', '==', selectedOffice), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, selectedOffice]);

  const shiftsQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const bookingsQuery = useMemo(() => {
    if (!selectedOffice || !weekId) return null;
    return query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId), where('office', '==', selectedOffice));
  }, [db, selectedOffice, weekId]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: shifts } = useCollection(shiftsQuery);
  const { data: bookings } = useCollection(bookingsQuery);

  const rosterEligibleUsers = useMemo(() => employees?.filter(e => e.role === 'user') || [], [employees]);

  useEffect(() => {
    if (rosterEligibleUsers.length > 0 && selectedEmpIds.length === 0 && status === 'idle') {
      setSelectedEmpIds(rosterEligibleUsers.map(e => e.id));
    }
  }, [rosterEligibleUsers, status]);

  const activeDays = useMemo(() => weekId ? getDatesForWeek(weekId).map(d => format(d, 'EEEE')) : [], [weekId]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setWeekId(formatWeekId(date));
    setStatus('idle');
    setSolverResult(null);
  };

  const handleSaveMatrix = async () => {
    if (!selectedOffice || !weekId) return;
    setSavingMatrix(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication pulse failed.");

      const result = await saveQuotaAction(idToken, {
        weekId,
        officeId: selectedOffice,
        quotas,
      });

      if (result.success) {
        toast({ title: "Assignment Matrix Secured", description: "Clinical headcount requirements saved to registry." });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleRunSolver = async () => {
    if (!selectedOffice || !weekId) return;
    
    setStatus("running");
    setProgress(30);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth pulse failed.");

      const result = await runLocalRosterEngineAction(idToken, {
        weekId,
        officeId: selectedOffice,
        employeeIds: selectedEmpIds,
        quotas,
        globalFreq,
        globalPreOff,
        globalPostOff
      });

      setProgress(100);
      if (result.success) {
        setSolverResult(result);
        setLastDraftId(result.draftId);
        setStatus("success");
        toast({ title: "Logic Pulse Complete", description: "Draft secured in registry." });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      setStatus("conflict");
      toast({ variant: "destructive", title: "Logic Conflict", description: e.message });
    }
  };

  const toggleEmpSelection = (id: string, checked: boolean) => {
    setSelectedEmpIds(prev => checked ? [...prev, id] : prev.filter(eid => eid !== id));
  };

  const handleQuotaChange = (day: string, sId: string, val: string) => {
    const num = parseInt(val) || 0;
    setQuotas(prev => ({ ...prev, [`${day}_${sId}`]: num }));
  };

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <BrainCircuit className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Roster Solver</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Deterministic Logic Center <ShieldCheck className="size-3 text-secondary" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Hub</label>
              <Select value={selectedOffice} onValueChange={(v) => { setSelectedOffice(v); setStatus('idle'); }}>
                <SelectTrigger className="h-6 w-48 font-black border-none bg-transparent p-0 text-[14px] focus:ring-0">
                  <SelectValue placeholder="Select Center..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white p-2 border-none shadow-2xl">
                  {authorizedOffices.map(o => (
                    <SelectItem key={o.officeId} value={o.officeId} className="font-bold py-2 uppercase text-[10px] rounded-lg">
                        {o.officeName}
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
           <Button className="bg-primary text-white h-10 px-8 font-black uppercase text-[10px] transition-all rounded-xl hover:bg-black shadow-lg" onClick={() => setStatus('config')} disabled={status === 'running' || !selectedOffice || !weekId}>
             <Play className="size-4 mr-2" /> {status === 'idle' ? 'INITIATE WORKSPACE' : 'ADJUST PARAMETERS'}
           </Button>
        </div>
      </div>

      {status === 'config' ? (
        <div className="space-y-10 animate-in duration-500">
           <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStatus('idle')} className="font-black uppercase text-[10px] tracking-widest hover:bg-slate-100"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Pulse</Button>
           </div>

           <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8 space-y-10">
                 {/* Integrated Quota Matrix */}
                 <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
                    <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between">
                       <div>
                          <CardTitle className="text-2xl font-black uppercase tracking-tight">Assignment Matrix</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Required headcount per shift type for Cycle {weekId}.</CardDescription>
                       </div>
                       <div className="flex items-center gap-4">
                          <Button 
                            className="h-12 px-10 bg-secondary text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-xl shadow-secondary/20 hover:scale-105 active:scale-95 transition-all"
                            onClick={handleSaveMatrix}
                            disabled={savingMatrix}
                          >
                            {savingMatrix ? <Loader2 className="size-5 animate-spin mr-3" /> : <Save className="size-5 mr-3" />}
                            SAVE MATRIX
                          </Button>
                       </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto no-scrollbar">
                       <Table>
                          <TableHeader className="bg-slate-50/30">
                             <TableRow>
                                <TableHead className="w-[200px] pl-10 py-6 uppercase text-[10px] font-black tracking-widest border-r">Shift Type</TableHead>
                                {activeDays.map(day => (
                                   <TableHead key={day} className="text-center px-4 py-6 border-r last:border-0 uppercase text-[10px] font-black text-black/40">{day.substring(0,3)}</TableHead>
                                ))}
                             </TableRow>
                          </TableHeader>
                          <TableBody>
                             {shifts?.map(s => (
                                <TableRow key={s.id} className="hover:bg-slate-50 border-b last:border-0 transition-colors">
                                   <TableCell className="pl-10 py-5 border-r font-black uppercase text-[13px]">{s.name}</TableCell>
                                   {activeDays.map(day => (
                                      <TableCell key={day} className="text-center px-2 py-4 border-r last:border-0">
                                         <Input 
                                            type="number" 
                                            className="w-16 mx-auto h-12 text-center text-lg font-black bg-slate-50 border-2 rounded-xl focus:border-secondary shadow-inner"
                                            value={quotas[`${day}_${s.id}`] || 0}
                                            onChange={(e) => handleQuotaChange(day, s.id, e.target.value)}
                                         />
                                      </TableCell>
                                   ))}
                                </TableRow>
                             ))}
                          </TableBody>
                       </Table>
                    </CardContent>
                 </Card>

                 {/* Professional Enrollment */}
                 <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden">
                   <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-6">
                      <CardTitle className="text-2xl font-black uppercase tracking-tight">Staff Enrollment</CardTitle>
                      <div className="relative w-full max-w-sm">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                         <Input placeholder="Find Professional..." className="pl-12 h-12 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                   </CardHeader>
                   <CardContent className="p-0 overflow-x-auto no-scrollbar max-h-[500px]">
                      <Table>
                         <TableHeader className="bg-slate-50/30 sticky top-0 z-10">
                            <TableRow>
                               <TableHead className="w-[80px] pl-10"><Checkbox checked={selectedEmpIds.length === rosterEligibleUsers.length} onCheckedChange={c => setSelectedEmpIds(c ? rosterEligibleUsers.map(e => e.id) : [])} /></TableHead>
                               <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest border-r">Professional Identity</TableHead>
                               <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-center">Week-Off Status</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {rosterEligibleUsers.filter(e => e.fullName.toLowerCase().includes(searchTerm.toLowerCase())).map(emp => {
                               const booking = bookings?.find(b => b.employeeId === emp.id);
                               return (
                                 <TableRow key={emp.id} className={cn("hover:bg-slate-50 transition-colors border-b last:border-0", !selectedEmpIds.includes(emp.id) && "opacity-40 grayscale")}>
                                    <TableCell className="pl-10"><Checkbox checked={selectedEmpIds.includes(emp.id)} onCheckedChange={c => toggleEmpSelection(emp.id, !!c)} /></TableCell>
                                    <TableCell className="py-6 border-r">
                                       <div className="flex flex-col">
                                          <span className="font-black text-[15px] uppercase">{emp.fullName}</span>
                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {emp.id}</span>
                                       </div>
                                    </TableCell>
                                    <TableCell className="text-center py-6">
                                       {booking ? <Badge className="bg-secondary text-white font-black text-[10px] px-4 py-1.5 rounded-full uppercase">{booking.dayOfWeek}</Badge> : <span className="text-[10px] italic opacity-30 uppercase font-bold">Unbooked</span>}
                                    </TableCell>
                                 </TableRow>
                               );
                            })}
                         </TableBody>
                      </Table>
                   </CardContent>
                 </Card>
              </div>

              <div className="lg:col-span-4 space-y-10">
                 {/* Logic Constraints */}
                 <Card className="shadow-2xl border-none rounded-[2.5rem] bg-[#0F172A] text-white overflow-hidden border-t-8 border-t-secondary sticky top-24">
                    <CardHeader className="p-10 pb-6 border-b border-white/5">
                       <CardTitle className="text-xl font-black uppercase tracking-tight">Global Constraints</CardTitle>
                       <CardDescription className="text-[10px] font-bold uppercase text-white/30 tracking-widest mt-4">Unified standards for Cycle {weekId}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                       <div className="space-y-6">
                          <label className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] block">Shift Adjacency (Pre/Post Off)</label>
                          <div className="space-y-6">
                             <div className="space-y-3">
                                <p className="text-[9px] font-bold text-white/40 uppercase flex items-center gap-2"><Zap className="size-3" /> Pre-Off Options:</p>
                                <div className="flex flex-wrap gap-2">
                                   {shifts?.map(s => (
                                      <Badge 
                                         key={s.id} 
                                         onClick={() => setGlobalPreOff(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                         className={cn("h-10 px-4 rounded-xl font-black cursor-pointer transition-all border-2", globalPreOff.includes(s.id) ? "bg-secondary text-white border-secondary shadow-lg" : "bg-white/5 text-white/40 border-white/10")}
                                      >
                                         {s.id}
                                      </Badge>
                                   ))}
                                </div>
                             </div>
                             <div className="space-y-3 pt-2">
                                <p className="text-[9px] font-bold text-white/40 uppercase flex items-center gap-2"><Zap className="size-3" /> Post-Off Options:</p>
                                <div className="flex flex-wrap gap-2">
                                   {shifts?.map(s => (
                                      <Badge 
                                         key={s.id} 
                                         onClick={() => setGlobalPostOff(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                         className={cn("h-10 px-4 rounded-xl font-black cursor-pointer transition-all border-2", globalPostOff.includes(s.id) ? "bg-emerald-500 text-white border-emerald-500 shadow-lg" : "bg-white/5 text-white/40 border-white/10")}
                                      >
                                         {s.id}
                                      </Badge>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6 pt-8 border-t border-white/5">
                          <label className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] block">Weekly Frequency Ranges</label>
                          <div className="grid grid-cols-2 gap-4">
                             {shifts?.map(s => (
                                <div key={s.id} className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-secondary/30 transition-all group">
                                   <p className="text-[10px] font-black uppercase text-white/80 group-hover:text-secondary">{s.name}</p>
                                   <Select onValueChange={(v) => {
                                      const range = FREQUENCY_RANGES.find(r => r.label === v);
                                      if (range) setGlobalFreq(prev => ({ ...prev, [s.id]: { min: range.min, max: range.max, label: range.label } }));
                                   }}>
                                      <SelectTrigger className="h-9 text-[9px] font-black bg-white/10 border-none text-white uppercase rounded-lg">
                                         <SelectValue placeholder="AUTO" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-[#0F172A] border-white/10 text-white">
                                         {FREQUENCY_RANGES.map(r => <SelectItem key={r.label} value={r.label} className="font-bold text-[10px]">{r.label}</SelectItem>)}
                                      </SelectContent>
                                   </Select>
                                </div>
                             ))}
                          </div>
                       </div>
                    </CardContent>
                    <CardFooter className="bg-white/5 p-10 border-t border-white/5">
                       <Button 
                        className="w-full h-20 bg-primary text-white font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all hover:scale-[1.01] group" 
                        onClick={handleRunSolver}
                        disabled={selectedEmpIds.length === 0}
                       >
                          <Wand2 className="mr-5 size-8 group-hover:rotate-12 transition-transform" /> INITIATE LOGIC PULSE
                       </Button>
                    </CardFooter>
                 </Card>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-12">
          {status !== 'idle' && (
            <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white animate-in zoom-in-95 duration-500">
               <CardContent className="p-14 space-y-10">
                  <div className="flex justify-between items-end">
                     <div className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/40">Logic Processing Velocity</span>
                        <p className="text-4xl font-black text-black tabular-nums tracking-tighter">{progress}%</p>
                     </div>
                     <div className="text-right">
                        <Badge variant="outline" className={cn(
                          "px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest",
                          status === 'running' ? 'bg-secondary/10 text-secondary border-secondary/20 animate-pulse' : 
                          status === 'success' ? 'bg-emerald-500 text-white border-none' : 'bg-destructive/10 text-destructive border-destructive/20'
                        )}>
                           {status === 'running' ? 'ALGORITHM ACTIVE' : status === 'success' ? 'LOGIC SYNCED' : 'SOLVER CONFLICT'}
                        </Badge>
                     </div>
                  </div>
                  <div className="h-6 bg-slate-100 rounded-full overflow-hidden border-2 p-1 shadow-inner">
                     <div className={cn(
                         "h-full rounded-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)",
                         status === 'running' ? 'bg-secondary' : status === 'success' ? 'bg-emerald-500' : 'bg-destructive'
                     )} style={{ width: `${progress}%` }} />
                  </div>
               </CardContent>
            </Card>
          )}

          {solverResult && (
            <Card className={cn(
                "shadow-2xl border-none overflow-hidden rounded-[3rem] animate-in slide-in-from-bottom-8 duration-700",
                status === 'success' ? "bg-white" : "bg-destructive/5"
            )}>
               <div className={cn("h-4", status === 'success' ? "bg-emerald-500" : "bg-destructive")} />
               <CardContent className="p-12 md:p-20 flex flex-col md:flex-row gap-16 items-start">
                  <div className={cn(
                      "size-32 rounded-[2.5rem] flex items-center justify-center shrink-0 shadow-3xl transform -rotate-6",
                      status === 'success' ? "bg-emerald-500 text-white" : "bg-destructive text-white"
                  )}>
                     {status === 'success' ? <ShieldCheck className="size-16" /> : <AlertTriangle className="size-16" />}
                  </div>
                  <div className="space-y-12 flex-1">
                     <div className="space-y-6">
                        <h2 className="text-4xl font-black uppercase tracking-tight leading-none text-black">Orchestration Outcome</h2>
                        <p className="text-xl font-medium text-black/60 leading-relaxed font-italic italic">"{solverResult.summary}"</p>
                     </div>

                     {status === 'success' && lastDraftId && (
                        <div className="flex flex-col sm:flex-row gap-6">
                           <Link href={`/admin/roster/review/${lastDraftId}`} className="flex-1">
                              <Button className="w-full h-20 bg-primary text-white font-black uppercase tracking-[0.3em] rounded-3xl shadow-2xl hover:bg-black transition-all hover:scale-[1.02]">
                                 Audit & Review Workspace <ChevronRight className="ml-4 size-6" />
                              </Button>
                           </Link>
                           <Button variant="outline" onClick={() => setStatus('config')} className="h-20 px-12 border-2 border-slate-100 rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] hover:bg-slate-50">
                              Adjust Logic Matrix
                           </Button>
                        </div>
                     )}
                  </div>
               </CardContent>
            </Card>
          )}

          {status === 'idle' && (
            <div className="grid gap-8 lg:grid-cols-2">
               <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white group hover:border-secondary transition-all p-12 space-y-10 border-t-8 border-t-primary">
                  <div className="size-20 rounded-[1.75rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform duration-700">
                     <Target className="size-10" />
                  </div>
                  <div className="space-y-4">
                     <h3 className="text-3xl font-black uppercase tracking-tight leading-none">Logic Pulse</h3>
                     <p className="text-[14px] text-muted-foreground font-medium leading-relaxed">
                        Initiate the deterministic orchestration engine to analyze staffing requirements, professional week-offs, and distribution limits. 
                        No AI inference — 100% mathematical accuracy.
                     </p>
                  </div>
                  <Button className="h-16 px-10 bg-primary text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-xl w-full" onClick={() => setStatus('config')}>
                    Configure Unified Workspace <ChevronRight className="ml-3 size-4" />
                  </Button>
               </Card>

               <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-[#0F172A] text-white p-12 space-y-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:rotate-12 transition-transform duration-1000"><Zap size={220} /></div>
                  <ShieldCheck className="size-12 text-secondary" />
                  <div className="space-y-4 relative z-10">
                     <h3 className="text-3xl font-black uppercase tracking-tight leading-none">Deterministic Guard</h3>
                     <p className="text-[14px] text-white/40 font-medium leading-relaxed">
                        All assignments are derived from pure institutional constraints. Registry integrity is maintained via the 
                        Singleton ID Protocol, strictly targeting active clinical cycles.
                     </p>
                  </div>
                  <div className="pt-6 relative z-10 flex gap-4">
                     <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-lg">Audit Active</Badge>
                     <Badge variant="outline" className="bg-secondary/20 border-secondary/20 text-secondary font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-lg">Logic Node v2.0</Badge>
                  </div>
               </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
