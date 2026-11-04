
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, limit, doc, setDoc, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateWeeklyRoster } from "@/ai/flows/generate-weekly-roster";
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, Activity, ChevronRight, Target, Lock, Server, Clock, Zap, Cpu, Terminal, Database, Building2, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit } from '@/lib/audit';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatWeekId, displayWeekRange } from '@/lib/date-utils';

export default function RosterSolver() {
  const [weekId, setWeekId] = useState('');
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [status, setStatus] = useState<"idle" | "running" | "success" | "conflict">("idle");
  const [progress, setProgress] = useState(0);
  const [solverResult, setSolverResult] = useState<any>(null);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);

  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  const { data: registryOffices, loading: registryLoading } = useCollection(
    query(collection(db, 'offices'), where('status', '==', 'Active'))
  );

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

  const draftsQuery = useMemo(() => {
    if (!profile || !selectedOffice) return null;
    const q = collection(db, 'roster_drafts');
    return query(q, where('office', '==', selectedOffice), orderBy('createdAt', 'desc'), limit(10));
  }, [db, profile, selectedOffice]);
  
  const { data: recentDrafts } = useCollection(draftsQuery);

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
    setProgress(20);
    setSolverResult(null);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const result = await generateWeeklyRoster({
        weekId,
        officeId: selectedOffice,
        idToken: idToken
      });
      
      setSolverResult(result);
      setProgress(100);

      if (result.status === 'INFEASIBLE') {
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
        actorId: profile?.uid
      });

      setLastDraftId(draftId);
      logAudit(db, profile?.uid || 'system', 'RUN_SOLVER', draftId, { weekId, office: selectedOffice });
      setStatus("success");
    } catch (e: any) {
      setStatus("conflict");
      toast({ variant: "destructive", title: "Pipeline Failure", description: e.message });
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
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Roster Solver</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
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
                    <span className="text-[14px] uppercase">{weekId ? displayWeekRange(weekId) : 'Select Start'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus />
                </PopoverContent>
              </Popover>
           </div>
           <Button className="bg-secondary text-white h-10 px-8 font-black uppercase text-[10px] transition-all rounded-xl" onClick={handleRunSolver} disabled={status === 'running' || !selectedOffice || !weekId}>
            {status === 'running' ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2 fill-white" />}
            EXECUTE HUB
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
            <CardHeader className="bg-slate-50/50 border-b p-10">
              <CardTitle className="text-xl uppercase font-black leading-none">CP-SAT Orchestrator</CardTitle>
            </CardHeader>
            <CardContent className="p-10">
              <div className="space-y-10">
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden border p-0.5">
                   <div className="h-full bg-secondary rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
                </div>

                {solverResult && (
                  <div className={cn("p-8 rounded-[2rem] border-2 animate-in zoom-in-95", solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20')}>
                    <div className="flex gap-8 items-start">
                      <div className={cn("size-14 rounded-2xl flex items-center justify-center shrink-0", solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600')}>
                         {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-7" /> : <Sparkles className="size-7" />}
                      </div>
                      <div className="space-y-4 flex-1">
                         <p className="text-lg font-black leading-snug">{solverResult.summary}</p>
                         {lastDraftId && solverResult.status !== 'INFEASIBLE' && (
                           <Link href={`/admin/roster/review/${lastDraftId}`}>
                              <Button className="w-full h-14 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-xl">Review Workspace <ChevronRight className="ml-2 size-5" /></Button>
                           </Link>
                         )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
