
'use client';

import { useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Filter, MoreVertical, Edit2, ShieldAlert } from "lucide-react";
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Workforce Directory</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground">Manage optometry professionals and clinical support staff.</p>
        </div>
        <Button className="bg-secondary" onClick={handleAdd}>
          <UserPlus className="mr-2 h-4 w-4" /> Provision Employee
        </Button>
      </div>

      <Card className="shadow-md">
        <CardHeader className="pb-2 border-b">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Staff Records</CardTitle>
              <CardDescription>Total Managed: {employees?.length || 0}</CardDescription>
            </div>
            <div className="flex gap-2 w-full max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter by name, ID, email or department..." 
                  className="pl-8 bg-muted/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[120px]">Employee ID</TableHead>
                  <TableHead>Professional Profile</TableHead>
                  <TableHead>Org Unit</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                      No matching employee records found in the directory.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees?.map((employee) => (
                    <TableRow key={employee.id} className="group hover:bg-muted/20 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-secondary">
                        {employee.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{employee.fullName}</span>
                          <span className="text-xs text-muted-foreground font-medium">{employee.email}</span>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-accent mt-0.5">{employee.role}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{employee.department || '—'}</span>
                          <span className="text-[10px] text-muted-foreground">{employee.designation || 'Unassigned'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {employee.gender}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={employee.status === 'Active' ? 'default' : 'destructive'} 
                          className={employee.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20' : ''}
                        >
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {employee.joinedAt ? new Date(employee.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleEdit(employee)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive font-medium">
                              <ShieldAlert className="mr-2 h-4 w-4" /> Suspend Access
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
