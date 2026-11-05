'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, doc, setDoc, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateWeeklyRoster } from "@/ai/flows/generate-weekly-roster";
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
  ArrowRightLeft,
  Users
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
import { formatWeekId, displayWeekRange } from '@/lib/date-utils';

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

  // Global Constraints State
  const [globalFreq, setGlobalFreq] = useState<Record<string, { min: number, max: number, label: string }>>({});
  const [globalPreOff, setGlobalPreOff] = useState<string[]>([]);
  const [globalPostOff, setGlobalPostOff] = useState<string[]>([]);

  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  const registryQuery = useMemo(() => query(collection(db, 'offices'), where('status', '==', 'Active')), [db]);
  const { data: registryOffices, loading: registryLoading } = useCollection(registryQuery);

  const authorizedOffices = useMemo(() => {
    if (!profile || !registryOffices) return [];
    if (profile.role === 'super_admin') return registryOffices;
    const allowedIds = profile.officeIds || (profile.office ? [profile.office] : []);
    return registryOffices.filter(o => allowedIds.includes(o.officeId));
  }, [profile, registryOffices]);

  const empQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'employees'), where('office', '==', selectedOffice), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, selectedOffice]);

  const bookingsQuery = useMemo(() => {
    if (!selectedOffice || !weekId) return null;
    return query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId), where('office', '==', selectedOffice));
  }, [db, selectedOffice, weekId]);

  const shiftsQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: shifts } = useCollection(shiftsQuery);
  const { data: bookings } = useCollection(bookingsQuery);

  useEffect(() => {
    if (authorizedOffices.length > 0 && !selectedOffice) {
      setSelectedOffice(authorizedOffices[0].officeId);
    }
  }, [authorizedOffices, selectedOffice]);

  // STRICT FILTER: Display only professionals with 'user' role
  const rosterEligibleUsers = useMemo(() => employees?.filter(e => e.role === 'user') || [], [employees]);

  useEffect(() => {
    if (rosterEligibleUsers.length > 0 && selectedEmpIds.length === 0 && status === 'idle') {
      setSelectedEmpIds(rosterEligibleUsers.map(e => e.id));
    }
  }, [rosterEligibleUsers, status]);

  const filteredEmployees = rosterEligibleUsers.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setWeekId(formatWeekId(date));
  };

  const handleRunSolver = async () => {
    if (!selectedOffice || !weekId) {
      toast({ variant: "destructive", title: "Input Required", description: "Select Hub and Clinical Cycle." });
      return;
    }
    if (selectedEmpIds.length === 0) {
      toast({ variant: "destructive", title: "Selection Required", description: "Select at least one professional." });
      return;
    }
    
    setStatus("running");
    setProgress(15);
    setSolverResult(null);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session pulse failed.");

      // CRITICAL: Ensure return is treated as plain object
      const result = await generateWeeklyRoster({
        weekId,
        officeId: selectedOffice,
        employeeIds: selectedEmpIds,
        idToken: idToken,
        globalFrequencyLimits: globalFreq,
        globalPreOffShifts: globalPreOff,
        globalPostOffShifts: globalPostOff
      });
      
      setSolverResult(result);
      setProgress(100);

      if (result.status === 'INFEASIBLE' || result.status === 'UNKNOWN') {
        setStatus("conflict");
        return;
      }

      const draftId = `draft_${weekId}_${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        id: draftId,
        weekId,
        office: selectedOffice,
        assignments: result.rosterAssignments,
        status: 'draft',
        solverStatus: result.status,
        summary: result.summary,
        solverMetadata: result.solverMetadata,
        createdAt: new Date().toISOString(),
        actorId: profile?.uid,
        generationMethod: 'ai',
        includedProfessionals: selectedEmpIds,
        appliedGlobalConstraints: { globalFreq, globalPreOff, globalPostOff }
      });

      setLastDraftId(draftId);
      logAudit(db, profile?.uid || 'system', 'RUN_AI_ROSTER_ENGINE', draftId, { weekId, office: selectedOffice, empCount: selectedEmpIds.length });
      setStatus("success");
    } catch (e: any) {
      setStatus("conflict");
      toast({ variant: "destructive", title: "Engine Conflict", description: "The generation pipeline encountered a serialization or timeout error." });
    }
  };

  const toggleAllSelection = (checked: boolean) => {
    setSelectedEmpIds(checked ? rosterEligibleUsers.map(e => e.id) : []);
  };

  const toggleEmpSelection = (id: string, checked: boolean) => {
    setSelectedEmpIds(prev => checked ? [...prev, id] : prev.filter(eid => eid !== id));
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
                  GenAI Intelligence Mode <Activity className="size-3 text-secondary animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Hub</label>
              <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                <SelectTrigger className="h-6 w-48 font-black border-none bg-transparent p-0 text-[14px] focus:ring-0">
                  <SelectValue placeholder={registryLoading ? "Syncing..." : "Select Center..."} />
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
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Monday Cycle</label>
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
           <Button className="bg-primary text-white h-10 px-8 font-black uppercase text-[10px] transition-all rounded-xl hover:bg-black" onClick={() => setStatus('config')} disabled={status === 'running' || !selectedOffice || !weekId}>
             <Play className="size-4 mr-2" /> {status === 'idle' ? 'INITIATE ENGINE' : 'ADJUST PARAMETERS'}
           </Button>
        </div>
      </div>

      {status === 'config' ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStatus('idle')} className="font-black uppercase text-[10px] tracking-widest hover:bg-slate-100"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Pulse</Button>
              <div className="flex items-center gap-4 px-6 py-2 bg-secondary/5 rounded-xl border border-secondary/10">
                 <Users className="size-4 text-secondary" />
                 <span className="text-[10px] font-black uppercase text-primary">Selected Professionals: {selectedEmpIds.length}</span>
              </div>
           </div>

           <div className="grid gap-8 lg:grid-cols-12">
              <Card className="lg:col-span-4 shadow-2xl border-none rounded-[2.5rem] bg-[#0F172A] text-white overflow-hidden border-t-8 border-t-secondary sticky top-24">
                 <CardHeader className="p-10 pb-6 border-b border-white/5">
                    <div className="flex items-center gap-5">
                       <div className="size-12 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary shadow-inner">
                          <Target className="size-6" />
                       </div>
                       <CardTitle className="text-xl font-black uppercase tracking-tight">Global Constraints</CardTitle>
                    </div>
                    <CardDescription className="text-[10px] font-bold uppercase text-white/30 tracking-widest mt-4">Uniform standards for Cycle {weekId}</CardDescription>
                 </CardHeader>
                 <CardContent className="p-10 space-y-10">
                    <div className="space-y-6">
                       <label className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] block">Shift Adjacency Eligibility</label>
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
              </Card>

              <Card className="lg:col-span-8 shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div>
                      <CardTitle className="text-2xl font-black uppercase tracking-tight">Professional Enrollment</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Selecting clinical staff for generation pulse.</CardDescription>
                   </div>
                   <div className="relative w-full max-w-sm">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                      <Input placeholder="Search Identity..." className="pl-12 h-12 rounded-xl text-[12px] font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                   </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto no-scrollbar max-h-[600px]">
                   <Table>
                      <TableHeader className="bg-slate-50/30 sticky top-0 z-10 backdrop-blur-md">
                         <TableRow>
                            <TableHead className="w-[80px] pl-10">
                               <Checkbox 
                                  checked={selectedEmpIds.length === rosterEligibleUsers.length && rosterEligibleUsers.length > 0} 
                                  onCheckedChange={(c) => toggleAllSelection(!!c)} 
                               />
                            </TableHead>
                            <TableHead className="w-[300px] py-6 uppercase text-[10px] font-black tracking-widest border-r">Professional Identity</TableHead>
                            <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-center border-r">Week-Off Status</TableHead>
                            <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-center">Status Pulse</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {empLoading ? (
                           Array(5).fill(0).map((_, i) => (
                             <TableRow key={i}><TableCell colSpan={4} className="p-12"><Loader2 className="animate-spin mx-auto size-6" /></TableCell></TableRow>
                           ))
                         ) : filteredEmployees.length === 0 ? (
                           <TableRow><TableCell colSpan={4} className="py-40 text-center opacity-30 italic font-black uppercase text-[11px] tracking-widest">No authorized professionals found in registry.</TableCell></TableRow>
                         ) : filteredEmployees.map(emp => {
                           const booking = bookings?.find(b => b.employeeId === emp.id);
                           const isSelected = selectedEmpIds.includes(emp.id);
                           return (
                             <TableRow key={emp.id} className={cn("hover:bg-slate-50 transition-colors border-b last:border-0", !isSelected && "opacity-40 grayscale")}>
                                <TableCell className="pl-10">
                                   <Checkbox checked={isSelected} onCheckedChange={(c) => toggleEmpSelection(emp.id, !!c)} />
                                </TableCell>
                                <TableCell className="py-8 border-r">
                                   <div className="flex flex-col gap-1.5">
                                      <span className="font-black text-[16px] text-black uppercase">{emp.fullName}</span>
                                      <div className="flex items-center gap-2">
                                         <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md tabular-nums">ID: {emp.id}</Badge>
                                         <span className="text-[8px] font-black text-black/20 uppercase tracking-widest">• {emp.gender}</span>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell className="text-center py-8 border-r">
                                   {booking ? (
                                      <Badge className="bg-secondary text-white text-[10px] font-black px-5 py-1.5 rounded-full shadow-lg shadow-secondary/20">{booking.dayOfWeek.toUpperCase()}</Badge>
                                   ) : (
                                      <span className="text-[10px] font-black text-destructive/20 italic tracking-widest">NOT SECURED</span>
                                   )}
                                </TableCell>
                                <TableCell className="text-center py-8">
                                   {isSelected ? (
                                      <div className="flex items-center justify-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                                         <CheckCircle2 className="size-4" /> Enrolled
                                      </div>
                                   ) : (
                                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Excluded</span>
                                   )}
                                </TableCell>
                             </TableRow>
                           );
                         })}
                      </TableBody>
                   </Table>
                </CardContent>
                <CardFooter className="bg-slate-50/50 p-12 border-t">
                   <Button 
                    className="w-full h-20 bg-primary text-white font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all hover:scale-[1.01] group" 
                    onClick={handleRunSolver}
                    disabled={selectedEmpIds.length === 0}
                   >
                      <Wand2 className="mr-5 size-8 group-hover:rotate-12 transition-transform" /> INITIATE AI GENERATION PULSE
                   </Button>
                </CardFooter>
              </Card>
           </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Status Tracker */}
          {status !== 'idle' && (
            <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white animate-in zoom-in-95 duration-500">
               <CardContent className="p-14 space-y-10">
                  <div className="flex justify-between items-end">
                     <div className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/40">Engine Velocity</span>
                        <p className="text-4xl font-black text-black tabular-nums tracking-tighter">{progress}%</p>
                     </div>
                     <div className="text-right">
                        <Badge variant="outline" className={cn(
                          "px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest",
                          status === 'running' ? 'bg-secondary/10 text-secondary border-secondary/20 animate-pulse' : 
                          status === 'success' ? 'bg-emerald-500 text-white border-none' : 'bg-destructive/10 text-destructive border-destructive/20'
                        )}>
                           {status === 'running' ? 'INFERENCE ACTIVE' : status === 'success' ? 'SYNC COMPLETE' : 'ENGINE CONFLICT'}
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

          {/* Results Summary */}
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
                        <p className="text-xl font-medium text-black/60 leading-relaxed max-w-4xl italic">"{solverResult.summary}"</p>
                     </div>

                     {status === 'success' && lastDraftId && (
                        <div className="flex flex-col sm:flex-row gap-6">
                           <Link href={`/admin/roster/review/${lastDraftId}`} className="flex-1">
                              <Button className="w-full h-20 bg-primary text-white font-black uppercase tracking-[0.3em] rounded-3xl shadow-2xl hover:bg-black transition-all hover:scale-[1.02]">
                                 Audit & Review Workspace <ChevronRight className="ml-4 size-6" />
                              </Button>
                           </Link>
                           <Button variant="outline" onClick={() => setStatus('config')} className="h-20 px-12 border-2 border-slate-100 rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] hover:bg-slate-50">
                              Adjust Pulse
                           </Button>
                        </div>
                     )}

                     {status === 'conflict' && (
                       <div className="space-y-8">
                         <div className="p-8 rounded-3xl bg-destructive/10 border-2 border-destructive/20 space-y-6">
                            <p className="text-[11px] font-black uppercase text-destructive tracking-[0.4em]">Conflict Log Trace</p>
                            <ul className="space-y-4">
                               {solverResult.issuesEncountered?.map((issue: string, i: number) => (
                                 <li key={i} className="flex gap-4 items-start text-destructive/80 font-bold text-[13px] uppercase tracking-tight">
                                    <AlertTriangle className="size-4 shrink-0 mt-0.5" /> {issue}
                                 </li>
                               ))}
                            </ul>
                         </div>
                         <Button onClick={() => setStatus('config')} className="h-16 px-12 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em]">
                            Re-Configure Clinical Matrix
                         </Button>
                       </div>
                     )}
                  </div>
               </CardContent>
            </Card>
          )}

          {/* Initial State / Selection Card */}
          {status === 'idle' && (
            <div className="grid gap-8 lg:grid-cols-2">
               <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white group hover:border-secondary transition-all p-12 space-y-10 border-t-8 border-t-primary">
                  <div className="size-20 rounded-[1.75rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform duration-700">
                     <BrainCircuit className="size-10" />
                  </div>
                  <div className="space-y-4">
                     <h3 className="text-3xl font-black uppercase tracking-tight leading-none">Intelligence Pulse</h3>
                     <p className="text-[14px] text-muted-foreground font-medium leading-relaxed">
                        Initiate the Gemini 1.5 Flash orchestrator to analyze staffing requirements, professional week-offs, and distribution limits.
                     </p>
                  </div>
                  <Button className="h-16 px-10 bg-primary text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-xl w-full" onClick={() => setStatus('config')}>
                    Configure Generation Workspace <ChevronRight className="ml-3 size-4" />
                  </Button>
               </Card>

               <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-[#0F172A] text-white p-12 space-y-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:rotate-12 transition-transform duration-1000"><Zap size={220} /></div>
                  <ShieldCheck className="size-12 text-secondary" />
                  <div className="space-y-4 relative z-10">
                     <h3 className="text-3xl font-black uppercase tracking-tight leading-none">Security Protocol</h3>
                     <p className="text-[14px] text-white/40 font-medium leading-relaxed">
                        All generated assignments are strictly isolated as drafts. 
                        No data is transmitted to professionals until a Super Administrator authorizes the publication pulse.
                     </p>
                  </div>
                  <div className="pt-6 relative z-10 flex gap-4">
                     <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-lg">Audit Active</Badge>
                     <Badge variant="outline" className="bg-secondary/20 border-secondary/20 text-secondary font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-lg">Level 4 Secure</Badge>
                  </div>
               </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
