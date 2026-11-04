
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, Info, Loader2, Send, History, CheckCircle2, ArrowLeft, ShieldCheck, User } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { DemoBadge } from '@/components/ui/demo-badge';
import { logAudit } from '@/lib/audit';
import Link from 'next/link';

export default function ShiftSwaps() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Memoized Queries for performance stability
  const activeEmployeesQuery = useMemo(() => query(collection(db, 'employees'), where('status', '==', 'Active')), [db]);
  const { data: employees } = useCollection(activeEmployeesQuery);

  const mySwapsQuery = useMemo(() => {
    if (!profile?.employeeId) return null;
    return query(
      collection(db, 'shift_swaps'), 
      where('requesterId', '==', profile.employeeId), 
      orderBy('createdAt', 'desc')
    );
  }, [db, profile?.employeeId]);

  const { data: mySwaps } = useCollection(mySwapsQuery);

  const [swapData, setSwapData] = useState({
    targetEmployeeId: '',
    date: '',
    reason: ''
  });

  const handleSubmit = async () => {
    if (!profile?.employeeId || !swapData.targetEmployeeId || !swapData.date) {
      toast({ title: "Validation Error", description: "Target professional and date are required.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        requesterId: profile.employeeId,
        office: profile.office, // Enforce office isolation metadata
        ...swapData,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'shift_swaps'), payload);
      logAudit(db, profile.uid, 'REQUEST_SHIFT_SWAP', swapData.targetEmployeeId, { office: profile.office, date: swapData.date });
      
      toast({ title: "Swap Requested", description: "Your request has been sent to the target professional for review." });
      setSwapData({ targetEmployeeId: '', date: '', reason: '' });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
      <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
      <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground">Opening Exchange Hub</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-32 pt-6 px-4 animate-in">
      <div className="flex items-center gap-6">
         <Link href="/employee/portal">
           <Button variant="ghost" size="icon" className="rounded-2xl border-2 hover:bg-muted size-12 transition-all shadow-sm">
              <ArrowLeft className="size-6 text-primary" />
           </Button>
         </Link>
         <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Shift Exchange</h1>
              <DemoBadge />
            </div>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] mt-1">Bilateral Professional Swap Matrix</p>
         </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <Card className="lg:col-span-7 shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary p-10 text-primary-foreground border-none">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl">
                <ArrowRightLeft className="size-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">Propose Swap</CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase text-white/40 tracking-[0.2em] mt-2">Formal request to a clinical colleague.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground ml-1">Select Professional</Label>
              <Select onValueChange={(val) => setSwapData({ ...swapData, targetEmployeeId: val })}>
                <SelectTrigger className="h-14 font-black border-2 rounded-2xl px-6">
                  <SelectValue placeholder="Target Colleague" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                  {employees?.filter(e => e.id !== profile?.employeeId && e.office === profile?.office).map(e => (
                    <SelectItem key={e.id} value={e.id} className="rounded-xl py-3 font-bold uppercase text-[11px]">
                        {e.fullName} <span className="opacity-40 ml-2">[{e.id}]</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground ml-1">Proposed Exchange Day</Label>
              <Select onValueChange={(val) => setSwapData({ ...swapData, date: val })}>
                <SelectTrigger className="h-14 font-black border-2 rounded-2xl px-6">
                  <SelectValue placeholder="Select Weekday" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                    <SelectItem key={d} value={d} className="rounded-xl py-3 font-bold uppercase text-[11px]">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground ml-1">Clinical Justification</Label>
              <Textarea 
                placeholder="Brief reason for the swap (e.g. Continuing Education, Family Commitments)..." 
                className="min-h-[140px] font-medium rounded-2xl border-2 p-6 transition-all focus:border-secondary"
                value={swapData.reason}
                onChange={(e) => setSwapData({ ...swapData, reason: e.target.value })}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 p-10 border-t">
            <Button className="w-full bg-primary hover:bg-secondary text-white font-black uppercase tracking-[0.3em] h-20 rounded-3xl shadow-2xl transition-all" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin size-6 mr-3" /> : <Send className="size-6 mr-3" />}
              Dispatch Request
            </Button>
          </CardFooter>
        </Card>

        <div className="lg:col-span-5 space-y-10">
          <Card className="bg-secondary/5 border-2 border-secondary/10 shadow-xl rounded-[2.5rem] p-10 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700"><ShieldCheck size={120} /></div>
            <div className="flex items-center gap-5 text-secondary">
               <Info className="size-6" />
               <p className="text-[11px] font-black uppercase tracking-[0.3em]">Governance Protocol</p>
            </div>
            <div className="space-y-6 pt-2">
              <p className="text-[13px] text-muted-foreground leading-relaxed font-medium">
                Clinical swaps are **PROVISIONAL** and strictly subject to two-stage authorization:
              </p>
              <div className="space-y-4">
                {[
                    'TARGET PROFESSIONAL ACCEPTS PULSE',
                    'ADMIN VALIDATES POD-QUOTAS',
                    'CP-SAT ENGINE RE-VERIFIES HARD CONSTRAINTS'
                ].map((step, i) => (
                    <div key={i} className="flex gap-4 items-center">
                        <div className="size-2 rounded-full bg-secondary shadow-[0_0_10px_blue]" />
                        <span className="text-[10px] font-black text-primary tracking-widest">{step}</span>
                    </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-muted/30 border-b p-8">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-4 text-primary">
                    <History className="size-5 text-secondary" /> Request Ledger
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-muted/30">
                    {mySwaps?.length === 0 ? (
                        <div className="text-center py-20 opacity-30 italic font-black uppercase text-[10px] tracking-widest">No recent exchanges.</div>
                    ) : mySwaps?.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-8 hover:bg-muted/5 transition-colors group">
                            <div className="space-y-1">
                                <p className="text-lg font-black uppercase tracking-tighter text-primary group-hover:translate-x-1 transition-transform">{s.date}</p>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                   <User className="size-3" />
                                   <p className="text-[10px] font-bold uppercase tracking-widest">To: {s.targetEmployeeId}</p>
                                </div>
                            </div>
                            <Badge className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border-none shadow-sm",
                                s.status === 'pending' ? 'bg-secondary/10 text-secondary' : 
                                s.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-destructive/10 text-destructive'
                            )}>
                                {s.status}
                            </Badge>
                        </div>
                    ))}
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
