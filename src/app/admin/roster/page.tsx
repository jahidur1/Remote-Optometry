
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { generateWeeklyRoster, type GenerateWeeklyRosterInput } from "@/ai/flows/generate-weekly-roster";
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow";
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, ArrowRight, Target, Info } from "lucide-react";
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

  // Feasibility Check
  const { data: quotaDoc } = useCollection(query(collection(db, 'roster_quotas'), where('weekId', '==', weekId)));
  const { data: employees } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: bookings } = useCollection(query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)));
  const { data: leaves } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));

  const feasibilityStatus = useMemo(() => {
    if (!employees || !quotaDoc?.[0]) return { ok: false, message: 'Awaiting Quota Configuration' };
    const quotas = quotaDoc[0].quotas || {};
    const weekDates = getDatesForWeek(weekId);
    if (weekDates.length === 0) return { ok: false, message: 'Invalid Week Format' };

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (const day of DAYS) {
      const dayIdx = DAYS.indexOf(day);
      const offCount = bookings?.filter(b => b.dayOfWeek === day).length || 0;
      const leaveCount = leaves?.filter(l => isDateInRange(weekDates[dayIdx], l.startDate, l.endDate)).length || 0;
      const avail = employees.length - offCount - leaveCount;
      
      let req = 0;
      Object.keys(quotas).forEach(k => { if (k.startsWith(day)) req += quotas[k]; });
      
      if (avail !== req) return { ok: false, message: `${day} Imbalance: ${avail} available vs ${req} required.` };
    }
    return { ok: true, message: 'Pre-feasibility Validated' };
  }, [employees, quotaDoc, bookings, leaves, weekId]);

  const handleRunSolver = async () => {
    if (!profile || !feasibilityStatus.ok) return;
    
    setStatus("running");
    setProgress(5);
    setExplanation(null);
    setSolverResult(null);

    try {
      const weekDates = getDatesForWeek(weekId);
      const [employeesSnap, shiftsSnap, quotasSnap, bookingsSnap, leavesSnap, prefsSnap, rulesSnap] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('status', '==', 'Active'))),
        getDocs(query(collection(db, 'shift_master'), orderBy('displayOrder'))),
        getDocs(doc(db, 'roster_quotas', weekId)),
        getDocs(query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId))),
        getDocs(query(collection(db, 'employee_leaves'), where('status', '==', 'approved'))),
        getDocs(query(collection(db, 'employee_preferences'), where('weekId', '==', weekId))),
        getDocs(query(collection(db, 'shift_adjacency_rules'), where('weekId', '==', weekId)))
      ]);

      const quotaData = quotasSnap.data()!;
      const adjacencyRules = rulesSnap.docs.map(d => d.data());
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
          ...bookingsSnap.docs.map(d => ({ employeeId: d.data().employeeId, type: 'weeklyOff' as const, dayOfWeek: d.data().dayOfWeek as any })),
          ...leavesSnap.docs.flatMap(d => {
            const leaf = d.data();
            return DAYS.filter((day, idx) => isDateInRange(weekDates[idx], leaf.startDate, leaf.endDate))
              .map(day => ({ employeeId: leaf.employeeId, type: 'unavailable' as const, dayOfWeek: day as any }));
          }),
          ...bookingsSnap.docs.flatMap(d => {
            const booking = d.data();
            const rule = adjacencyRules.find(r => r.employeeId === booking.employeeId);
            if (!rule) return [];
            const constraints: any[] = [];
            const offDayIdx = DAYS.indexOf(booking.dayOfWeek);
            if (offDayIdx > 0 && rule.allowedPreOffShifts?.length > 0) {
              constraints.push({ employeeId: booking.employeeId, type: 'restrictedShift' as const, dayOfWeek: DAYS[offDayIdx - 1], restrictedToShifts: rule.allowedPreOffShifts });
            }
            if (offDayIdx < 6 && rule.allowedPostOffShifts?.length > 0) {
              constraints.push({ employeeId: booking.employeeId, type: 'restrictedShift' as const, dayOfWeek: DAYS[offDayIdx + 1], restrictedToShifts: rule.allowedPostOffShifts });
            }
            return constraints;
          })
        ],
        employeeSoftPreferences: prefsSnap.docs.map(d => ({ employeeId: d.data().employeeId, dayOfWeek: d.data().dayOfWeek as any, shiftId: d.data().shiftId, type: 'preferShift' as const })),
        genderTargets: Object.entries(quotaData.genderTargets || {}).map(([shiftId, targets]: any) => ({ shiftId, maleTarget: targets.male, femaleTarget: targets.female }))
      };

      setProgress(70);
      const result = await generateWeeklyRoster(input);
      setSolverResult(result);

      if (result.status === 'INFEASIBLE') {
        throw new Error("Mathematical solver failed to find a valid solution. Constraints exceed pool availability.");
      }

      const draftId = `draft_${weekId}_${Date.now()}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        id: draftId, weekId, assignments: result.rosterAssignments,
        status: 'draft', solverStatus: result.status, summary: result.summary,
        solverMetadata: result.solverMetadata, createdAt: new Date().toISOString(), actorId: profile.uid
      });

      logAudit(db, profile.uid, 'RUN_ROSTER_SOLVER', draftId, { weekId, status: result.status });
      setProgress(100);
      setStatus("success");
      toast({ title: "Draft Generated", description: "Optimized roster saved for clinical review." });
    } catch (e: any) {
      setStatus("conflict");
      toast({ variant: "destructive", title: "Solver Error", description: e.message });
    }
  };

  const handleExplain = async () => {
    if (!solverResult) return;
    const result = await explainSchedulingConflicts({
      problemDescription: `Roster optimization for Week ${weekId}`,
      hardConstraints: ["Exact Quotas", "Protected Weekly-Offs", "Adjacency Fairness"],
      softConstraints: ["Gender Balance Targets", "Employee Preferences"],
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase leading-none">CP-SAT Solver Hub</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium mt-1">Institutional workforce optimization powered by mathematical constraints.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm">
           <div className="space-y-1">
             <Label className="text-[9px] font-black uppercase text-muted-foreground px-2">Cycle Target</Label>
             <Input className="h-10 w-32 font-black text-secondary border-none bg-secondary/5 focus-visible:ring-0" value={weekId} onChange={e => setWeekId(e.target.value)} />
           </div>
           <Button 
             className="bg-secondary shadow-xl shadow-secondary/10 mt-auto h-10 px-8 font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95" 
             onClick={handleRunSolver} 
             disabled={status === 'running' || !feasibilityStatus.ok}
           >
            {status === 'running' ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2" />}
            {status === 'running' ? 'Solving...' : 'Run Engine'}
           </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className={`shadow-md border-t-4 ${feasibilityStatus.ok ? 'border-t-primary' : 'border-t-destructive'}`}>
            <CardHeader className="py-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BrainCircuit className={`size-6 ${feasibilityStatus.ok ? 'text-primary' : 'text-destructive'}`} />
                  <div>
                    <CardTitle className="text-lg uppercase font-black">Optimization Matrix</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                       {feasibilityStatus.message}
                    </CardDescription>
                  </div>
                </div>
                {status === 'success' && <Badge className="bg-emerald-500 px-4 py-1.5 rounded-full font-black text-[10px] uppercase">Solution Found</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {!feasibilityStatus.ok ? (
                <div className="p-8 rounded-3xl bg-destructive/5 border-2 border-dashed border-destructive/20 text-center space-y-4">
                   <AlertTriangle className="size-12 text-destructive/40 mx-auto" />
                   <p className="text-sm font-black text-destructive uppercase tracking-widest leading-relaxed">
                     Staffing shortfalls or surpluses detected.<br/>Please align Shift Quotas with Clinical Availability.
                   </p>
                   <Link href="/admin/quotas">
                      <Button variant="outline" size="sm" className="font-black text-[10px] uppercase tracking-widest border-destructive/20 hover:bg-destructive hover:text-white transition-all">Fix Quota Imbalance</Button>
                   </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Search Space Coverage</span>
                      <span className="text-2xl font-black text-primary italic">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3 rounded-full bg-muted shadow-inner" />
                  </div>

                  {solverResult && (
                    <div className={`p-6 rounded-2xl border-2 ${solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'} animate-in zoom-in-95`}>
                      <div className="flex gap-5">
                        <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
                           {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-7" /> : <Sparkles className="size-7" />}
                        </div>
                        <div className="space-y-1">
                           <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Status: {solverResult.status}</p>
                           <p className="text-sm font-bold text-foreground leading-relaxed">{solverResult.summary}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="border-t bg-muted/5 p-4">
              <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-[0.25em] h-12 hover:bg-white transition-all" onClick={handleExplain} disabled={!solverResult}>
                <BrainCircuit className="mr-3 h-5 w-5 text-secondary" /> 
                Interpret Mathematical Logic
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-5">
               <div className="flex items-center gap-3">
                 <History className="size-5 text-muted-foreground" />
                 <CardTitle className="text-sm font-black uppercase tracking-widest">Recent Solution Clusters</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-muted/30">
                {recentDrafts?.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-6 hover:bg-muted/5 transition-colors group">
                    <div className="flex items-center gap-6">
                       <div className={`size-3 rounded-full ${draft.status === 'published' ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-secondary shadow-[0_0_8px_blue]'}`} />
                       <div>
                          <p className="text-sm font-black uppercase tracking-widest text-primary">Week {draft.weekId}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{new Date(draft.createdAt).toLocaleString()}</p>
                       </div>
                    </div>
                    <Link href={`/admin/roster/review/${draft.id}`}>
                       <Button variant="outline" size="sm" className="h-10 px-6 text-[10px] font-black uppercase tracking-widest border-2 hover:bg-primary hover:text-white hover:border-primary transition-all rounded-xl">
                          Validate Solution <ArrowRight className="ml-2 size-4" />
                       </Button>
                    </Link>
                  </div>
                ))}
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-2xl border-none bg-primary text-primary-foreground rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 transform group-hover:scale-125 transition-transform duration-1000">
               <Target className="size-48 text-white opacity-5" />
            </div>
            <CardHeader className="relative z-10 p-8 pb-4">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-3 text-secondary">
                <Sparkles className="size-5" /> AI Engine Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-8 pt-0 space-y-8">
              {!explanation ? (
                <div className="py-24 text-center space-y-6">
                   <div className="size-16 rounded-full bg-white/5 flex items-center justify-center mx-auto shadow-inner">
                      <BrainCircuit className="size-8 opacity-10" />
                   </div>
                   <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] leading-relaxed">
                     Execute a solver pulse to unlock<br/>logical interpretation.
                   </p>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3 shadow-xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Logical Rationale</p>
                    <p className="text-[12px] font-medium leading-relaxed italic opacity-80">"{explanation.solverInterpretation}"</p>
                  </div>
                  
                  {explanation.conflictExplanations.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-destructive px-1">Optimization Hard-Conflicts</p>
                      <div className="space-y-4">
                        {explanation.conflictExplanations.map((c: any, i: number) => (
                          <div key={i} className="p-5 rounded-2xl bg-destructive/10 border-l-4 border-l-destructive space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-tight text-destructive-foreground">{c.conflict}</p>
                            <p className="text-[11px] font-semibold leading-snug opacity-80">{c.explanation}</p>
                            <div className="pt-2 border-t border-white/5">
                               <p className="text-[10px] font-black uppercase text-secondary">Action: {c.suggestedAction}</p>
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

          <Card className="bg-white shadow-md border-2 border-muted rounded-3xl overflow-hidden">
            <CardHeader className="p-8 pb-4">
               <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-3 text-muted-foreground">
                <Info className="size-5 text-secondary" /> solver governance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="flex gap-5 items-start">
                 <div className="size-2 rounded-full bg-secondary mt-1.5 shrink-0 shadow-[0_0_8px_blue]" />
                 <p className="text-[11px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-80">Assignments are mathematically guaranteed to meet quotas.</p>
              </div>
              <div className="flex gap-5 items-start">
                 <div className="size-2 rounded-full bg-accent mt-1.5 shrink-0 shadow-[0_0_8px_teal]" />
                 <p className="text-[11px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-80">Diversity targets are soft objectives and may be bypassed for feasibility.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
