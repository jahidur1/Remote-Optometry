
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
  Database,
  MessageSquare,
  Zap,
  FileText,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  XCircle,
  FileCheck,
  Bell,
  Filter
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDatesForWeek, formatWeekId, displayWeekRange, getCurrentWeekId, getISTNow } from '@/lib/date-utils';
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
import { previewEmployeeRosterAction, sendTestWhatsAppAction } from '@/services/roster-notification-service';
import { initiateWeeklyRosterCampaignAction } from '@/services/weekly-roster-pdf-service';
import { runDailyShiftReminders } from '@/services/daily-reminder-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function MasterMatrix() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { selectedOffice, setSelectedOffice, authorizedOffices } = useOffice();
  const { toast } = useToast();
  
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  // Campaign States
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [campaignStarting, setCampaignStarting] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<any>(null);

  // 2-Day Manual Dispatch State
  const [dispatchingDaily, setDispatchingDaily] = useState(false);

  const todayStr = useMemo(() => format(getISTNow(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    setSelectedWeek(getCurrentWeekId());
  }, []);

  const empQuery = useMemo(() => {
    if (!profile || !selectedOffice) return null;
    const q = collection(db, 'employees');
    return query(q, where('office', '==', selectedOffice), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
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

  useEffect(() => {
    if (!db || !selectedWeek || !selectedOffice) return;
    
    setLoadingAssignments(true);
    const draftId = `draft_${selectedWeek}_${selectedOffice}`;
    const activeId = `active_${selectedWeek}_${selectedOffice}`;

    let hasActiveDraft = false;
    let draftData: any[] = [];
    let activeData: any[] = [];

    const unsubDraft = onSnapshot(doc(db, 'roster_drafts', draftId), (snap) => {
      if (snap.exists() && snap.data().status === 'draft') {
        draftData = snap.data().assignments || [];
        hasActiveDraft = true;
      } else {
        hasActiveDraft = false;
        draftData = [];
      }
      updateState();
    });

    const unsubActive = onSnapshot(doc(db, 'published_rosters', activeId), (snap) => {
      activeData = snap.exists() ? (snap.data().assignments || []) : [];
      updateState();
    });

    function updateState() {
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
      const matchesSearch = name.includes(search) || id.includes(search);
      const matchesRole = roleFilter === 'all' || (e.role || '').toLowerCase() === roleFilter.toLowerCase();
      return matchesSearch && matchesRole;
    });
  }, [employees, searchTerm, roleFilter]);

  const campaignEligibility = useMemo(() => {
    if (!employees || !assignments.length) return { total: 0, eligible: 0, missingWA: 0, missingOptIn: 0, missingRoster: 0 };
    
    let eligible = 0;
    let missingWA = 0;
    let missingOptIn = 0;
    let missingRoster = 0;

    employees.forEach(emp => {
      const hasRoster = assignments.some(a => a.employeeId === emp.id);
      if (!hasRoster) { missingRoster++; return; }
      if (!emp.whatsappNumber) { missingWA++; return; }
      if (emp.whatsappOptIn === false) { missingOptIn++; return; }
      eligible++;
    });

    return { total: employees.length, eligible, missingWA, missingOptIn, missingRoster };
  }, [employees, assignments]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedWeek(formatWeekId(date));
  };

  const handleAssignmentChange = (employeeId: string, day: string, shiftId: string, date: string) => {
    setAssignments(prev => {
      const filtered = prev.filter(a => !(a.employeeId === employeeId && a.date === date));
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
      toast({ title: "Draft Synchronized" });
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
      toast({ title: "Clinical Roster Live" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Rollout Failed", description: e.message });
    } finally {
      setPublishing(false);
    }
  };

  const handlePreviewPDF = async (employeeId: string) => {
    setPreviewingId(employeeId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth link missing.");
      const result = await previewEmployeeRosterAction(idToken, employeeId, selectedWeek);
      if (result.success && result.base64) {
        const win = window.open();
        win?.document.write(`<iframe src="${result.base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Synthesis Error", description: e.message });
    } finally {
      setPreviewingId(null);
    }
  };

  const handleStartWeeklyCampaign = async () => {
    if (!selectedOffice || !selectedWeek) return;
    setCampaignStarting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication failed.");

      const result = await initiateWeeklyRosterCampaignAction(idToken, selectedOffice, selectedWeek);
      if (result.success) {
        toast({ title: "Campaign Initiated", description: `Weekly distribution for ${selectedOffice} is processing in the background.` });
        setIsCampaignDialogOpen(false);
        const unsub = onSnapshot(doc(db, 'weekly_roster_campaigns', result.campaignId!), (snap) => {
           if (snap.exists()) setActiveCampaign(snap.data());
        });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Campaign Conflict", description: e.message });
    } finally {
      setCampaignStarting(false);
    }
  };

  const handleManual2DayDispatch = async () => {
    setDispatchingDaily(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const result = await runDailyShiftReminders(true, idToken);
      
      if (result.success) {
        toast({ title: "Briefings Dispatched", description: `Successfully processed ${result.stats?.success} professionals.` });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Dispatch Failed", description: e.message });
    } finally {
      setDispatchingDaily(false);
    }
  };

  const currentOfficeName = authorizedOffices.find(o => o.officeId === selectedOffice)?.officeName || 'Selected';
  const displayOfficeHeader = currentOfficeName.toUpperCase().includes('ROC') ? currentOfficeName : `${currentOfficeName} ROC`;

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4 text-black">
      {/* Precision Header Hub */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 pt-6">
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

        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target Cluster</label>
              <Select value={selectedOffice || ''} onValueChange={setSelectedOffice}>
                <SelectTrigger className="h-6 w-48 font-black text-black border-none bg-transparent focus:ring-0 p-0 text-[14px]">
                  <SelectValue placeholder="Select Hub..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                  {authorizedOffices.map(o => (
                    <SelectItem key={o.officeId} value={o.officeId} className="font-bold text-[11px] py-2.5 rounded-lg uppercase">
                      {o.officeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-6 p-0 flex items-center gap-2 font-black text-black hover:bg-transparent">
                    <CalendarDays className="size-4 text-secondary" />
                    <span className="text-[14px] uppercase tracking-tight">{selectedWeek ? displayWeekRange(selectedWeek) : 'Select Start'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus className="bg-white" />
                </PopoverContent>
              </Popover>
           </div>
           <div className="flex gap-2 p-1">
              <Button 
                variant="outline"
                className="bg-white border-2 border-slate-100 text-black h-10 px-6 font-black uppercase text-[10px] transition-all rounded-xl hover:bg-slate-50"
                onClick={handleSaveDraft}
                disabled={saving || publishing || !selectedOffice || !selectedWeek}
              >
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                Save Draft
              </Button>
              <Button 
                className="bg-secondary text-white h-10 px-8 font-black uppercase text-[10px] transition-all rounded-xl shadow-xl shadow-secondary/20 group" 
                onClick={handlePublish}
                disabled={saving || publishing || !selectedOffice || !selectedWeek}
              >
                {publishing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2 group-hover:rotate-12 transition-transform" />}
                Rollout Roster
              </Button>
           </div>
        </div>
      </div>

      <Card className="shadow-xl border-none rounded-[2.5rem] bg-primary text-white overflow-hidden relative group">
         <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:rotate-12 transition-transform duration-1000"><Zap size={180} /></div>
         <CardHeader className="p-10 pb-6 border-b border-white/5 relative z-10">
            <div className="flex flex-col xl:flex-row items-center justify-between gap-8">
               <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tight leading-none">Roster Distribution</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-white/40 tracking-[0.3em] mt-3">Institutional bulk dispatch protocols via Meta Cloud API.</CardDescription>
               </div>
               <div className="flex flex-wrap gap-4">
                  <Button 
                    variant="outline"
                    className="h-14 px-8 border-2 border-white/20 bg-white/5 text-white font-black uppercase tracking-[0.1em] text-[10px] rounded-2xl hover:bg-white/10 hover:border-white/40 transition-all group/btn"
                    onClick={handleManual2DayDispatch}
                    disabled={dispatchingDaily}
                  >
                    {dispatchingDaily ? <Loader2 className="size-4 animate-spin mr-3" /> : <Bell className="mr-3 size-4 fill-white" />}
                    DISPATCH 2-DAY BRIEFINGS
                  </Button>
                  <Button 
                    className="bg-secondary text-white h-14 px-10 font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all group/btn"
                    onClick={() => setIsCampaignDialogOpen(true)}
                    disabled={!selectedOffice || !selectedWeek || assignments.length === 0}
                  >
                    <Zap className="mr-3 size-5 fill-white group-hover/btn:animate-pulse" /> SEND WEEKLY ROSTER PDF
                  </Button>
               </div>
            </div>
         </CardHeader>
         <CardContent className="p-10 grid gap-10 md:grid-cols-4 relative z-10">
            {[
              { label: 'Eligible Pool', value: campaignEligibility.eligible, sub: 'Ready for Dispatch', icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Missing Phone', value: campaignEligibility.missingWA, sub: 'Registry Incomplete', icon: XCircle, color: 'text-destructive' },
              { label: 'Missing Opt-In', value: campaignEligibility.missingOptIn, sub: 'Pulse Restricted', icon: ShieldCheck, color: 'text-amber-400' },
              { label: 'Missing Roster', value: campaignEligibility.missingRoster, sub: 'Empty Cycle Data', icon: AlertTriangle, color: 'text-slate-400' }
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 hover:bg-white/10 transition-all cursor-default">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{stat.label}</span>
                    <stat.icon className={cn("size-4", stat.color)} />
                 </div>
                 <div className="space-y-1">
                    <p className="text-4xl font-black tabular-nums">{stat.value}</p>
                    <p className="text-[8px] font-bold uppercase text-white/20 tracking-widest">{stat.sub}</p>
                 </div>
              </div>
            ))}
         </CardContent>
         {activeCampaign && (
           <CardFooter className="bg-black/20 p-10 border-t border-white/5">
              <div className="flex-1 space-y-4">
                 <div className="flex justify-between items-end">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Active Campaign Pulse</p>
                       <p className="text-[12px] font-bold uppercase text-white/60">ID: {activeCampaign.id.slice(-8)} • {activeCampaign.status?.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                       <span className="text-2xl font-black text-white tabular-nums">
                         {activeCampaign.stats.total > 0 ? Math.round(((activeCampaign.stats.total - activeCampaign.stats.pending) / activeCampaign.stats.total) * 100) : 0}%
                       </span>
                    </div>
                 </div>
                 <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div 
                      className="h-full bg-secondary transition-all duration-1000" 
                      style={{ width: `${activeCampaign.stats.total > 0 ? ((activeCampaign.stats.total - activeCampaign.stats.pending) / activeCampaign.stats.total) * 100 : 0}%` }} 
                    />
                 </div>
              </div>
           </CardFooter>
         )}
      </Card>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-primary">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col xl:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6 shrink-0">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
                 <ArrowRightLeft className="size-8 text-white" />
              </div>
              <div className="space-y-1">
                 <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Institutional Pulse</CardTitle>
                 <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                    Direct shift assignment for {displayOfficeHeader}.
                 </CardDescription>
              </div>
           </div>
           <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl">
              <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Search Professional Name or ID..." 
                  className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-primary transition-all text-black shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full md:w-64">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:ring-primary shadow-inner">
                    <div className="flex items-center gap-2">
                      <Filter className="size-3.5 text-secondary" />
                      <SelectValue placeholder="Filter Role" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                    <SelectItem value="all" className="font-bold text-[11px] py-3 rounded-lg uppercase">All Roles</SelectItem>
                    <SelectItem value="super_admin" className="font-bold text-[11px] py-3 rounded-lg uppercase">Super Admin</SelectItem>
                    <SelectItem value="admin" className="font-bold text-[11px] py-3 rounded-lg uppercase">Cluster Admin</SelectItem>
                    <SelectItem value="user" className="font-bold text-[11px] py-3 rounded-lg uppercase">Staff Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto no-scrollbar">
            <Table className="border-collapse min-w-max">
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 bg-white/95 backdrop-blur-md sticky left-0 z-20 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">Professional Identity</TableHead>
                  {DAYS.map((day, idx) => {
                    const date = weekDates[idx];
                    const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                    const isToday = dateStr === todayStr;
                    
                    return (
                      <TableHead key={day} className={cn(
                        "text-center w-[200px] border-r border-slate-100 last:border-0 py-8 transition-all relative overflow-hidden",
                        isToday && "bg-primary text-white border-x-secondary/40 shadow-inner"
                      )}>
                         <div className="flex flex-col gap-1 relative z-10">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest transition-colors",
                              isToday ? "text-secondary" : "text-primary/30"
                            )}>{day.substring(0,3)}</span>
                            <span className={cn(
                              "text-[12px] font-black tabular-nums transition-colors",
                              isToday ? "text-white" : "text-black/20"
                            )}>
                               {date ? format(date, 'dd MMM') : '-- --'}
                            </span>
                            {isToday && (
                              <span className="text-[7px] font-black uppercase tracking-[0.4em] text-secondary mt-1 animate-pulse">Pulse Today</span>
                            )}
                         </div>
                         {isToday && <div className="absolute top-0 left-0 w-full h-1 bg-secondary shadow-[0_0_10px_hsl(var(--secondary))]" />}
                      </TableHead>
                    );
                  })}
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
                      <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] italic">No active professionals found for this hub.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className={cn(
                      "hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0",
                      emp.status !== 'Active' && "opacity-40 grayscale"
                    )}>
                      <TableCell className="pl-10 py-8 border-r border-slate-100 bg-white group-hover:bg-slate-50 transition-colors sticky left-0 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                         <div className="flex items-center justify-between pr-4">
                            <div className="flex flex-col gap-1.5">
                               <span className="font-black text-[16px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{emp.fullName}</span>
                               <div className="flex items-center gap-2 mt-1.5">
                                  <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit tabular-nums">ID: {emp.id}</Badge>
                                  {emp.whatsappOptIn === false && <Badge className="bg-destructive text-white border-none text-[7px] font-black uppercase px-2 py-0 rounded-sm">OPT-OUT</Badge>}
                               </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-8 rounded-lg hover:bg-secondary/10 text-secondary transition-all"
                              onClick={() => handlePreviewPDF(emp.id)}
                              disabled={previewingId === emp.id}
                            >
                              {previewingId === emp.id ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                            </Button>
                         </div>
                      </TableCell>
                      {DAYS.map((day, idx) => {
                        const isOff = bookings?.some(b => b.employeeId === emp.id && b.dayOfWeek === day);
                        const date = weekDates[idx];
                        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                        const onLeave = leaves?.find(l => l.employeeId === emp.id && dateStr >= l.startDate && dateStr <= l.endDate);
                        const currentAssignment = assignments.find(a => a.employeeId === emp.id && a.date === dateStr);
                        const isToday = dateStr === todayStr;

                        return (
                          <TableCell key={day} className={cn(
                            "py-8 border-r border-slate-100 last:border-0 text-center px-4 transition-colors relative",
                            isToday && "bg-secondary/[0.02]"
                          )}>
                             {isOff ? (
                               <div className="flex flex-col items-center gap-2 animate-in zoom-in-95">
                                  <Badge className="bg-secondary text-white font-black text-[9px] uppercase px-4 py-1.5 rounded-xl shadow-lg shadow-secondary/20">WEEK-OFF</Badge>
                                  <Lock className="size-3 text-secondary opacity-30" />
                               </div>
                             ) : onLeave ? (
                               <div className="flex flex-col items-center gap-2 animate-in zoom-in-95">
                                  <Badge className="bg-accent text-primary font-black text-[9px] uppercase px-4 py-1.5 rounded-xl border border-primary/10">LEAVE</Badge>
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
                                     currentAssignment ? "bg-emerald-50/5 border-emerald-500/20 text-emerald-600 shadow-sm" : "bg-slate-50 border-2 border-dashed border-slate-200 text-slate-300"
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
                             {isToday && <div className="absolute inset-y-0 left-0 w-[1px] bg-secondary/10" />}
                             {isToday && <div className="absolute inset-y-0 right-0 w-[1px] bg-secondary/10" />}
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

      {/* Campaign Confirmation Dialog */}
      <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-black">
          <div className="bg-primary p-12 text-white relative">
             <div className="absolute top-0 right-0 p-10 opacity-5"><MessageSquare size={160} /></div>
             <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none relative z-10">Initiate Distribution</DialogTitle>
             <DialogDescription className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mt-4 relative z-10">Institutional Weekly Roster Dispatch Protocol</DialogDescription>
          </div>
          <div className="p-12 space-y-10">
             <div className="space-y-6">
                <div className="flex justify-between items-center p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 group">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400">Target Hub</p>
                      <p className="text-lg font-black uppercase text-primary tracking-tight">{currentOfficeName}</p>
                   </div>
                   <TrendingUp className="size-6 text-secondary" />
                </div>

                <div className="flex justify-between items-center p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 group">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400">Clinical Cycle</p>
                      <p className="text-lg font-black uppercase text-primary tracking-tight">{displayWeekRange(selectedWeek)}</p>
                   </div>
                   <CalendarDays className="size-6 text-secondary" />
                </div>
             </div>

             <div className="p-8 rounded-3xl bg-secondary/5 border-2 border-secondary/10 space-y-4">
                <div className="flex items-center gap-4 text-secondary">
                   <ShieldCheck className="size-6" />
                   <p className="text-[12px] font-black uppercase tracking-widest">Campaign Summary</p>
                </div>
                <div className="space-y-3 pt-2">
                   <p className="text-[13px] font-medium leading-relaxed uppercase">
                     Dispatching <span className="font-black text-secondary">{campaignEligibility.eligible} personalized PDFs</span> to authorized mobile endpoints.
                   </p>
                   <p className="text-[11px] text-black/40 font-bold uppercase tracking-widest leading-relaxed">
                     Professionals without valid rosters or opt-ins will be automatically skipped to maintain registry integrity.
                   </p>
                </div>
             </div>
          </div>
          <DialogFooter className="p-12 bg-slate-50 border-t border-slate-100 flex gap-4">
             <Button variant="ghost" className="flex-1 h-16 font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl" onClick={() => setIsCampaignDialogOpen(false)}>Abort Pulse</Button>
             <Button 
                className="flex-1 h-16 bg-primary text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-[1.02] transition-all"
                onClick={handleStartWeeklyCampaign}
                disabled={campaignStarting}
             >
                {campaignStarting ? <Loader2 className="size-6 animate-spin mr-3" /> : <Zap className="size-6 mr-3 fill-white" />}
                Authorize Batch
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
