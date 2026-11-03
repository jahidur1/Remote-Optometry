
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Key, 
  Search, 
  Trash2, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Database, 
  ArrowUpRight,
  Info,
  Clock,
  Phone,
  Lock,
  Terminal,
  Server
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { DemoBadge } from '@/components/ui/demo-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function OtpMonitor() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Stable Authoritative Fetch (Latest 100 pulses)
  const otpQuery = useMemo(() => query(
    collection(db, 'otp_registry'), 
    orderBy('createdAt', 'desc'), 
    limit(100)
  ), [db]);

  const { data: pulses, loading } = useCollection(otpQuery);

  const handleDelete = async (phone: string) => {
    if (!confirm("Decommission this backup pulse?")) return;
    try {
      await deleteDoc(doc(db, 'otp_registry', phone));
      toast({ title: "Pulse Decommissioned" });
    } catch (e: any) {
      toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
    }
  };

  const filteredPulses = useMemo(() => {
    return pulses?.filter(p => {
      return p.phone.includes(searchTerm) || p.otp.includes(searchTerm);
    });
  }, [pulses, searchTerm]);

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Key className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">OTP Monitor</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Backup Pulse Ledger <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Protocol Status</label>
              <div className="flex items-center gap-3">
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">ADMIN_BACKUP_LIVE</span>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Pulses', value: pulses?.length || 0, sub: 'Total Registry', icon: Zap, color: 'text-primary' },
          { label: 'Security Cycle', value: '24h', sub: 'Temporary Node', icon: Clock, color: 'text-secondary' },
          { label: 'Sync Integrity', value: '100%', sub: 'Compliance Verified', icon: ShieldCheck, color: 'text-secondary' },
          { label: 'Access Mode', value: 'S-ADMIN', sub: 'Privileged View', icon: Lock, color: 'text-black' }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /> : (
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
              <Key className="size-8 text-secondary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-black leading-none">Backup Pulse Ledger</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                 Temporary security codes for institutional authentication support.
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-4 w-full max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-secondary transition-colors" />
              <Input 
                placeholder="Search Phone or Pulse Code..." 
                className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-secondary transition-all text-black placeholder:text-slate-300"
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
                <TableHead className="w-[320px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Mobile Endpoint</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center px-8">Backup Pulse Code</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center px-8">Initiated (IST)</TableHead>
                <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center px-8">Status deadline</TableHead>
                <TableHead className="text-right pr-12 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100"><TableCell colSpan={5} className="py-10 px-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></TableCell></TableRow>
                ))
              ) : filteredPulses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-40 text-center">
                    <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em] mb-4 italic">No active backup pulses found in node.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPulses?.map((p) => {
                  const expiry = new Date(p.expiresAt);
                  const isExpired = new Date() > expiry;

                  return (
                    <TableRow key={p.phone} className={cn(
                      "hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0",
                      isExpired && "opacity-40 grayscale"
                    )}>
                      <TableCell className="pl-10 py-8 border-r border-slate-100">
                        <div className="flex items-center gap-4">
                           <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-secondary/10 transition-all shadow-inner">
                              <Phone className="size-5 text-secondary" />
                           </div>
                           <div className="flex flex-col">
                              <span className="font-black text-[17px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{p.phone}</span>
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">IDENTITY_ENDPOINT</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 text-center px-8">
                         <code className="text-secondary font-black text-[28px] bg-secondary/5 px-6 py-2 rounded-xl border-2 border-secondary/10 shadow-inner group-hover:scale-110 inline-block transition-transform tabular-nums tracking-[0.2em]">
                           {p.otp}
                         </code>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 text-center px-8">
                         <div className="flex flex-col items-center">
                            <span className="text-[14px] font-black text-black/60 tabular-nums">
                               {new Date(p.createdAt?.toDate?.() || p.createdAt).toLocaleTimeString()}
                            </span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] mt-1">REQUESTED PULSE</span>
                         </div>
                      </TableCell>
                      <TableCell className="py-8 border-r border-slate-100 text-center px-8">
                         <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-2">
                              <Clock className={cn("size-3.5", isExpired ? 'text-destructive' : 'text-emerald-500')} />
                              <span className={cn("text-[13px] font-black tabular-nums", isExpired ? 'text-destructive' : 'text-black/80')}>
                                {expiry.toLocaleTimeString()}
                              </span>
                            </div>
                            <Badge 
                              className={cn(
                                "font-black text-[8px] uppercase tracking-widest px-4 py-0.5 rounded-full border-none shadow-2xl transition-all",
                                isExpired ? 'bg-destructive text-white' : 'bg-emerald-500 text-white shadow-emerald-500/20'
                              )}
                            >
                              {isExpired ? 'EXPIRED' : 'ACTIVE_PULSE'}
                            </Badge>
                         </div>
                      </TableCell>
                      <TableCell className="text-right pr-12 py-8">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-11 rounded-xl text-slate-200 hover:bg-destructive/10 hover:text-destructive transition-all border border-transparent hover:border-destructive/20"
                          onClick={() => handleDelete(p.phone)}
                        >
                          <Trash2 className="size-5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><Database size={280} className="text-primary" /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ArrowUpRight className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Institutional Governance node</p>
               <p className="text-lg font-bold text-black/80 leading-relaxed max-w-4xl tracking-tight">
                  "Backup pulses are architected for administrative fallback. Codes are immutably deleted after the 24-hour security window 
                  to maintain registry hygiene. Access to this ledger is strictly restricted to Super Admin identities for identity node verification."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
