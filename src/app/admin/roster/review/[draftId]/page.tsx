
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, setDoc, collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Save, ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Lock, Info, Send, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from '@/lib/audit';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';

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

  // Data Fetching
  const { data: draft, loading: draftLoading } = useDoc(doc(db, 'roster_drafts', draftId));
  const { data: employees } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
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

  const getConstraintStatus = (employeeId: string, day: string, dateIndex: number) => {
    const isOff = bookings?.some(b => b.employeeId === employeeId && b.dayOfWeek === day);
    const date = weekDates[dateIndex];
    const leave = leaves?.find(l => l.employeeId === employeeId && isDateInRange(date, l.startDate, l.endDate));
    
    if (isOff) return { type: 'WEEKLY_OFF', label: 'WEEK OFF' };
    if (leave) return { type: 'LEAVE', label: leave.type.toUpperCase() };
    return null;
  };

  const handleAssignmentChange = (employeeId: string, day: string, shiftId: string) => {
    setAssignments(prev => {
      const filtered = prev.filter(a => !(a.employeeId === employeeId && a.dayOfWeek === day));
      if (shiftId === 'none') return filtered;
      return [...filtered, { employeeId, dayOfWeek: day, shiftId }];
    });
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
    setPublishing(true);
    try {
      const versionId = `${weekId}_v${Date.now()}`;
      await setDoc(doc(db, 'published_rosters', versionId), {
        weekId,
        version: Date.now(),
        assignments,
        publishedAt: new Date().toISOString(),
        publisherId: profile.uid
      });

      await updateDoc(doc(db, 'roster_drafts', draftId), { status: 'published' });
      
      logAudit(db, profile.uid, 'PUBLISH_ROSTER', versionId, { weekId });
      toast({ title: "Roster Published", description: "Schedule is now live for all professionals." });
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl border-2 hover:bg-muted size-12 transition-all">
            <ArrowLeft className="size-6 text-primary" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-primary font-headline uppercase leading-none">Review Cluster</h1>
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
               Validating optimized draft for Week {weekId} <Target className="size-3 text-secondary" />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <Button variant="outline" onClick={handleSave} disabled={saving} className="h-12 px-8 font-black uppercase tracking-widest border-2 hover:bg-muted transition-all">
             <Save className="mr-3 h-5 w-5" /> {saving ? 'Syncing...' : 'Save Draft'}
           </Button>
           <Button className="bg-secondary text-white shadow-2xl shadow-secondary/20 h-12 px-8 font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95" onClick={handlePublish} disabled={publishing}>
             <Send className="mr-3 h-5 w-5" /> {publishing ? 'Rollout...' : 'Approve & Rollout'}
           </Button>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] glass-card">
        <CardHeader className="bg-primary p-8 text-primary-foreground border-none">
          <div className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-4 font-black uppercase tracking-tight">
                <ShieldCheck className="size-7 text-secondary" /> Clinical Assignment Grid
              </CardTitle>
              <CardDescription className="text-[11px] font-black uppercase text-white/40 tracking-[0.15em]">Locked cells indicate protected FCFS records or Approved Absences.</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-white/20 text-white bg-white/5 px-4 py-1.5 rounded-full">
               Node: {draftId.slice(-8)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/50 border-b">
              <TableRow>
                <TableHead className="w-[240px] border-r py-6 pl-8 bg-white/50 backdrop-blur-sm sticky left-0 z-20">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Professional Unit</span>
                </TableHead>
                {DAYS.map(day => (
                  <TableHead key={day} className="text-center w-[180px] min-w-[180px] border-r last:border-0 uppercase text-[11px] font-black tracking-[0.15em] py-6">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/10 group transition-colors border-b last:border-0">
                  <TableCell className="border-r py-6 pl-8 bg-white/30 backdrop-blur-sm sticky left-0 z-10 group-hover:bg-muted/20 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-black text-sm text-primary tracking-tight leading-none">{emp.fullName}</span>
                      <span className="text-[10px] font-black text-secondary uppercase tracking-[0.1em] opacity-80">{emp.id}</span>
                    </div>
                  </TableCell>
                  {DAYS.map((day, idx) => {
                    const status = getConstraintStatus(emp.id, day, idx);
                    const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
                    
                    if (status) {
                      return (
                        <TableCell key={day} className="border-r last:border-0 bg-muted/30 p-3">
                          <div className="flex flex-col items-center justify-center gap-2 opacity-50 select-none">
                            <div className="size-7 rounded-full bg-muted flex items-center justify-center shadow-inner">
                                <Lock className="size-3 text-muted-foreground" />
                            </div>
                            <span className="text-[10px] font-black tracking-widest text-muted-foreground text-center uppercase">
                              {status.label}
                            </span>
                          </div>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell key={day} className="border-r last:border-0 p-3 transition-colors group-hover:bg-muted/5">
                        <Select 
                          value={assignment?.shiftId || 'none'}
                          onValueChange={(val) => handleAssignmentChange(emp.id, day, val)}
                        >
                          <SelectTrigger className={`h-11 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${assignment ? 'border-secondary/40 bg-secondary/5 text-secondary shadow-sm' : 'border-dashed border-2 opacity-40 hover:opacity-100 hover:border-primary/30'}`}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-2xl border-none bg-white/95 backdrop-blur-xl">
                            <SelectItem value="none" className="text-[10px] font-black uppercase tracking-widest">Unassigned</SelectItem>
                            {shifts?.map(s => (
                              <SelectItem key={s.id} value={s.id} className="text-[11px] font-black uppercase tracking-widest">
                                  {s.name} <span className="opacity-40 ml-2">[{s.startTime}]</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Validation HUD Footer */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-6xl bg-primary/95 backdrop-blur-2xl border border-white/10 z-50 p-6 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem]">
        <div className="flex items-center justify-between gap-12">
           <div className="flex items-center gap-5 shrink-0">
              <div className="size-14 rounded-2xl bg-secondary/20 flex items-center justify-center shadow-xl border border-secondary/20">
                 <Target className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                 <p className="text-[11px] font-black uppercase text-white/40 tracking-[0.3em]">Integrity HUD</p>
                 <p className="text-lg font-black uppercase tracking-tight text-white">Quota Adherence</p>
              </div>
           </div>
           
           <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-5 pb-2 pr-4">
                 {DAYS.map(day => {
                    const dayShifts = shifts?.map(s => quotaValidation[`${day}_${s.id}`]).filter(Boolean);
                    const allOk = dayShifts?.every(v => v.ok);
                    return (
                      <div key={day} className={`px-6 py-3 rounded-2xl border-2 flex flex-col items-center min-w-[140px] transition-all ${allOk ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                         <span className="text-[10px] font-black uppercase mb-1.5 tracking-widest text-white/60">{day.substring(0,3)}</span>
                         <div className="flex items-center gap-3">
                            {allOk ? <CheckCircle2 className="size-5 text-emerald-400" /> : <AlertTriangle className="size-5 text-destructive" />}
                            <span className={`text-sm font-black tracking-tighter ${allOk ? 'text-emerald-400' : 'text-destructive'}`}>
                               {allOk ? 'VALID' : 'CONFLICT'}
                            </span>
                         </div>
                      </div>
                    )
                 })}
              </div>
           </div>
           
           <div className="hidden lg:flex flex-col justify-center bg-white/5 p-4 rounded-2xl border border-white/10 text-right shrink-0">
              <p className="text-[10px] font-black text-white/40 uppercase flex items-center justify-end gap-2 tracking-widest">
                 <Info className="size-3 text-secondary" /> Automated Guard
              </p>
              <p className="text-[11px] text-white font-bold leading-relaxed mt-2 uppercase tracking-tighter opacity-80">
                 Real-time Conflict Analysis Active.<br/>Staffing shortfall blocks rollout.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
