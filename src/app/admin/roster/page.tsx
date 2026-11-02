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
import { BrainCircuit, Sparkles, AlertTriangle, History, ShieldCheck, Loader2, Play, ArrowRight, Target, Info, Activity, ChevronRight } from "lucide-react";
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
      
      if (avail !== req) return { ok: false, message: `${day} Imbalance: ${avail} avail vs ${req} required.` };
    }
    return { ok: true, message: 'Institutional Pre-feasibility Validated' };
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
        throw new Error("Mathematical solver failed to find a valid solution. Constraints exceed clinical capacity.");
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
      toast({ title: "Optimized Draft Prepared", description: "Roster cycle saved for administrative review." });
    } catch (e: any) {
      setStatus("conflict");
      toast({ variant: "destructive", title: "Solver Infeasible", description: e.message });
    }
  };

  const handleExplain = async () => {
    if (!solverResult) return;
    const result = await explainSchedulingConflicts({
      problemDescription: `Clinical Roster Optimization Cycle for Week ${weekId}`,
      hardConstraints: ["Atomic Daily Quotas", "Protected Weekly-Offs (FCFS)", "Clinical Leave & Training", "Adjacency Fairness Rules"],
      softConstraints: ["Gender Target Bands", "Professional Shift Preferences", "Historical Super-Opening Fairness"],
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
               Mathematical Optimization Hub • CP-SAT Execution <BrainCircuit className="size-3 text-secondary" />
            </p>
            <Badge variant="destructive" className="text-[8px] font-black uppercase px-2 py-0">MOCK ENGINE</Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border-2 shadow-sm">
           <div className="space-y-1">
             <Label className="text-[9px] font-black uppercase text-muted-foreground px-2">Cycle Target</Label>
             <Input className="h-10 w-36 font-black text-secondary border-none bg-secondary/5 focus-visible:ring-0 text-lg rounded-xl" value={weekId} onChange={e => setWeekId(e.target.value)} />
           </div>
           <Button 
             className="bg-primary text-white shadow-2xl shadow-primary/20 mt-auto h-12 px-10 font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleRunSolver} 
             disabled={status === 'running' || !feasibilityStatus.ok}
           >
            {status === 'running' ? <Loader2 className="size-5 animate-spin mr-3" /> : <Play className="size-5 mr-3 group-hover:rotate-12 transition-transform" />}
            {status === 'running' ? 'Optimizing...' : 'Run Engine'}
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className={`shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 ${feasibilityStatus.ok ? 'border-t-primary' : 'border-t-destructive'}`}>
            <CardHeader className="bg-muted/10 border-b p-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={`size-16 rounded-[1.5rem] flex items-center justify-center shadow-inner ${feasibilityStatus.ok ? 'bg-primary text-white' : 'bg-destructive/10 text-destructive'}`}>
                    <Activity className="size-8" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl uppercase font-black tracking-tight">Feasibility Matrix</CardTitle>
                    <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-60">
                       {feasibilityStatus.message}
                    </CardDescription>
                  </div>
                </div>
                {status === 'success' && (
                  <Badge className="bg-emerald-500 px-6 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                    Solution Secured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              {!feasibilityStatus.ok ? (
                <div className="p-10 rounded-[2.5rem] bg-destructive/5 border-2 border-dashed border-destructive/20 text-center space-y-6">
                   <AlertTriangle className="size-16 text-destructive/40 mx-auto" />
                   <p className="text-lg font-black text-destructive uppercase tracking-widest leading-relaxed">
                     Clinical Load Imbalance Detected.<br/>Quotas must strictly align with eligible pool.
                   </p>
                   <Link href="/admin/quotas">
                      <Button variant="outline" className="font-black text-[11px] uppercase tracking-[0.2em] border-2 border-destructive/20 h-12 px-8 rounded-xl hover:bg-destructive hover:text-white transition-all">Correct Quota Matrix</Button>
                   </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-6">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.3em]">AI Simulation Coverage</span>
                      <span className="text-4xl font-black text-primary italic tracking-tighter">{progress}%</span>
                    </div>
                    <div className="h-4 bg-muted/30 rounded-full overflow-hidden shadow-inner border">
                       <Progress value={progress} className="h-full bg-primary rounded-full transition-all duration-1000" />
                    </div>
                  </div>

                  {solverResult && (
                    <div className={`p-8 rounded-[2rem] border-2 animate-in zoom-in-95 ${solverResult.status === 'INFEASIBLE' ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20 shadow-xl'}`}>
                      <div className="flex gap-6 items-start">
                        <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 ${solverResult.status === 'INFEASIBLE' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
                           {solverResult.status === 'INFEASIBLE' ? <AlertTriangle className="size-8" /> : <Sparkles className="size-8" />}
                        </div>
                        <div className="space-y-2">
                           <div className="flex items-center gap-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.25em] opacity-40">AI Simulation Result</p>
                              <Badge variant="outline" className="text-[9px] font-black">{solverResult.status}</Badge>
                           </div>
                           <p className="text-lg font-bold text-foreground leading-relaxed tracking-tight">{solverResult.summary}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="border-t bg-muted/5 p-6">
              <Button variant="ghost" className="w-full text-[11px] font-black uppercase tracking-[0.3em] h-14 hover:bg-white transition-all rounded-xl" onClick={handleExplain} disabled={!solverResult}>
                <BrainCircuit className="mr-4 h-6 w-6 text-secondary" /> 
                Interpret AI Logic
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card">
            <CardHeader className="bg-muted/10 border-b p-8">
               <div className="flex items-center gap-4">
                 <History className="size-6 text-muted-foreground opacity-40" />
                 <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Roster History Trace</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-muted/30">
                {recentDrafts?.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-8 hover:bg-muted/5 transition-colors group">
                    <div className="flex items-center gap-8">
                       <div className={`size-4 rounded-full ${draft.status === 'published' ? 'bg-emerald-500 shadow-[0_0_15px_emerald]' : 'bg-secondary shadow-[0_0_12px_blue]'}`} />
                       <div>
                          <p className="text-lg font-black uppercase tracking-tighter text-primary">Week {draft.weekId}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">{new Date(draft.createdAt).toLocaleString()}</p>
                       </div>
                    </div>
                    <Link href={`/admin/roster/review/${draft.id}`}>
                       <Button variant="outline" className="h-12 px-8 text-[11px] font-black uppercase tracking-[0.2em] border-2 rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all group">
                          Review Cluster <ChevronRight className="ml-3 size-4 group-hover:translate-x-1 transition-transform" />
                       </Button>
                    </Link>
                  </div>
                ))}
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-2xl border-none bg-primary text-primary-foreground rounded-[3rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2000ms] opacity-5">
               <Target size={320} />
            </div>
            <CardHeader className="relative z-10 p-10 pb-6 border-b border-white/5">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] flex items-center gap-4 text-secondary">
                <Sparkles className="size-6" /> Engine Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-10 pt-8 space-y-10">
              {!explanation ? (
                <div className="py-24 text-center space-y-8">
                   <div className="size-20 rounded-[2rem] bg-white/5 flex items-center justify-center mx-auto shadow-inner border border-white/10">
                      <BrainCircuit className="size-10 opacity-20" />
                   </div>
                   <p className="text-[11px] font-black uppercase text-white/30 tracking-[0.2em] leading-relaxed px-6">
                     Awaiting solver cycle to generate logical interpretation.
                   </p>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
                  <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60">AI Rationale</p>
                    <p className="text-[14px] font-medium leading-relaxed italic opacity-90">"{explanation.solverInterpretation}"</p>
                  </div>
                  
                  {explanation.conflictExplanations.length > 0 && (
                    <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive px-1">Constraint Conflicts</p>
                      <div className="space-y-6">
                        {explanation.conflictExplanations.map((c: any, i: number) => (
                          <div key={i} className="p-6 rounded-[1.75rem] bg-destructive/10 border-l-4 border-l-destructive space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-tight text-white">{c.conflict}</p>
                            <p className="text-[12px] font-semibold leading-relaxed opacity-70">{c.explanation}</p>
                            <div className="pt-3 border-t border-white/5 flex items-center gap-3">
                               <div className="size-2 rounded-full bg-secondary" />
                               <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Rec: {c.suggestedAction}</p>
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
                <ShieldCheck className="size-5 text-secondary" /> Engine Governance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-2 space-y-8">
              <div className="flex gap-6 items-start">
                 <div className="size-2 rounded-full bg-secondary mt-2 shrink-0 shadow-[0_0_12px_blue]" />
                 <p className="text-[12px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-70">
                    Hard constraints (Quotas, Leaves, Adjacency) are mathematically modeled by the AI.
                 </p>
              </div>
              <div className="flex gap-6 items-start">
                 <div className="size-2 rounded-full bg-accent mt-2 shrink-0 shadow-[0_0_12px_teal]" />
                 <p className="text-[12px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight opacity-70">
                    Soft objectives (Gender, Preferences) are weighted for optimal pod-balance.
                 </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
