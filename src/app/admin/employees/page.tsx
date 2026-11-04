
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useAuth } from '@/firebase';
import { useOffice } from '@/context/office-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Edit2, 
  ShieldAlert, 
  Users, 
  Activity, 
  CheckCircle2, 
  Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDialog } from '@/components/admin/employee-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { updateAccountStatusAction } from '@/services/identity-actions';
import Link from 'next/link';

export default function UserDetailsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const firestore = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { selectedOffice } = useOffice();
  const { toast } = useToast();

  const employeesQuery = useMemo(() => {
    if (!profile) return null;
    const empsRef = collection(firestore, 'employees');
    
    // Super Admin retrieves the entire global clinical registry
    if (profile.role === 'super_admin') {
      return query(empsRef, orderBy('fullName', 'asc'));
    }
    
    // Cluster Admin is scoped to their authorized center
    if (!selectedOffice) return null;
    return query(
      empsRef,
      where('office', '==', selectedOffice),
      orderBy('fullName', 'asc')
    );
  }, [firestore, profile, selectedOffice]);

  const { data: employees, loading } = useCollection(employeesQuery);

  const filteredEmployees = useMemo(() => 
    employees?.filter(emp => 
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  , [employees, searchTerm]);

  const handleEdit = (employee: any) => {
    setSelectedEmployee(employee);
    setIsDialogOpen(true);
  };

  const toggleStatus = async (employee: any) => {
    const newStatus = employee.status === 'Active' ? 'Suspended' : 'Active';
    setProcessingId(employee.id);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const result = await updateAccountStatusAction(idToken, employee.id, newStatus);
      if (result.success) {
        toast({ title: `Protocol Updated`, description: `${employee.fullName} status set to ${newStatus}.` });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ title: "Registry Error", description: e.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Users className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">User Details</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Professionals <Activity className="size-3 text-secondary animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <Link href="/register">
             <Button className="bg-primary text-white shadow-xl shadow-primary/20 h-14 px-10 font-black uppercase text-[11px] tracking-[0.2em] transition-all hover:scale-105 active:scale-95 rounded-2xl group">
              <UserPlus className="size-5 mr-3 group-hover:rotate-12 transition-transform" />
              PROVISION PROFILE
             </Button>
           </Link>
        </div>
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex gap-4 w-full max-wxl">
              <div className="relative w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Search Identity or Designation..." 
                  className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-primary transition-all text-black"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Badge variant="outline" className="px-6 py-2 rounded-xl font-black text-[10px] uppercase border-secondary/20 text-secondary bg-secondary/5 shadow-inner">
               Authorized Count: {employees?.length || 0}
            </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <Table className="border-collapse">
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-b border-slate-100">
                <TableHead className="w-[200px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">ID Trace</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Clinical Identity</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Status Pulse</TableHead>
                <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100"><TableCell colSpan={4} className="py-10 px-10"><Skeleton className="h-12 w-full rounded-2xl opacity-10 bg-slate-200" /></TableCell></TableRow>
                ))
              ) : filteredEmployees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-40 text-center">
                    <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] italic">No authorized records found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees?.map((employee) => (
                  <TableRow key={employee.id} className={cn(
                    "hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0",
                    employee.status !== 'Active' && "opacity-40 grayscale"
                  )}>
                    <TableCell className="pl-10 py-8 border-r border-slate-100">
                      <code className="text-secondary font-black text-[13px] bg-secondary/5 px-4 py-1.5 rounded-lg border border-secondary/20 shadow-inner group-hover:scale-105 inline-block transition-transform tabular-nums">
                        {employee.id}
                      </code>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100">
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-[16px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{employee.fullName}</span>
                        <div className="flex items-center gap-2 mt-1.5">
                           <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{employee.designation || 'STAFF'}</span>
                           <span className="text-[9px] text-primary/30 font-black uppercase">•</span>
                           <span className="text-[9px] text-secondary font-black uppercase tracking-widest">{employee.role.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100 text-center">
                      <div className="flex flex-col items-center">
                        {processingId === employee.id ? (
                           <Loader2 className="size-4 animate-spin text-secondary" />
                        ) : (
                          <Badge 
                            className={cn(
                              "font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full border-none shadow-xl transition-all",
                              employee.status === 'Active' ? 'bg-emerald-500 text-white' : 'bg-destructive text-white'
                            )}
                          >
                            {employee.status}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-10 py-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-10 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                            <MoreVertical className="h-5 w-5 text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-2xl border border-slate-100 bg-white p-2 animate-in zoom-in-95">
                          <DropdownMenuItem className="h-12 font-black uppercase text-[10px] tracking-[0.2em] rounded-xl focus:bg-primary focus:text-white cursor-pointer" onClick={() => handleEdit(employee)}>
                            <Edit2 className="mr-3 h-4 w-4" /> Edit User Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-50" />
                          <DropdownMenuItem 
                            className={cn(
                              "h-12 font-black uppercase text-[10px] tracking-[0.2em] rounded-xl focus:text-white cursor-pointer",
                              employee.status === 'Active' ? "text-destructive focus:bg-destructive" : "text-emerald-500 focus:bg-emerald-500"
                            )}
                            onClick={() => toggleStatus(employee)}
                          >
                            {employee.status === 'Active' ? (
                              <><ShieldAlert className="mr-3 h-4 w-4" /> Suspend Account</>
                            ) : (
                              <><CheckCircle2 className="mr-3 h-4 w-4" /> Reactivate</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EmployeeDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        employee={selectedEmployee} 
      />
    </div>
  );
}
