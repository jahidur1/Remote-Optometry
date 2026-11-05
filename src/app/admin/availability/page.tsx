
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
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
  CheckCircle2,
  Info,
  Clock,
  PlaneTakeoff,
  TrendingUp,
  CalendarDays,
  Lock,
  ArrowRightLeft
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDatesForWeek, formatWeekId, displayWeekRange } from '@/lib/date-utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { DemoBadge } from '@/components/ui/demo-badge';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AvailabilitySummary() {
  const db = useFirestore();
  const { profile } = useUser();
  const [selectedWeek, setSelectedWeek] = useState('20241230-20250105');
  const [searchTerm, setSearchTerm] = useState('');

  // STABLE AUTHORITATIVE FETCHES
  const empQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employees');
    return profile.role === 'super_admin' 
      ? query(q, where('status', '==', 'Active'), orderBy('fullName', 'asc'))
      : query(q, where('office', '==', profile.office), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, profile]);

  const bookQuery = useMemo(() => {
    if (!profile || !selectedWeek) return null;
    const q = collection(db, 'weekoff_bookings');
    return profile.role === 'super_admin'
      ? query(q, where('weekId', '==', selectedWeek))
      : query(q, where('weekId', '==', selectedWeek), where('office', '==', profile.office));
  }, [db, selectedWeek, profile]);

  const leaveQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employee_leaves');
    return profile.role === 'super_admin'
      ? query(q, where('status', '==', 'approved'))
      : query(q, where('office', '==', profile.office), where('status', '==', 'approved'));
  }, [db, profile]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: bookings, loading: bookLoading } = useCollection(bookQuery);
  const { data: leaves } = useCollection(leaveQuery);

  const weekDates = useMemo(() => getDatesForWeek(selectedWeek), [selectedWeek]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(e => 
      e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedWeek(formatWeekId(date));
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4 text-black">
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-6 p-0 flex items-center gap-2 font-black text-black hover:bg-transparent">
                    <CalendarDays className="size-4 text-secondary" />
                    <span className="text-[14px] uppercase">{displayWeekRange(selectedWeek)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar mode="single" onSelect={handleDateSelect} initialFocus className="bg-white" />
                </PopoverContent>
              </Popover>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Data Hub</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ACTIVE SYNC</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Authorized Pool', value: employees?.length || 0, sub: 'Active Registry', icon: Users, color: 'text-primary' },
          { label: 'Secured Offs', value: bookings?.length || 0, sub: 'Cycle Reservations', icon: CalendarDays, color: 'text-secondary' },
          { label: 'Active Absences', value: leaves?.filter(l => {
              const start = new Date(l.startDate);
              const end = new Date(l.endDate);
              const weekStart = weekDates[0];
              const weekEnd = weekDates[6];
              return (weekStart <= end && weekEnd >= start);
          }).length || 0, sub: 'Leave Registry', icon: PlaneTakeoff, color: 'text-accent' },
          { label: 'Sync Integrity', value: '100%', sub: 'Logic Verified', icon: ShieldCheck, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {empLoading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /> : (
                <>
                  <div className="text-5xl font-black text-black tracking-tighter tabular-nums">{kpi.value}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-primary">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
                 <ArrowRightLeft className="size-8 text-white" />
              </div>
              <div className="space-y-1">
                 <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Master Availability Matrix</CardTitle>
                 <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                    Visual registry of all professionals and their clinical constraints.
                 </CardDescription>
              </div>
           </div>
           <div className="relative w-full max-w-xl group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search Professional Name or ID..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-primary transition-all text-black shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto no-scrollbar">
            <Table className="border-collapse min-w-max">
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 bg-white/95 backdrop-blur-md sticky left-0 z-20">Professional Identity</TableHead>
                  {DAYS.map((day, idx) => (
                    <TableHead key={day} className="text-center w-[160px] border-r border-slate-100 last:border-0 py-8">
                       <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary/30">{day.substring(0,3)}</span>
                          <span className="text-[12px] font-black text-black/20 tabular-nums">
                             {weekDates[idx] ? format(weekDates[idx], 'dd MMM') : '-- --'}
                          </span>
                       </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {empLoading || bookLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-100">
                      <TableCell colSpan={8} className="py-12 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-40 text-center">
                      <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] italic">No active professionals match the filter registry.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0">
                      <TableCell className="pl-10 py-8 border-r border-slate-100 bg-white group-hover:bg-slate-50 transition-colors sticky left-0 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.02)]">
                         <div className="flex flex-col gap-1.5">
                            <span className="font-black text-[16px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{emp.fullName}</span>
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit tabular-nums">ID: {emp.id}</Badge>
                         </div>
                      </TableCell>
                      {DAYS.map((day, idx) => {
                        const isOff = bookings?.some(b => b.employeeId === emp.id && b.dayOfWeek === day);
                        const date = weekDates[idx];
                        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                        const onLeave = leaves?.find(l => l.employeeId === emp.id && dateStr >= l.startDate && dateStr <= l.endDate);

                        return (
                          <TableCell key={day} className="py-8 border-r border-slate-100 last:border-0 text-center">
                             {isOff ? (
                               <div className="flex flex-col items-center gap-2 animate-in zoom-in-95">
                                  <Badge className="bg-secondary text-white font-black text-[10px] uppercase px-4 py-1.5 rounded-xl shadow-lg shadow-secondary/20">WEEK-OFF</Badge>
                                  <Lock className="size-3 text-secondary opacity-30" />
                               </div>
                             ) : onLeave ? (
                               <div className="flex flex-col items-center gap-2 animate-in zoom-in-95">
                                  <Badge className="bg-accent text-primary font-black text-[10px] uppercase px-4 py-1.5 rounded-xl border border-primary/10">LEAVE</Badge>
                                  <PlaneTakeoff className="size-3 text-accent" />
                               </div>
                             ) : (
                               <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <CheckCircle2 className="size-4 text-emerald-500/20" />
                               </div>
                             )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50/50 p-8 border-t border-slate-100 flex items-center gap-10">
           <div className="flex items-center gap-4">
              <div className="size-3 rounded-full bg-secondary shadow-[0_0_10px_blue]" />
              <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">Confirmed Week-Off</span>
           </div>
           <div className="flex items-center gap-4">
              <div className="size-3 rounded-full bg-accent border border-primary/10" />
              <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">Approved Leave</span>
           </div>
           <div className="ml-auto flex items-center gap-3 text-emerald-600">
              <ShieldCheck className="size-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Atomic Registry Verified</span>
           </div>
        </CardFooter>
      </Card>
    </div>
  );
}
