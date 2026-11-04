
'use client';

import { useState } from 'react';
import { collection, query, orderBy, setDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaneTakeoff, Plus, CheckCircle2, XCircle, Search, Trash2, ShieldCheck, ShieldAlert, Activity, Calendar, Zap, ArrowRight, Clock, Database } from "lucide-react";
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

  const leavesQuery = query(
    collection(db, 'employee_leaves'), 
    profile?.role === 'super_admin' ? orderBy('startDate', 'desc') : where('office', '==', profile?.office || '')
  );
  const { data: leaves, loading: leavesLoading } = useCollection(leavesQuery);
  
  const employeesQuery = query(
    collection(db, 'employees'), 
    profile?.role === 'super_admin' ? orderBy('fullName', 'asc') : where('office', '==', profile?.office || '')
  );
  const { data: employees } = useCollection(employeesQuery);

  const handleAddLeave = async () => {
    if (!newLeave.employeeId || !newLeave.startDate || !newLeave.endDate) {
      toast({ title: "Validation Error", description: "Employee and date range are required.", variant: "destructive" });
      return;
    }

    const emp = employees?.find(e => e.id === newLeave.employeeId);
    if (!emp) return;

    setLoading(true);
    try {
      const leaveId = `${newLeave.employeeId}_${Date.now()}`;
      const leaveRef = doc(db, 'employee_leaves', leaveId);
      const payload = {
        ...newLeave,
        id: leaveId,
        office: emp.office,
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <PlaneTakeoff className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-primary uppercase leading-none">Clinical Absences</h1>
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
              </div>
           </div>
           <div className="w-px h-10 bg-black/10" />
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-12 px-10 font-black uppercase tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={() => document.getElementById('record-absence-form')?.scrollIntoView({ behavior: 'smooth' })}
           >
            <Plus className="size-5 mr-3 group-hover:rotate-90 transition-transform" />
            PROVISION OVERRIDE
           </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4" id="record-absence-form">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary sticky top-24">
            <CardHeader className="bg-muted/30 border-b p-10">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-[1.25rem] bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20 shadow-inner">
                  <Plus className="size-7" />
                </div>
                <div>
                  <CardTitle className="text-xl uppercase font-black tracking-tight text-primary leading-none">Record Absence</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] ml-1">Professional Identity</Label>
                <Select onValueChange={(val) => setNewLeave({ ...newLeave, employeeId: val })} value={newLeave.employeeId}>
                  <SelectTrigger className="h-14 text-sm font-black rounded-2xl border-2 border-slate-100 bg-slate-50 shadow-sm hover:border-secondary transition-all">
                    <SelectValue placeholder="Select Professional" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl bg-white p-2">
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
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Start Date</Label>
                  <Input type="date" className="h-14 font-black border-2 border-slate-100 rounded-2xl px-6" value={newLeave.startDate} onChange={e => setNewLeave({ ...newLeave, startDate: e.target.value })} />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">End Date</Label>
                  <Input type="date" className="h-14 font-black border-2 border-slate-100 rounded-2xl px-6" value={newLeave.endDate} onChange={e => setNewLeave({ ...newLeave, endDate: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Type</Label>
                <Select onValueChange={(val) => setNewLeave({ ...newLeave, type: val })} value={newLeave.type}>
                  <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white p-2">
                    <SelectItem value="leave" className="font-bold text-[11px] uppercase">Clinical Leave</SelectItem>
                    <SelectItem value="training" className="font-bold text-[11px] uppercase">Technical Training</SelectItem>
                    <SelectItem value="other" className="font-bold text-[11px] uppercase">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full bg-primary text-white h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all" onClick={handleAddLeave} disabled={loading}>
                {loading ? <Zap className="size-5 animate-spin mr-3" /> : <ShieldCheck className="size-5 mr-3" />}
                {loading ? 'SYNCING...' : 'COMMIT OVERRIDE'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] bg-white">
            <CardHeader className="bg-muted/30 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <CardTitle className="text-2xl font-black uppercase tracking-tight">Absence Ledger</CardTitle>
              <div className="relative w-full max-w-md">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search Identity..." className="pl-12 h-12 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[280px] pl-10 py-6 uppercase text-[10px] font-black tracking-[0.4em]">Professional</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-[0.4em]">Duration</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-[0.4em] text-center">Status</TableHead>
                    <TableHead className="text-right pr-10 py-6 uppercase text-[10px] font-black tracking-[0.4em]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leavesLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={4} className="py-8 px-10"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredLeaves?.map((l) => {
                    const emp = employees?.find(e => e.id === l.employeeId);
                    return (
                      <TableRow key={l.id} className="hover:bg-slate-50">
                        <TableCell className="pl-10 py-6">
                           <div className="flex flex-col">
                              <span className="font-black text-[14px] uppercase">{emp?.fullName || l.employeeId}</span>
                              <span className="text-[10px] text-muted-foreground font-bold">{l.employeeId}</span>
                           </div>
                        </TableCell>
                        <TableCell className="py-6 font-black text-[12px] tabular-nums">{l.startDate} — {l.endDate}</TableCell>
                        <TableCell className="py-6 text-center">
                           <Badge variant="outline" className={cn("uppercase text-[9px] font-black px-3", l.status === 'approved' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50')}>
                              {l.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-10 py-6">
                           <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(l.id)}>
                              <Trash2 className="size-5" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
