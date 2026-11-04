'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, setDoc, collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Save, ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Lock, Info, Send, Target, Activity, User, Server, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from '@/lib/audit';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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
  
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideData, setOverrideData] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const { data: draft, loading: draftLoading } = useDoc(doc(db, 'roster_drafts', draftId));
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: shifts } = useCollection(query(collection(db, 'shift_master'), orderBy('displayOrder')));
  
  const weekId = draft?.weekId;
  const officeId = draft?.office;

  // Localized Quota Fetch
  const quotaDocId = weekId && officeId ? `${weekId}_${officeId}` : null;
  const { data: quotaDoc, loading: quotaLoading } = useDoc(quotaDocId ? doc(db, 'roster_quotas', quotaDocId) : null);
  
  const { data: bookings } = useCollection(weekId && officeId ? query(collection(db, 'weekoff_bookings'), where('weekId', '==', weekId), where('office', '==', officeId)) : null);
  const { data: leaves } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));

  useEffect(() => {
    if (draft?.assignments) {
      setAssignments(draft.assignments);
    }
  }, [draft]);

  const weekDates = useMemo(() => weekId ? getDatesForWeek(weekId) : [], [weekId]);

  const filteredEmployees = useMemo(() => {
    if (!employees || !draft) return [];
    return employees.filter(e => 
      e.office === draft.office && (
        e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [employees, searchTerm, draft]);

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
    
    if (constraint?.type === 'WEEKLY_OFF' && profile?.role !== 'SUPER_ADMIN') {
      toast({ title: "FCFS Lock Active", description: "Only Super Admins can override clinical weekly-offs.", variant: "destructive" });
      return;
    }

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
    
    if (!quotaDoc) {
      toast({ variant: "destructive", title: "Institutional Block", description: "Publication restricted. Office-specific quota configuration is missing." });
      return;
    }

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
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-white">
      <Loader2 className="size-16 animate-spin text-secondary opacity-30" />
      <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Initializing Roster Workspace</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-64 max-w-[1600px] mx-auto animate-in px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pt-6">
        <div className="flex items-center gap-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl border-2 hover:bg-slate-50 size-14 transition-all shadow-sm">
            <ArrowLeft className="size-7 text-primary" />
          </Button>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-black font-headline uppercase leading-none">Review Workspace</h1>
            <div className="flex items-center gap-5 mt-4">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-4 py-1.5 rounded-xl shadow-inner">Cycle {weekId}</Badge>
              <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                 Status: <span className="text-primary">{draft?.status?.toUpperCase() || 'DRAFT'}</span> <Activity className="size-3 text-secondary animate-pulse" />
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="relative w-64 mr-4">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <Input 
                placeholder="Search Professional..." 
                className="pl-12 h-11 font-black uppercase text-[10px] tracking-widest bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-secondary transition-all shadow-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" onClick={handleSave} disabled={saving} className="h-11 px-8 font-black uppercase text-[10px] tracking-[0.2em] border-2 border-slate-100 rounded-xl hover:bg-slate-50 transition-all">
             <Save className="mr-3 h-4 w-4" /> {saving ? 'Syncing...' : 'Save Draft'}
           </Button>
           <Button className="bg-secondary text-white shadow-xl shadow-secondary/20 h-11 px-10 font-black uppercase text-[10px] tracking-[0.2em] transition-all hover:scale-105 active:scale-95 rounded-xl" onClick={handlePublish} disabled={publishing}>
             <Send className="mr-3 h-4 w-4" /> {publishing ? 'Deploying...' : 'Approve & Rollout'}
           </Button>
        </div>
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[3rem] bg-white">
        <CardHeader className="bg-primary p-10 text-primary-foreground border-none relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 transform translate-x-10 -translate-y-10 opacity-5 group-hover:scale-110 transition-transform duration-[2s]">
            <ShieldCheck size={280} />
          </div>
          <div className="flex flex-row items-center justify-between relative z-10">
            <div className="space-y-2">
              <CardTitle className="text-2xl flex items-center gap-5 font-black uppercase tracking-tight leading-none">
                <ShieldCheck className="size-10 text-secondary" /> Clinical Assignment Grid
              </CardTitle>
              <CardDescription className="text-[11px] font-black uppercase text-white/40 tracking-[0.2em] mt-3">
                Deterministic Model Output: NODE_{draft?.office?.substring(0,3)} • {draft?.solverStatus}
              </CardDescription>
            </div>
            <div className="flex items-center gap-6">
                {draft?.solverMetadata && (
                   <div className="flex items-center gap-8 px-10 py-4 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Latency Pulse</span>
                        <span className="text-[14px] font-black text-secondary tabular-nums">{draft.solverMetadata.solveTimeMs.toFixed(0)}ms</span>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Constraints</span>
                        <span className="text-[14px] font-black tabular-nums">{draft.solverMetadata.constraintsChecked}</span>
                      </div>
                   </div>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar relative">
          {!quotaDoc && !quotaLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-30 flex items-center justify-center p-10 text-center">
               <div className="p-16 rounded-[3rem] bg-destructive text-white shadow-2xl border-none max-w-xl animate-in zoom-in-95">
                  <AlertTriangle className="size-20 mx-auto mb-8 animate-bounce" />
                  <h3 className="text-4xl font-black uppercase tracking-tight leading-none mb-4">Quota Pulse Missing</h3>
                  <p className="text-[14px] font-bold uppercase tracking-widest text-white/60 leading-relaxed mb-10">
                    Clinical requirements for ROC {draft?.office} in Week {weekId} are not configured. 
                    Assignments cannot be validated against institutional standards.
                  </p>
                  <Link href="/admin/quotas">
                    <Button className="h-16 px-14 bg-white text-destructive font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 transition-all">
                       Configure Quotas
                    </Button>
                  </Link>
               </div>
            </div>
          )}

          <Table className="border-collapse">
            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
              <TableRow>
                <TableHead className="w-[320px] border-r border-slate-100 py-10 pl-10 bg-white/80 backdrop-blur-md sticky left-0 z-20 shadow-[8px_0_20px_rgba(0,0,0,0.03)]">
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">Professional Identity</span>
                </TableHead>
                {DAYS.map(day => (
                  <TableHead key={day} className="text-center w-[240px] min-w-[240px] border-r border-slate-100 last:border-0 uppercase text-[11px] font-black tracking-[0.3em] py-10 text-primary/30">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(emp => (
                <TableRow key={emp.id} className="hover:bg-slate-50 group transition-all duration-300 border-b border-slate-100 last:border-0">
                  <TableCell className="border-r border-slate-100 py-10 pl-10 bg-white/60 backdrop-blur-sm sticky left-0 z-10 group-hover:bg-slate-100 transition-colors shadow-[8px_0_20px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-col gap-2">
                      <span className="font-black text-[16px] text-black tracking-tight leading-none group-hover:translate-x-2 transition-transform uppercase">{emp.fullName}</span>
                      <code className="text-[10px] font-black text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit uppercase tracking-widest border border-secondary/10 shadow-inner">ID: {emp.id}</code>
                    </div>
                  </TableCell>
                  {DAYS.map((day, idx) => {
                    const status = getConstraintStatus(emp.id, day, idx);
                    const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
                    
                    return (
                      <TableCell key={day} className={cn(
                        "border-r border-slate-100 last:border-0 p-6 transition-colors",
                        status ? 'bg-slate-50/50' : 'group-hover:bg-slate-50/30'
                      )}>
                        <div className="space-y-4">
                            {status && (
                                <div className="flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm">
                                    <Lock className="size-3 text-slate-400" />
                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", status.color)}>
                                        {status.label}
                                    </span>
                                </div>
                            )}
                            <Select 
                                value={assignment?.shiftId || 'none'}
                                onValueChange={(val) => handleAssignmentChange(emp.id, day, val)}
                            >
                                <SelectTrigger className={cn(
                                    "h-12 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all",
                                    assignment 
                                      ? 'border-secondary/40 bg-secondary/5 text-secondary shadow-lg' 
                                      : 'border-dashed border-2 border-slate-200 text-slate-400 bg-slate-50/50 hover:bg-white hover:border-secondary/30 hover:text-black'
                                )}>
                                    <SelectValue placeholder="UNSET" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-none bg-white/95 backdrop-blur-xl p-2">
                                    <SelectItem value="none" className="text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100">Unassigned</SelectItem>
                                    <div className="h-px bg-slate-100 my-2" />
                                    {shifts?.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="text-[11px] font-black uppercase tracking-widest rounded-xl py-3.5 hover:bg-secondary/5 hover:text-secondary">
                                            {s.id} <span className="opacity-30 ml-3 text-[10px] font-bold tracking-tight">[{s.startTime} — {s.endTime}]</span>
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
                   <TableCell colSpan={8} className="py-40 text-center opacity-20 italic font-black uppercase text-xs tracking-[0.5em] text-slate-400">
                      No matching records found in cluster node.
                   </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Validation HUD Footer */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-8rem)] max-w-7xl bg-primary/95 backdrop-blur-3xl border border-white/10 z-50 p-10 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.6)] rounded-[3.5rem] border-t-4 border-t-secondary animate-in slide-in-from-bottom-12 duration-700">
        <div className="flex items-center justify-between gap-16">
           <div className="flex items-center gap-8 shrink-0">
              <div className="size-20 rounded-[1.75rem] bg-secondary/20 flex items-center justify-center shadow-2xl border border-secondary/20">
                 <Target className="size-12 text-secondary" />
              </div>
              <div className="space-y-1">
                 <p className="text-[11px] font-black uppercase text-white/40 tracking-[0.5em]">Integrity Guard</p>
                 <p className="text-2xl font-black uppercase tracking-tight text-white leading-none">Quota Pulse</p>
              </div>
           </div>
           
           <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-6 pb-2 pr-8">
                 {DAYS.map(day => {
                    const dayShifts = shifts?.map(s => quotaValidation[`${day}_${s.id}`]).filter(Boolean);
                    const allOk = quotaDoc && dayShifts?.every(v => v.ok);
                    return (
                      <div key={day} className={cn(
                          "px-10 py-5 rounded-[2rem] border-2 flex flex-col items-center min-w-[170px] transition-all duration-700",
                          allOk ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : "bg-destructive/10 border-destructive/30 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                      )}>
                         <span className="text-[11px] font-black uppercase mb-3 tracking-[0.3em] text-white/50">{day.substring(0,3)}</span>
                         <div className="flex items-center gap-4">
                            {allOk ? <CheckCircle2 className="size-5 text-emerald-400" /> : <AlertTriangle className="size-5 text-destructive" />}
                            <span className={cn(
                                "text-[15px] font-black tracking-[0.15em]",
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
           
           <div className="hidden lg:flex flex-col justify-center bg-white/5 p-8 rounded-3xl border border-white/10 text-right shrink-0">
              <div className="flex items-center justify-end gap-4 text-[13px] font-black text-secondary uppercase tracking-[0.3em]">
                 <Server className="size-5" /> NODE_SYNC
              </div>
              <p className="text-[11px] text-white/30 font-bold leading-relaxed mt-4 uppercase tracking-tighter max-w-[260px]">
                 Automated rollout is restricted until daily headcount imbalances are neutralized.
              </p>
           </div>
        </div>
      </div>

      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-[600px] bg-white">
          <div className="bg-primary p-12 text-white space-y-3">
             <DialogTitle className="text-4xl font-black uppercase tracking-tight leading-none">FCFS Override Pulse</DialogTitle>
             <DialogDescription className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40">Initiating manual bypass of a clinical weekly-off registry entry.</DialogDescription>
          </div>
          <div className="p-12 space-y-10">
             <div className="p-8 rounded-3xl bg-secondary/5 border-2 border-secondary/10 flex items-center gap-8 shadow-inner">
                <ShieldCheck className="size-12 text-secondary" />
                <div className="space-y-1">
                    <p className="text-[12px] font-black uppercase text-primary tracking-widest">Privileged Transaction</p>
                    <p className="text-base font-bold text-slate-500 uppercase tracking-tight leading-tight">Manual Assignment on Protected FCFS Slot</p>
                </div>
             </div>
             <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] px-4 block">Mandatory Governance Justification</Label>
                <Textarea 
                  placeholder="Explain why this override is necessary for clinical pod-balance..." 
                  className="min-h-[180px] rounded-3xl font-medium border-2 border-slate-100 bg-slate-50/50 focus:border-secondary transition-all text-sm leading-relaxed p-8 shadow-inner shadow-none"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                />
             </div>
          </div>
          <DialogFooter className="p-12 bg-slate-50 border-t border-slate-100 flex flex-row gap-6 sm:justify-center">
            <Button variant="ghost" onClick={() => setOverrideDialogOpen(false)} className="h-16 flex-1 font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl hover:bg-white hover:text-black transition-all">Abort Action</Button>
            <Button className="h-16 flex-1 font-black uppercase text-[11px] tracking-[0.3em] bg-primary text-white rounded-2xl shadow-2xl hover:bg-secondary transition-all" onClick={handleProcessOverride} disabled={!overrideReason.trim()}>Confirm Bypass</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}