
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
  Terminal
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { DemoBadge } from '@/components/ui/demo-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

export default function AdminSessionManager() {
  const db = useFirestore();
  const { profile: adminProfile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [revokingAll, setRevokingAll] = useState(false);

  // Fetch all sessions (Audit trace)
  const { data: sessions, loading: sessionsLoading } = useCollection(
    query(collection(db, 'sessions'), orderBy('deadlineAt', 'desc'), limit(200))
  );
  
  const { data: employees } = useCollection(query(collection(db, 'employees')));

  const stats = useMemo(() => {
    if (!sessions) return null;
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
      toast({ title: "Session Terminated", description: "Node access has been immediately locked." });
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

  const filteredSessions = sessions?.filter(s => {
    const emp = employees?.find(e => e.id === s.employeeId);
    const text = `${emp?.fullName} ${s.employeeId} ${s.label} ${s.status}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <ShieldAlert className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Session Audit</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Governance Node Pulse <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Protocol Status</label>
              <div className="flex items-center gap-3">
                 <span className="font-black text-secondary uppercase tracking-widest text-lg">SECURE ARCH</span>
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             variant="outline"
             className="bg-white/5 border-white/10 text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-xl transition-all hover:bg-secondary/20 hover:border-secondary" 
           >
            <Database className="size-4 mr-3" /> EXPORT TRACE
           </Button>
        </div>
      </div>

      {/* KPI Ledger */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Authorized Devices</CardTitle>
            <Monitor className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">{stats?.active || 0}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Active Pulse</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-destructive">Revoked Trace</CardTitle>
            <ShieldX className="h-5 w-5 text-destructive opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-destructive tracking-tighter">{stats?.revoked || 0}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Access Blocked</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Security Cycle</CardTitle>
            <RefreshCcw className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">365D</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Standard Persistent</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Auth Efficiency</CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-500 opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">100%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Integrity Verified</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8">
        {/* Session Ledger Hub */}
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                <Lock className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">Institutional Device Grid</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                   Live persistent session tracing for ROC professionals.
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <div className="relative w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-white/20 group-focus-within:text-secondary transition-colors" />
                <Input 
                  placeholder="Filter Device Traces..." 
                  className="pl-12 h-12 font-black uppercase text-[11px] tracking-widest bg-white/[0.02] border-2 border-white/10 rounded-xl focus:border-secondary transition-all text-white placeholder:text-white/10 shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto no-scrollbar">
            <Table className="border-collapse">
              <TableHeader className="bg-white/[0.02]">
                <TableRow className="border-b border-white/5">
                  <TableHead className="w-[300px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Professional</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5">Device Intelligence</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Verification Pulse</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-white/5 text-center">Security Deadline</TableHead>
                  <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Governance Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-b border-white/5"><TableCell colSpan={5} className="py-10 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /></TableCell></TableRow>
                  ))
                ) : filteredSessions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-40 text-center">
                      <p className="text-white/10 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No active session traces found in node.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions?.map((s) => {
                    const emp = employees?.find(e => e.id === s.employeeId);
                    const deadline = s.deadlineAt instanceof Timestamp ? s.deadlineAt.toDate() : new Date(s.deadlineAt);
                    const expired = new Date() > deadline;
                    const isRevoked = s.status === 'revoked';

                    return (
                      <TableRow key={`${s.uid}_${s.id}`} className={cn(
                        "hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0",
                        isRevoked && "opacity-40 grayscale"
                      )}>
                        <TableCell className="pl-10 py-8 border-r border-white/5">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-black text-[16px] text-white tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{emp?.fullName || 'Unmapped'}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-white/10 text-white/40 bg-white/5 px-2 py-0.5 rounded-md">ID: {s.employeeId}</Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-8 border-r border-white/5">
                           <div className="flex items-center gap-4">
                              <div className={cn(
                                "size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-secondary/20 transition-all shadow-inner",
                                isRevoked && "border-destructive/20"
                              )}>
                                 {s.userAgent?.includes('Mobile') ? <Smartphone className="size-5 text-secondary" /> : <Laptop className="size-5 text-secondary" />}
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-[12px] font-black uppercase text-white/80 tracking-widest">{s.label || 'Unknown Node'}</span>
                                 <span className="text-[9px] font-mono font-black text-white/20 uppercase tracking-widest mt-0.5">TRC_{s.id.slice(-6)}</span>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className="py-8 border-r border-white/5 text-center">
                           <div className="flex flex-col items-center">
                              <span className="text-[11px] font-black text-white/60 tabular-nums">
                                {s.verifiedAt instanceof Timestamp ? s.verifiedAt.toDate().toLocaleDateString() : new Date(s.verifiedAt).toLocaleDateString()}
                              </span>
                              <span className="text-[8px] font-black uppercase text-white/20 tracking-widest mt-1">LATEST OTP</span>
                           </div>
                        </TableCell>
                        <TableCell className="py-8 border-r border-white/5 text-center">
                           <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-2">
                                <Clock className={cn("size-3.5", expired ? 'text-destructive' : 'text-emerald-500')} />
                                <span className={cn("text-[11px] font-black tabular-nums", expired ? 'text-destructive' : 'text-white/80')}>
                                  {deadline.toLocaleDateString()}
                                </span>
                              </div>
                              <Badge 
                                className={cn(
                                  "font-black text-[8px] uppercase tracking-widest px-3 py-0.5 rounded-full border-none",
                                  isRevoked ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500 text-white'
                                )}
                              >
                                {s.status}
                              </Badge>
                           </div>
                        </TableCell>
                        <TableCell className="text-right pr-10 py-8">
                          <div className="flex justify-end gap-3">
                             {s.status === 'active' && (
                               <>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="size-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-inner border border-destructive/20"
                                   onClick={() => handleRevoke(s.uid, s.id, s.employeeId)}
                                 >
                                   <ShieldX className="size-5" />
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="size-10 rounded-xl border-2 border-white/10 text-white/40 hover:bg-white/5 hover:text-white transition-all shadow-sm"
                                   onClick={() => handleRevokeAllForEmployee(s.uid, s.employeeId)}
                                   disabled={revokingAll}
                                 >
                                   <Users className="size-5" />
                                 </Button>
                               </>
                             )}
                             {isRevoked && (
                               <div className="flex items-center gap-2 text-[9px] font-black text-white/20 uppercase tracking-widest">
                                  <Terminal className="size-3" /> Audit Logged
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
          <CardFooter className="bg-white/[0.02] p-10 border-t border-white/5">
             <div className="flex items-center gap-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-secondary shadow-inner shrink-0">
                   <Info className="size-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Audit Protocol</p>
                  <p className="text-[13px] font-medium text-white/80 uppercase leading-relaxed tracking-tight max-w-4xl">
                    Device sessions are immutably linked to the clinical registry. Revocation is immediate across all cluster nodes. 
                    Mandatory 365-day security deadlines ensure that dormant or compromised sessions are automatically neutralized.
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
               <ShieldAlert size={280} />
            </div>
            <CardContent className="p-12 space-y-8 relative z-10">
                <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                    <ShieldCheck className="size-8 text-white" />
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Security Protocol</p>
                  <p className="text-[15px] leading-relaxed font-medium text-white/80 uppercase tracking-tight">
                    Professional device authorization utilizes zero-trust architecture. Every verification transaction 
                    is recorded with temporal integrity markers to ensure complete traceability within the workforce lifecycle.
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
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Emergency Control</p>
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none">Global Revocation</p>
                </div>
             </div>
             
             <div className="space-y-6 pt-2">
               <p className="text-[14px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                 The registry control node allows for immediate termination of all sessions for a compromised professional identity. 
                 Target devices are locked out upon the next network heartbeat and redirected to the verification barrier.
               </p>
               <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                  <Lock className="size-5 text-secondary" />
                  <p className="text-[10px] font-black uppercase text-secondary tracking-[0.2em]">Institutional Access Guard Active</p>
               </div>
             </div>
          </Card>
      </div>
    </div>
  );
}
