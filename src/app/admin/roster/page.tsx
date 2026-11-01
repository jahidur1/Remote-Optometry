
'use client';

import { useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { generateWeeklyRoster, type GenerateWeeklyRosterInput } from "@/ai/flows/generate-weekly-roster";
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow";
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logAudit } from '@/lib/audit';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import Link from 'next/link';

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
    if (!profile) return;
    
    setStatus("running");
    setProgress(5);
    setExplanation(null);
    setSolverResult(null);

    try {
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
          ...bookingsSnap.docs.map(d => ({ 
            employeeId: d.data().employeeId, 
            type: 'weeklyOff' as const, 
            dayOfWeek: d.data().dayOfWeek as any 
          })),
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

      setProgress(70);
      const result = await generateWeeklyRoster(input);
      setSolverResult(result);

      if (result.status === 'INFEASIBLE') {
        throw new Error("Mathematical solver determined this configuration is INFEASIBLE. Hard constraints (Quotas) exceed clinical availability.");
      }

      setProgress(90);
      const draftId = `draft_${weekId}_${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        id: draftId,
        weekId,
        assignments: result.rosterAssignments,
        status: 'draft',
        solverStatus: result.status,
        summary: result.summary,
        solverMetadata: result.solverMetadata,
        createdAt: new Date().toISOString(),
        actorId: profile.uid
      });

      logAudit(db, profile.uid, 'RUN_ROSTER_SOLVER', draftId, { weekId, status: result.status });
      
      setProgress(100);
      setStatus("success");
      toast({ title: "Draft Generated", description: `Optimized solution for Week ${weekId} saved to review workspace.` });

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
      hardConstraints: ["Exact Staffing Quotas", "Protected Weekly-Offs", "Approved Absences"],
      softConstraints: ["Employee Preferences", "Gender Balance Targets"],
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
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-md border-t-4 border-t-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg uppercase font-black">Optimization Status</CardTitle>
                </div>
                {status === 'success' && <Badge className="bg-emerald-500 font-bold uppercase text-[10px] px-3">Solution Found</Badge>}
                {status === 'conflict' && <Badge variant="destructive" className="font-bold uppercase text-[10px] px-3 tracking-widest">Infeasible</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="rounded-2xl border bg-muted/20 p-8 space-y-6 relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Search Progress</span>
                  <span className="text-2xl font-black text-primary italic">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3 bg-background shadow-inner" />
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

          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg uppercase font-black">Generation History</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDrafts?.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`size-2 rounded-full ${draft.status === 'published' ? 'bg-emerald-500' : 'bg-secondary'}`} />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest">Week {draft.weekId}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">{new Date(draft.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <Link href={`/admin/roster/review/${draft.id}`}>
                      <Button variant="outline" size="sm" className="text-[10px] font-black uppercase tracking-widest px-4">
                        Review & Publish <ArrowRight className="ml-2 size-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-1 shadow-md border-t-4 border-t-secondary bg-muted/5">
          <CardHeader>
            <CardTitle className="text-lg uppercase font-black">AI Insights</CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-secondary">Solver Analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {!explanation ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-6 pt-12">
                <History className="size-16 text-muted-foreground/10" />
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  Run a solver execution to unlock AI interpretation.
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
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-destructive">Conflicts Detected</h5>
                    <div className="space-y-3">
                      {explanation.conflictExplanations.map((c: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl border-l-4 border-l-destructive bg-destructive/5 space-y-2">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
