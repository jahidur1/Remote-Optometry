
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
  Filter,
  Info,
  Clock,
  PlaneTakeoff,
  TrendingUp,
  CalendarDays,
  UserX,
  History
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDatesForWeek, isDateInRange } from '@/lib/date-utils';
import { format, getISOWeek, getISOWeekYear } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AvailabilitySummary() {
  const db = useFirestore();
  const { profile } = useUser();
  const [selectedWeek, setSelectedWeek] = useState('2024-52');
  const [searchTerm, setSearchTerm] = useState('');

  // Stable Authoritative Fetches
  const empQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employees');
    return profile.role === 'super_admin' 
      ? query(q, where('status', '==', 'Active'), orderBy('fullName', 'asc'))
      : query(q, where('office', '==', profile.office), where('status', '==', 'Active'), orderBy('fullName', 'asc'));
  }, [db, profile]);

  const bookQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'weekoff_bookings');
    return profile.role === 'super_admin'
      ? query(q, where('weekId', '==', selectedWeek))
      : query(q, where('weekId', '==', selectedWeek), where('office', '==', profile.office));
  }, [db, selectedWeek, profile]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: bookings, loading: bookLoading } = useCollection(bookQuery);

  const stats = useMemo(() => {
    if (!employees || !selectedWeek) return null;

    const weekDates = getDatesForWeek(selectedWeek);
    if (weekDates.length === 0) return null;

    return DAYS.map((day, index) => {
      const date = weekDates[index];
      const dateStr = format(date, 'yyyy-MM-dd');

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

  const detailedOffDuty = useMemo(() => {
    if (!bookings || !employees) return [];
    return bookings
      .map(b => {
        const emp = employees.find(e => e.id === b.employeeId);
        return {
          ...b,
          employeeName: emp?.fullName || 'Unknown Professional',
          office: emp?.office || b.office
        };
      })
      .filter(b => 
        b.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek));
  }, [bookings, employees, searchTerm]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const year = getISOWeekYear(date);
    const week = getISOWeek(date);
    const formattedWeek = `${year}-${week.toString().padStart(2, '0')}`;
    setSelectedWeek(formattedWeek);
  };

  const totalActivePool = employees?.length || 0;
  const currentWeekOffs = bookings?.length || 0;

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
                    <span className="text-[16px]">{selectedWeek}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                  <Calendar
                    mode="single"
                    onSelect={handleDateSelect}
                    initialFocus
                    className="bg-white"
                  />
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Authorized Pool', value: totalActivePool, sub: 'Personnel Active', icon: Users, color: 'text-primary' },
          { label: 'Secured Offs', value: currentWeekOffs, sub: 'FCFS Reservations', icon: CalendarDays, color: 'text-secondary' },
          { label: 'Sync Efficiency', value: '100%', sub: 'Integrity Verified', icon: ShieldCheck, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all shadow-md">
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

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-secondary h-full">
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
                    <TableHead className="w-[240px] pl-10 py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Daily Unit</TableHead>
                    <TableHead className="py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Pool</TableHead>
                    <TableHead className="py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Off</TableHead>
                    <TableHead className="text-right pr-10 py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Net Capacity</TableHead>
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
                          <span className="font-black text-[20px] text-black tracking-tighter group-hover:translate-x-1 transition-transform leading-none uppercase">{s.day}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.date}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 text-center">
                        <span className="text-lg font-black text-black/60 tabular-nums">{s.totalActive}</span>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 text-center">
                        <Badge variant="outline" className="text-[10px] font-black text-secondary border-secondary/20 bg-secondary/5 px-4 py-1.5 rounded-xl tabular-nums">
                          {s.offCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-10 py-8">
                        <div className="flex flex-col items-end gap-1.5">
                             <span className={cn(
                               "text-3xl font-black tabular-nums transition-all duration-500",
                               s.available > 0 ? "text-black" : "text-destructive"
                             )}>{s.available}</span>
                          <Badge 
                            className={cn(
                              "font-black text-[8px] uppercase tracking-[0.2em] px-3 py-1 rounded-full border-none shadow-md",
                              s.percent < 70 ? 'bg-destructive text-white' : 'bg-emerald-500 text-white'
                            )}
                          >
                            {s.percent}%
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
           <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-primary h-full">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col gap-8">
                <div className="flex items-center gap-6">
                  <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
                    <Users className="size-8 text-white" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black uppercase tracking-tight text-black leading-none">Off-Duty Ledger</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                       Detailed registry of professionals with confirmed off-days.
                    </CardDescription>
                  </div>
                </div>
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search Professional Name or ID..." 
                    className="pl-12 h-12 font-black uppercase text-[10px] tracking-widest bg-white border-2 border-slate-100 rounded-xl focus:border-primary transition-all text-black"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[600px] overflow-y-auto no-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-50/30 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow>
                      <TableHead className="pl-10 py-6 uppercase text-[9px] font-black tracking-[0.4em]">Professional</TableHead>
                      <TableHead className="py-6 uppercase text-[9px] font-black tracking-[0.4em] text-center">Confirmed Off</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookLoading ? (
                       Array(5).fill(0).map((_, i) => (
                         <TableRow key={i}><TableCell colSpan={2} className="p-10"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                       ))
                    ) : detailedOffDuty.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-32 text-center opacity-30 italic font-black uppercase text-xs tracking-[0.3em]">No off-duty professionals in ledger.</TableCell>
                      </TableRow>
                    ) : detailedOffDuty.map((b) => (
                      <TableRow key={b.id} className="hover:bg-slate-50 transition-all border-b last:border-0 group">
                        <TableCell className="pl-10 py-6 border-r border-slate-50">
                           <div className="flex flex-col gap-1">
                              <span className="font-black text-[14px] text-black uppercase group-hover:translate-x-1 transition-transform">{b.employeeName}</span>
                              <div className="flex items-center gap-2">
                                 <code className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{b.employeeId}</code>
                                 <span className="text-[8px] text-secondary font-black uppercase opacity-40">• {b.office?.substring(0,3)}</span>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className="py-6 text-center">
                           <Badge className="bg-secondary text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-secondary/20">
                              {b.dayOfWeek}
                           </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="bg-slate-50/50 p-6 border-t border-slate-100">
                 <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                    <History className="size-3" /> Historical Trace: {detailedOffDuty.length} Active Records
                 </p>
              </CardFooter>
           </Card>
        </div>
      </div>

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><ShieldCheck size={280} className="text-primary" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ShieldCheck className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Institutional Guard Hub</p>
               <p className="text-lg font-bold text-black/80 leading-relaxed max-w-4xl tracking-tight">
                  "The Off-Duty Ledger provides live, cluster-specific data on professional availability. 
                  Confirmed Weekly-Offs are treated as immutable hard constraints during optimization, 
                  and the system identifies any staffing shortfalls relative to daily clinical requirements."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
