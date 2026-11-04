'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, Users, Clock, ShieldCheck, Download, 
  Search, FileSpreadsheet, MapPin, Activity, Zap, 
  Database, ArrowUpRight, CheckCircle2, Globe, Filter, AlertCircle,
  CalendarDays
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';
import { exportRosterReport, exportToCSV } from '@/lib/export-utils';
import { logAudit } from '@/lib/audit';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [weekId, setWeekId] = useState('2024-52');
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filtered queries to satisfy hardened matchesOffice rules
  const empQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'employees');
    return profile.role === 'SUPER_ADMIN'
      ? query(q, where('status', '==', 'Active'))
      : query(q, where('office', '==', profile.office), where('status', '==', 'Active'));
  }, [db, profile]);

  const rosterQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'published_rosters');
    const base = profile.role === 'SUPER_ADMIN'
      ? query(q, where('weekId', '==', weekId))
      : query(q, where('weekId', '==', weekId), where('office', '==', profile.office));
    return query(base, orderBy('publishedAt', 'desc'));
  }, [db, weekId, profile]);

  const bookQuery = useMemo(() => {
    if (!profile) return null;
    const q = collection(db, 'weekoff_bookings');
    return profile.role === 'SUPER_ADMIN'
      ? query(q, where('weekId', '==', weekId))
      : query(q, where('weekId', '==', weekId), where('office', '==', profile.office));
  }, [db, weekId, profile]);

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master'), orderBy('displayOrder')), [db]);
  const logQuery = useMemo(() => query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc')), [db]);

  const { data: employees, loading: empLoading } = useCollection(empQuery);
  const { data: publishedRosters, loading: rosterLoading } = useCollection(rosterQuery);
  const { data: shifts } = useCollection(shiftQuery);
  const { data: logs } = useCollection(logQuery);
  const { data: bookings } = useCollection(bookQuery);

  const activeRoster = publishedRosters?.[0];

  const stats = useMemo(() => {
    const totalEmp = employees?.length || 0;
    const confirmedOffs = bookings?.length || 0;
    return {
      totalEmp,
      confirmedOffs,
      deploymentCount: activeRoster?.assignments?.length || 0
    };
  }, [employees, bookings, activeRoster]);

  const COLORS = ['hsl(var(--secondary))', 'hsl(var(--accent))', '#3B82F6', '#14B8A6'];

  const handleExportRoster = async () => {
    if (!activeRoster || !employees || !shifts || !bookings) {
      toast({ title: "Insufficient Data", description: "Publish a roster and ensure FCFS bookings exist first.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      exportRosterReport(`ROC_Institutional_Roster_W${weekId}`, activeRoster.assignments, employees, shifts, bookings);
      logAudit(db, profile?.uid || 'system', 'EXPORT_ROSTER_REPORT', weekId);
      toast({ title: "Export Successful" });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-10 animate-in max-w-[1600px] mx-auto pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <BarChart3 className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Analytics Hub</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Active Cycle</label>
              <Input 
                className="w-24 h-6 font-black text-black border-none bg-transparent p-0 text-[16px]" 
                value={weekId} 
                onChange={(e) => setWeekId(e.target.value)}
              />
           </div>
           <Button 
            className="bg-secondary text-white h-10 px-6 font-black uppercase text-[10px] tracking-[0.15em] transition-all rounded-xl" 
            onClick={handleExportRoster} 
            disabled={exporting || rosterLoading}
           >
             <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Clinical Pool', value: stats.totalEmp, icon: Users, color: 'text-primary' },
          { label: 'Confirmed Week-Offs', value: stats.confirmedOffs, icon: CalendarDays, color: 'text-secondary' },
          { label: 'Deployment Rate', value: stats.deploymentCount, icon: Zap, color: 'text-secondary' },
          { label: 'System Integrity', value: '100%', icon: ShieldCheck, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30", kpi.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}