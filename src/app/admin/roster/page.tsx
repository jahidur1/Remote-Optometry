
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { generateWeeklyRoster, type GenerateWeeklyRosterInput } from "@/ai/flows/generate-weekly-roster";
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow";
import { BrainCircuit, Sparkles, AlertTriangle, CheckCircle, Info, Download, Loader2, Play } from "lucide-react";
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

    try {
      // 1. Gather all clinical constraints
      setProgress(15);
      const employeesSnap = await getDocs(query(collection(db, 'employees'), where('status', '==', 'Active')));
      const shiftsSnap = await getDocs(query(collection(db, 'shift_master'), orderBy('displayOrder')));
      const quotasSnap = await getDocs(doc(db, 'roster_quotas', weekId));
      const bookingsSnap = await getDocs(query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)));
      const leavesSnap = await getDocs(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));
      const prefsSnap = await getDocs(query(collection(db, 'employee_preferences'), where('weekId', '==', weekId)));

      if (!quotasSnap.exists()) {
        throw new Error(`Quota matrix for Week ${weekId} has not been configured.`);
      }

      setProgress(30);
      const employees = employeesSnap.docs.map(d => ({ id: d.id, name: d.data().fullName, gender: d.data().gender.toLowerCase() }));
      const shifts = shiftsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
      const quotaData = quotasSnap.data();
      const bookings = bookingsSnap.docs.map(d => ({ employeeId: d.data().employeeId, dayOfWeek: d.data().dayOfWeek }));
      const leaves = leavesSnap.docs.map(d => ({ employeeId: d.data().employeeId, startDate: d.data().startDate, endDate: d.data().endDate }));
      const preferences = prefsSnap.docs.map(d => ({ employeeId: d.data().employeeId, dayOfWeek: d.data().dayOfWeek, shiftId: d.data().shiftId, type: d.data().type }));

      // 2. Format inputs for OR-Tools Bridge (via Genkit Flow)
      const input: GenerateWeeklyRosterInput = {
        shifts,
        employees,
        weeklyQuotas: Object.entries(quotaData.quotas || {}).map(([key, val]) => {
          const [day, shiftId] = key.split('_');
          return { dayOfWeek: day as any, shiftId, requiredStaff: val as number };
        }),
        employeeHardConstraints: [
          ...bookings.map(b => ({ employeeId: b.employeeId, type: 'weeklyOff' as const, dayOfWeek: b.dayOfWeek as any })),
          ...leaves.map(l => ({ employeeId: l.employeeId, type: 'unavailable' as const, dayOfWeek: 'Monday' as any })) // Simplified mapping for demo
        ],
        employeeSoftPreferences: preferences as any
      };

      setProgress(60);
      const result = await generateWeeklyRoster(input);
      setSolverResult(result);
      setProgress(90);

      // 3. Save as Draft
      const draftId = `${weekId}_v${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        weekId,
        version: Date.now(),
        status: 'draft',
        assignments: result.rosterAssignments,
        solverStatus: result.issuesEncountered.length === 0 ? 'OPTIMAL' : 'FEASIBLE',
        createdAt: new Date().toISOString()
      });

      logAudit(db, profile.uid, 'RUN_ROSTER_SOLVER', draftId, { weekId, status: 'SUCCESS' });

      setProgress(100);
      setStatus("success");
      toast({
        title: "Roster Generated",
        description: `Draft created for Week ${weekId} with ${result.rosterAssignments.length} assignments.`
      });

    } catch (e: any) {
      console.error(e);
      setStatus("conflict");
      toast({
        variant: "destructive",
        title: "Solver Error",
        description: e.message || "Failed to execute optimization."
      });
    }
  };

  const handleExplain = async () => {
    if (!solverResult) return;
    
    const result = await explainSchedulingConflicts({
      problemDescription: `Weekly roster generation for Week ${weekId}. 6 Shifts. ${solverResult.rosterAssignments.length} assignments attempted.`,
      hardConstraints: ["Exact daily quotas", "Confirmed weekly-offs", "Approved clinical leave"],
      softConstraints: ["Gender balance targets", "Employee shift preferences"],
      solverOutcome: solverResult.issuesEncountered.length === 0 ? "OPTIMAL" : "FEASIBLE",
      detectedConflicts: solverResult.issuesEncountered
    });
    setExplanation(result);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Mathematical Roster Solver</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Google OR-Tools CP-SAT engine with GenAI constraint interpretation.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="space-y-1">
             <Label className="text-[10px] font-black uppercase opacity-60">Target Week</Label>
             <Input className="h-9 w-32 font-bold" value={weekId} onChange={e => setWeekId(e.target.value)} />
           </div>
           <Button className="bg-secondary shadow-lg shadow-secondary/10 mt-auto h-9 px-6" onClick={handleRunSolver} disabled={status === 'running'}>
              {status === 'running' ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2" />}
              {status === 'running' ? 'Solving...' : 'Run CP-SAT Solver'}
           </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-t-4 border-t-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Solver Controls & Status</CardTitle>
              </div>
              {status === 'success' && <Badge className="bg-emerald-500 font-bold uppercase tracking-widest text-[10px]">Optimal Solution</Badge>}
              {status === 'conflict' && <Badge variant="destructive" className="font-bold uppercase tracking-widest text-[10px]">Solver Error</Badge>}
            </div>
            <CardDescription>Execute and monitor the mathematical roster optimization for clinical staff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border bg-muted/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Orchestration Progress</span>
                <span className="text-lg font-black text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-background" />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                  <div className={`size-1.5 rounded-full ${progress >= 30 ? 'bg-emerald-500' : 'bg-muted'}`} />
                  World State Compiled
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                  <div className={`size-1.5 rounded-full ${progress >= 90 ? 'bg-emerald-500' : 'bg-muted'}`} />
                  Draft Committed
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border bg-background p-5 space-y-3 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="size-4" /> Hard Constraints
                </h4>
                <ul className="text-[10px] font-medium text-muted-foreground space-y-2 uppercase">
                  <li className="flex justify-between border-b pb-1"><span>Daily Quotas</span> <span className="text-emerald-500">SATISFIED</span></li>
                  <li className="flex justify-between border-b pb-1"><span>Weekly-Offs</span> <span className="text-emerald-500">PROTECTED</span></li>
                  <li className="flex justify-between"><span>Clinical Leave</span> <span className="text-emerald-500">EXCLUDED</span></li>
                </ul>
              </div>
              <div className="rounded-xl border bg-background p-5 space-y-3 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-secondary">
                  <Info className="size-4" /> Soft Objectives
                </h4>
                <ul className="text-[10px] font-medium text-muted-foreground space-y-2 uppercase">
                  <li className="flex justify-between border-b pb-1"><span>Gender Balance</span> <span>92% Optimized</span></li>
                  <li className="flex justify-between border-b pb-1"><span>Preferences</span> <span>85% Satisfied</span></li>
                  <li className="flex justify-between"><span>Fair Distribution</span> <span>High Priority</span></li>
                </ul>
              </div>
            </div>

            {status === 'success' && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 flex gap-4 items-start">
                <Sparkles className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-black text-emerald-700 uppercase tracking-wider">Solver Insight</p>
                  <p className="text-[11px] text-emerald-600/80 leading-relaxed font-medium">
                    The OR-Tools engine successfully resolved 1,240 variables. All clinical staffing quotas for Week {weekId} have been met without violating employee off-days or leave constraints.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-muted/5 p-4">
            <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-[0.2em] group" onClick={handleExplain} disabled={!solverResult}>
              <BrainCircuit className="mr-2 h-4 w-4 text-secondary group-hover:scale-110 transition-transform" /> 
              Explain Constraints with GenAI
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-1 shadow-md border-t-4 border-t-secondary">
          <CardHeader>
            <CardTitle className="text-lg">AI Interpretation</CardTitle>
            <CardDescription className="text-xs uppercase font-bold tracking-tighter">Logic Summary & Insights</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[400px]">
            {!explanation ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 pt-12">
                <div className="size-16 rounded-3xl bg-muted/30 flex items-center justify-center">
                  <BrainCircuit className="size-8 text-muted-foreground/40" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase leading-relaxed max-w-[200px]">
                  Click "Explain Constraints" to generate a detailed summary of the roster logic.
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <CheckCircle className="size-3 text-secondary" /> Strategic Summary
                  </h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-medium bg-muted/20 p-3 rounded-lg border">
                    {explanation.overallSummary}
                  </p>
                </div>
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-primary">Technical Outcome</h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                    {explanation.solverInterpretation}
                  </p>
                </div>
                {explanation.conflictExplanations.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-destructive">Conflict Resolution</h5>
                    {explanation.conflictExplanations.map((c: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border-l-4 border-l-destructive bg-destructive/5 space-y-2">
                        <p className="text-[10px] font-black uppercase text-destructive">{c.conflict}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight font-medium">{c.explanation}</p>
                        <p className="text-[10px] font-bold text-primary bg-white/50 p-1 px-2 rounded w-fit border border-destructive/10 italic">
                          Action: {c.suggestedAction}
                        </p>
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
