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
import { BrainCircuit, Sparkles, AlertTriangle, CheckCircle, Info, Loader2, Play, History, ShieldCheck, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logAudit } from '@/lib/audit';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { format } from 'date-fns';

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
      // 1. COMPILE WORLD STATE (Hard Constraints)
      setProgress(15);
      const weekDates = getDatesForWeek(weekId);
      if (weekDates.length === 0) throw new Error("Invalid Week ID format.");

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

      const quotaData = quotasSnap.data();
      const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

      setProgress(40);
      
      // Map Firestore data to Solver Input
      const input: GenerateWeeklyRosterInput = {
        weekId,
        shifts: shiftsSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        employees: employeesSnap.docs.map(d => ({ 
          id: d.id, 
          name: d.data().fullName, 
          gender: (d.data().gender || 'Other').toLowerCase() as any 
        })),
        weeklyQuotas: Object.entries(quotaData.quotas || {}).map(([key, val]) => {
          const [day, shiftId] = key.split('_');
          return { dayOfWeek: day as any, shiftId, requiredStaff: val as number };
        }),
        employeeHardConstraints: [
          // Weekly Offs
          ...bookingsSnap.docs.map(d => ({ 
            employeeId: d.data().employeeId, 
            type: 'weeklyOff' as const, 
            dayOfWeek: d.data().dayOfWeek as any 
          })),
          // Approved Leaves
          ...leavesSnap.docs.flatMap(d => {
            const leaf = d.data();
            return DAYS.filter((day, idx) => isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
              .map(day => ({
                employeeId: leaf.employeeId,
                type: 'unavailable' as const,
                dayOfWeek: day as any
              }));
          })
        ],
        employeeSoftPreferences: prefsSnap.docs.map(d => ({ 
          employeeId: d.data().employeeId, 
          dayOfWeek: d.data().dayOfWeek as any, 
          shiftId: d.data().shiftId, 
          type: 'preferShift' as const 
        })),
        genderTargets: Object.entries(quotaData.genderTargets || {}).map(([shiftId, targets]: any) => ({
          shiftId,
          maleTarget: targets.male,
          femaleTarget: targets.female
        }))
      };

      // 2. EXECUTE MATHEMATICAL SOLVER
      setProgress(70);
      const result = await generateWeeklyRoster(input);
      setSolverResult(result);

      if (result.status === 'INFEASIBLE') {
        throw new Error("Mathematical solver determined this configuration is INFEASIBLE. Hard constraints (Quotas) exceed clinical availability.");
      }

      // 3. COMMIT DRAFT (Review Workflow)
      setProgress(90);
      const draftId = `draft_${weekId}_${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        weekId,
        assignments: result.rosterAssignments,
        status: 'draft',
        solverStatus: result.status,
        summary: result.summary,
        solverMetadata: result.solverMetadata,
        createdAt: new Date().toISOString(),
        actorId: profile.uid
      });

      logAudit(db, profile.uid, 'RUN_ROSTER_SOLVER', draftId, { weekId, status: result.status, solveTime: result.solverMetadata?.solveTimeMs });
      
      setProgress(100);
      setStatus("success");
      toast({ title: "Roster Draft Generated", description: `Optimized solution for Week ${weekId} saved and awaiting review.` });

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
      hardConstraints: [
        "Exact Daily Staffing Quotas (7x6 Matrix)", 
        "Protected FCFS Weekly-Offs", 
        "Approved Clinical Leaves & Unavailability"
      ],
      softConstraints: [
        "Employee Shift Preferences", 
        "Gender Balance Target Bands (e.g., Men 1-2, Women 2-3)",
        "Fairness Distribution (Open/Close Balance)"
      ],
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">CP-SAT Solver Engine</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Mathematical workforce allocation powered by Google OR-Tools.</p>
        </div>
        <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-xl border border-dashed">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase opacity-60 px-1">Roster Cycle</Label>
            <Input className="h-9 w-32 font-bold bg-background" value={weekId} onChange={e => setWeekId(e.target.value)} />
          </div>
          <Button className="bg-secondary shadow-lg shadow-secondary/10 mt-auto h-9 px-6 font-black uppercase tracking-widest" onClick={handleRunSolver} disabled={status === 'running'}>
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
                <CardTitle className="text-lg uppercase font-black">Optimization Status</CardTitle>
              </div>
              {status === 'success' && <Badge className="bg-emerald-500 font-bold uppercase text-[10px] px-3">Optimal Solution Found</Badge>}
              {status === 'conflict' && <Badge variant="destructive" className="font-bold uppercase text-[10px] px-3 tracking-widest">Infeasible Path</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="rounded-2xl border bg-muted/20 p-8 space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Mathematical Search Progress</span>
                <span className="text-2xl font-black text-primary italic">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3 bg-background shadow-inner" />
              <div className="absolute bottom-0 right-0 p-4 opacity-5">
                 <ShieldCheck className="size-32" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border p-5 bg-background shadow-sm space-y-3 hover:border-emerald-500/50 transition-colors">
                <h4 className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-2 tracking-widest">
                  <CheckCircle className="size-3" /> Hard Rule Injection
                </h4>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  Quotas, Weekly-Offs, and Leaves are treated as mandatory solver inputs. The engine will NEVER violate these to satisfy preferences.
                </p>
              </div>
              <div className="rounded-xl border p-5 bg-background shadow-sm space-y-3 hover:border-secondary/50 transition-colors">
                <h4 className="text-[10px] font-black uppercase text-secondary flex items-center gap-2 tracking-widest">
                  <Target className="size-3" /> Soft Objective Weights
                </h4>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  Gender balance targets and shift preferences are optimized using weight penalties (Default: 0.7 for Gender, 0.5 for Prefs).
                </p>
              </div>
            </div>

            {solverResult && (
              <div className={`p-6 rounded-2xl border-2 ${solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'} animate-in zoom-in-95`}>
                <div className="flex gap-4">
                  <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10' : 'bg-emerald-500/10'}`}>
                    {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-6 text-destructive" /> : <Sparkles className="size-6 text-emerald-500" />}
                  </div>
                  <div className="space-y-1">
                    <p className={`text-xs font-black uppercase tracking-widest ${solverResult.status === 'INFEASIBLE' ? 'text-destructive' : 'text-emerald-700'}`}>
                      Solver {solverResult.status}
                    </p>
                    <p className="text-[12px] text-foreground/80 leading-relaxed font-medium">
                      {solverResult.summary}
                    </p>
                    {solverResult.solverMetadata && (
                      <div className="pt-2 flex gap-4 text-[9px] font-bold text-muted-foreground uppercase">
                        <span>Solve Time: {solverResult.solverMetadata.solveTimeMs}ms</span>
                        <span>Variables: {solverResult.solverMetadata.constraintsChecked}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-muted/5 p-4">
            <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-[0.2em] py-6 hover:bg-white transition-all" onClick={handleExplain} disabled={!solverResult}>
              <BrainCircuit className="mr-2 h-4 w-4 text-secondary" /> 
              Interpret Logic with GenAI
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-1 shadow-md border-t-4 border-t-secondary bg-muted/5">
          <CardHeader>
            <CardTitle className="text-lg uppercase font-black">AI Interpretation</CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-secondary">Constraint Summary</CardDescription>
          </CardHeader>
          <CardContent>
            {!explanation ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-6 pt-12">
                <div className="relative">
                  <History className="size-16 text-muted-foreground/10" />
                  <Loader2 className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 text-secondary/30 ${status === 'running' ? 'animate-spin opacity-100' : 'opacity-0'}`} />
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest max-w-[200px]">
                  {status === 'running' ? 'Monitoring Solver Threads...' : 'Run a roster generation to unlock AI insights.'}
                </p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-3">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Sparkles className="size-3" /> Solver Rationale
                  </h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-semibold bg-white p-4 rounded-xl border shadow-sm">
                    {explanation.solverInterpretation}
                  </p>
                </div>
                
                {explanation.conflictExplanations.length > 0 && (
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-destructive">Bottlenecks Detected</h5>
                    <div className="space-y-3">
                      {explanation.conflictExplanations.map((c: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl border-l-4 border-l-destructive bg-destructive/5 space-y-2 group hover:bg-destructive/10 transition-colors">
                          <p className="text-[10px] font-black uppercase text-destructive tracking-tighter">{c.conflict}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug font-medium italic">"{c.explanation}"</p>
                          <div className="pt-2 border-t border-destructive/10">
                            <p className="text-[9px] font-black uppercase text-foreground">Action: {c.suggestedAction}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="p-4 rounded-xl bg-primary/5 border border-dashed border-primary/20">
                  <p className="text-[9px] text-muted-foreground leading-tight italic">
                    "This summary is generated by Gemini 2.5 Flash using mathematical solver logs. It provides an interpretation of the CP-SAT search space but does not modify the hard assignments."
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
