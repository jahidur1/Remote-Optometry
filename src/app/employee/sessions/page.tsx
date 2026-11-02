
'use client';

import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Clock, ShieldX, RefreshCw, Loader2, ArrowLeft, Laptop, ShieldCheck, Edit2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getLocalSessionId } from '@/lib/session-utils';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export default function SessionManagement() {
  const db = useFirestore();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const currentSessionId = getLocalSessionId();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');

  const sessionsQuery = user ? query(
    collection(db, 'sessions'), 
    where('uid', '==', user.uid), 
    where('status', '==', 'active')
  ) : null;

  const { data: sessions, loading } = useCollection(sessionsQuery);

  const handleRevoke = async (sessionId: string, fullId: string) => {
    if (!confirm("Terminate access for this device? You will require fresh OTP verification to use it again.")) return;
    try {
      await updateDoc(doc(db, 'sessions', fullId), { 
        status: 'revoked',
        revokedAt: new Date().toISOString()
      });
      toast({ title: "Session Terminated" });
      if (sessionId === currentSessionId) {
          router.push('/login');
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdateLabel = async (fullId: string) => {
    if (!labelInput.trim()) return;
    try {
      await updateDoc(doc(db, 'sessions', fullId), { label: labelInput });
      setEditingId(null);
      toast({ title: "Label Updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-secondary" />
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing Device Cloud</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 pt-4 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl border hover:bg-muted size-10 transition-all">
              <ArrowLeft className="size-5 text-primary" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">Authorized Devices</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">365-Day Security Cycle Active</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {sessions?.map((s: any) => {
          const isCurrent = s.id === currentSessionId;
          const deadline = new Date(s.deadlineAt);
          const fullId = `${s.uid}_${s.id}`;
          
          return (
            <Card key={s.id} className={`border-2 transition-all relative overflow-hidden group ${isCurrent ? 'border-secondary/40 shadow-xl' : 'border-muted opacity-80'}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-start gap-4">
                     <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${isCurrent ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'}`}>
                        {s.userAgent.includes('Mobile') ? <Smartphone className="size-7" /> : <Laptop className="size-7" />}
                     </div>
                     <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {editingId === s.id ? (
                            <div className="flex gap-2">
                              <Input 
                                value={labelInput} 
                                onChange={e => setLabelInput(e.target.value)} 
                                className="h-7 w-48 text-sm font-bold"
                                autoFocus
                              />
                              <Button size="sm" className="h-7 px-2 font-black text-[10px] uppercase" onClick={() => handleUpdateLabel(fullId)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 font-black text-[10px] uppercase" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <>
                              <p className="font-black text-lg tracking-tight">{s.label || 'Unknown Device'}</p>
                              <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingId(s.id); setLabelInput(s.label || ''); }}>
                                <Edit2 className="size-3" />
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                           <span className="flex items-center gap-1.5"><Clock className={`size-3 ${isCurrent ? 'text-secondary' : ''}`} /> Verified: {new Date(s.verifiedAt).toLocaleDateString()}</span>
                           <span className="flex items-center gap-1.5 text-accent"><ShieldCheck className="size-3" /> Deadline: {deadline.toLocaleDateString()}</span>
                           {isCurrent && <Badge className="bg-emerald-500 text-[8px] font-black tracking-widest h-4">Active Session</Badge>}
                        </div>
                     </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive border-destructive/20 hover:bg-destructive/5 font-black uppercase text-[10px] tracking-[0.15em] h-10 px-6 rounded-xl transition-all"
                    onClick={() => handleRevoke(s.id, fullId)}
                  >
                    <ShieldX className="size-4 mr-2" /> Revoke Access
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/20 border-dashed border-2 rounded-[1.5rem]">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-start">
             <div className="size-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-muted">
                <ShieldCheck className="size-6 text-secondary" />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-black text-primary uppercase tracking-widest">Institutional Session Policy</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                  Your clinical portal access is authorized per device. Every verification remains valid for 365 days 
                  before requiring a fresh mobile OTP check. Revoking a session will immediately sign you out 
                  of that specific device. 
                </p>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
