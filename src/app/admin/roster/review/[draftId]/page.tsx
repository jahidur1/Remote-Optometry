
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, setDoc, collection, query, where, orderBy, getDoc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Save, ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Lock, Info, Send, Target, History, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from '@/lib/audit';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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
    return employees.filter(e => 
      e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  const getConstraintStatus = (employeeId: string, day: string, dateIndex: number) => {
    const isOff = bookings?.some(b => b.employeeId === employeeId && b.dayOfWeek === day);
    const date = weekDates[dateIndex];
    const leave = leaves?.find(l => l.employeeId === employeeId && isDateInRange(date, l.startDate, l.endDate));
    
    if (isOff) return { type: 'WEEKLY_OFF', label: 'WEEK OFF', color: 'text-secondary' };
    if (leave) return { type: 'LEAVE', label: leave.type.toUpperCase(), color: 'text-accent' };
    return null;
  };

  const handleAssignmentChange = (employeeId: string, day: string, shiftId: string) => {
    // Logic for restricted working-day changes
    const constraint = getConstraintStatus(employeeId, day, DAYS.indexOf(day));
    
    if (constraint?.type === 'WEEKLY_OFF' && profile?.role !== 'SUPER_ADMIN') {
      toast({ title: "Action Blocked", description: "Only Super Admins can override FCFS Weekly-Offs.", variant: "destructive" });
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
    toast({ title: "Override Applied", description: "Institutional FCFS record bypassed with audit trail." });
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
      toast({ title: "Draft Saved", description: "Manual adjustments preserved in cluster storage." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!profile) return;
    
    // Check for validation errors
    const hasConflicts = Object.values(quotaValidation).some((v: any) => !v.ok);
    if (hasConflicts) {
      toast({ variant: "destructive", title: "Rollout Blocked", description: "Staffing quotas must be exactly matched for all days before publication." });
      return;
    }

    setPublishing(true);
    try {
      const versionId = `${weekId}_v${Date.now()}`;
      await setDoc(doc(db, 'published_rosters', versionId), {
        weekId,
        version: Date.now(),
        assignments,
        publishedAt: new Date().toISOString(),
        publisherId: profile.uid,
        status: 'active'
      });

      await updateDoc(doc(db, 'roster_drafts', draftId), { status: 'published' });
      
      logAudit(db, profile.uid, 'PUBLISH_ROSTER', versionId, { weekId });
      toast({ title: "Roster Published", description: "Clinical schedule is now LIVE for all professionals." });
      router.push('/admin/roster');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  if (draftLoading) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="size-12 animate-spin text-secondary" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Initializing Workspace</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-48 max-w-[1600px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl border-2 hover:bg-muted size-12 transition-all">
            <ArrowLeft className="size-6 text-primary" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-primary font-headline uppercase leading-none">Roster Review Cluster</h1>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5">Cycle {weekId}</Badge>
              <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                 Status: {draft?.status?.toUpperCase() || 'DRAFT'} <History className="size-3 text-secondary" />
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative w-64">
              <User className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search staff..." 
                className="pl-10 h-11 font-bold bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" onClick={handleSave} disabled={saving} className="h-11 px-8 font-black uppercase tracking-widest border-2 hover:bg-muted transition-all">
             <Save className="mr-3 h-5 w-5" /> {saving ? 'Syncing...' : 'Save Progress'}
           </Button>
           <Button className="bg-secondary text-white shadow-2xl shadow-secondary/20 h-11 px-8 font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95" onClick={handlePublish} disabled={publishing}>
             <Send className="mr-3 h-5 w-5" /> {publishing ? 'Rollout...' : 'Approve & Publish'}
           </Button>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] glass-card mx-4">
        <CardHeader className="bg-primary p-8 text-primary-foreground border-none">
          <div className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-4 font-black uppercase tracking-tight">
                <ShieldCheck className="size-7 text-secondary" /> Clinical Deployment Grid
              </CardTitle>
              <CardDescription className="text-[11px] font-black uppercase text-white/40 tracking-[0.15em]">Assignments are strictly validated against Daily Quotas and FCFS locks.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Badge className="bg-white/10 text-white border-none font-black text-[9px] uppercase tracking-widest py-1 px-4">Node: {draftId.slice(-8)}</Badge>
                <Badge className="bg-secondary text-white border-none font-black text-[9px] uppercase tracking-widest py-1 px-4">Admin Verified</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/50 border-b">
              <TableRow>
                <TableHead className="w-[280px] border-r py-6 pl-8 bg-white/50 backdrop-blur-sm sticky left-0 z-20 shadow-[4px_0_10px_rgba(0,0,0,0.05)]">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Clinical Professional</span>
                </TableHead>
                {DAYS.map(day => (
                  <TableHead key={day} className="text-center w-[200px] min-w-[200px] border-r last:border-0 uppercase text-[11px] font-black tracking-[0.15em] py-6">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/10 group transition-colors border-b last:border-0">
                  <TableCell className="border-r py-6 pl-8 bg-white/30 backdrop-blur-sm sticky left-0 z-10 group-hover:bg-muted/20 transition-colors shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-col gap-1">
                      <span className="font-black text-[13px] text-primary tracking-tight leading-none truncate">{emp.fullName}</span>
                      <span className="text-[10px] font-black text-secondary uppercase tracking-[0.1em] opacity-80">{emp.id}</span>
                    </div>
                  </TableCell>
                  {DAYS.map((day, idx) => {
                    const status = getConstraintStatus(emp.id, day, idx);
                    const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
                    
                    return (
                      <TableCell key={day} className={`border-r last:border-0 p-3 transition-colors ${status ? 'bg-muted/10' : 'group-hover:bg-muted/5'}`}>
                        <div className="space-y-2">
                            {status && (
                                <div className="flex items-center justify-center gap-1.5 opacity-60 px-2">
                                    <Lock className="size-2.5 text-muted-foreground" />
                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${status.color}`}>
                                        {status.label}
                                    </span>
                                </div>
                            )}
                            <Select 
                                value={assignment?.shiftId || 'none'}
                                onValueChange={(val) => handleAssignmentChange(emp.id, day, val)}
                            >
                                <SelectTrigger className={`h-10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${assignment ? 'border-secondary/40 bg-secondary/5 text-secondary shadow-sm' : 'border-dashed border-2 opacity-30 hover:opacity-100 hover:border-primary/20'}`}>
                                    <SelectValue placeholder="UNSET" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-2xl border-none bg-white/95 backdrop-blur-xl">
                                    <SelectItem value="none" className="text-[9px] font-black uppercase tracking-widest">Unassigned</SelectItem>
                                    {shifts?.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="text-[10px] font-black uppercase tracking-widest">
                                            {s.id} <span className="opacity-40 ml-2">[{s.startTime}]</span>
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
                   <TableCell colSpan={8} className="py-24 text-center opacity-30 italic font-black uppercase text-xs tracking-widest">
                      No professionals matching your search criteria.
                   </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Validation HUD Footer */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-6xl bg-primary/95 backdrop-blur-2xl border border-white/10 z-50 p-6 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.4)] rounded-[2.5rem] border-t-4 border-t-secondary">
        <div className="flex items-center justify-between gap-12">
           <div className="flex items-center gap-5 shrink-0">
              <div className="size-14 rounded-2xl bg-secondary/20 flex items-center justify-center shadow-xl border border-secondary/20">
                 <Target className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                 <p className="text-[11px] font-black uppercase text-white/40 tracking-[0.3em]">Integrity Guard</p>
                 <p className="text-lg font-black uppercase tracking-tight text-white leading-none">Quota Fulfillment</p>
              </div>
           </div>
           
           <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-4 pb-1 pr-4">
                 {DAYS.map(day => {
                    const dayShifts = shifts?.map(s => quotaValidation[`${day}_${s.id}`]).filter(Boolean);
                    const allOk = dayShifts?.every(v => v.ok);
                    return (
                      <div key={day} className={`px-5 py-3 rounded-2xl border-2 flex flex-col items-center min-w-[130px] transition-all ${allOk ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-destructive/10 border-destructive/30 animate-pulse'}`}>
                         <span className="text-[9px] font-black uppercase mb-1.5 tracking-widest text-white/60">{day.substring(0,3)}</span>
                         <div className="flex items-center gap-2">
                            {allOk ? <CheckCircle2 className="size-4 text-emerald-400" /> : <AlertTriangle className="size-4 text-destructive" />}
                            <span className={`text-[12px] font-black tracking-tighter ${allOk ? 'text-emerald-400' : 'text-destructive'}`}>
                               {allOk ? 'FULFILLED' : 'CONFLICT'}
                            </span>
                         </div>
                      </div>
                    )
                 })}
              </div>
           </div>
           
           <div className="hidden lg:flex flex-col justify-center bg-white/5 p-4 rounded-2xl border border-white/10 text-right shrink-0">
              <div className="flex items-center justify-end gap-2 text-[10px] font-black text-secondary uppercase tracking-widest">
                 <Info className="size-3" /> Live Logic Engine
              </div>
              <p className="text-[10px] text-white/60 font-bold leading-relaxed mt-2 uppercase tracking-tighter max-w-[200px]">
                 Rollout is restricted until daily headcount imbalances are zeroed.
              </p>
           </div>
        </div>
      </div>

      {/* Super Admin Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-primary">Protected FCFS Bypass</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">You are about to override a clinical weekly-off record secured by a professional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
             <div className="p-4 rounded-2xl bg-secondary/5 border-2 border-secondary/10 flex items-center gap-4">
                <ShieldCheck className="size-8 text-secondary" />
                <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Target Transaction</p>
                    <p className="text-sm font-bold text-primary">Manual Assignment on Reserved Off-Day</p>
                </div>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground px-2">Mandatory Authorization Reason</label>
                <Textarea 
                  placeholder="Explain why this override is necessary for clinical operations..." 
                  className="min-h-[120px] rounded-2xl font-medium border-2"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                />
             </div>
          </div>
          <DialogFooter className="gap-3 sm:justify-center">
            <Button variant="ghost" onClick={() => setOverrideDialogOpen(false)} className="h-12 px-8 font-black uppercase text-[10px] tracking-widest">Abort Action</Button>
            <Button className="h-12 px-8 font-black uppercase text-[10px] tracking-widest bg-secondary" onClick={handleProcessOverride} disabled={!overrideReason.trim()}>Confirm Bypass</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
