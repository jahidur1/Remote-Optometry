
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, doc, setDoc, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Search, Target, Info, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { DemoBadge } from '@/components/ui/demo-badge';

export default function ShiftAdjacencyManager() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [weekId, setWeekId] = useState('2024-52');
  const [saving, setSaving] = useState<string | null>(null);

  // Fetch core data - Scoped to office
  const empQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employees');
    return profile.role === 'super_admin' 
      ? query(q, where('status', '==', 'Active'), orderBy('fullName', 'asc'))
      : query(q, where('office', '==', profile.office), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, profile]);

  const rulesQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'shift_adjacency_rules');
    const base = profile.role === 'super_admin'
      ? query(q, where('weekId', '==', weekId))
      : query(q, where('weekId', '==', weekId), where('office', '==', profile.office));
    return base;
  }, [db, profile, weekId]);

  const bookingsQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'weekoff_bookings');
    return profile.role === 'super_admin'
      ? query(q, where('weekId', '==', weekId))
      : query(q, where('weekId', '==', weekId), where('office', '==', profile.office));
  }, [db, profile, weekId]);

  const shiftsQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: shifts } = useCollection(shiftsQuery);
  const { data: rules } = useCollection(rulesQuery);
  const { data: bookings } = useCollection(bookingsQuery);

  const filteredEmployees = employees?.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateRule = async (employeeId: string, type: 'pre' | 'post', shiftId: string, checked: boolean) => {
    const emp = employees?.find(e => e.id === employeeId);
    if (!emp) return;

    const ruleId = `${weekId}_${employeeId}`;
    const existingRule = rules?.find(r => r.id === ruleId) || {
      id: ruleId,
      employeeId,
      weekId,
      office: emp.office,
      allowedPreOffShifts: [],
      allowedPostOffShifts: []
    };

    let updatedList = type === 'pre' ? [...existingRule.allowedPreOffShifts] : [...existingRule.allowedPostOffShifts];
    
    if (checked) {
      if (!updatedList.includes(shiftId)) updatedList.push(shiftId);
    } else {
      updatedList = updatedList.filter(id => id !== shiftId);
    }

    const payload = {
      ...existingRule,
      office: emp.office,
      [type === 'pre' ? 'allowedPreOffShifts' : 'allowedPostOffShifts']: updatedList,
      updatedAt: new Date().toISOString()
    };

    setSaving(employeeId);
    try {
      await setDoc(doc(db, 'shift_adjacency_rules', ruleId), payload);
      logAudit(db, profile?.uid || 'system', 'UPDATE_ADJACENCY_RULE', employeeId, { type, shiftId, checked, office: emp.office });
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase leading-none">Shift Adjacency Control</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium mt-2">Restrict shift types before and after a clinical week-off for {profile?.office?.replace('_', ' ') || 'authorized cluster'}.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Target Cycle</label>
             <Input 
               className="w-32 h-10 font-black text-secondary bg-white border-2 border-secondary/20" 
               value={weekId} 
               onChange={(e) => setWeekId(e.target.value)}
             />
           </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-primary text-primary-foreground md:col-span-1 shadow-xl rounded-2xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-4 opacity-5">
                <Target size={120} />
             </div>
             <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-secondary">Policy: Distribution Fairness</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <p className="text-[12px] leading-relaxed opacity-80">
                  Opening (OP) and Super Opening (SO) shifts are in high demand. Use this panel to rotate eligibility.
                </p>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                   <div className="flex items-center gap-2">
                      <ShieldCheck className="size-3 text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white">Solver Enforced</span>
                   </div>
                   <p className="text-[10px] opacity-60">The CP-SAT engine will block any assignment not selected in this matrix.</p>
                </div>
             </CardContent>
          </Card>
          
          <Card className="md:col-span-3 shadow-md">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-2">
                    <Search className="size-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search professionals..." 
                        className="h-9 w-64 text-[11px] font-bold bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5">
                        {employees?.length || 0} Professionals
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="text-[10px] font-black uppercase tracking-widest">
                    <TableHead className="w-[200px]">Professional</TableHead>
                    <TableHead>Week-Off</TableHead>
                    <TableHead className="text-center">Pre-Off Eligibility</TableHead>
                    <TableHead className="text-center">Post-Off Eligibility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={4}><Loader2 className="animate-spin mx-auto size-4 opacity-20" /></TableCell></TableRow>
                    ))
                  ) : filteredEmployees?.map(emp => {
                    const booking = bookings?.find(b => b.employeeId === emp.id);
                    const rule = rules?.find(r => r.employeeId === emp.id);
                    
                    return (
                      <TableRow key={emp.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 group">
                        <TableCell>
                           <div className="flex flex-col">
                              <span className="font-black text-[13px] tracking-tight text-primary">{emp.fullName}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{emp.id}</span>
                           </div>
                        </TableCell>
                        <TableCell>
                           {booking ? (
                             <Badge className="bg-secondary text-[10px] font-black">{booking.dayOfWeek.substring(0,3)}</Badge>
                           ) : (
                             <span className="text-[10px] font-black text-destructive/40 italic">UNSET</span>
                           )}
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-wrap justify-center gap-2">
                              {shifts?.map(s => {
                                const isChecked = rule?.allowedPreOffShifts?.includes(s.id);
                                return (
                                  <div key={s.id} className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all ${isChecked ? 'bg-secondary/5 border-secondary/20' : 'opacity-40 grayscale'}`}>
                                     <Checkbox 
                                        id={`pre-${emp.id}-${s.id}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => handleUpdateRule(emp.id, 'pre', s.id, !!checked)}
                                     />
                                     <label htmlFor={`pre-${emp.id}-${s.id}`} className="text-[9px] font-black cursor-pointer">{s.id}</label>
                                  </div>
                                );
                              })}
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-wrap justify-center gap-2">
                              {shifts?.map(s => {
                                const isChecked = rule?.allowedPostOffShifts?.includes(s.id);
                                return (
                                  <div key={s.id} className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all ${isChecked ? 'bg-accent/5 border-accent/20' : 'opacity-40 grayscale'}`}>
                                     <Checkbox 
                                        id={`post-${emp.id}-${s.id}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => handleUpdateRule(emp.id, 'post', s.id, !!checked)}
                                     />
                                     <label htmlFor={`post-${emp.id}-${s.id}`} className="text-[9px] font-black cursor-pointer">{s.id}</label>
                                  </div>
                                );
                              })}
                           </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
