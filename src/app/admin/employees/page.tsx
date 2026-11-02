
'use client';

import { useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Filter, MoreVertical, Edit2, ShieldAlert, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDialog } from '@/components/admin/employee-dialog';
import { DemoBadge } from '@/components/ui/demo-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function EmployeeManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  const firestore = useFirestore();

  const employeesQuery = query(
    collection(firestore, 'employees'),
    orderBy('fullName', 'asc')
  );

  const { data: employees, loading } = useCollection(employeesQuery);

  const filteredEmployees = employees?.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.office?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (employee: any) => {
    setSelectedEmployee(employee);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedEmployee(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Professional Directory</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Manage clinical identities and institutional access across all ROC clusters.</p>
        </div>
        <Button className="bg-secondary h-11 px-8 font-black uppercase tracking-widest shadow-lg shadow-secondary/10" onClick={handleAdd}>
          <UserPlus className="mr-3 h-5 w-5" /> Provision Profile
        </Button>
      </div>

      <Card className="shadow-xl border-none overflow-hidden rounded-[1.5rem]">
        <CardHeader className="bg-muted/10 border-b p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-black uppercase tracking-tight">Clinical Staff Ledger</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest">Global Workforce: {employees?.length || 0} Registered</CardDescription>
            </div>
            <div className="flex gap-2 w-full max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, ID, or clinical office..." 
                  className="pl-10 h-10 font-bold bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 border-2">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30 border-b">
                <TableRow className="text-[10px] font-black uppercase tracking-widest">
                  <TableHead className="w-[120px] pl-6">Professional ID</TableHead>
                  <TableHead>Clinical Identity</TableHead>
                  <TableHead>Location Cluster</TableHead>
                  <TableHead>Profile Info</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Management</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="py-6"><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic font-medium uppercase text-xs tracking-widest">
                      No matching clinical records found in the directory.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees?.map((employee) => (
                    <TableRow key={employee.id} className="group hover:bg-muted/10 transition-colors border-b last:border-0">
                      <TableCell className="pl-6 font-mono text-xs font-black text-secondary uppercase">
                        {employee.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-black text-[13px] text-primary tracking-tight">{employee.fullName}</span>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{employee.designation || 'Staff'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3 text-secondary" />
                          <span className="text-[11px] font-black uppercase text-foreground/80 tracking-tight">{employee.office || 'UNASSIGNED'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col gap-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                            <span>AGE: {employee.age || '—'}</span>
                            <span>{employee.gender}</span>
                         </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={employee.status === 'Active' ? 'default' : 'destructive'} 
                          className={employee.status === 'Active' ? 'bg-emerald-500 font-black text-[9px] uppercase px-3' : 'font-black text-[9px] uppercase px-3'}
                        >
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-2xl border-none p-1">
                            <DropdownMenuItem className="h-10 font-bold uppercase text-[10px] tracking-widest rounded-lg" onClick={() => handleEdit(employee)}>
                              <Edit2 className="mr-3 h-4 w-4" /> Edit Registry
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="h-10 font-bold uppercase text-[10px] tracking-widest rounded-lg text-destructive focus:text-destructive">
                              <ShieldAlert className="mr-3 h-4 w-4" /> Revoke All Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
