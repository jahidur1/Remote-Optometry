
'use client';

import { useState } from 'react';
import { collection, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, ArrowRightLeft, Info, Loader2, Send, History, CheckCircle2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { DemoBadge } from '@/components/ui/demo-badge';

export default function ShiftSwaps() {
  const db = useFirestore();
  const { profile, loading: userLoading } = useUser();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Fetch only active eligible employees for swap
  const { data: employees } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: mySwaps } = useCollection(profile?.employeeId ? query(collection(db, 'shift_swaps'), where('requesterId', '==', profile.employeeId), orderBy('createdAt', 'desc')) : null);

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
      await addDoc(collection(db, 'shift_swaps'), {
        requesterId: profile.employeeId,
        ...swapData,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      toast({ title: "Swap Requested", description: "Your request has been sent to the target professional for review." });
      setSwapData({ targetEmployeeId: '', date: '', reason: '' });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Shift Exchange</h1>
        <DemoBadge />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-md border-t-4 border-t-secondary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-secondary" />
              <CardTitle className="text-lg">Propose Swap</CardTitle>
            </div>
            <CardDescription>Request a shift exchange with another verified professional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Select Professional</Label>
              <Select onValueChange={(val) => setSwapData({ ...swapData, targetEmployeeId: val })}>
                <SelectTrigger className="h-11 font-bold">
                  <SelectValue placeholder="Target Employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.filter(e => e.id !== profile?.employeeId).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.fullName} ({e.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Target Date</Label>
              <Select onValueChange={(val) => setSwapData({ ...swapData, date: val })}>
                <SelectTrigger className="h-11 font-bold">
                  <SelectValue placeholder="Select Date" />
                </SelectTrigger>
                <SelectContent>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Justification</Label>
              <Textarea 
                placeholder="Brief reason for the exchange..." 
                className="min-h-[100px] font-medium"
                value={swapData.reason}
                onChange={(e) => setSwapData({ ...swapData, reason: e.target.value })}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/5 border-t p-4">
            <Button className="w-full bg-secondary font-black uppercase tracking-widest h-11" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin size-4 mr-2" /> : <Send className="size-4 mr-2" />}
              Send Exchange Request
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card className="bg-muted/30 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Info className="size-3 text-secondary" /> Swap Governance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Swaps are **provisional** until:
              </p>
              <div className="space-y-3">
                <div className="flex gap-2 items-center text-[10px] font-bold text-primary">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    <span>TARGET PROFESSIONAL ACCEPTS</span>
                </div>
                <div className="flex gap-2 items-center text-[10px] font-bold text-primary">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    <span>ADMIN VALIDATES CONSTRAINTS</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <History className="size-4" /> Request History
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {mySwaps?.length === 0 ? (
                        <p className="text-center py-8 text-xs text-muted-foreground italic">No recent exchange requests.</p>
                    ) : mySwaps?.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                            <div>
                                <p className="text-xs font-bold uppercase">{s.date}</p>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">To: {s.targetEmployeeId}</p>
                            </div>
                            <Badge variant="outline" className="text-[9px] font-black uppercase">{s.status}</Badge>
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
