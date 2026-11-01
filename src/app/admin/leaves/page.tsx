
'use client';

import { useState } from 'react';
import { collection, query, orderBy, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaneTakeoff, Plus, CheckCircle2, XCircle, Search, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from "@/components/ui/skeleton";

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
        status: 'approved', // Admin direct entry is auto-approved
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

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this unavailability record? This will restore shift eligibility.')) return;
    try {
      await deleteDoc(doc(db, 'employee_leaves', id));
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
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Clinical Unavailability</h1>
          <p className="text-muted-foreground">Manage approved leave, training sessions, and system-mandated off-time.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 shadow-md border-t-4 border-t-secondary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-secondary" />
              <CardTitle>Record Absence</CardTitle>
            </div>
            <CardDescription>Manually override availability for specific employees.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select onValueChange={(val) => setNewLeave({ ...newLeave, employeeId: val })} value={newLeave.employeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Professional" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.fullName} ({e.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={newLeave.startDate} onChange={e => setNewLeave({ ...newLeave, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={newLeave.endDate} onChange={e => setNewLeave({ ...newLeave, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unavailability Type</Label>
              <Select onValueChange={(val) => setNewLeave({ ...newLeave, type: val })} value={newLeave.type}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leave">Clinical Leave</SelectItem>
                  <SelectItem value="training">Technical Training</SelectItem>
                  <SelectItem value="other">Other Unavailability</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason / Documentation</Label>
              <Input placeholder="Optional details..." value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} />
            </div>
            <Button className="w-full bg-secondary" onClick={handleAddLeave} disabled={loading}>
              Confirm Availability Override
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlaneTakeoff className="h-5 w-5 text-accent" />
                <CardTitle>Absence Logs</CardTitle>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter by name or ID..." 
                  className="pl-8" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Professional</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leavesLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredLeaves?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                      No active absence records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeaves?.map(l => {
                    const emp = employees?.find(e => e.id === l.employeeId);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{emp?.fullName || l.employeeId}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{l.reason || 'No details'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.startDate} — {l.endDate}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold">{l.type}</Badge>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase">
                              <CheckCircle2 className="size-3" /> Approved
                           </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
