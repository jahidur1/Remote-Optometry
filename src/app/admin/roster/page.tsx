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
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, Activity, ChevronRight, Target, Lock, Server, Clock, Zap, Cpu, Terminal } from "lucide-react";
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
    <div className="space-y-8 pb-32 max-w-[1600px] mx-auto animate-in px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Cpu className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Roster Solver</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Deterministic Node Pulse <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5 border-emerald-500/20 text-emerald-500 bg-emerald-500/5">Authenticated OIDC</Badge>
              </div>
            </div>
            <DemoBadge />
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Week</label>
              <Input 
                className="w-32 h-8 font-black text-secondary border-none bg-transparent focus-visible:ring-0 p-0 text-xl" 
                value={weekId} 
                onChange={(e) => setWeekId(e.target.value)}
              />
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-12 px-10 font-black uppercase tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleRunSolver} 
             disabled={status === 'running'}
           >
            {status === 'running' ? <Loader2 className="size-5 animate-spin mr-3" /> : <Play className="size-5 mr-3 fill-white group-hover:rotate-12 transition-transform" />}
            {status === 'running' ? 'OPTIMIZING...' : 'EXECUTE NODE'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main Solver Console */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-white/10">
                    <Server className="size-8 text-secondary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl uppercase font-black tracking-tight text-white leading-none">CP-SAT Orchestrator</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                       Deterministic Cluster Logic • v2.0
                    </CardDescription>
                  </div>
                </div>
                {status === 'success' && (
                  <Badge className={cn(
                    "px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl animate-in zoom-in-90",
                    solverResult?.status === 'OPTIMAL' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-secondary shadow-secondary/20'
                  )}>
                    {solverResult?.status} SOLUTION FOUND
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-12 space-y-12">
              <div className="space-y-6">
                <div className="flex justify-between items-end px-2">
                  <span className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.4em]">Computational Progress</span>
                  <span className="text-5xl font-black text-white italic tracking-tighter tabular-nums">{Math.floor(progress)}%</span>
                </div>
                <div className="h-6 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/10 p-1">
                   <div 
                    className="h-full bg-gradient-to-r from-secondary to-blue-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(59,130,246,0.5)]" 
                    style={{ width: `${progress}%` }}
                   />
                </div>
              </div>

              {solverResult && (
                <div className={cn(
                    "p-10 rounded-[3rem] border-2 animate-in zoom-in-95 transition-all duration-700",
                    solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10 border-destructive/30 shadow-2xl' : 
                    solverResult.status === 'OPTIMAL' ? 'bg-emerald-500/5 border-emerald-500/30 shadow-2xl shadow-emerald-500/5' :
                    'bg-secondary/5 border-secondary/30 shadow-2xl shadow-secondary/5'
                )}>
                  <div className="flex gap-10 items-start">
                    <div className={cn(
                        "size-20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-2xl",
                        solverResult.status === 'INFEASIBLE' ? 'bg-destructive/20 text-destructive' : 
                        solverResult.status === 'OPTIMAL' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-secondary/20 text-secondary'
                    )}>
                       {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-10" /> : <Sparkles className="size-10" />}
                    </div>
                    <div className="space-y-5 w-full">
                       <div className="flex items-center justify-between">
                          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Execution Protocol Outcome</p>
                          {solverResult.solverMetadata?.runId && (
                            <span className="text-[9px] font-mono font-black text-white/20 uppercase tracking-widest">NODE_TRACE: {solverResult.solverMetadata.runId}</span>
                          )}
                       </div>
                       <p className="text-2xl font-bold text-white leading-tight tracking-tight max-w-2xl">{solverResult.summary}</p>
                       
                       {solverResult.solverMetadata && (
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10 pt-10 border-t border-white/5">
                            <div className="space-y-1.5">
                               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Clock className="size-3 text-secondary" /> Latency</p>
                               <p className="text-2xl font-black text-white tracking-tighter">{solverResult.solverMetadata.solveTimeMs.toFixed(0)}ms</p>
                            </div>
                            <div className="space-y-1.5">
                               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><ShieldCheck className="size-3 text-secondary" /> Constraints</p>
                               <p className="text-2xl font-black text-white tracking-tighter">{solverResult.solverMetadata.constraintsChecked}</p>
                            </div>
                            {solverResult.solverMetadata.objectiveValue !== undefined && (
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Activity className="size-3 text-secondary" /> Objective</p>
                                <p className="text-2xl font-black text-secondary tracking-tighter">{solverResult.solverMetadata.objectiveValue.toFixed(1)}</p>
                              </div>
                            )}
                            <div className="space-y-1.5">
                               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Zap className="size-3 text-secondary" /> Status</p>
                               <p className="text-lg font-black text-white tracking-widest">{solverResult.status}</p>
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-white/5 bg-white/[0.02] p-8">
              <Button 
                variant="ghost" 
                className="w-full text-[11px] font-black uppercase tracking-[0.3em] h-16 hover:bg-white hover:text-primary transition-all rounded-2xl group" 
                onClick={handleExplain} 
                disabled={!solverResult}
              >
                <BrainCircuit className="mr-4 h-7 w-7 text-secondary group-hover:scale-110 transition-transform" /> 
                INTERPRET ENGINE LOGIC & CONSTRAINTS
              </Button>
            </CardFooter>
          </Card>

          {/* Audit History */}
          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-8">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                      <History className="size-6" />
                    </div>
                    <CardTitle className="text-base font-black uppercase tracking-[0.2em] text-white">Deployment Registry</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-white/10 text-white/40">Latest 10 Runs</Badge>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-white/5">
                {recentDrafts?.length === 0 ? (
                    <div className="py-24 text-center opacity-10 italic font-black uppercase text-xs tracking-[0.3em]">No optimization history detected in cluster.</div>
                ) : recentDrafts?.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-8 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex items-center gap-10">
                       <div className={cn(
                           "size-3 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)]",
                           draft.status === 'published' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-secondary shadow-secondary/50'
                       )} />
                       <div>
                          <p className="text-xl font-black uppercase tracking-tighter text-white group-hover:translate-x-2 transition-transform">Cycle {draft.weekId}</p>
                          <div className="flex items-center gap-4 mt-1">
                             <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">{new Date(draft.createdAt).toLocaleString()} IST</p>
                             <div className="size-1 rounded-full bg-white/10" />
                             <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{draft.office?.replace('_', ' ')}</p>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <Badge variant="outline" className="text-[9px] font-black uppercase px-4 py-1 border-white/10 text-white/60 hidden sm:inline-flex">{draft.solverStatus}</Badge>
                        <Link href={`/admin/roster/review/${draft.id}`}>
                        <Button variant="outline" className="h-12 px-10 text-[10px] font-black uppercase tracking-[0.2em] border-2 border-white/5 rounded-xl hover:bg-white hover:text-primary transition-all group">
                            REVIEW WORKSPACE <ChevronRight className="ml-3 size-4 group-hover:translate-x-2 transition-transform" />
                        </Button>
                        </Link>
                    </div>
                  </div>
                ))}
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Interpretation Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <Card className="shadow-2xl border-none bg-primary text-primary-foreground rounded-[3rem] overflow-hidden relative group border border-white/5">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-[0.03]">
               <Target size={320} />
            </div>
            <CardHeader className="relative z-10 p-10 pb-6 border-b border-white/5">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] flex items-center gap-5 text-secondary">
                <BrainCircuit className="size-6" /> Logical Interpretation
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-10 pt-10 space-y-12">
              {!explanation ? (
                <div className="py-32 text-center space-y-10">
                   <div className="size-24 rounded-[2.5rem] bg-white/[0.03] flex items-center justify-center mx-auto shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-700">
                      <Terminal className="size-10 text-white/10" />
                   </div>
                   <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em] leading-relaxed px-10">
                     Awaiting computation cycle to interpret deterministic engine results.
                   </p>
                </div>
              ) : (
                <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
                  <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 shadow-2xl relative">
                    <div className="absolute -top-3 -left-3 size-8 rounded-xl bg-secondary flex items-center justify-center shadow-xl">
                      <Sparkles className="size-4 text-white" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary/60">Engine Rationale</p>
                    <p className="text-[15px] font-medium leading-relaxed italic text-white/90">"{explanation.solverInterpretation}"</p>
                  </div>
                  
                  {explanation.conflictExplanations.length > 0 && (
                    <div className="space-y-8">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-destructive flex items-center gap-3">
                         <AlertTriangle className="size-4" /> Constraint Violations <span className="h-px flex-1 bg-destructive/10" />
                      </h5>
                      <div className="space-y-6">
                        {explanation.conflictExplanations.map((c: any, i: number) => (
                          <div key={i} className="p-8 rounded-[2rem] bg-destructive/5 border border-destructive/20 space-y-4 group/item hover:bg-destructive/10 transition-colors">
                            <p className="text-[12px] font-black uppercase tracking-tight text-white">{c.conflict}</p>
                            <p className="text-[13px] font-medium leading-relaxed opacity-70 text-slate-300">{c.explanation}</p>
                            <div className="pt-4 border-t border-white/5 flex items-center gap-4">
                               <Zap className="size-3.5 text-secondary" />
                               <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Recommended: {c.suggestedAction}</p>
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

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-10 space-y-10 group border-l-4 border-l-secondary">
             <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                   <Lock className="size-6" />
                </div>
                <div>
                   <p className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">Security Protocol</p>
                   <p className="text-lg font-black text-white uppercase tracking-tight mt-1">Zero-Trust Environment</p>
                </div>
             </div>
             
             <div className="space-y-8">
                {[
                    { label: 'Trusted Backend', text: 'All clinical constraints are fetched server-side from authoritative collections.', icon: Server },
                    { label: 'Deterministic Proof', text: 'Assignments use branch-and-bound logic, not probabilistic LLM guessing.', icon: Zap },
                    { label: 'IAM Gateway', text: 'All solver communication is strictly gated via Google Cloud Identity tokens.', icon: ShieldCheck }
                ].map((item, i) => (
                    <div key={i} className="flex gap-6 items-start group/node">
                       <div className="size-1.5 rounded-full bg-secondary mt-1.5 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.8)] group-hover/node:scale-150 transition-transform" />
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-white/80 tracking-widest">{item.label}</p>
                          <p className="text-[12px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-60">
                             {item.text}
                          </p>
                       </div>
                    </div>
                ))}
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
