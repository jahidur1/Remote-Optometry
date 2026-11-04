'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, limit, doc, setDoc, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateWeeklyRoster } from "@/ai/flows/generate-weekly-roster";
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow";
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, Activity, ChevronRight, Target, Lock, Server, Clock, Zap, Cpu, Terminal, Database, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit } from '@/lib/audit';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function RosterSolver() {
  const [weekId, setWeekId] = useState('2024-52');
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [status, setStatus] = useState<"idle" | "running" | "success" | "conflict">("idle");
  const [progress, setProgress] = useState(0);
  const [explanation, setExplanation] = useState<any>(null);
  const [solverResult, setSolverResult] = useState<any>(null);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);

  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  // Dynamic Office Registry Subscription
  const { data: registryOffices, loading: registryLoading } = useCollection(
    query(collection(db, 'offices'), where('status', '==', 'Active'))
  );

  const authorizedOffices = useMemo(() => {
    if (!profile || !registryOffices) return [];
    if (profile.role === 'SUPER_ADMIN') return registryOffices;
    
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

  const handleRunSolver = async () => {
    const targetOffice = selectedOffice;

    if (!targetOffice || !profile?.uid) {
      toast({ 
        variant: "destructive", 
        title: "Authorization Required", 
        description: "Please select a target cluster node to initiate the solver." 
      });
      return;
    }
    
    setStatus("running");
    setProgress(20);
    setExplanation(null);
    setSolverResult(null);
    setLastDraftId(null);

    const interval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + Math.random() * 5 : prev));
    }, 1000);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired. Please re-authenticate.");

      const result = await generateWeeklyRoster({
        weekId,
        officeId: targetOffice,
        idToken: idToken
      });
      
      clearInterval(interval);
      setSolverResult(result);
      setProgress(100);

      if (result.status === 'INFEASIBLE') {
        setStatus("conflict");
        toast({ variant: "destructive", title: "Mathematical Infeasibility", description: "Solver could not satisfy exact quotas within clinical constraints." });
        return;
      }

      const draftId = `draft_${weekId}_${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        id: draftId,
        weekId,
        office: targetOffice,
        assignments: result.rosterAssignments,
        status: 'draft',
        solverStatus: result.status,
        summary: result.summary,
        solverMetadata: result.solverMetadata,
        createdAt: new Date().toISOString(),
        actorId: profile.uid
      });

      setLastDraftId(draftId);
      logAudit(db, profile.uid, 'RUN_CP_SAT_SOLVER', draftId, { weekId, solverStatus: result.status, office: targetOffice });
      setStatus("success");
      toast({ title: "Optimization Complete", description: "Deterministic draft secured in cluster registry." });
    } catch (e: any) {
      clearInterval(interval);
      setStatus("conflict");
      toast({ variant: "destructive", title: "Pipeline Failure", description: e.message });
    }
  };

  const handleExplain = async () => {
    if (!solverResult) return;
    const result = await explainSchedulingConflicts({
      problemDescription: `Roster Node: ${selectedOffice} | Target Cycle: ${weekId}`,
      hardConstraints: ["Atomic Clinical Quotas", "Protected Weekly-Offs", "Approved Absences", "Adjacency Fairness"],
      softConstraints: ["Gender Pod Balance", "Professional Preferences"],
      solverOutcome: solverResult.status,
      detectedConflicts: solverResult.issuesEncountered
    });
    setExplanation(result);
  };

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Cpu className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Roster Solver</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  CP-SAT Optimization Node <Activity className="size-3 text-secondary animate-pulse" />
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
                <SelectTrigger className="h-6 w-48 font-black text-black border-none bg-transparent focus:ring-0 p-0 text-[14px]">
                  <SelectValue placeholder={registryLoading ? "Syncing..." : "Select Node..."} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                  {authorizedOffices.map(o => (
                    <SelectItem key={o.officeId} value={o.officeId} className="font-bold text-[11px] py-2.5 rounded-lg uppercase">
                      {o.officeName} [{o.shortCode}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cycle</label>
              <div className="flex items-center gap-2">
                <Input 
                  className="w-20 h-6 font-black text-black border-none bg-transparent focus-visible:ring-0 p-0 text-[16px]" 
                  value={weekId} 
                  onChange={(e) => setWeekId(e.target.value)}
                />
                <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
              </div>
           </div>
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleRunSolver} 
             disabled={status === 'running' || !selectedOffice}
           >
            {status === 'running' ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2 fill-white" />}
            {status === 'running' ? 'OPTIMIZING...' : 'EXECUTE NODE'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-row items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-2xl flex items-center justify-center shadow-inner bg-primary border border-slate-200">
                  <Server className="size-7 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">CP-SAT Orchestrator</CardTitle>
                  <CardDescription className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                     Deterministic Cluster Logic Node: {authorizedOffices.find(o => o.officeId === selectedOffice)?.officeName || '---'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between items-end px-1">
                   <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Load Status</span>
                   <span className="text-2xl font-black text-black tabular-nums">{Math.floor(progress)}%</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5 shadow-inner">
                   <div 
                    className="h-full bg-secondary rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                    style={{ width: `${progress}%` }}
                   />
                </div>
              </div>

              {solverResult && (
                <div className={cn(
                    "p-8 rounded-[2rem] border-2 animate-in zoom-in-95 transition-all duration-500",
                    solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'
                )}>
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className={cn(
                        "size-14 rounded-2xl flex items-center justify-center shrink-0",
                        solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'
                    )}>
                       {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-7" /> : <Sparkles className="size-7" />}
                    </div>
                    <div className="space-y-4 flex-1">
                       <p className="text-lg font-black text-black leading-snug">{solverResult.summary}</p>
                       
                       {lastDraftId && solverResult.status !== 'INFEASIBLE' && (
                         <Link href={`/admin/roster/review/${lastDraftId}`} className="block">
                            <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-xl transition-all group">
                                Enter Review Workspace <ChevronRight className="ml-2 size-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                         </Link>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
               <div className="flex items-center gap-5">
                  <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <History className="size-6" />
                  </div>
                  <CardTitle className="text-base font-black uppercase tracking-[0.15em] text-black">Deployment Registry</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-50">
                {recentDrafts?.length === 0 ? (
                    <div className="py-24 text-center opacity-20 italic font-black uppercase text-[10px] tracking-[0.3em] text-slate-400">No registry history detected for selected node.</div>
                ) : recentDrafts?.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-8 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-8">
                       <div className={cn(
                           "size-2.5 rounded-full shadow-lg",
                           draft.status === 'published' ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-secondary shadow-secondary/30'
                       )} />
                       <div>
                          <p className="text-xl font-black uppercase tracking-tighter text-black group-hover:translate-x-1 transition-transform leading-none">Cycle {draft.weekId}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{new Date(draft.createdAt).toLocaleDateString()} • NODE_{draft.office?.substring(0,3)}</p>
                       </div>
                    </div>
                    <Link href={`/admin/roster/review/${draft.id}`}>
                      <Button variant="outline" className="h-11 px-8 text-[9px] font-black uppercase tracking-[0.2em] border-2 border-slate-100 rounded-xl hover:bg-white hover:border-secondary transition-all">
                          Review Workspace <ChevronRight className="ml-2 size-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
