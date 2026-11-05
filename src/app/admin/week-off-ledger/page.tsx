
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, orderBy, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { useOffice } from '@/context/office-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  Search, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Database,
  Edit2,
  Lock,
  Loader2,
  Calendar as CalendarIcon,
  Info
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { DemoBadge } from '@/components/ui/demo-badge';
import { formatWeekId, displayWeekRange } from '@/lib/date-utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Resilient Timestamp Formatter
 * Prevents client-side crashes when dealing with inconsistent temporal data.
 */
function formatTimestamp(ts: any): string {
  if (!ts) return '---';
  try {
    // Robust Firestore Timestamp check (SDK independent)
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString();
    if (ts.seconds !== undefined) return new Date(ts.seconds * 1000).toLocaleTimeString();
    if (ts instanceof Date) return ts.toLocaleTimeString();
    if (typeof ts === 'string') return new Date(ts).toLocaleTimeString();
  } catch (e) {
    return '---';
  }
  return '---';
}

export default function WeekOffLedger() {
  const db = useFirestore();
  const { profile } = useUser();
  const { selectedOffice } = useOffice();
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState('20241230-20250105');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [newDay, setNewDay] = useState('');
  const [processing, setProcessing] = useState(false);

  // STABLE AUTHORITATIVE FETCHES
  const empQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employees');
    const targetOffice = profile.role === 'super_admin' ? selectedOffice : profile.office;
    
    if (profile.role === 'super_admin' && !selectedOffice) {
      return query(q, where('status', '==', 'Active'), orderBy('fullName', 'asc'));
    }
    
    if (!targetOffice) return null;
    return query(q, where('office', '==', targetOffice), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, profile, selectedOffice]);

  const bookQuery = useMemo(() => {
    if (!profile || !selectedWeek) return null;
    const q = collection(db, 'weekoff_bookings');
    const targetOffice = profile.role === 'super_admin' ? selectedOffice : profile.office;

    if (profile.role === 'super_admin' && !selectedOffice) {
      return query(q, where('weekId', '==', selectedWeek));
    }
    
    if (!targetOffice) return null;
    return query(q, where('weekId', '==', selectedWeek), where('office', '==', targetOffice));
  }, [db, selectedWeek, profile, selectedOffice]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: bookings, loading: bookLoading } = useCollection(bookQuery);

  const ledgerData = useMemo(() => {
    if (!employees) return [];
    
    const empList = Array.isArray(employees) ? employees : [];
    
    return empList.map(emp => {
      const booking = bookings?.find(b => b.employeeId === emp.id);
      return {
        id: String(emp.id || ''),
        fullName: String(emp.fullName || 'Unmapped Identity'),
        office: String(emp.office || ''),
        status: String(emp.status || 'Active'),
        bookingId: booking?.id ? String(booking.id) : null,
        weekOff: booking?.dayOfWeek ? String(booking.dayOfWeek) : null,
        timestamp: booking?.timestamp || null
      };
    }).filter(e => {
      const name = e.fullName.toLowerCase();
      const id = e.id.toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || id.includes(search);
    });
  }, [employees, bookings, searchTerm]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedWeek(formatWeekId(date));
  };

  const openOverride = (emp: any) => {
    setSelectedEmp(emp);
    setNewDay(emp.weekOff || '');
    setOverrideDialogOpen(true);
  };

  const handleManualOverride = async () => {
    if (!selectedEmp || !newDay) return;
    
    setProcessing(true);
    try {
      const configId = `${selectedWeek}_${selectedEmp.office}`;
      const configRef = doc(db, 'weekoff_configs', configId);
      const bookingId = `${selectedWeek}_${selectedEmp.id}`;
      const bookingRef = doc(db, 'weekoff_bookings', bookingId);

      await runTransaction(db, async (transaction) => {
        const configSnap = await transaction.get(configRef);
        if (!configSnap.exists()) throw new Error("Cycle configuration missing.");

        const configData = configSnap.data();
        const bookedMap = configData.booked || {};

        if (selectedEmp.weekOff) {
          const oldDay = selectedEmp.weekOff;
          bookedMap[oldDay] = Math.max(0, (bookedMap[oldDay] || 1) - 1);
        }

        bookedMap[newDay] = (bookedMap[newDay] || 0) + 1;

        transaction.update(configRef, { booked: bookedMap, updatedAt: serverTimestamp() });

        transaction.set(bookingRef, {
          id: bookingId,
          weekId: selectedWeek,
          office: selectedEmp.office,
          employeeId: selectedEmp.id,
          dayOfWeek: newDay,
          status: 'confirmed',
          timestamp: serverTimestamp(),
          actorId: profile?.uid,
          isOverride: true
        });
      });

      logAudit(db, profile?.uid || 'system', 'SUPER_ADMIN_OVERRIDE_WEEKOFF', selectedEmp.id, { weekId: selectedWeek, newDay });
      toast({ title: "Institutional Override Applied", description: `Week-off for ${selectedEmp.fullName} set to ${newDay}.` });
      setOverrideDialogOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Override Failed", description: e.message });
    } finally {
      setProcessing(false);
    }
  };

  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <CalendarIcon className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Week-Off Ledger</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Off-Day Matrix <Activity className="size-3 text-secondary animate-pulse" />
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
                    <span className="text-[14px] uppercase">{displayWeekRange(selectedWeek)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus className="bg-white" />
                </PopoverContent>
              </Popover>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Hub</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
        </div>
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
                 <Zap className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                 <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Assignment Pulse</CardTitle>
                 <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                    Monitoring institutional off-day reservations for ROC professionals.
                 </CardDescription>
              </div>
           </div>
           <div className="relative w-full max-w-xl group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-secondary transition-colors" />
              <Input 
                placeholder="Search Professional Name or ID..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-secondary transition-all text-black placeholder:text-slate-300 shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <Table className="border-collapse">
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-b border-slate-100">
                <TableHead className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left">Professional Identity</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center px-8">Clinical Off-Day</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center px-8">Sync Status</TableHead>
                <TableHead className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Governance Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empLoading || bookLoading ? (
                Array(10).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100"><TableCell colSpan={4} className="py-10 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></TableCell></TableRow>
                ))
              ) : ledgerData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-40 text-center">
                    <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No matching authorized traces found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                ledgerData.map((emp) => (
                  <TableRow key={emp.id} className={cn(
                    "hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0",
                    emp.status !== 'Active' && "opacity-40 grayscale"
                  )}>
                    <TableCell className="pl-10 py-8 border-r border-slate-100">
                       <div className="flex flex-col gap-1.5">
                          <span className="font-black text-[17px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{emp.fullName}</span>
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit tabular-nums">ID: {emp.id}</Badge>
                       </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100 text-center px-8">
                       {emp.weekOff ? (
                         <div className="flex flex-col items-center gap-2">
                           <Badge className="bg-secondary text-white font-black text-[11px] uppercase tracking-widest px-6 py-2 rounded-xl shadow-lg shadow-secondary/20">
                             {emp.weekOff}
                           </Badge>
                           <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">FCFS COMMITTED</span>
                         </div>
                       ) : (
                         <div className="flex flex-col items-center gap-1 opacity-20">
                            <span className="text-[12px] font-black uppercase italic">NOT_BOOKED</span>
                            <div className="w-12 h-0.5 bg-slate-300 rounded-full" />
                         </div>
                       )}
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100 text-center px-8">
                       {emp.weekOff ? (
                         <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-2 text-emerald-500">
                               <ShieldCheck className="size-3.5" />
                               <span className="text-[11px] font-black uppercase tracking-widest">REGISTRY_LOCKED</span>
                            </div>
                            <span className="text-[8px] font-mono text-slate-300 uppercase">
                              {formatTimestamp(emp.timestamp)}
                            </span>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center gap-2 text-slate-300">
                            <Lock className="size-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">PENDING_SYNC</span>
                         </div>
                       )}
                    </TableCell>
                    <TableCell className="text-right pr-12 py-8">
                       <div className="flex justify-end gap-3">
                          {isSuperAdmin ? (
                            <Button 
                              variant="ghost" 
                              className="h-11 px-6 rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white font-black uppercase text-[10px] tracking-widest transition-all border border-primary/10"
                              onClick={() => openOverride(emp)}
                            >
                              <Edit2 className="size-3.5 mr-2" /> OVERRIDE
                            </Button>
                          ) : (
                            <div className="flex items-center gap-3 opacity-20">
                               <span className="text-[9px] font-black uppercase tracking-widest">READ_ONLY_ACCESS</span>
                               <ShieldCheck className="size-5" />
                            </div>
                          )}
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><Database size={280} className="text-primary" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Governance Protocol Hub</p>
               <p className="text-lg font-bold text-black/80 leading-relaxed max-w-4xl tracking-tight">
                  "The Week-Off Ledger represents the deterministic source of truth for professional availability. 
                  Manual modifications are strictly restricted to Super Administrative nodes to maintain audit integrity 
                  and ensure pod-quota balance within clinical centers."
               </p>
            </div>
         </div>
      </div>

      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden w-[95vw] sm:max-w-[500px] bg-white text-black">
          <div className="bg-primary p-10 text-white space-y-2">
             <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none">Manual Assignment</DialogTitle>
             <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Bypassing FCFS Matrix for Institutional Compliance</DialogDescription>
          </div>
          <div className="p-10 space-y-8">
             <div className="flex items-center gap-5 p-5 rounded-2xl bg-slate-50 border-2 border-slate-100">
                <div className="size-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                   <Activity className="size-6" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-400">Professional</p>
                   <p className="text-base font-black uppercase tracking-tight">{selectedEmp?.fullName || '---'}</p>
                </div>
             </div>

             <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">New Designated Off-Day</Label>
                <Select value={newDay} onValueChange={setNewDay}>
                   <SelectTrigger className="h-14 font-black border-2 rounded-2xl px-6 focus:ring-secondary">
                      <SelectValue placeholder="Select Day" />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl shadow-2xl p-2 border-none">
                      {DAYS.map(day => (
                        <SelectItem key={day} value={day} className="font-bold py-3 rounded-xl uppercase text-[11px]">{day}</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
             </div>

             <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex gap-4">
                <Info className="size-5 text-amber-600 shrink-0" />
                <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase tracking-tight">
                   Modifying this assignment will automatically adjust the cluster quota counts for {selectedWeek}.
                </p>
             </div>
          </div>
          <DialogFooter className="p-10 bg-slate-50 border-t flex gap-4">
             <Button variant="ghost" className="flex-1 font-black uppercase text-[10px] tracking-widest h-14 rounded-2xl" onClick={() => setOverrideDialogOpen(false)}>Abort</Button>
             <Button className="flex-1 bg-primary text-white font-black uppercase text-[10px] tracking-widest h-14 rounded-2xl shadow-2xl" onClick={handleManualOverride} disabled={processing || !newDay}>
                {processing ? <Loader2 className="size-4 animate-spin" /> : "Commit Pulse"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
