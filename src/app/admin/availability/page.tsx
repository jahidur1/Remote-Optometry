'use client';

import { useState, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Database,
  Search,
  Filter,
  Info,
  Clock,
  PlaneTakeoff,
  TrendingUp,
  CalendarDays
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

  // Stable Authoritative Fetch
  const empQuery = useMemo(() => query(collection(db, 'employees'), where('status', '==', 'Active')), [db]);
  const bookQuery = useMemo(() => query(collection(db, 'weekoff_bookings'), where('weekId', '==', selectedWeek)), [db, selectedWeek]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: bookings, loading: bookLoading } = useCollection(bookQuery);

  const stats = useMemo(() => {
    if (!employees || !selectedWeek) return null;

    const weekDates = getDatesForWeek(selectedWeek);
    if (weekDates.length === 0) return null;

    return DAYS.map((day, index) => {
      const date = weekDates[index];
      const dateStr = format(date, 'yyyy-MM-dd');

      // Confirmed Weekly Offs for this day
      const offCount = bookings?.filter(b => b.dayOfWeek === day).length || 0;
      
      const totalActive = employees.length;
      const available = totalActive - offCount;

      return {
        day,
        date: dateStr,
        totalActive,
        offCount,
        available,
        percent: totalActive > 0 ? Math.round((available / totalActive) * 100) : 0
      };
    });
  }, [employees, bookings, selectedWeek]);

  const totalActivePool = employees?.length || 0;
  const currentWeekOffs = bookings?.length || 0;

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* Institutional Pulse Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Activity className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Registry Pulse</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Live Capacity Matrix <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <div className="flex items-center gap-2">
                 <Input 
                   className="w-24 h-6 font-black text-black border-none bg-transparent focus-visible:ring-0 p-0 text-[16px]" 
                   value={selectedWeek} 
                   onChange={(e) => setSelectedWeek(e.target.value)}
                 />
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Node</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
        </div>
      </div>

      {/* Primary KPI Matrix */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Authorized Pool', value: totalActivePool, sub: 'Personnel Active', icon: Users, color: 'text-primary' },
          { label: 'Secured Offs', value: currentWeekOffs, sub: 'FCFS Reservations', icon: CalendarDays, color: 'text-secondary' },
          { label: 'Sync Efficiency', value: '100%', sub: 'Integrity Verified', icon: ShieldCheck, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {empLoading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /> : (
                <>
                  <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
              <TrendingUp className="size-8 text-secondary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-black leading-none">Availability Matrix</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                 Net operational capacity calculated for CP-SAT optimization.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <Table className="border-collapse">
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-b border-slate-100">
                <TableHead className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Daily Clinical Node</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Active Pool</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Confirmed Off</TableHead>
                <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Net Capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empLoading || bookLoading ? (
                Array(7).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100"><TableCell colSpan={4} className="py-12 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></TableCell></TableRow>
                ))
              ) : stats?.map((s) => (
                <TableRow key={s.day} className="hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0">
                  <TableCell className="pl-10 py-8 border-r border-slate-100">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-black text-[24px] text-black tracking-tighter group-hover:translate-x-1 transition-transform leading-none uppercase">{s.day}</span>
                      <div className="flex items-center gap-2">
                        <Clock className="size-3 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.date}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-8 border-r border-slate-100 text-center">
                    <span className="text-xl font-black text-black/60 tabular-nums">{s.totalActive}</span>
                  </TableCell>
                  <TableCell className="py-8 border-r border-slate-100 text-center">
                    <Badge variant="outline" className="text-[11px] font-black text-secondary border-secondary/20 bg-secondary/5 px-4 py-1.5 rounded-xl tabular-nums">
                      {s.offCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-10 py-8">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-baseline gap-2">
                         <span className={cn(
                           "text-4xl font-black tabular-nums transition-all duration-500",
                           s.available > 0 ? "text-black" : "text-destructive"
                         )}>{s.available}</span>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ELIGIBLE</span>
                      </div>
                      <Badge 
                        className={cn(
                          "font-black text-[9px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border-none shadow-xl",
                          s.percent < 70 ? 'bg-destructive text-white' : 'bg-emerald-500 text-white'
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
      </Card>

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><ShieldCheck size={280} className="text-primary" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Institutional Guard node</p>
               <p className="text-lg font-bold text-black/80 leading-relaxed max-w-4xl tracking-tight">
                  "Availability calculations serve as the mathematical **ceiling** for the CP-SAT optimization node. 
                  Any staffing quota exceeding this threshold will trigger an INFEASIBLE state to prevent clinical 
                  double-assignments and protect professional off-time integrity."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}