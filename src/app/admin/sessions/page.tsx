
'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, 
  ShieldX, 
  Search, 
  Loader2, 
  Clock, 
  Users, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Database, 
  ArrowUpRight, 
  Info, 
  Laptop, 
  Smartphone, 
  Lock,
  RefreshCcw,
  Monitor,
  Terminal,
  Server
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

export default function AdminSessionManager() {
  const db = useFirestore();
  const { profile: adminProfile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [revokingAll, setRevokingAll] = useState(false);

  // Stable Authoritative Fetch (Latest 200 pulses)
  const sessionsQuery = useMemo(() => query(
    collection(db, 'sessions'), 
    orderBy('deadlineAt', 'desc'), 
    limit(200)
  ), [db]);

  const { data: sessions, loading: sessionsLoading } = useCollection(sessionsQuery);
  const { data: employees } = useCollection(query(collection(db, 'employees')));

  const stats = useMemo(() => {
    if (!sessions) return { active: 0, revoked: 0 };
    const active = sessions.filter(s => s.status === 'active').length;
    const revoked = sessions.filter(s => s.status === 'revoked').length;
    return { active, revoked };
  }, [sessions]);

  const handleRevoke = async (uid: string, sessionId: string, employeeId: string) => {
    if (!confirm(`Revoke this specific device session for ${employeeId}?`)) return;
    
    try {
      const sessionRef = doc(db, 'sessions', `${uid}_${sessionId}`);
      await updateDoc(sessionRef, { 
        status: 'revoked',
        revokedBy: adminProfile?.uid,
        revokedAt: new Date().toISOString()
      });
      
      logAudit(db, adminProfile?.uid || 'system', 'ADMIN_REVOKE_SESSION', employeeId, { sessionId, uid });
      toast({ title: "Session Terminated", description: "Identity access has been immediately locked." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRevokeAllForEmployee = async (uid: string, employeeId: string) => {
    if (!confirm(`EMERGENCY: Terminate ALL active sessions for ${employeeId}? User must re-verify with OTP on all devices.`)) return;
    
    setRevokingAll(true);
    try {
      const q = query(collection(db, 'sessions'), where('uid', '==', uid), where('status', '==', 'active'));
      const snap = await getDocs(q);
      
      const promises = snap.docs.map(d => updateDoc(d.ref, { 
        status: 'revoked',
        revokedBy: adminProfile?.uid,
        revokedAt: new Date().toISOString()
      }));
      
      await Promise.all(promises);
      logAudit(db, adminProfile?.uid || 'system', 'ADMIN_REVOKE_ALL_SESSIONS', employeeId, { uid, count: promises.length });
      toast({ title: `Emergency Block Complete`, description: `Terminated ${promises.length} sessions for ${employeeId}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRevokingAll(false);
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions?.filter(s => {
      const emp = employees?.find(e => e.id === s.employeeId);
      const text = `${emp?.fullName} ${s.employeeId} ${s.label} ${s.status}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    });
  }, [sessions, employees, searchTerm]);

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <ShieldAlert className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Session Audit</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Governance Pulse <Activity className="size-3 text-secondary animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Protocol Status</label>
              <div className="flex items-center gap-3">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">AUTHORIZED ACCESS</span>
              </div>
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
          { label: 'Authorized Devices', value: stats.active, sub: 'Active Pulse', icon: Monitor, color: 'text-primary' },
          { label: 'Revoked Trace', value: stats.revoked, sub: 'Access Blocked', icon: ShieldX, color: 'text-destructive' },
          { label: 'Security Cycle', value: '30D', sub: 'Standard Persistent', icon: RefreshCcw, color: 'text-secondary' },
          { label: 'Auth Efficiency', value: '100%', sub: 'Integrity Verified', icon: ShieldCheck, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {sessionsLoading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /> : (
                <>
                  <div className={cn("text-5xl font-black tracking-tighter", i === 1 ? 'text-destructive' : 'text-black')}>{kpi.value}</div>
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
              <Lock className="size-8 text-secondary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-black leading-none">Institutional Device Grid</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                 Live persistent session tracing for ROC professionals.
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-4 w-full max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-secondary transition-colors" />
              <Input 
                placeholder="Filter Device Traces or Identity..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-secondary transition-all text-black placeholder:text-slate-300 shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <Table className="border-collapse">
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-b border-slate-100">
                <TableHead className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Professional Identity</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-left px-8">Device Intelligence</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center px-8">Pulse (Latest OTP)</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center px-8">Security Deadline</TableHead>
                <TableHead className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100"><TableCell colSpan={5} className="py-10 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></TableCell></TableRow>
                ))
              ) : filteredSessions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-40 text-center">
                    <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No active session traces found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions?.map((s: any) => {
                  const emp = employees?.find(e => e.id === s.employeeId);
                  const deadline = s.deadlineAt instanceof Timestamp ? s.deadlineAt.toDate() : new Date(s.deadlineAt);
                  const expired = new Date() > deadline;
                  const isRevoked = s.status === 'revoked';

                  return (
                    <TableRow key={`${s.uid}_${s.id}`} className={cn(
                      "hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0",
                      isRevoked && "opacity-40 grayscale"
                    )}>
                      <TableCell className="pl-10 py-8 border-r border-slate-100">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-[17px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{emp?.fullName || 'Unmapped Identity'}</span>
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/20 text-secondary bg-secondary/5 px-2 py-0.5 rounded-md w-fit tabular-nums">ID: {s.employeeId}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 px-8">
                         <div className="flex items-center gap-4">
                            <div className={cn(
                              "size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-secondary/20 transition-all shadow-inner",
                              isRevoked && "border-destructive/20"
                            )}>
                               {s.userAgent?.includes('Mobile') ? <Smartphone className="size-5 text-secondary" /> : <Laptop className="size-5 text-secondary" />}
                            </div>
                            <div className="flex flex-col">
                               <span className="text-[12px] font-black uppercase text-black/80 tracking-widest">{s.label || 'Unknown Device'}</span>
                               <span className="text-[9px] font-mono font-black text-slate-300 uppercase tracking-widest mt-0.5">TRC_{s.id.slice(-6)}</span>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 text-center px-8">
                         <div className="flex flex-col items-center">
                            <span className="text-[14px] font-black text-black/60 tabular-nums">
                              {s.verifiedAt instanceof Timestamp ? s.verifiedAt.toDate().toLocaleDateString('en-IN') : new Date(s.verifiedAt).toLocaleDateString('en-IN')}
                            </span>
                            <span className="text-[8px] font-black uppercase text-slate-300 tracking-[0.2em] mt-1">LATEST OTP PULSE</span>
                         </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 text-center px-8">
                         <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-2">
                              <Clock className={cn("size-3.5", expired ? 'text-destructive' : 'text-emerald-500')} />
                              <span className={cn("text-[14px] font-black tabular-nums", expired ? 'text-destructive' : 'text-black/80')}>
                                {deadline.toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <Badge 
                              className={cn(
                                "font-black text-[8px] uppercase tracking-widest px-4 py-0.5 rounded-full border-none shadow-2xl transition-all",
                                isRevoked ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500 text-white shadow-emerald-500/20'
                              )}
                            >
                              {s.status}
                            </Badge>
                         </div>
                      </TableCell>
                      <TableCell className="text-right pr-12 py-8">
                        <div className="flex justify-end gap-3">
                           {s.status === 'active' ? (
                             <>
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="size-11 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-inner border border-destructive/20"
                                 onClick={() => handleRevoke(s.uid, s.id, s.employeeId)}
                               >
                                 <ShieldX className="size-5" />
                               </Button>
                               <Button 
                                 variant="outline" 
                                 size="icon" 
                                 className="size-11 rounded-xl border-2 border-slate-100 text-slate-300 hover:bg-slate-50 hover:text-black transition-all shadow-sm"
                                 onClick={() => handleRevokeAllForEmployee(s.uid, s.employeeId)}
                                 disabled={revokingAll}
                               >
                                 <Users className="size-5" />
                               </Button>
                             </>
                           ) : (
                             <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Audit Traced</span>
                                   <span className="text-[8px] font-mono text-slate-200 uppercase">{s.revokedAt ? 'REVOKED' : 'EXPIRED'}</span>
                                </div>
                                <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                   <ShieldCheck className="size-5 text-slate-300" />
                                </div>
                             </div>
                           )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
