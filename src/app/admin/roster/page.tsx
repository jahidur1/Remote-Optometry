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
  Wand2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit } from '@/lib/audit';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { formatWeekId, displayWeekRange } from '@/lib/date-utils';

export default function RosterSolver() {
  const [weekId, setWeekId] = useState('20241230-20250105');
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [method, setMethod] = useState<'solver' | 'ai'>('solver');
  const [status, setStatus] = useState<"idle" | "running" | "success" | "conflict">("idle");
  const [progress, setProgress] = useState(0);
  const [solverResult, setSolverResult] = useState<any>(null);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);

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

  useEffect(() => {
    if (authorizedOffices.length > 0 && !selectedOffice) {
      setSelectedOffice(authorizedOffices[0].officeId);
    }
  }, [authorizedOffices, selectedOffice]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setWeekId(formatWeekId(date));
  };

  const handleRunSolver = async () => {
    if (!selectedOffice || !weekId) {
      toast({ variant: "destructive", title: "Input Required", description: "Select Hub and Clinical Cycle." });
      return;
    }
    
    setStatus("running");
    setProgress(15);
    setSolverResult(null);
    setLastDraftId(null);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session pulse failed.");

      setProgress(40);
      const result = await generateWeeklyRoster({
        weekId,
        officeId: selectedOffice,
        idToken: idToken,
        method
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
        generationMethod: method
      });

      setLastDraftId(draftId);
      logAudit(db, profile?.uid || 'system', 'RUN_ROSTER_ENGINE', draftId, { weekId, office: selectedOffice, method });
      setStatus("success");
    } catch (e: any) {
      setStatus("conflict");
      toast({ variant: "destructive", title: "Engine Conflict", description: e.message });
    }
  };

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Cpu className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Roster Engine</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Multi-Engine Orchestrator <Activity className="size-3 text-secondary animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Strategy</label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger className="h-6 w-40 font-black border-none bg-transparent p-0 text-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white p-2 border-none shadow-2xl">
                  <SelectItem value="solver" className="font-bold py-2 uppercase text-[10px]">CP-SAT Mathematical</SelectItem>
                  <SelectItem value="ai" className="font-bold py-2 uppercase text-[10px]">GenAI Intelligence</SelectItem>
                </SelectContent>
              </Select>
           </div>
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
                    <span className="text-[14px] uppercase">{weekId ? displayWeekRange(weekId) : 'Select Cycle'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus />
                </PopoverContent>
              </Popover>
           </div>
           <Button className="bg-primary text-white h-10 px-8 font-black uppercase text-[10px] transition-all rounded-xl hover:bg-black" onClick={handleRunSolver} disabled={status === 'running' || !selectedOffice || !weekId}>
            {status === 'running' ? <Loader2 className="size-4 animate-spin mr-2" /> : method === 'solver' ? <Zap className="size-4 mr-2" /> : <Wand2 className="size-4 mr-2" />}
            INITIATE HUB GENERATION
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-primary">
            <CardHeader className="bg-slate-50/50 border-b p-10 flex items-center justify-between">
              <div>
                <CardTitle className="text-xl uppercase font-black leading-none">Institutional Pulse Hub</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2">Active Generation strategy: {method === 'solver' ? 'Deterministic Optimization' : 'LLM-Based Scheduling'}</CardDescription>
              </div>
              <div className="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                 {method === 'solver' ? <Cpu className="size-7" /> : <BrainCircuit className="size-7" />}
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <div className="space-y-12">
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/40">Processing Velocity</span>
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
                            <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Orchestration Result</h3>
                            <p className="text-[15px] font-medium leading-relaxed text-black/60">{solverResult.summary}</p>
                         </div>
                         
                         {solverResult.status === 'UNKNOWN' && solverResult.issuesEncountered?.some((i: string) => i.includes('MISSING_QUOTA')) && (
                           <Link href="/admin/quotas">
                              <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all hover:scale-[1.02]">
                                Fix Matrix: Configure Quotas <ChevronRight className="ml-3 size-5" />
                              </Button>
                           </Link>
                         )}

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
                {status === 'idle' && !registryLoading && authorizedOffices.length === 0 && (
                   <div className="py-20 text-center opacity-30 italic font-black uppercase text-xs tracking-[0.4em]">No authorized offices found for your administrative identity.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white p-10 space-y-8 group border-l-4 border-l-secondary">
              <div className="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:rotate-6 transition-all">
                 <ShieldCheck className="size-8" />
              </div>
              <div className="space-y-3">
                 <p className="text-[11px] font-black uppercase text-secondary tracking-[0.3em]">Institutional Guard</p>
                 <p className="text-[13px] font-bold text-black/50 leading-relaxed uppercase tracking-tight">
                   Both engines strictly enforce **Shift Adjacency Rules** set in the control matrix. Professionals will never be assigned 
                   invalid shifts before or after their protected week-off.
                 </p>
              </div>
              <Link href="/admin/adjacency" className="block">
                 <Button variant="outline" className="w-full h-12 border-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-secondary/5 hover:text-secondary hover:border-secondary transition-all">
                   Manage Adjacency Matrix
                 </Button>
              </Link>
           </Card>
        </div>
      </div>
    </div>
  );
}