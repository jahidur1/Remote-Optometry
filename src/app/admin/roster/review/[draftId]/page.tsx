
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
      toast({ title: "Draft Saved", description: "Manual adjustments preserved." });
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

  if (draftLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-6 pb-40">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Review Workspace</h1>
            <p className="text-muted-foreground font-medium italic">Validating optimized draft for Week {weekId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" onClick={handleSave} disabled={saving}>
             <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
           </Button>
           <Button className="bg-secondary shadow-lg shadow-secondary/10" onClick={handlePublish} disabled={publishing}>
             <Send className="mr-2 h-4 w-4" /> {publishing ? 'Publishing...' : 'Approve & Publish'}
           </Button>
        </div>
      </div>

      <Card className="shadow-md border-t-4 border-t-primary">
        <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Professional Assignment Grid
            </CardTitle>
            <CardDescription>Locked cells indicate protected Weekly Offs or Approved Leaves.</CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
             Draft ID: {draftId.slice(-8)}
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[200px] border-r">Professional</TableHead>
                {DAYS.map(day => (
                  <TableHead key={day} className="text-center w-[160px] min-w-[160px] border-r last:border-0 uppercase text-[10px] font-black tracking-widest">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/5 group">
                  <TableCell className="border-r bg-muted/5">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{emp.fullName}</span>
                      <span className="text-[10px] font-mono text-secondary uppercase font-bold">{emp.id}</span>
                    </div>
                  </TableCell>
                  {DAYS.map((day, idx) => {
                    const status = getConstraintStatus(emp.id, day, idx);
                    const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
                    
                    if (status) {
                      return (
                        <TableCell key={day} className="border-r last:border-0 bg-muted/20 p-2">
                          <div className="flex flex-col items-center justify-center gap-1 opacity-60">
                            <Lock className="size-3 text-muted-foreground" />
                            <span className="text-[9px] font-black tracking-tighter text-muted-foreground text-center">
                              {status.label}
                            </span>
                          </div>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell key={day} className="border-r last:border-0 p-2">
                        <Select 
                          value={assignment?.shiftId || 'none'}
                          onValueChange={(val) => handleAssignmentChange(emp.id, day, val)}
                        >
                          <SelectTrigger className={`h-9 text-[11px] font-bold ${assignment ? 'border-secondary/50 bg-secondary/5 text-secondary' : 'border-dashed opacity-50'}`}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">UNASSIGNED</SelectItem>
                            {shifts?.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime})</SelectItem>
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

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t z-50 p-4 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
           <div className="flex items-center gap-3 shrink-0">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                 <Target className="size-6 text-primary" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Roster Integrity HUD</p>
                 <p className="text-sm font-bold uppercase tracking-tight">Shift Quota Adherence</p>
              </div>
           </div>
           
           <div className="flex-1 overflow-x-auto">
              <div className="flex gap-4 pb-2">
                 {DAYS.map(day => {
                    const dayShifts = shifts?.map(s => quotaValidation[`${day}_${s.id}`]).filter(Boolean);
                    const allOk = dayShifts?.every(v => v.ok);
                    return (
                      <div key={day} className={`px-4 py-2 rounded-xl border-2 flex flex-col items-center min-w-[120px] ${allOk ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                         <span className="text-[9px] font-black uppercase mb-1">{day.substring(0,3)}</span>
                         <div className="flex items-center gap-2">
                            {allOk ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-destructive" />}
                            <span className={`text-sm font-black ${allOk ? 'text-emerald-700' : 'text-destructive'}`}>
                               {allOk ? 'VALID' : 'CONFLICT'}
                            </span>
                         </div>
                      </div>
                    )
                 })}
              </div>
           </div>
           
           <div className="hidden lg:block bg-muted/30 p-3 rounded-xl border border-dashed text-right shrink-0">
              <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center justify-end gap-1">
                 <Info className="size-3" /> System Guard
              </p>
              <p className="text-[10px] text-foreground font-medium leading-tight mt-1">
                 Manual edits trigger instant re-validation.<br/>Over-staffing blocks publication.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
