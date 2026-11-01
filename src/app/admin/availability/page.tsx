
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Users, Calendar, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBadge } from '@/components/ui/demo-badge';

export default function AvailabilitySummary() {
  const db = useFirestore();
  const [selectedWeek, setSelectedWeek] = useState('2024-52'); // Default for demo

  // Fetch all core data
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: bookings, loading: bookLoading } = useCollection(query(collection(db, 'weekoff_bookings'), where('weekId', '==', selectedWeek)));
  const { data: leaves, loading: leaveLoading } = useCollection(collection(db, 'employee_leaves'));

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const stats = useMemo(() => {
    if (!employees) return null;

    return DAYS.map(day => {
      // Confirmed Weekly Offs for this day
      const offCount = bookings?.filter(b => b.dayOfWeek === day).length || 0;
      
      // Approved leaves overlapping with this day (simplified for week view)
      // In a real app, this would use exact dates based on the weekId
      const leaveCount = 0; // Placeholder for date-range logic

      const totalActive = employees.length;
      const available = totalActive - offCount - leaveCount;

      return {
        day,
        totalActive,
        offCount,
        leaveCount,
        available,
        percent: Math.round((available / totalActive) * 100)
      };
    });
  }, [employees, bookings, leaves, selectedWeek]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Roster Availability Matrix</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground">Calculated clinical capacity for Week {selectedWeek}.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
         <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  Active Clinical Pool <Users className="size-4" />
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-black">{employees?.length || 0}</div>
               <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Authorized Active Staff</p>
            </CardContent>
         </Card>
         <Card className="border-l-4 border-l-secondary shadow-sm">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  Confirmed Week-Offs <Calendar className="size-4" />
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-black text-secondary">{bookings?.length || 0}</div>
               <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Secured FCFS Reservations</p>
            </CardContent>
         </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-secondary" />
            <CardTitle>Daily Staffing Availability</CardTitle>
          </div>
          <CardDescription>Available = Active Pool - (Weekly Offs + Approved Absences)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30 text-[10px] uppercase font-black tracking-widest">
              <TableRow>
                <TableHead>Day of Week</TableHead>
                <TableHead className="text-center">Active Pool</TableHead>
                <TableHead className="text-center">Confirmed OFF</TableHead>
                <TableHead className="text-center">Approved Leave</TableHead>
                <TableHead className="text-right">Eligible for Roster</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empLoading || bookLoading || leaveLoading ? (
                Array(7).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : stats?.map(s => (
                <TableRow key={s.day} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-black uppercase tracking-tighter text-lg">{s.day}</TableCell>
                  <TableCell className="text-center font-bold text-muted-foreground">{s.totalActive}</TableCell>
                  <TableCell className="text-center font-bold text-secondary">{s.offCount}</TableCell>
                  <TableCell className="text-center font-bold text-accent">{s.leaveCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-primary">{s.available}</span>
                      <Badge variant="outline" className={`text-[9px] font-black uppercase mt-1 ${s.percent < 75 ? 'border-destructive text-destructive' : 'border-emerald-500/20 text-emerald-600'}`}>
                        {s.percent}% Clinical Capacity
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="p-4 rounded-xl bg-muted/30 border border-dashed flex gap-4 items-start">
         <AlertCircle className="size-5 text-muted-foreground shrink-0 mt-0.5" />
         <div className="space-y-1">
            <p className="text-xs font-black text-primary uppercase">Solver Constraints Logic</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              The OR-Tools engine only considers "Eligible for Roster" employees. If a shift's exact quota exceeds 
              eligible availability for that day, the solver will return INFEASIBLE. Admins must then override 
              non-protected constraints or adjust quotas.
            </p>
         </div>
      </div>
    </div>
  );
}
