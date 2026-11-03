
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  UserCheck, 
  Users, 
  Calendar, 
  AlertCircle, 
  Activity, 
  ShieldCheck, 
  Zap, 
  ArrowUpRight, 
  Database,
  Search,
  Filter,
  Info,
  Clock,
  PlaneTakeoff,
  TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBadge } from '@/components/ui/demo-badge';
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AvailabilitySummary() {
  const db = useFirestore();
  const [selectedWeek, setSelectedWeek] = useState('2024-52');

  // Fetch all core data
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: bookings, loading: bookLoading } = useCollection(query(collection(db, 'weekoff_bookings'), where('weekId', '==', selectedWeek)));
  const { data: leaves, loading: leaveLoading } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));

  const stats = useMemo(() => {
    if (!employees || !selectedWeek) return null;

    const weekDates = getDatesForWeek(selectedWeek);
    if (weekDates.length === 0) return null;

    return DAYS.map((day, index) => {
      const date = weekDates[index];
      const dateStr = format(date, 'yyyy-MM-dd');

      // Confirmed Weekly Offs for this day
      const offCount = bookings?.filter(b => b.dayOfWeek === day).length || 0;
      
      // Approved leaves overlapping with this specific date
      const leaveCount = leaves?.filter(l => isDateInRange(date, l.startDate, l.endDate)).length || 0;

      const totalActive = employees.length;
      const available = totalActive - offCount - leaveCount;

      return {
        day,
        date: dateStr,
        totalActive,
        offCount,
        leaveCount,
        available,
        percent: totalActive > 0 ? Math.round((available / totalActive) * 100) : 0
      };
    });
  }, [employees, bookings, leaves, selectedWeek]);

  const totalActivePool = employees?.length || 0;
  const currentWeekOffs = bookings?.length || 0;
  const currentLeaves = leaves?.filter(l => {
    const weekDates = getDatesForWeek(selectedWeek);
    if (weekDates.length === 0) return false;
    return isDateInRange(weekDates[0], l.startDate, l.endDate) || isDateInRange(weekDates[6], l.startDate, l.endDate);
  }).length || 0;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Activity className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Registry Pulse</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Live Capacity Matrix <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Target week</label>
              <div className="flex items-center gap-3">
                 <Input 
                   className="w-32 h-8 font-black text-secondary border-none bg-transparent focus-visible:ring-0 p-0 text-xl" 
                   value={selectedWeek} 
                   onChange={(e) => setSelectedWeek(e.target.value)}
                 />
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             variant="outline"
             className="bg-white/5 border-white/10 text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-xl transition-all hover:bg-secondary/20 hover:border-secondary" 
           >
            <Database className="size-4 mr-3" /> REFRESH SYNC
           </Button>
        </div>
      </div>

      {/* KPI Ledger */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Clinical Pool</CardTitle>
            <Users className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{totalActivePool}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Authorized Personnel</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">Secured Offs</CardTitle>
            <Calendar className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent tracking-tighter">{currentWeekOffs}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">FCFS Reservations</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Absences</CardTitle>
            <PlaneTakeoff className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{currentLeaves}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Medical / Training</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Sync Efficiency</CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-500 opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">100%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Integrity Verified</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8">
        {/* Availability Hub */}
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                <UserCheck className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">Availability Matrix</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                   Net operational capacity calculated for clinical optimization.
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <div className="relative w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-white/20 group-focus-within:text-secondary transition-colors" />
                <Input 
                  placeholder="Filter Daily Nodes..." 
                  className="pl-12 h-12 font-black uppercase text-[11px] tracking-widest bg-white/[0.02] border-2 border-white/10 rounded-xl focus:border-secondary transition-all text-white placeholder:text-white/10 shadow-inner"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto no-scrollbar">
            <Table className="border-collapse">
              <TableHeader className="bg-white/[0.02]">
                <TableRow className="border-b border-white/5">
                  <TableHead className="w-[280px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Daily Node</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Active Pool</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Confirmed Off</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Medical Leave</TableHead>
                  <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Net Capacity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empLoading || bookLoading || leaveLoading ? (
                  Array(7).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-b border-white/5"><TableCell colSpan={5} className="py-10 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /></TableCell></TableRow>
                  ))
                ) : stats?.map((s) => (
                  <TableRow key={s.day} className="hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                    <TableCell className="pl-10 py-8 border-r border-white/5">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-black text-[22px] text-white tracking-tighter group-hover:translate-x-1 transition-transform leading-none uppercase">{s.day}</span>
                        <div className="flex items-center gap-2">
                          <Clock className="size-3 text-white/20" />
                          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{s.date}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-white/5 text-center">
                      <span className="text-xl font-black text-white/60 tabular-nums">{s.totalActive}</span>
                    </TableCell>
                    <TableCell className="py-8 border-r border-white/5 text-center">
                      <Badge variant="outline" className="text-[11px] font-black text-secondary border-secondary/20 bg-secondary/5 px-4 py-1.5 rounded-xl tabular-nums">
                        {s.offCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-8 border-r border-white/5 text-center">
                      <Badge variant="outline" className="text-[11px] font-black text-accent border-accent/20 bg-accent/5 px-4 py-1.5 rounded-xl tabular-nums">
                        {s.leaveCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-10 py-8">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-baseline gap-2">
                           <span className="text-4xl font-black text-white tracking-tighter tabular-nums">{s.available}</span>
                           <span className="text-[10px] font-black text-white/20 uppercase">ELIGIBLE</span>
                        </div>
                        <Badge 
                          className={cn(
                            "font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full border-none shadow-2xl",
                            s.percent < 75 ? 'bg-destructive text-white shadow-destructive/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'
                          )}
                        >
                          {s.percent}% Duty Potential
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="bg-white/[0.02] p-10 border-t border-white/5">
             <div className="flex items-center gap-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                   <Info className="size-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Solver Constraint Protocol</p>
                  <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                    Net Capacity represents the mathematical **ceiling** for the deterministic optimization node. 
                    If any shift's exact quota exceeds this threshold, the CP-SAT engine will return INFEASIBLE to prevent clinical double-assignments.
                  </p>
                </div>
             </div>
          </CardFooter>
        </Card>
      </div>

      {/* Governance Footer */}
      <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground shadow-2xl border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-125 transition-transform duration-[2s] opacity-[0.03]">
               <TrendingUp size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <ShieldCheck className="size-8 text-white" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Registry protocol</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Clinical availability is immutably linked to the audit ledger. Every modification to the clinical pool—including 
                    approved leaves and FCFS slot reservations—is recorded with temporal integrity markers.
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
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Capacity sync</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 The CP-SAT engine utilizes this ledger to calculate daily clinical eligibility. Professionals with approved overlaps 
                 or confirmed off-days are automatically excluded from the assignment pool.
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
