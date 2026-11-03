'use client';

import { useState } from 'react';
import { collection, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { generateWeeklyRoster } from "@/ai/flows/generate-weekly-roster";
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow";
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, Activity, ChevronRight, Target, Lock, Server, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logAudit } from '@/lib/audit';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function RosterSolver() {
  const [weekId, setWeekId] = useState('2024-52');
  const [status, setStatus] = useState<"idle" | "running" | "success" | "conflict">("idle");
  const [progress, setProgress] = useState(0);
  const [explanation, setExplanation] = useState<any>(null);
  const [solverResult, setSolverResult] = useState<any>(null);

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  const draftsQuery = query(collection(db, 'roster_drafts'), orderBy('createdAt', 'desc'), limit(10));
  const { data: recentDrafts } = useCollection(draftsQuery);

  const handleRunSolver = async () => {
    if (!profile?.office || !profile?.uid) {
      toast({ variant: "destructive", title: "Authorization Missing", description: "Identity node verification failed." });
      return;
    }
    
    setStatus("running");
    setProgress(20);
    setExplanation(null);
    setSolverResult(null);

    // Simulated progress pulses
    const interval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + Math.random() * 5 : prev));
    }, 1000);

    try {
      const result = await generateWeeklyRoster({
        weekId,
        officeId: profile.office,
        adminUid: profile.uid
      });
      
      clearInterval(interval);
      setSolverResult(result);
      setProgress(100);

      if (result.status === 'INFEASIBLE') {
        setStatus("conflict");
        toast({ variant: "destructive", title: "Mathematical Infeasibility", description: "Solver could not satisfy exact quotas within clinical constraints." });
        return;
      }

      if (result.status === 'UNKNOWN') {
        setStatus("conflict");
        toast({ variant: "destructive", title: "Institutional Node Error", description: result.summary });
        return;
      }

      // Create Roster Draft Record
      const draftId = `draft_${weekId}_${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        id: draftId,
        weekId,
        office: profile.office,
        assignments: result.rosterAssignments,
        status: 'draft',
        solverStatus: result.status,
        summary: result.summary,
        solverMetadata: result.solverMetadata,
        createdAt: new Date().toISOString(),
        actorId: profile.uid
      });

      logAudit(db, profile.uid, 'RUN_CP_SAT_SOLVER', draftId, { weekId, solverStatus: result.status });
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
      problemDescription: `Roster Node: ${profile?.office} | Target Cycle: ${weekId}`,
      hardConstraints: ["Atomic Clinical Quotas", "Protected Weekly-Offs", "Approved Absences", "Adjacency Fairness"],
      softConstraints: ["Gender Pod Balance", "Professional Preferences"],
      solverOutcome: solverResult.status,
      detectedConflicts: solverResult.issuesEncountered
    });
    setExplanation(result);
  };

  return (
    <div className="space-y-8 pb-32 max-w-[1600px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary font-headline uppercase leading-none">Roster Solver</h1>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
               Deterministic OR-Tools Node • Production Link <BrainCircuit className="size-3 text-secondary" />
            </p>
            <Badge variant="outline" className="text-[8px] font-black uppercase px-3 py-0.5 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">Authenticated OIDC</Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border-2 shadow-sm">
           <div className="space-y-1">
             <Label className="text-[9px] font-black uppercase text-muted-foreground px-2">Week Cycle</Label>
             <Input className="h-10 w-36 font-black text-secondary border-none bg-secondary/5 focus-visible:ring-0 text-lg rounded-xl" value={weekId} onChange={e => setWeekId(e.target.value)} />
           </div>
           <Button 
             className="bg-primary text-white shadow-2xl shadow-primary/20 mt-auto h-12 px-10 font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleRunSolver} 
             disabled={status === 'running'}
           >
            {status === 'running' ? <Loader2 className="size-5 animate-spin mr-3" /> : <Play className="size-5 mr-3 group-hover:rotate-12 transition-transform" />}
            {status === 'running' ? 'Solving...' : 'Execute Node'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-primary">
            <CardHeader className="bg-muted/10 border-b p-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="size-16 rounded-[1.5rem] flex items-center justify-center shadow-inner bg-primary text-white">
                    <Server className="size-8" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl uppercase font-black tracking-tight leading-none">CP-SAT Engine Hub</CardTitle>
                    <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-2 opacity-60">
                       Deterministic Optimization Node • {profile?.office}
                    </CardDescription>
                  </div>
                </div>
                {status === 'success' && (
                  <Badge className={cn(
                    "px-6 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg animate-in zoom-in-90",
                    solverResult?.status === 'OPTIMAL' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-secondary shadow-secondary/20'
                  )}>
                    {solverResult?.status} Solution Found
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.3em]">Computation Pulse</span>
                  <span className="text-4xl font-black text-primary italic tracking-tighter">{Math.floor(progress)}%</span>
                </div>
                <div className="h-4 bg-muted/30 rounded-full overflow-hidden shadow-inner border">
                   <Progress value={progress} className="h-full bg-primary rounded-full transition-all duration-500" />
                </div>
              </div>

              {solverResult && (
                <div className={cn(
                    "p-8 rounded-[2rem] border-2 animate-in zoom-in-95 transition-all duration-500",
                    solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20 shadow-none' : 
                    solverResult.status === 'OPTIMAL' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-xl' :
                    'bg-secondary/5 border-secondary/20 shadow-lg'
                )}>
                  <div className="flex gap-6 items-start">
                    <div className={cn(
                        "size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                        solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10 text-destructive' : 
                        solverResult.status === 'OPTIMAL' ? 'bg-emerald-500/10 text-emerald-600' :
                        'bg-secondary/10 text-secondary'
                    )}>
                       {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-8" /> : <Sparkles className="size-8" />}
                    </div>
                    <div className="space-y-3 w-full">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40">Execution Status</p>
                             <Badge variant="outline" className={cn(
                                 "text-[9px] font-black uppercase tracking-widest",
                                 solverResult.status === 'OPTIMAL' ? 'border-emerald-500 text-emerald-600' : 
                                 solverResult.status === 'FEASIBLE' ? 'border-secondary text-secondary' : ''
                             )}>{solverResult.status}</Badge>
                          </div>
                          {solverResult.solverMetadata?.runId && (
                            <span className="text-[9px] font-mono font-black text-muted-foreground uppercase opacity-40">NODE_ID: {solverResult.solverMetadata.runId}</span>
                          )}
                       </div>
                       <p className="text-lg font-bold text-foreground leading-snug tracking-tight max-w-lg">{solverResult.summary}</p>
                       
                       {solverResult.solverMetadata && (
                         <div className="flex flex-wrap items-center gap-8 mt-6 pt-6 border-t border-muted">
                            <div className="space-y-1">
                               <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><Clock className="size-2.5" /> Latency</p>
                               <p className="text-[12px] font-black">{solverResult.solverMetadata.solveTimeMs.toFixed(0)}ms</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><ShieldCheck className="size-2.5" /> Constraints</p>
                               <p className="text-[12px] font-black">{solverResult.solverMetadata.constraintsChecked} ACTIVE</p>
                            </div>
                            {solverResult.solverMetadata.objectiveValue !== undefined && (
                              <div className="space-y-1">
                                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><Activity className="size-2.5" /> Objective</p>
                                <p className="text-[12px] font-black text-secondary">{solverResult.solverMetadata.objectiveValue.toFixed(2)}</p>
                              </div>
                            )}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t bg-muted/5 p-6">
              <Button variant="ghost" className="w-full text-[11px] font-black uppercase tracking-[0.3em] h-14 hover:bg-white transition-all rounded-xl" onClick={handleExplain} disabled={!solverResult}>
                <BrainCircuit className="mr-4 h-6 w-6 text-secondary" /> 
                Interpret Engine Logic
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card">
            <CardHeader className="bg-muted/10 border-b p-8">
               <div className="flex items-center gap-4">
                 <History className="size-6 text-muted-foreground opacity-40" />
                 <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Deployment Audit History</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-muted/30">
                {recentDrafts?.length === 0 ? (
                    <div className="py-20 text-center opacity-30 italic font-black uppercase text-xs tracking-widest">No previous optimization runs in cluster record.</div>
                ) : recentDrafts?.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-8 hover:bg-muted/5 transition-colors group">
                    <div className="flex items-center gap-8">
                       <div className={cn(
                           "size-4 rounded-full",
                           draft.status === 'published' ? 'bg-emerald-500 shadow-[0_0_15px_emerald]' : 'bg-secondary shadow-[0_0_12px_blue]'
                       )} />
                       <div>
                          <p className="text-lg font-black uppercase tracking-tighter text-primary group-hover:translate-x-1 transition-transform">Cycle {draft.weekId}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">{new Date(draft.createdAt).toLocaleString()} • {draft.office?.replace('_', ' ')}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <Badge variant="outline" className="text-[8px] font-black uppercase hidden sm:inline-flex">{draft.solverStatus}</Badge>
                        <Link href={`/admin/roster/review/${draft.id}`}>
                        <Button variant="outline" className="h-12 px-8 text-[11px] font-black uppercase tracking-[0.2em] border-2 rounded-xl hover:bg-primary hover:text-white transition-all group">
                            Review Workspace <ChevronRight className="ml-3 size-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                        </Link>
                    </div>
                  </div>
                ))}
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-2xl border-none bg-primary text-primary-foreground rounded-[3rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-5">
               <Target size={320} />
            </div>
            <CardHeader className="relative z-10 p-10 pb-6 border-b border-white/5">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] flex items-center gap-4 text-secondary">
                <Sparkles className="size-6" /> Logical Interpretation
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-10 pt-8 space-y-10">
              {!explanation ? (
                <div className="py-24 text-center space-y-8">
                   <div className="size-20 rounded-[2rem] bg-white/5 flex items-center justify-center mx-auto shadow-inner border border-white/10">
                      <BrainCircuit className="size-10 opacity-20" />
                   </div>
                   <p className="text-[11px] font-black uppercase text-white/30 tracking-[0.2em] leading-relaxed px-6">
                     Awaiting computation cycle to interpret mathematical outcomes.
                   </p>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
                  <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60">Engine Rationale</p>
                    <p className="text-[14px] font-medium leading-relaxed italic opacity-90">"{explanation.solverInterpretation}"</p>
                  </div>
                  
                  {explanation.conflictExplanations.length > 0 && (
                    <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive px-1">Constraint Blocks</p>
                      <div className="space-y-6">
                        {explanation.conflictExplanations.map((c: any, i: number) => (
                          <div key={i} className="p-6 rounded-[1.75rem] bg-destructive/10 border-l-4 border-l-destructive space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-tight text-white">{c.conflict}</p>
                            <p className="text-[12px] font-semibold leading-relaxed opacity-70">{c.explanation}</p>
                            <div className="pt-3 border-t border-white/5 flex items-center gap-3">
                               <div className="size-2 rounded-full bg-secondary" />
                               <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Action: {c.suggestedAction}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white shadow-xl border-none rounded-[2.5rem] overflow-hidden border-l-4 border-l-secondary">
            <CardHeader className="p-8 pb-4">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 text-muted-foreground">
                <Lock className="size-5 text-secondary" /> Secure Optimization Path
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-2 space-y-8">
              <div className="flex gap-6 items-start">
                 <div className="size-2 rounded-full bg-secondary mt-2 shrink-0 shadow-[0_0_12px_blue]" />
                 <p className="text-[12px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-70">
                    Trusted Backend: All clinical constraints are fetched on the server from authoritative collections.
                 </p>
              </div>
              <div className="flex gap-6 items-start">
                 <div className="size-2 rounded-full bg-accent mt-2 shrink-0 shadow-[0_0_12px_teal]" />
                 <p className="text-[12px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-70">
                    Mathematical Proof: Assignments are calculated using branch-and-bound logic, not LLM probability.
                 </p>
              </div>
              <div className="flex gap-6 items-start">
                 <div className="size-2 rounded-full bg-emerald-500 mt-2 shrink-0 shadow-[0_0_12px_emerald]" />
                 <p className="text-[12px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-70">
                    IAM Gateway: All solver communication is authenticated via Google Cloud Identity tokens.
                 </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
