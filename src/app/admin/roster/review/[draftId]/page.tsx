'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, setDoc, collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Save, ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Lock, Info, Send, Target, Activity, User, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from '@/lib/audit';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function RosterReviewWorkspace() {
  const params = useParams();
  const draftId = params.draftId as string;
  const db = useFirestore();
  const router = useRouter();
  const { profile } = useUser();
  const { toast } = useToast();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Super Admin Override State
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideData, setOverrideData] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Data Fetching
  const { data: draft, loading: draftLoading } = useDoc(doc(db, 'roster_drafts', draftId));
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: shifts } = useCollection(query(collection(db, 'shift_master'), orderBy('displayOrder')));
  
  const weekId = draft?.weekId;
  const { data: quotaDoc } = useDoc(weekId ? doc(db, 'roster_quotas', weekId) : null);
  const { data: bookings } = useCollection(weekId ? query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId)) : null);
  const { data: leaves } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));

  useEffect(() => {
    if (draft?.assignments) {
      setAssignments(draft.assignments);
    }
  }, [draft]);

  const weekDates = useMemo(() => weekId ? getDatesForWeek(weekId) : [], [weekId]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    // Only show employees matching the draft's office
    return employees.filter(e => 
      e.office === draft?.office && (
        e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [employees, searchTerm, draft?.office]);

  const getConstraintStatus = (employeeId: string, day: string, dateIndex: number) => {
    const isOff = bookings?.some(b => b.employeeId === employeeId && b.dayOfWeek === day);
    const date = weekDates[dateIndex];
    const leaf = leaves?.find(l => l.employeeId === employeeId && isDateInRange(date, l.startDate, l.endDate));
    
    if (isOff) return { type: 'WEEKLY_OFF', label: 'WEEK OFF', color: 'text-secondary' };
    if (leaf) return { type: 'LEAVE', label: leaf.type.toUpperCase(), color: 'text-accent' };
    return null;
  };

  const handleAssignmentChange = (employeeId: string, day: string, shiftId: string) => {
    const constraint = getConstraintStatus(employeeId, day, DAYS.indexOf(day));
    
    // FCFS Protection: Strictly prohibit non-Super Admins from overriding off-days
    if (constraint?.type === 'WEEKLY_OFF' && profile?.role !== 'SUPER_ADMIN') {
      toast({ title: "FCFS Lock Active", description: "Only Super Admins can override clinical weekly-offs.", variant: "destructive" });
      return;
    }

    // Super Admin Override Pulse
    if (constraint?.type === 'WEEKLY_OFF' && profile?.role === 'SUPER_ADMIN') {
      setOverrideData({ employeeId, day, shiftId });
      setOverrideDialogOpen(true);
      return;
    }

    applyAssignmentUpdate(employeeId, day, shiftId);
  };

  const applyAssignmentUpdate = (employeeId: string, day: string, shiftId: string) => {
    setAssignments(prev => {
      const filtered = prev.filter(a => !(a.employeeId === employeeId && a.dayOfWeek === day));
      if (shiftId === 'none') return filtered;
      return [...filtered, { employeeId, dayOfWeek: day, shiftId }];
    });
  };

  const handleProcessOverride = async () => {
    if (!overrideReason.trim()) return;
    
    applyAssignmentUpdate(overrideData.employeeId, overrideData.day, overrideData.shiftId);
    logAudit(db, profile?.uid || 'system', 'SUPER_ADMIN_OVERRIDE_OFF', overrideData.employeeId, { 
      day: overrideData.day, 
      newShift: overrideData.shiftId,
      reason: overrideReason 
    });
    
    setOverrideDialogOpen(false);
    setOverrideReason('');
    toast({ title: "Institutional Override Applied", description: "Manual assignment committed with audit trace." });
  };

  const quotaValidation = useMemo(() => {
    if (!quotaDoc || !shifts) return {};
    const targets = quotaDoc.quotas || {};
    const results: any = {};

    DAYS.forEach(day => {
      shifts.forEach(shift => {
        const key = `${day}_${shift.id}`;
        const target = targets[key] || 0;
        const actual = assignments.filter(a => a.dayOfWeek === day && a.shiftId === shift.id).length;
        results[key] = { target, actual, ok: target === actual };
      });
    });
    return results;
  }, [assignments, quotaDoc, shifts]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'roster_drafts', draftId), {
        assignments,
        updatedAt: new Date().toISOString()
      });
      logAudit(db, profile?.uid || 'system', 'UPDATE_ROSTER_DRAFT', draftId);
      toast({ title: "Draft Synchronized", description: "Manual adjustments secured in cluster storage." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!profile) return;
    
    // Strict Quota Enforcement Gateway
    const hasConflicts = Object.values(quotaValidation).some((v: any) => !v.ok);
    if (hasConflicts) {
      toast({ variant: "destructive", title: "Institutional Block", description: "Publication requires 100% compliance with daily clinical quotas." });
      return;
    }

    setPublishing(true);
    try {
      const versionId = `${weekId}_v${Date.now()}`;
      await setDoc(doc(db, 'published_rosters', versionId), {
        weekId,
        office: draft?.office,
        version: Date.now(),
        assignments,
        publishedAt: new Date().toISOString(),
        publisherId: profile.uid,
        status: 'active'
      });

      await updateDoc(doc(db, 'roster_drafts', draftId), { status: 'published' });
      
      logAudit(db, profile.uid, 'PUBLISH_ROSTER', versionId, { weekId, office: draft?.office });
      toast({ title: "Clinical Roster Live", description: "Schedule broadcast initiated via Meta Cloud API Node." });
      router.push('/admin/roster');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  if (draftLoading) return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
      <Loader2 className="size-16 animate-spin text-secondary opacity-30" />
      <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Initializing Roster Workspace</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-56 max-w-[1600px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-6">
        <div className="flex items-center gap-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl border-2 hover:bg-muted size-14 transition-all shadow-sm">
            <ArrowLeft className="size-7 text-primary" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-primary font-headline uppercase leading-none">Review Workspace</h1>
            <div className="flex items-center gap-5 mt-3">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-4 py-1">Cycle {weekId}</Badge>
              <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                 Status: <span className="text-primary">{draft?.status?.toUpperCase() || 'DRAFT'}</span> <Activity className="size-3 text-secondary animate-pulse" />
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative w-72">
              <User className="absolute left-4 top-3.5 size-4 text-muted-foreground/40" />
              <Input 
                placeholder="Search Professional..." 
                className="pl-12 h-12 font-bold bg-white border-2 rounded-xl focus:border-secondary transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" onClick={handleSave} disabled={saving} className="h-12 px-8 font-black uppercase tracking-[0.2em] border-2 border-primary/10 rounded-xl hover:bg-muted transition-all">
             <Save className="mr-3 h-5 w-5" /> {saving ? 'Syncing...' : 'Save Draft'}
           </Button>
           <Button className="bg-secondary text-white shadow-2xl shadow-secondary/20 h-12 px-10 font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 rounded-xl" onClick={handlePublish} disabled={publishing}>
             <Send className="mr-3 h-5 w-5" /> {publishing ? 'Deploying...' : 'Approve & Rollout'}
           </Button>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card mx-6">
        <CardHeader className="bg-primary p-10 text-primary-foreground border-none relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 transform translate-x-10 -translate-y-10 opacity-5 group-hover:scale-110 transition-transform duration-[2s]">
            <ShieldCheck size={280} />
          </div>
          <div className="flex flex-row items-center justify-between relative z-10">
            <div className="space-y-2">
              <CardTitle className="text-2xl flex items-center gap-5 font-black uppercase tracking-tight leading-none">
                <ShieldCheck className="size-10 text-secondary" /> Clinical Assignment Grid
              </CardTitle>
              <CardDescription className="text-[11px] font-black uppercase text-white/40 tracking-[0.2em] mt-2">
                Deterministic Model Output: Validated against {draft?.solverMetadata?.constraintsChecked || 0} constraints.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
                {draft?.solverMetadata && (
                   <div className="flex items-center gap-6 px-8 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">CP-SAT Status</span>
                        <span className="text-[11px] font-black text-secondary">{draft.solverStatus}</span>
                      </div>
                      <div className="flex flex-col border-l border-white/10 pl-6">
                        <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Execution</span>
                        <span className="text-[11px] font-black">{draft.solverMetadata.solveTimeMs.toFixed(0)}ms</span>
                      </div>
                   </div>
                )}
                <Badge className="bg-secondary text-white border-none font-black text-[9px] uppercase tracking-widest py-1.5 px-5 rounded-full shadow-2xl">Verified Schema</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/50 border-b">
              <TableRow>
                <TableHead className="w-[320px] border-r py-8 pl-10 bg-white/50 backdrop-blur-md sticky left-0 z-20 shadow-[6px_0_15px_rgba(0,0,0,0.05)]">
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">Professional Identity</span>
                </TableHead>
                {DAYS.map(day => (
                  <TableHead key={day} className="text-center w-[220px] min-w-[220px] border-r last:border-0 uppercase text-[11px] font-black tracking-[0.2em] py-8 text-primary/40">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/10 group transition-colors border-b last:border-0">
                  <TableCell className="border-r py-8 pl-10 bg-white/30 backdrop-blur-sm sticky left-0 z-10 group-hover:bg-muted/20 transition-colors shadow-[6px_0_15px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-black text-[15px] text-primary tracking-tight leading-none truncate group-hover:translate-x-1 transition-transform">{emp.fullName}</span>
                      <span className="text-[10px] font-black text-secondary uppercase tracking-[0.15em] opacity-80">{emp.id}</span>
                    </div>
                  </TableCell>
                  {DAYS.map((day, idx) => {
                    const status = getConstraintStatus(emp.id, day, idx);
                    const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
                    
                    return (
                      <TableCell key={day} className={`border-r last:border-0 p-4 transition-colors ${status ? 'bg-muted/10' : 'group-hover:bg-muted/5'}`}>
                        <div className="space-y-3">
                            {status && (
                                <div className="flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-white/50 border shadow-sm">
                                    <Lock className="size-3 text-muted-foreground" />
                                    <span className={`text-[9px] font-black uppercase tracking-tighter ${status.color}`}>
                                        {status.label}
                                    </span>
                                </div>
                            )}
                            <Select 
                                value={assignment?.shiftId || 'none'}
                                onValueChange={(val) => handleAssignmentChange(emp.id, day, val)}
                            >
                                <SelectTrigger className={`h-11 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${assignment ? 'border-secondary/40 bg-secondary/5 text-secondary shadow-lg' : 'border-dashed border-2 opacity-30 hover:opacity-100 hover:border-primary/20'}`}>
                                    <SelectValue placeholder="UNSET" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-2xl border-none bg-white/95 backdrop-blur-xl p-2">
                                    <SelectItem value="none" className="text-[10px] font-black uppercase tracking-widest rounded-lg">Unassigned</SelectItem>
                                    <div className="h-px bg-muted my-2" />
                                    {shifts?.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="text-[11px] font-black uppercase tracking-widest rounded-lg py-3">
                                            {s.id} <span className="opacity-40 ml-3 text-[10px] tracking-tight">[{s.startTime} — {s.endTime}]</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
                <TableRow>
                   <TableCell colSpan={8} className="py-32 text-center opacity-20 italic font-black uppercase text-xs tracking-[0.4em]">
                      No clinical records matching search criteria for cluster node.
                   </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Validation HUD Footer */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-6rem)] max-w-7xl bg-primary/98 backdrop-blur-3xl border border-white/10 z-50 p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] rounded-[3rem] border-t-4 border-t-secondary animate-in slide-in-from-bottom-10 duration-700">
        <div className="flex items-center justify-between gap-16">
           <div className="flex items-center gap-6 shrink-0">
              <div className="size-16 rounded-[1.5rem] bg-secondary/20 flex items-center justify-center shadow-2xl border border-secondary/20">
                 <Target className="size-10 text-secondary" />
              </div>
              <div className="space-y-1">
                 <p className="text-[11px] font-black uppercase text-white/40 tracking-[0.4em]">Integrity Guard</p>
                 <p className="text-xl font-black uppercase tracking-tight text-white leading-none">Quota Fulfillment Status</p>
              </div>
           </div>
           
           <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-5 pb-1 pr-6">
                 {DAYS.map(day => {
                    const dayShifts = shifts?.map(s => quotaValidation[`${day}_${s.id}`]).filter(Boolean);
                    const allOk = dayShifts?.every(v => v.ok);
                    return (
                      <div key={day} className={cn(
                          "px-8 py-4 rounded-[1.5rem] border-2 flex flex-col items-center min-w-[150px] transition-all duration-500",
                          allOk ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "bg-destructive/10 border-destructive/30 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                      )}>
                         <span className="text-[10px] font-black uppercase mb-2 tracking-widest text-white/50">{day.substring(0,3)}</span>
                         <div className="flex items-center gap-3">
                            {allOk ? <CheckCircle2 className="size-4 text-emerald-400" /> : <AlertTriangle className="size-4 text-destructive" />}
                            <span className={cn(
                                "text-[13px] font-black tracking-widest",
                                allOk ? "text-emerald-400" : "text-destructive"
                            )}>
                               {allOk ? 'MATCHED' : 'CONFLICT'}
                            </span>
                         </div>
                      </div>
                    )
                 })}
              </div>
           </div>
           
           <div className="hidden lg:flex flex-col justify-center bg-white/5 p-6 rounded-2xl border border-white/10 text-right shrink-0">
              <div className="flex items-center justify-end gap-3 text-[11px] font-black text-secondary uppercase tracking-[0.2em]">
                 <Server className="size-4" /> Deterministic Node
              </div>
              <p className="text-[10px] text-white/50 font-bold leading-relaxed mt-3 uppercase tracking-tighter max-w-[240px]">
                 Rollout is restricted until daily headcount imbalances across all shifts are neutralized.
              </p>
           </div>
        </div>
      </div>

      {/* Super Admin Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] p-0 overflow-hidden sm:max-w-[540px]">
          <div className="bg-primary p-10 text-white space-y-2">
             <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none">FCFS Override Pulse</DialogTitle>
             <DialogDescription className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">You are initiating a manual bypass of a clinical weekly-off record.</DialogDescription>
          </div>
          <div className="p-10 space-y-8">
             <div className="p-6 rounded-2xl bg-secondary/5 border-2 border-secondary/10 flex items-center gap-6">
                <ShieldCheck className="size-10 text-secondary" />
                <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Privileged Transaction</p>
                    <p className="text-sm font-bold text-primary">Manual Assignment on Protected Slot</p>
                </div>
             </div>
             <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] px-2 block">Mandatory Governance Justification</Label>
                <Textarea 
                  placeholder="Explain why this override is necessary for clinical pod-balance..." 
                  className="min-h-[160px] rounded-2xl font-medium border-2 focus:border-secondary transition-all text-sm leading-relaxed p-6"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                />
             </div>
          </div>
          <DialogFooter className="p-10 bg-muted/30 border-t flex flex-row gap-4 sm:justify-center">
            <Button variant="ghost" onClick={() => setOverrideDialogOpen(false)} className="h-14 flex-1 font-black uppercase text-[11px] tracking-[0.2em] rounded-xl hover:bg-white transition-all">Abort Action</Button>
            <Button className="h-14 flex-1 font-black uppercase text-[11px] tracking-[0.2em] bg-primary text-white rounded-xl shadow-2xl hover:bg-secondary transition-all" onClick={handleProcessOverride} disabled={!overrideReason.trim()}>Confirm Bypass</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
