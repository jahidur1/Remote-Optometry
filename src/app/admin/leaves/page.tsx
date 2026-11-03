
'use client';

import { useState } from 'react';
import { collection, query, orderBy, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlaneTakeoff, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Calendar, 
  User, 
  FileText, 
  Zap, 
  ArrowRight,
  Info,
  Clock,
  Database
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';

export default function LeaveManagement() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [newLeave, setNewLeave] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    type: 'leave',
    reason: ''
  });

  const leavesQuery = query(collection(db, 'employee_leaves'), orderBy('startDate', 'desc'));
  const { data: leaves, loading: leavesLoading } = useCollection(leavesQuery);
  
  const employeesQuery = query(collection(db, 'employees'), orderBy('fullName', 'asc'));
  const { data: employees } = useCollection(employeesQuery);

  const handleAddLeave = async () => {
    if (!newLeave.employeeId || !newLeave.startDate || !newLeave.endDate) {
      toast({ title: "Validation Error", description: "Employee and date range are required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const leaveId = `${newLeave.employeeId}_${Date.now()}`;
      const leaveRef = doc(db, 'employee_leaves', leaveId);
      const payload = {
        ...newLeave,
        id: leaveId,
        status: 'approved',
        approvedBy: profile?.uid,
        updatedAt: new Date().toISOString()
      };

      await setDoc(leaveRef, payload);
      logAudit(db, profile?.uid || 'system', 'ADMIN_ADD_LEAVE', newLeave.employeeId, payload);

      toast({ title: "Unavailability Recorded", description: "Status successfully updated in clinical roster constraints." });
      setNewLeave({ employeeId: '', startDate: '', endDate: '', type: 'leave', reason: '' });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const leaveRef = doc(db, 'employee_leaves', id);
      await updateDoc(leaveRef, {
        status,
        approvedBy: profile?.uid,
        updatedAt: new Date().toISOString()
      });
      logAudit(db, profile?.uid || 'system', `LEAVE_${status.toUpperCase()}`, id, { status });
      toast({ title: `Leave ${status}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this unavailability record? This will restore shift eligibility.')) return;
    try {
      await deleteDoc(doc(db, 'employee_leaves', id));
      logAudit(db, profile?.uid || 'system', 'DELETE_LEAVE', id);
      toast({ title: "Record Removed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filteredLeaves = leaves?.filter(l => {
    const emp = employees?.find(e => e.id === l.employeeId);
    const text = `${emp?.fullName} ${l.employeeId} ${l.reason}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <PlaneTakeoff className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Clinical Absences</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Override Registry <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Protocol Status</label>
              <div className="flex items-center gap-3">
                 <span className="font-black text-secondary uppercase tracking-widest text-lg">SOLVER GUARD</span>
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-12 px-10 font-black uppercase tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={() => document.getElementById('record-absence-form')?.scrollIntoView({ behavior: 'smooth' })}
           >
            <Plus className="size-5 mr-3 group-hover:rotate-90 transition-transform" />
            PROVISION OVERRIDE
           </Button>
        </div>
      </div>

      {/* KPI Ledger */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Active Overrides</CardTitle>
            <Zap className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">
              {leaves?.filter(l => l.status === 'approved').length || 0}
            </div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Verified Absences</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">Pending Action</CardTitle>
            <Clock className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent tracking-tighter">
              {leaves?.filter(l => l.status === 'pending').length || 0}
            </div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Awaiting Authorization</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Integrity Sync</CardTitle>
            <Database className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">100%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Global Node Sync</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Security Cycle</CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-500 opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">IMMUT</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Audit Locked</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Provisioning Deck */}
        <div className="lg:col-span-4" id="record-absence-form">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary sticky top-24">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-[1.25rem] bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20 shadow-inner">
                  <Plus className="size-7" />
                </div>
                <div>
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-white leading-none">Record Absence</CardTitle>
                  <CardDescription className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                     Provision manual availability overrides.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] ml-1">Professional Identity</Label>
                <Select onValueChange={(val) => setNewLeave({ ...newLeave, employeeId: val })} value={newLeave.employeeId}>
                  <SelectTrigger className="h-14 text-sm font-black rounded-2xl border-2 border-white/10 bg-white/[0.02] shadow-sm hover:border-secondary transition-all">
                    <SelectValue placeholder="Select Professional" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl bg-slate-900/95 backdrop-blur-xl p-2">
                    {employees?.map(e => (
                      <SelectItem key={e.id} value={e.id} className="font-bold text-[11px] py-3 rounded-xl uppercase">
                        {e.fullName} <span className="text-[9px] opacity-40 ml-2">[{e.id}]</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">Start Date</Label>
                  <Input 
                    type="date" 
                    className="h-14 font-black border-2 border-white/10 bg-white/[0.02] rounded-2xl px-6 text-white focus:border-secondary transition-all" 
                    value={newLeave.startDate} 
                    onChange={e => setNewLeave({ ...newLeave, startDate: e.target.value })} 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">End Date</Label>
                  <Input 
                    type="date" 
                    className="h-14 font-black border-2 border-white/10 bg-white/[0.02] rounded-2xl px-6 text-white focus:border-secondary transition-all" 
                    value={newLeave.endDate} 
                    onChange={e => setNewLeave({ ...newLeave, endDate: e.target.value })} 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">Unavailability Type</Label>
                <Select onValueChange={(val) => setNewLeave({ ...newLeave, type: val })} value={newLeave.type}>
                  <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-white/10 bg-white/[0.02] transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl bg-slate-900/95 backdrop-blur-xl p-2">
                    <SelectItem value="leave" className="font-bold text-[11px] py-3 rounded-xl uppercase">Clinical Leave</SelectItem>
                    <SelectItem value="training" className="font-bold text-[11px] py-3 rounded-xl uppercase">Technical Training</SelectItem>
                    <SelectItem value="other" className="font-bold text-[11px] py-3 rounded-xl uppercase">Other / Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">Governance Justification</Label>
                <Input 
                  placeholder="Optional audit details..." 
                  className="h-14 font-bold border-2 border-white/10 bg-white/[0.02] rounded-2xl px-6 text-white placeholder:text-white/10 transition-all focus:border-secondary" 
                  value={newLeave.reason} 
                  onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} 
                />
              </div>

              <Button 
                className="w-full bg-secondary text-white h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-secondary/20 hover:scale-[1.02] transition-all group" 
                onClick={handleAddLeave} 
                disabled={loading}
              >
                {loading ? <Zap className="size-5 animate-spin mr-3" /> : <ShieldCheck className="size-5 mr-3 group-hover:rotate-12 transition-transform" />}
                {loading ? 'SYNCING REGISTRY...' : 'COMMIT OVERRIDE'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Absence Ledger */}
        <div className="lg:col-span-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
            <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                  <PlaneTakeoff className="size-8 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">Absence Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                     Verified professional unavailability tracing.
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-4 w-full max-w-md">
                <div className="relative w-full group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-white/20 group-focus-within:text-secondary transition-colors" />
                  <Input 
                    placeholder="Search Identity or Case..." 
                    className="pl-12 h-12 font-black uppercase text-[11px] tracking-widest bg-white/[0.02] border-2 border-white/10 rounded-xl focus:border-secondary transition-all text-white placeholder:text-white/10 shadow-inner"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table className="border-collapse">
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-b border-white/5">
                    <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Professional Identity</TableHead>
                    <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Duration Window</TableHead>
                    <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Protocol Type</TableHead>
                    <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Status</TableHead>
                    <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leavesLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} className="border-b border-white/5"><TableCell colSpan={5} className="py-10 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /></TableCell></TableRow>
                    ))
                  ) : filteredLeaves?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-40 text-center">
                        <p className="text-white/10 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No active absence records found in node.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeaves?.map((l) => {
                      const emp = employees?.find(e => e.id === l.employeeId);
                      return (
                        <TableRow key={l.id} className="hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                          <TableCell className="pl-10 py-8 border-r border-white/5">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-black text-[15px] text-white tracking-tight group-hover:translate-x-1 transition-transform leading-none">{emp?.fullName || l.employeeId}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-white/10 text-white/40 bg-white/5 px-2 py-0.5 rounded-md">{l.employeeId}</Badge>
                                <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest truncate max-w-[120px]">{l.reason || 'UNJUSTIFIED'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-8 border-r border-white/5">
                            <div className="flex items-center gap-4">
                               <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-secondary/20 transition-all shadow-inner">
                                  <Calendar className="size-4 text-secondary" />
                               </div>
                               <div className="flex flex-col">
                                  <span className="font-black text-[13px] text-white/80 tracking-tighter tabular-nums">{l.startDate}</span>
                                  <span className="text-[9px] font-black uppercase text-white/20 tracking-widest flex items-center gap-2">
                                     <ArrowRight className="size-2.5" /> {l.endDate}
                                  </span>
                               </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-8 border-r border-white/5">
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-4 py-1 rounded-lg">
                              {l.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-8 border-r border-white/5 text-center">
                             {l.status === 'approved' ? (
                               <div className="flex flex-col items-center gap-1.5">
                                 <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                                    <CheckCircle2 className="size-3.5" /> AUTHORIZED
                                 </div>
                               </div>
                             ) : l.status === 'rejected' ? (
                               <div className="flex items-center justify-center gap-2 text-destructive font-black text-[10px] uppercase tracking-widest">
                                  <XCircle className="size-3.5" /> REJECTED
                               </div>
                             ) : (
                               <Badge className="bg-amber-500 text-white font-black text-[9px] uppercase tracking-widest px-4 py-1 rounded-full shadow-lg shadow-amber-500/20 animate-pulse">PENDING</Badge>
                             )}
                          </TableCell>
                          <TableCell className="text-right pr-10 py-8">
                            <div className="flex justify-end gap-3">
                              {l.status === 'pending' && (
                                <>
                                  <Button variant="ghost" size="icon" className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-inner border border-emerald-500/20" onClick={() => handleUpdateStatus(l.id, 'approved')}>
                                    <ShieldCheck className="size-5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="size-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-inner border border-destructive/20" onClick={() => handleUpdateStatus(l.id, 'rejected')}>
                                    <ShieldAlert className="size-5" />
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="icon" className="size-10 rounded-xl text-white/20 hover:bg-destructive hover:text-white transition-all" onClick={() => handleDelete(l.id)}>
                                <Trash2 className="size-5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="bg-white/[0.02] p-10 border-t border-white/5">
               <div className="flex items-center gap-10">
                  <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                     <Info className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Constraint Protocol</p>
                    <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                      Overrides represent **hard constraints** for the deterministic optimization node. 
                      Once committed and authorized, the CP-SAT engine will mathematically block any shift assignment for that professional during the duration window.
                    </p>
                  </div>
               </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Policy Section */}
      <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-[0.03]">
               <FileText size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <ShieldCheck className="size-8 text-white" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Registry Protocol</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Clinical availability overrides are immutably linked to the audit ledger. Every provisioning action is recorded with 
                    administrative identity markers to ensure complete traceability within the workforce lifecycle.
                  </p>
                </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-12 space-y-10 group border-l-4 border-l-secondary shadow-2xl">
             <div className="space-y-4">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                   <Zap className="size-8" />
                </div>
                <div className="space-y-1">
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Operational Pulse</p>
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Absence Sync</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 The CP-SAT engine utilizes this ledger to calculate daily clinical capacity. Professionals with approved overlaps 
                 are automatically excluded from the assignment pool to prevent quota shortfalls.
               </p>
               <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                  <Zap className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Deterministic Node Control Active</p>
               </div>
             </div>
          </Card>
      </div>
    </div>
  );
}

