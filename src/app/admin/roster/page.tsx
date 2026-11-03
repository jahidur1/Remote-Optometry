'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateWeeklyRoster } from "@/ai/flows/generate-weekly-roster";
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow";
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, Activity, ChevronRight, Target, Lock, Server, Clock, Zap, Cpu, Terminal, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Input } from '@/components/ui/input';
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

  const draftsQuery = useMemo(() => query(
    collection(db, 'roster_drafts'), 
    orderBy('createdAt', 'desc'), 
    limit(10)
  ), [db]);
  
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
      {/* Precision Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase leading-none">Roster Solver</h1>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
              CP-SAT Optimization Node <Activity className="size-3 text-secondary animate-pulse" />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 border-r border-white/5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cycle</label>
              <div className="flex items-center gap-2">
                 <Input 
                  className="w-24 h-6 font-black text-secondary border-none bg-transparent focus-visible:ring-0 p-0 text-[16px]" 
                  value={weekId} 
                  onChange={(e) => setWeekId(e.target.value)}
                />
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
              </div>
           </div>
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleRunSolver} 
             disabled={status === 'running'}
           >
            {status === 'running' ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2 fill-white" />}
            {status === 'running' ? 'OPTIMIZING...' : 'EXECUTE NODE'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Primary Command Deck */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-row items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-2xl flex items-center justify-center shadow-inner bg-primary border border-white/10">
                  <Server className="size-7 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-white leading-none">CP-SAT Orchestrator</CardTitle>
                  <CardDescription className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                     Deterministic Cluster Logic Node
                  </CardDescription>
                </div>
              </div>
              {status === 'running' && (
                <Badge className="bg-secondary/10 text-secondary border-secondary/20 font-black text-[9px] px-4 py-1.5 rounded-full animate-pulse">COMPUTING_ACTIVE</Badge>
              )}
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              {/* Progress Pulse */}
              <div className="space-y-4">
                <div className="flex justify-between items-end px-1">
                   <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Load Status</span>
                   <span className="text-2xl font-black text-white tabular-nums">{Math.floor(progress)}%</span>
                </div>
                <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                   <div 
                    className="h-full bg-secondary rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                    style={{ width: `${progress}%` }}
                   />
                </div>
              </div>

              {/* Dynamic Outcome Result */}
              {solverResult && (
                <div className={cn(
                    "p-8 rounded-[2rem] border-2 animate-in zoom-in-95 transition-all duration-500",
                    solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'
                )}>
                  <div className="flex gap-8 items-start">
                    <div className={cn(
                        "size-14 rounded-2xl flex items-center justify-center shrink-0",
                        solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-400'
                    )}>
                       {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-7" /> : <Sparkles className="size-7" />}
                    </div>
                    <div className="space-y-4 flex-1">
                       <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Status Update</p>
                          <span className="text-[9px] font-mono font-black text-white/20 uppercase">TRACE_{solverResult.solverMetadata?.runId || 'SYS'}</span>
                       </div>
                       <p className="text-lg font-bold text-white leading-snug">{solverResult.summary}</p>
                       
                       {solverResult.solverMetadata && (
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/5">
                            <div className="space-y-1">
                               <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Latency</p>
                               <p className="text-base font-black text-white">{solverResult.solverMetadata.solveTimeMs.toFixed(0)}ms</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Constraints</p>
                               <p className="text-base font-black text-white">{solverResult.solverMetadata.constraintsChecked}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Objective</p>
                               <p className="text-base font-black text-secondary">{solverResult.solverMetadata.objectiveValue?.toFixed(1) || '0.0'}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Protocol</p>
                               <p className="text-base font-black text-white">{solverResult.status}</p>
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            {solverResult && (
              <CardFooter className="border-t border-white/5 bg-white/[0.01] p-6">
                <Button 
                  variant="ghost" 
                  className="w-full text-[10px] font-black uppercase tracking-[0.2em] h-12 hover:bg-white hover:text-primary transition-all rounded-xl group" 
                  onClick={handleExplain}
                >
                  <BrainCircuit className="mr-3 h-5 w-5 text-secondary group-hover:scale-110" /> 
                  Interpret Engine Rationale
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Optimized Deployment Registry */}
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-8 flex flex-row items-center justify-between">
               <div className="flex items-center gap-5">
                  <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <History className="size-6" />
                  </div>
                  <CardTitle className="text-base font-black uppercase tracking-[0.15em] text-white">Deployment Registry</CardTitle>
               </div>
               <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-white/10 text-white/30">Latest 10 Traces</Badge>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-white/5">
                {recentDrafts?.length === 0 ? (
                    <div className="py-20 text-center opacity-10 italic font-black uppercase text-[10px] tracking-[0.3em]">No registry history detected.</div>
                ) : recentDrafts?.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex items-center gap-8">
                       <div className={cn(
                           "size-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                           draft.status === 'published' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-secondary shadow-secondary/50'
                       )} />
                       <div>
                          <p className="text-lg font-black uppercase tracking-tighter text-white group-hover:translate-x-1 transition-transform leading-none">Cycle {draft.weekId}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                             <p className="text-[9px] font-bold text-white/20 uppercase">{new Date(draft.createdAt).toLocaleDateString()} • {draft.office?.substring(0,3)}</p>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <Badge variant="outline" className="text-[8px] font-black uppercase px-3 py-0.5 border-white/10 text-white/40 hidden sm:inline-flex">{draft.solverStatus}</Badge>
                        <Link href={`/admin/roster/review/${draft.id}`}>
                          <Button variant="outline" className="h-10 px-6 text-[9px] font-black uppercase tracking-[0.15em] border-2 border-white/5 rounded-xl hover:bg-white hover:text-primary transition-all">
                              Review Workspace <ChevronRight className="ml-2 size-3" />
                          </Button>
                        </Link>
                    </div>
                  </div>
                ))}
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* Collapsible/Dynamic Interpretation */}
          <Card className={cn(
            "shadow-2xl border-none rounded-[2.5rem] overflow-hidden transition-all duration-700 relative group border border-white/5",
            explanation ? "bg-primary text-primary-foreground p-0" : "bg-white/[0.02] border-dashed border-2"
          )}>
            <CardHeader className="p-8 pb-4 border-b border-white/5">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-4 text-secondary">
                <BrainCircuit className="size-5" /> Logical Interpretation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-6">
              {!explanation ? (
                <div className="py-16 text-center space-y-6">
                   <div className="size-16 rounded-[1.25rem] bg-white/[0.03] flex items-center justify-center mx-auto border border-white/5">
                      <Terminal className="size-7 text-white/10" />
                   </div>
                   <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] leading-relaxed max-w-[200px] mx-auto">
                     Awaiting solver cycle to interpret results.
                   </p>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3 relative">
                    <p className="text-[8px] font-black uppercase tracking-widest text-secondary/60">Engine Rationale</p>
                    <p className="text-[13px] font-medium leading-relaxed italic text-white/90">"{explanation.solverInterpretation}"</p>
                  </div>
                  
                  {explanation.conflictExplanations.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-destructive flex items-center gap-2">
                         <AlertTriangle className="size-3" /> Conflict Ledger
                      </p>
                      <div className="space-y-4">
                        {explanation.conflictExplanations.map((c: any, i: number) => (
                          <div key={i} className="p-5 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-tight text-white">{c.conflict}</p>
                            <p className="text-[12px] text-white/60 leading-relaxed font-medium">{c.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Institutional Guard Card */}
          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-10 space-y-8 group border-l-4 border-l-secondary shadow-2xl">
             <div className="space-y-3">
                <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-105 transition-transform">
                   <Lock className="size-6" />
                </div>
                <div>
                   <p className="text-[11px] font-black uppercase tracking-[0.25em] text-secondary">Security Protocol</p>
                   <p className="text-xl font-black text-white uppercase tracking-tight">Zero-Trust Sync</p>
                </div>
             </div>
             
             <div className="space-y-6">
                {[
                    { label: 'Authoritative Data', text: 'Constraints are fetched server-side from clinical registries.', icon: Database },
                    { label: 'Deterministic Proof', text: 'Assignments use branch-and-bound logic for 100% precision.', icon: Zap },
                    { label: 'IAM Identity', text: 'All node communication is gated via OIDC service tokens.', icon: ShieldCheck }
                ].map((item, i) => (
                    <div key={i} className="flex gap-5 items-start group/node">
                       <div className="size-1.5 rounded-full bg-secondary mt-1.5 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)] group-hover/node:scale-125 transition-transform" />
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-white/80 tracking-widest">{item.label}</p>
                          <p className="text-[11px] text-white/30 leading-relaxed font-bold uppercase tracking-tighter">
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
