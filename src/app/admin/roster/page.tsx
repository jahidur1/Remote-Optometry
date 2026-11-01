'use client';

import { useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, orderBy } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { generateWeeklyRoster, type GenerateWeeklyRosterInput } from "@/ai/flows/generate-weekly-roster";
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow";
import { BrainCircuit, Sparkles, AlertTriangle, CheckCircle, Info, Loader2, Play, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logAudit } from '@/lib/audit';

export default function RosterSolver() {
  const [weekId, setWeekId] = useState('2024-52');
  const [status, setStatus] = useState<"idle" | "running" | "success" | "conflict">("idle");
  const [progress, setProgress] = useState(0);
  const [explanation, setExplanation] = useState<any>(null);
  const [solverResult, setSolverResult] = useState<any>(null);

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  const handleRunSolver = async () => {
    if (!profile) return;
    
    setStatus("running");
    setProgress(5);
    setExplanation(null);
    setSolverResult(null);

    try {
      // 1. Compile World State
      setProgress(15);
      const [employeesSnap, shiftsSnap, quotasSnap, bookingsSnap, leavesSnap, prefsSnap] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('status', '==', 'Active'))),
        getDocs(query(collection(db, 'shift_master'), orderBy('displayOrder'))),
        getDocs(doc(db, 'roster_quotas', weekId)),
        getDocs(query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId))),
        getDocs(query(collection(db, 'employee_leaves'), where('status', '==', 'approved'))),
        getDocs(query(collection(db, 'employee_preferences'), where('weekId', '==', weekId)))
      ]);

      if (!quotasSnap.exists()) {
        throw new Error(`Staffing quotas for Week ${weekId} have not been configured. Solve aborted.`);
      }

      setProgress(40);
      const input: GenerateWeeklyRosterInput = {
        shifts: shiftsSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        employees: employeesSnap.docs.map(d => ({ id: d.id, name: d.data().fullName, gender: d.data().gender.toLowerCase() as any })),
        weeklyQuotas: Object.entries(quotasSnap.data().quotas || {}).map(([key, val]) => {
          const [day, shiftId] = key.split('_');
          return { dayOfWeek: day as any, shiftId, requiredStaff: val as number };
        }),
        employeeHardConstraints: [
          ...bookingsSnap.docs.map(d => ({ employeeId: d.data().employeeId, type: 'weeklyOff' as const, dayOfWeek: d.data().dayOfWeek as any })),
          ...leavesSnap.docs.map(d => ({ employeeId: d.data().employeeId, type: 'unavailable' as const, dayOfWeek: 'Monday' as any })) // Simplified date mapping
        ],
        employeeSoftPreferences: prefsSnap.docs.map(d => ({ 
          employeeId: d.data().employeeId, 
          dayOfWeek: d.data().dayOfWeek as any, 
          shiftId: d.data().shiftId, 
          type: 'preferShift' as const 
        }))
      };

      // 2. Execute Solver (Genkit Flow)
      setProgress(70);
      const result = await generateWeeklyRoster(input);
      setSolverResult(result);

      if (result.status === 'INFEASIBLE') {
        throw new Error("Mathematical solver determined this configuration is INFEASIBLE. Please check staffing shortages.");
      }

      // 3. Commit Draft
      setProgress(90);
      const draftId = `draft_${weekId}_${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        weekId,
        assignments: result.rosterAssignments,
        status: 'draft',
        solverStatus: result.status,
        summary: result.summary,
        createdAt: new Date().toISOString(),
        actorId: profile.uid
      });

      logAudit(db, profile.uid, 'RUN_ROSTER_SOLVER', draftId, { weekId, status: result.status });
      
      setProgress(100);
      setStatus("success");
      toast({ title: "Roster Draft Generated", description: `Optimized solution for ${weekId} saved.` });

    } catch (e: any) {
      console.error(e);
      setStatus("conflict");
      toast({ variant: "destructive", title: "Solver Blocked", description: e.message });
    }
  };

  const handleExplain = async () => {
    if (!solverResult) return;
    const result = await explainSchedulingConflicts({
      problemDescription: `Weekly Roster Generation for Week ${weekId}`,
      hardConstraints: ["Daily Staffing Quotas", "Protected Weekly-Offs", "Approved Clinical Leave"],
      softConstraints: ["Employee Shift Preferences", "Gender Balance Targets"],
      solverOutcome: solverResult.status,
      detectedConflicts: solverResult.issuesEncountered
    });
    setExplanation(result);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">CP-SAT Optimizer</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Mathematical workforce allocation engine (OR-Tools).</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase opacity-60">Target Week</Label>
            <Input className="h-9 w-32 font-bold" value={weekId} onChange={e => setWeekId(e.target.value)} />
          </div>
          <Button className="bg-secondary shadow-lg shadow-secondary/10 mt-auto h-9 px-6" onClick={handleRunSolver} disabled={status === 'running'}>
            {status === 'running' ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2" />}
            {status === 'running' ? 'Solving...' : 'Run Solver'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-t-4 border-t-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Orchestration & Status</CardTitle>
              </div>
              {status === 'success' && <Badge className="bg-emerald-500 font-bold uppercase text-[10px]">Optimal</Badge>}
              {status === 'conflict' && <Badge variant="destructive" className="font-bold uppercase text-[10px]">Infeasible</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border bg-muted/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Computation Progress</span>
                <span className="text-lg font-black text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-background" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4 bg-background shadow-sm space-y-2">
                <h4 className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-2">
                  <CheckCircle className="size-3" /> Hard Constraints
                </h4>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  Exact quotas, Weekly-Off protection, and Leave blocks are treated as mandatory solver inputs.
                </p>
              </div>
              <div className="rounded-xl border p-4 bg-background shadow-sm space-y-2">
                <h4 className="text-[10px] font-black uppercase text-secondary flex items-center gap-2">
                  <Info className="size-3" /> Soft Objectives
                </h4>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  Shift preferences and gender balance targets are optimized but may be relaxed to satisfy hard rules.
                </p>
              </div>
            </div>

            {solverResult && (
              <div className={`p-4 rounded-xl border ${solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <div className="flex gap-3">
                  {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-5 text-destructive" /> : <Sparkles className="size-5 text-emerald-500" />}
                  <div className="space-y-1">
                    <p className={`text-xs font-black uppercase ${solverResult.status === 'INFEASIBLE' ? 'text-destructive' : 'text-emerald-700'}`}>
                      Solver {solverResult.status}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                      {solverResult.summary}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-muted/5 p-4">
            <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-[0.2em]" onClick={handleExplain} disabled={!solverResult}>
              <BrainCircuit className="mr-2 h-4 w-4 text-secondary" /> 
              Explain Logic with GenAI
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-1 shadow-md border-t-4 border-t-secondary">
          <CardHeader>
            <CardTitle className="text-lg">Logic Interpretation</CardTitle>
            <CardDescription className="text-xs uppercase font-bold tracking-tighter">AI Constraint Summary</CardDescription>
          </CardHeader>
          <CardContent>
            {!explanation ? (
              <div className="h-48 flex flex-col items-center justify-center text-center space-y-4 pt-12">
                <History className="size-8 text-muted-foreground/20" />
                <p className="text-[11px] text-muted-foreground font-medium uppercase max-w-[180px]">
                  Generate a roster then click "Explain" for AI insights.
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-primary">Outcome</h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-medium bg-muted/20 p-3 rounded-lg border">
                    {explanation.solverInterpretation}
                  </p>
                </div>
                {explanation.conflictExplanations.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-destructive">Identified Conflicts</h5>
                    {explanation.conflictExplanations.map((c: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border-l-4 border-l-destructive bg-destructive/5 space-y-1">
                        <p className="text-[10px] font-black uppercase text-destructive">{c.conflict}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight font-medium">{c.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
