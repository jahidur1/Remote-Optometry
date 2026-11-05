'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, orderBy, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser, useAuth, useCollection } from '@/firebase';
import { useOffice } from '@/context/office-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  ShieldCheck, 
  Search,
  CheckCircle2,
  CalendarDays,
  Lock,
  PlaneTakeoff,
  ArrowRightLeft,
  Save,
  Send,
  Loader2,
  Database
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDatesForWeek, formatWeekId, displayWeekRange, getCurrentWeekId } from '@/lib/date-utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { DemoBadge } from '@/components/ui/demo-badge';
import { logAudit } from '@/lib/audit';
import { useToast } from '@/hooks/use-toast';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AvailabilitySummary() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { selectedOffice } = useOffice();
  const { toast } = useToast();
  
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Hydration-Safe Week Initialization
  useEffect(() => {
    setSelectedWeek(getCurrentWeekId());
  }, []);

  // Clear assignments on cycle change to prevent ghosting
  useEffect(() => {
    setAssignments([]);
  }, [selectedWeek, selectedOffice]);

  // Stable Authoritative Registry Fetches
  const empQuery = useMemo(() => {
    if (!profile || !selectedOffice) return null;
    const q = collection(db, 'employees');
    const targetOffice = profile.role === 'super_admin' ? selectedOffice : profile.office;
    if (!targetOffice) return null;
    return query(q, where('office', '==', targetOffice), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, profile, selectedOffice]);

  const bookQuery = useMemo(() => {
    if (!profile || !selectedWeek || !selectedOffice) return null;
    const q = collection(db, 'weekoff_bookings');
    return query(q, where('weekId', '==', selectedWeek), where('office', '==', selectedOffice));
  }, [db, selectedWeek, profile, selectedOffice]);

  const leaveQuery = useMemo(() => {
    if (!profile || !selectedOffice) return null;
    const q = collection(db, 'employee_leaves');
    return query(q, where('office', '==', selectedOffice), where('status', '==', 'approved'));
  }, [db, profile, selectedOffice]);

  const shiftsQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: bookings, loading: bookLoading } = useCollection(bookQuery);
  const { data: leaves } = useCollection(leaveQuery);
  const { data: shifts } = useCollection(shiftsQuery);

  /**
   * DETERMINISTIC SINGLETON REGISTRY LINK
   * Atomic Temporal Protocol: Enforces date mapping upon retrieval and overwrite.
   */
  useEffect(() => {
    if (!db || !selectedWeek || !selectedOffice) return;
    
    setLoadingAssignments(true);
    const draftId = `draft_${selectedWeek}_${selectedOffice}`;
    const activeId = `active_${selectedWeek}_${selectedOffice}`;

    let draftData: any[] = [];
    let activeData: any[] = [];
    let hasActiveDraft = false;

    // 1. Listen for Draft Singleton
    const unsubDraft = onSnapshot(doc(db, 'roster_drafts', draftId), (snap) => {
      if (snap.exists() && snap.data().status === 'draft') {
        draftData = snap.data().assignments || [];
        hasActiveDraft = true;
      } else {
        hasActiveDraft = false;
      }
      updateState();
    });

    // 2. Listen for Active Published Singleton
    const unsubActive = onSnapshot(doc(db, 'published_rosters', activeId), (snap) => {
      activeData = snap.exists() ? (snap.data().assignments || []) : [];
      updateState();
    });

    function updateState() {
      // Logic Priority: Show Draft if it's being worked on, otherwise show Published
      setAssignments(hasActiveDraft ? draftData : activeData);
      setLoadingAssignments(false);
    }

    return () => {
      unsubDraft();
      unsubActive();
    };
  }, [db, selectedWeek, selectedOffice]);

  const weekDates = useMemo(() => selectedWeek ? getDatesForWeek(selectedWeek) : [], [selectedWeek]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(e => {
      const name = (e.fullName || '').toLowerCase();
      const id = (e.id || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || id.includes(search);
    });
  }, [employees, searchTerm]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedWeek(formatWeekId(date));
  };

  const handleAssignmentChange = (employeeId: string, day: string, shiftId: string, date: string) => {
    setAssignments(prev => {
      const filtered = prev.filter(a => !(a.employeeId === employeeId && a.dayOfWeek === day));
      if (shiftId === 'none') return filtered;
      return [...filtered, { employeeId, dayOfWeek: day, shiftId, date }];
    });
  };

  const handleSaveDraft = async () => {
    if (!selectedOffice || !selectedWeek) return;
    setSaving(true);
    try {
      const draftId = `draft_${selectedWeek}_${selectedOffice}`;
      await setDoc(doc(db, 'roster_drafts', draftId), {
        id: draftId,
        weekId: selectedWeek,
        office: selectedOffice,
        assignments,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        actorId: profile?.uid,
        generationMethod: 'manual'
      });

      logAudit(db, profile?.uid || 'system', 'SAVE_MANUAL_ROSTER_DRAFT', draftId, { weekId: selectedWeek, office: selectedOffice });
      toast({ title: "Draft Synchronized", description: "Manual assignments secured in registry." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedOffice || !selectedWeek) return;
    setPublishing(true);
    try {
      // SINGLETON ID PROTOCOL: strictly overwrites active week/office document
      const activeId = `active_${selectedWeek}_${selectedOffice}`;
      await setDoc(doc(db, 'published_rosters', activeId), {
        id: activeId,
        weekId: selectedWeek,
        office: selectedOffice,
        version: Date.now(),
        assignments,
        publishedAt: new Date().toISOString(),
        publisherId: profile?.uid,
        status: 'active'
      });

      // Clear draft status on publish to transition priority back to published view
      const draftId = `draft_${selectedWeek}_${selectedOffice}`;
      await setDoc(doc(db, 'roster_drafts', draftId), { status: 'published' }, { merge: true });

      logAudit(db, profile?.uid || 'system', 'PUBLISH_MANUAL_ROSTER', activeId, { weekId: selectedWeek, office: selectedOffice });
      toast({ title: "Clinical Roster Live", description: "Shift data released to professional portals." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Rollout Failed", description: e.message });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Activity className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Master Matrix</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Atomic Temporal Registry <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-6 p-0 flex items-center gap-2 font-black text-black hover:bg-transparent">
                    <CalendarDays className="size-4 text-secondary" />
                    <span className="text-[14px] uppercase">{selectedWeek ? displayWeekRange(selectedWeek) : 'Select Start'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus className="bg-white" />
                </PopoverContent>
              </Popover>
           </div>
           <div className="flex gap-2">
              <Button 
                variant="outline"
                className="bg-white border-2 border-slate-100 text-black h-10 px-6 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl hover:bg-slate-50"
                onClick={handleSaveDraft}
                disabled={saving || publishing || !selectedOffice || !selectedWeek}
              >
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                Save Draft
              </Button>
              <Button 
                className="bg-secondary text-white h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl shadow-xl shadow-secondary/20 group" 
                onClick={handlePublish}
                disabled={saving || publishing || !selectedOffice || !selectedWeek}
              >
                {publishing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2 group-hover:rotate-12 transition-transform" />}
                Rollout Roster
              </Button>
           </div>
        </div>
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-primary">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
                 <ArrowRightLeft className="size-8 text-white" />
              </div>
              <div className="space-y-1">
                 <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Institutional Pulse</CardTitle>
                 <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                    Direct shift assignment with date-specific clinical synchronization.
                 </CardDescription>
              </div>
           </div>
           <div className="relative w-full max-xl:max-w-xl group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search Professional Name or ID..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-primary transition-all text-black shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto no-scrollbar">
            <Table className="border-collapse min-w-max">
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 bg-white/95 backdrop-blur-md sticky left-0 z-20 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">Professional Identity</TableHead>
                  {DAYS.map((day, idx) => (
                    <TableHead key={day} className="text-center w-[200px] border-r border-slate-100 last:border-0 py-8">
                       <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary/30">{day.substring(0,3)}</span>
                          <span className="text-[12px] font-black text-black/20 tabular-nums">
                             {weekDates[idx] ? format(weekDates[idx], 'dd MMM') : '-- --'}
                          </span>
                       </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {empLoading || bookLoading || loadingAssignments ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-100">
                      <TableCell colSpan={8} className="py-12 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-40 text-center">
                      <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] italic">No active professionals match the filter registry.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className={cn(
                      "hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0",
                      emp.status !== 'Active' && "opacity-40 grayscale"
                    )}>
                      <TableCell className="pl-10 py-8 border-r border-slate-100 bg-white group-hover:bg-slate-50 transition-colors sticky left-0 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                         <div className="flex flex-col gap-1.5">
                            <span className="font-black text-[16px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{emp.fullName}</span>
                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit tabular-nums">ID: {emp.id}</Badge>
                         </div>
                      </TableCell>
                      {DAYS.map((day, idx) => {
                        const isOff = bookings?.some(b => b.employeeId === emp.id && b.dayOfWeek === day);
                        const date = weekDates[idx];
                        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                        const onLeave = leaves?.find(l => l.employeeId === emp.id && dateStr >= l.startDate && dateStr <= l.endDate);
                        const currentAssignment = assignments.find(a => a.employeeId === emp.id && (a.date === dateStr || a.dayOfWeek === day));

                        return (
                          <TableCell key={day} className="py-8 border-r border-slate-100 last:border-0 text-center px-4">
                             {isOff ? (
                               <div className="flex flex-col items-center gap-2 animate-in zoom-in-95">
                                  <Badge className="bg-secondary text-white font-black text-[9px] uppercase px-4 py-1 rounded-xl shadow-lg shadow-secondary/20">WEEK-OFF</Badge>
                                  <Lock className="size-3 text-secondary opacity-30" />
                               </div>
                             ) : onLeave ? (
                               <div className="flex flex-col items-center gap-2 animate-in zoom-in-95">
                                  <Badge className="bg-accent text-primary font-black text-[9px] uppercase px-4 py-1 rounded-xl border border-primary/10">LEAVE</Badge>
                                  <PlaneTakeoff className="size-3 text-accent" />
                               </div>
                             ) : (
                               <div className="flex flex-col gap-2 items-center">
                                 <Select 
                                   value={currentAssignment?.shiftId || 'none'} 
                                   onValueChange={(val) => handleAssignmentChange(emp.id, day, val, dateStr)}
                                 >
                                   <SelectTrigger className={cn(
                                     "h-10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                     currentAssignment ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 shadow-sm" : "bg-slate-50 border-2 border-dashed border-slate-200 text-slate-300"
                                   )}>
                                     <SelectValue placeholder="-" />
                                   </SelectTrigger>
                                   <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                                      <SelectItem value="none" className="font-bold text-[10px] uppercase">UNASSIGNED</SelectItem>
                                      {shifts?.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="font-bold text-[10px] uppercase py-2.5">
                                          {s.name}
                                        </SelectItem>
                                      ))}
                                   </SelectContent>
                                 </Select>
                                 {currentAssignment && <CheckCircle2 className="size-3 text-emerald-500/40" />}
                               </div>
                             )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50/50 p-8 border-t border-slate-100 flex flex-wrap items-center gap-10">
           <div className="flex items-center gap-4">
              <div className="size-3 rounded-full bg-secondary shadow-[0_0_10px_blue]" />
              <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">Confirmed Week-Off</span>
           </div>
           <div className="flex items-center gap-4">
              <div className="size-3 rounded-full bg-accent border border-primary/10" />
              <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">Approved Leave</span>
           </div>
           <div className="flex items-center gap-4">
              <div className="size-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40" />
              <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">Shift Assigned</span>
           </div>
           <div className="ml-auto flex items-center gap-3 text-emerald-600">
              <ShieldCheck className="size-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Atomic Temporal Pulse Secured</span>
           </div>
        </CardFooter>
      </Card>
    </div>
  );
}
