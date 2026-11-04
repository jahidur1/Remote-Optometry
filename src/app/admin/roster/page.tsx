
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, doc, setDoc, where, getDocs } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateWeeklyRoster } from "@/ai/flows/generate-weekly-roster";
import { 
  BrainCircuit, 
  Sparkles, 
  AlertTriangle, 
  History, 
  ShieldCheck, 
  Loader2, 
  Play, 
  Activity, 
  ChevronRight, 
  Target, 
  Lock, 
  Server, 
  Clock, 
  Zap, 
  Cpu, 
  Terminal, 
  Database, 
  Building2, 
  CalendarDays,
  Wand2,
  BarChart3,
  ArrowRightLeft,
  Search,
  Plus,
  ArrowLeft
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

  // Constraints Data
  const empQuery = useMemo(() => {
    if (!selectedOffice) return null;
    return query(collection(db, 'employees'), where('office', '==', selectedOffice), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, selectedOffice]);

  const rulesQuery = useMemo(() => {
    if (!selectedOffice || !weekId) return null;
    return query(collection(db, 'shift_adjacency_rules'), where('weekId', '==', weekId), where('office', '==', selectedOffice));
  }, [db, selectedOffice, weekId]);

  const bookingsQuery = useMemo(() => {
    if (!selectedOffice || !weekId) return null;
    return query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId), where('office', '==', selectedOffice));
  }, [db, selectedOffice, weekId]);

  const shiftsQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: shifts } = useCollection(shiftsQuery);
  const { data: rules } = useCollection(rulesQuery);
  const { data: bookings } = useCollection(bookingsQuery);

  useEffect(() => {
    if (authorizedOffices.length > 0 && !selectedOffice) {
      setSelectedOffice(authorizedOffices[0].officeId);
    }
  }, [authorizedOffices, selectedOffice]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setWeekId(formatWeekId(date));
  };

  const handleUpdateRule = async (employeeId: string, type: 'pre' | 'post', shiftId: string, checked: boolean) => {
    const ruleId = `${weekId}_${employeeId}`;
    const existingRule = rules?.find(r => r.employeeId === employeeId) || {
      id: ruleId, weekId, employeeId, office: selectedOffice, allowedPreOffShifts: [], allowedPostOffShifts: [], frequencyLimits: {}
    };

    let updatedList = type === 'pre' ? [...(existingRule.allowedPreOffShifts || [])] : [...(existingRule.allowedPostOffShifts || [])];
    if (checked) { if (!updatedList.includes(shiftId)) updatedList.push(shiftId); }
    else { updatedList = updatedList.filter(id => id !== shiftId); }

    await setDoc(doc(db, 'shift_adjacency_rules', ruleId), {
      ...existingRule,
      [type === 'pre' ? 'allowedPreOffShifts' : 'allowedPostOffShifts']: updatedList,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const handleUpdateFrequency = async (employeeId: string, shiftId: string, rangeValue: string) => {
    const range = FREQUENCY_RANGES.find(r => r.label === rangeValue);
    if (!range) return;

    const ruleId = `${weekId}_${employeeId}`;
    const existingRule = rules?.find(r => r.employeeId === employeeId) || {
      id: ruleId, weekId, employeeId, office: selectedOffice, allowedPreOffShifts: [], allowedPostOffShifts: [], frequencyLimits: {}
    };

    const updatedFrequency = {
      ...(existingRule.frequencyLimits || {}),
      [shiftId]: { min: range.min, max: range.max, label: range.label }
    };

    await setDoc(doc(db, 'shift_adjacency_rules', ruleId), {
      ...existingRule,
      frequencyLimits: updatedFrequency,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const handleRunSolver = async () => {
    if (!selectedOffice || !weekId) {
      toast({ variant: "destructive", title: "Input Required", description: "Select Hub and Clinical Cycle." });
      return;
    }
    
    setStatus("running");
    setProgress(15);
    setSolverResult(null);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session pulse failed.");

      setProgress(40);
      const result = await generateWeeklyRoster({
        weekId,
        officeId: selectedOffice,
        idToken: idToken,
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
        generationMethod: 'ai'
      });

      setLastDraftId(draftId);
      logAudit(db, profile?.uid || 'system', 'RUN_AI_ROSTER_ENGINE', draftId, { weekId, office: selectedOffice });
      setStatus("success");
    } catch (e: any) {
      setStatus("conflict");
      toast({ variant: "destructive", title: "Engine Conflict", description: e.message });
    }
  };

  const filteredEmployees = employees?.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <BrainCircuit className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">AI Roster Engine</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Gemini 1.5 Flash Orchestrator <Activity className="size-3 text-secondary animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cluster</label>
              <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                <SelectTrigger className="h-6 w-48 font-black border-none bg-transparent p-0 text-[14px]">
                  <SelectValue placeholder={registryLoading ? "Syncing..." : "Select Hub..."} />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white p-2 border-none shadow-2xl">
                  {authorizedOffices.map(o => (
                    <SelectItem key={o.officeId} value={o.officeId} className="font-bold py-2 uppercase text-[10px]">{o.officeName}</SelectItem>
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
                    <span className="text-[14px] uppercase">{weekId ? displayWeekRange(weekId) : 'Select Monday'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus />
                </PopoverContent>
              </Popover>
           </div>
           <Button className="bg-primary text-white h-10 px-8 font-black uppercase text-[10px] transition-all rounded-xl hover:bg-black" onClick={() => setStatus('config')} disabled={status === 'running' || !selectedOffice || !weekId}>
             <Play className="size-4 mr-2" /> SETUP CONSTRAINTS
           </Button>
        </div>
      </div>

      {status === 'config' ? (
        <div className="space-y-8 animate-in">
           <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStatus('idle')} className="font-black uppercase text-[10px] tracking-widest"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine</Button>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                <Input placeholder="Search Professionals..." className="pl-10 h-10 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
           </div>

           <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden border-t-8 border-t-secondary">
             <CardHeader className="bg-slate-50/50 border-b p-8">
                <CardTitle className="text-xl font-black uppercase">Constraint Matrix (Cycle {displayWeekRange(weekId)})</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Define shift distribution and adjacency eligibility before generation.</CardDescription>
             </CardHeader>
             <CardContent className="p-0 overflow-x-auto">
                <Table>
                   <TableHeader className="bg-slate-50/30">
                      <TableRow>
                         <TableHead className="w-[200px] pl-10 py-6 uppercase text-[9px] font-black tracking-widest">Professional</TableHead>
                         <TableHead className="w-[100px] py-6 uppercase text-[9px] font-black tracking-widest text-center">Off-Day</TableHead>
                         <TableHead className="py-6 uppercase text-[9px] font-black tracking-widest text-center">Frequency limits</TableHead>
                         <TableHead className="py-6 uppercase text-[9px] font-black tracking-widest text-center">Pre-Off eligibility</TableHead>
                         <TableHead className="py-6 uppercase text-[9px] font-black tracking-widest text-center">Post-Off eligibility</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {filteredEmployees?.map(emp => {
                        const rule = rules?.find(r => r.employeeId === emp.id);
                        const booking = bookings?.find(b => b.employeeId === emp.id);
                        return (
                          <TableRow key={emp.id} className="hover:bg-slate-50 border-b">
                             <TableCell className="pl-10 py-4">
                                <p className="font-black text-[13px] uppercase">{emp.fullName}</p>
                                <code className="text-[9px] font-bold text-slate-300">{emp.id}</code>
                             </TableCell>
                             <TableCell className="text-center">
                                {booking ? <Badge className="bg-secondary text-white text-[9px] font-black">{booking.dayOfWeek.toUpperCase()}</Badge> : <span className="text-[9px] text-destructive italic">NOT SET</span>}
                             </TableCell>
                             <TableCell className="px-4">
                                <div className="grid grid-cols-2 gap-2">
                                   {shifts?.slice(0, 4).map(s => (
                                     <div key={s.id} className="space-y-1">
                                        <p className="text-[8px] font-black uppercase text-slate-400">{s.id}</p>
                                        <Select value={rule?.frequencyLimits?.[s.id]?.label || 'UNRESTRICTED'} onValueChange={(v) => handleUpdateFrequency(emp.id, s.id, v)}>
                                          <SelectTrigger className="h-8 text-[8px] font-black uppercase rounded-lg">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {FREQUENCY_RANGES.map(range => <SelectItem key={range.label} value={range.label} className="text-[9px] font-bold">{range.label}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                     </div>
                                   ))}
                                </div>
                             </TableCell>
                             <TableCell className="px-4">
                                <div className="flex flex-wrap gap-2 justify-center">
                                   {shifts?.map(s => (
                                     <div key={s.id} className="flex items-center gap-1">
                                        <Checkbox checked={rule?.allowedPreOffShifts?.includes(s.id)} onCheckedChange={(c) => handleUpdateRule(emp.id, 'pre', s.id, !!c)} />
                                        <span className="text-[9px] font-black">{s.id}</span>
                                     </div>
                                   ))}
                                </div>
                             </TableCell>
                             <TableCell className="px-4">
                                <div className="flex flex-wrap gap-2 justify-center">
                                   {shifts?.map(s => (
                                     <div key={s.id} className="flex items-center gap-1">
                                        <Checkbox checked={rule?.allowedPostOffShifts?.includes(s.id)} onCheckedChange={(c) => handleUpdateRule(emp.id, 'post', s.id, !!c)} />
                                        <span className="text-[9px] font-black">{s.id}</span>
                                     </div>
                                   ))}
                                </div>
                             </TableCell>
                          </TableRow>
                        );
                      })}
                   </TableBody>
                </Table>
             </CardContent>
             <CardFooter className="bg-slate-50/50 p-8 border-t">
                <Button className="w-full h-16 bg-primary text-white font-black uppercase tracking-[0.25em] rounded-2xl shadow-2xl hover:bg-black transition-all" onClick={handleRunSolver}>
                   <Wand2 className="mr-3 size-6" /> INITIATE AI GENERATION
                </Button>
             </CardFooter>
           </Card>
        </div>
      ) : (
        <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-primary">
          <CardHeader className="bg-slate-50/50 border-b p-10 flex items-center justify-between">
            <div>
              <CardTitle className="text-xl uppercase font-black leading-none">Institutional AI Hub</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2">Engine: Gemini 1.5 Flash (Deterministic Command Protocol)</CardDescription>
            </div>
            <div className="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
               <BrainCircuit className="size-7" />
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="space-y-12">
              <div className="space-y-4">
                  <div className="flex justify-between items-end">
                     <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/40">Inference Velocity</span>
                     <span className="text-xl font-black tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden border p-0.5 shadow-inner">
                     <div className={cn(
                         "h-full rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
                         status === 'running' ? 'bg-secondary animate-pulse' : status === 'success' ? 'bg-emerald-500' : status === 'conflict' ? 'bg-destructive' : 'bg-slate-200'
                     )} style={{ width: `${progress}%` }} />
                  </div>
              </div>

              {solverResult && (
                <div className={cn(
                    "p-10 rounded-[2.5rem] border-2 animate-in zoom-in-95", 
                    (solverResult.status === 'INFEASIBLE' || solverResult.status === 'UNKNOWN') ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'
                )}>
                  <div className="flex flex-col md:flex-row gap-10 items-start">
                    <div className={cn(
                        "size-20 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl", 
                        (solverResult.status === 'INFEASIBLE' || solverResult.status === 'UNKNOWN') ? 'bg-destructive text-white shadow-destructive/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'
                    )}>
                       {(solverResult.status === 'INFEASIBLE' || solverResult.status === 'UNKNOWN') ? <AlertTriangle className="size-10" /> : <ShieldCheck className="size-10" />}
                    </div>
                    <div className="space-y-8 flex-1">
                       <div className="space-y-2">
                          <h3 className="text-2xl font-black uppercase tracking-tight leading-none">AI Orchestration Result</h3>
                          <p className="text-[15px] font-medium leading-relaxed text-black/60">{solverResult.summary}</p>
                       </div>
                       
                       {lastDraftId && solverResult.status !== 'INFEASIBLE' && solverResult.status !== 'UNKNOWN' && (
                         <Link href={`/admin/roster/review/${lastDraftId}`}>
                            <Button className="w-full h-16 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:bg-black transition-all hover:scale-[1.02]">
                              Audit & Review Workspace <ChevronRight className="ml-3 size-5" />
                            </Button>
                         </Link>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
