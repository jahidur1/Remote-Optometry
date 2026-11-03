
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  UserPlus, 
  Filter, 
  MoreVertical, 
  Edit2, 
  ShieldAlert, 
  Building2, 
  Users, 
  Activity, 
  Zap, 
  ShieldCheck, 
  Database,
  CheckCircle2,
  Loader2,
  Lock,
  Terminal,
  Server
} from "lucide-react";
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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';

export default function EmployeeManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const firestore = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  const employeesQuery = useMemo(() => query(
    collection(firestore, 'employees'),
    orderBy('fullName', 'asc')
  ), [firestore]);

  const { data: employees, loading } = useCollection(employeesQuery);

  const filteredEmployees = useMemo(() => 
    employees?.filter(emp => 
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.office?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  , [employees, searchTerm]);

  const stats = useMemo(() => ({
    active: employees?.filter(e => e.status === 'Active').length || 0,
    offices: new Set(employees?.map(e => e.office)).size || 0,
    syncIntegrity: 100
  }), [employees]);

  const handleEdit = (employee: any) => {
    setSelectedEmployee(employee);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedEmployee(null);
    setIsDialogOpen(true);
  };

  const toggleStatus = async (employee: any) => {
    if (!profile) return;
    const newStatus = employee.status === 'Active' ? 'Suspended' : 'Active';
    
    setProcessingId(employee.id);
    try {
      const empRef = doc(firestore, 'employees', employee.id);
      await updateDoc(empRef, { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
      
      logAudit(firestore, profile.uid, `ADMIN_${newStatus.toUpperCase()}_EMPLOYEE`, employee.id);
      toast({ 
        title: `Protocol Updated`, 
        description: `${employee.fullName} status set to ${newStatus} in registry.` 
      });
    } catch (e: any) {
      toast({ title: "Registry Error", description: e.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* Institutional Header Pulse */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Users className="size-8 text-secondary fill-secondary/20" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Registry Node</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Directory <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 border-r border-white/5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Protocol Status</label>
              <div className="flex items-center gap-2">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">AUTHORIZED ACCESS</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Registry Sync</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-white uppercase tracking-widest text-[11px]">ACTIVE PULSE</span>
              </div>
           </div>
           <Button 
             className="bg-secondary text-white shadow-xl shadow-secondary/20 h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 active:scale-95 rounded-xl group" 
             onClick={handleAdd}
           >
            <UserPlus className="size-4 mr-2 group-hover:rotate-12 transition-transform" />
            PROVISION PROFILE
           </Button>
        </div>
      </div>

      {/* KPI Ledger */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Authorized Pool', value: stats.active, sub: 'Active Personnel', icon: Users, color: 'text-primary' },
          { label: 'Cluster Distribution', value: stats.offices, sub: 'ROC Units Engaged', icon: Building2, color: 'text-secondary' },
          { label: 'Sync Pulse', value: `${stats.syncIntegrity}%`, sub: 'Registry Integrity', icon: Database, color: 'text-accent' },
          { label: 'Security Mode', value: 'Z-TRUST', sub: 'IAM OIDC Policy', icon: ShieldCheck, color: 'text-white' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /> : (
                <>
                  <div className="text-5xl font-black text-white tracking-tighter">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Staff Ledger */}
      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
        <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
               <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                  <ShieldCheck className="size-8 text-secondary" />
               </div>
               <div className="space-y-1">
                  <CardTitle className="text-2xl uppercase font-black tracking-tight text-white leading-none">Clinical Staff Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                     Verified professional identities within the institutional cloud.
                  </CardDescription>
               </div>
            </div>
            <div className="flex gap-4 w-full max-w-xl">
              <div className="relative w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-white/20 group-focus-within:text-secondary transition-colors" />
                <Input 
                  placeholder="Search Identity, Designation, or Node..." 
                  className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white/[0.02] border-2 border-white/10 rounded-2xl focus:border-secondary focus:bg-secondary/5 transition-all shadow-inner text-white placeholder:text-white/10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="h-14 w-14 shrink-0 border-2 border-white/10 rounded-2xl hover:bg-secondary/20 hover:border-secondary transition-all">
                <Filter className="size-5 text-white/40" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <Table className="border-collapse">
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-b border-white/5">
                <TableHead className="w-[200px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">ID Node</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Clinical Identity</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">ROC Cluster</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Metadata</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Status Pulse</TableHead>
                <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-b border-white/5"><TableCell colSpan={6} className="py-10 px-10"><Skeleton className="h-12 w-full rounded-2xl opacity-10 bg-white" /></TableCell></TableRow>
                ))
              ) : filteredEmployees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-40 text-center">
                    <p className="text-white/10 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No matching identity records found in cluster.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees?.map((employee) => (
                  <TableRow key={employee.id} className={cn(
                    "hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0",
                    employee.status !== 'Active' && "opacity-40 grayscale"
                  )}>
                    <TableCell className="pl-10 py-8 border-r border-white/5">
                      <code className="text-secondary font-black text-[13px] bg-secondary/10 px-4 py-1.5 rounded-lg border border-secondary/20 shadow-inner group-hover:scale-105 inline-block transition-transform tabular-nums">
                        {employee.id}
                      </code>
                    </TableCell>
                    <TableCell className="py-8 border-r border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-[16px] text-white tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{employee.fullName}</span>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-white/10 text-white/40 bg-white/5 px-2 py-0.5 rounded-md">
                            {employee.designation || 'STAFF'}
                          </Badge>
                          <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{employee.role}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-secondary/20 transition-all">
                          <Building2 className="size-4 text-secondary" />
                        </div>
                        <span className="text-[12px] font-black uppercase text-white/80 tracking-widest">{employee.office?.replace('_', ' ') || 'UNASSIGNED'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-white/5">
                       <div className="flex items-center gap-6">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Node</span>
                             <span className="text-[11px] font-black text-white/70 uppercase">{employee.gender?.substring(0,1)} / {employee.age || '--'}</span>
                          </div>
                          <div className="w-px h-8 bg-white/5" />
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Contact</span>
                             <span className="text-[11px] font-black text-white/70 tabular-nums">+{employee.whatsappNumber?.replace(/\D/g, '').slice(-10)}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-white/5 text-center">
                      <div className="flex flex-col items-center">
                        {processingId === employee.id ? (
                           <Loader2 className="size-4 animate-spin text-secondary" />
                        ) : (
                          <Badge 
                            className={cn(
                              "font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full border-none shadow-2xl transition-all",
                              employee.status === 'Active' 
                                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                                : 'bg-destructive text-white shadow-destructive/20'
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
                          <Button variant="ghost" size="icon" className="size-10 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10">
                            <MoreVertical className="h-5 w-5 text-white/40" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-2xl border-none bg-slate-900/95 backdrop-blur-xl p-2 animate-in zoom-in-95">
                          <DropdownMenuItem className="h-12 font-black uppercase text-[10px] tracking-[0.2em] rounded-xl focus:bg-secondary focus:text-white" onClick={() => handleEdit(employee)}>
                            <Edit2 className="mr-3 h-4 w-4" /> Edit Audit Trail
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem 
                            className={cn(
                              "h-12 font-black uppercase text-[10px] tracking-[0.2em] rounded-xl focus:text-white",
                              employee.status === 'Active' ? "text-destructive focus:bg-destructive" : "text-emerald-500 focus:bg-emerald-500"
                            )}
                            onClick={() => toggleStatus(employee)}
                          >
                            {employee.status === 'Active' ? (
                              <><ShieldAlert className="mr-3 h-4 w-4" /> Suspend Auth Node</>
                            ) : (
                              <><CheckCircle2 className="mr-3 h-4 w-4" /> Reactivate Profile</>
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

      {/* Institutional Protocol Matrix */}
      <div className="grid md:grid-cols-2 gap-8">
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-110 transition-transform duration-[2s] opacity-[0.03] pointer-events-none">
               <Server size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-inner">
                    <Terminal className="size-8 text-secondary" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Registry Protocol</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Professional identity records are immutably linked to the clinical cluster pulse. Every provisioning action is audited 
                    and logged to ensure complete traceability within the workforce management lifecycle.
                  </p>
                </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden p-12 space-y-10 group border-l-4 border-l-secondary shadow-2xl relative">
             <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
                <ShieldCheck size={200} />
             </div>
             <div className="space-y-4">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                   <Lock className="size-8" />
                </div>
                <div className="space-y-1">
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Operational Pulse</p>
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Sync Intelligence</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 The CP-SAT engine utilizes this directory to calculate clinical eligibility. Personnel marked as 'Suspended' or 'Inactive' 
                 are automatically excluded from the optimization matrix to prevent invalid assignments.
               </p>
               <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                  <Zap className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Deterministic Node Control Active</p>
               </div>
             </div>
          </Card>
      </div>

      <EmployeeDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        employee={selectedEmployee} 
      />
    </div>
  );
}

