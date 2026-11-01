
'use client';

import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Clock, ShieldX, RefreshCw, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getLocalSessionId } from '@/lib/session-utils';

export default function SessionManagement() {
  const db = useFirestore();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const currentSessionId = getLocalSessionId();

  const sessionsQuery = user ? query(collection(db, 'sessions'), where('uid', '==', user.uid)) : null;
  const { data: sessions, loading } = useCollection(sessionsQuery);

  const handleRevoke = async (sessionId: string, fullId: string) => {
    if (!confirm("Log out this device? You will need fresh OTP verification to use it again.")) return;
    try {
      await updateDoc(doc(db, 'sessions', fullId), { status: 'revoked' });
      toast({ title: "Session Terminated" });
      if (sessionId === currentSessionId) {
          router.push('/login');
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 pt-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl border hover:bg-muted">
            <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">My Authorized Devices</h1>
      </div>

      <div className="grid gap-4">
        {sessions?.filter(s => s.status === 'active').map((s: any) => {
          const isCurrent = s.id === currentSessionId;
          const deadline = new Date(s.deadlineAt);
          
          return (
            <Card key={s.id} className={`border-2 transition-all ${isCurrent ? 'border-secondary/40 shadow-lg' : 'opacity-80'}`}>
              <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                   <div className={`size-12 rounded-2xl flex items-center justify-center ${isCurrent ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'}`}>
                      {s.userAgent.includes('Mobile') ? <Smartphone /> : <Monitor />}
                   </div>
                   <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">{isCurrent ? 'Current Browser' : 'Authorized Device'}</p>
                        {isCurrent && <Badge className="bg-emerald-500 text-[9px] font-black tracking-widest">ACTIVE NOW</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{s.label}</p>
                      <div className="flex items-center gap-4 mt-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                         <span className="flex items-center gap-1"><Clock className="size-3" /> Deadline: {deadline.toLocaleDateString()}</span>
                         <span className="flex items-center gap-1"><RefreshCw className="size-3" /> Latest Sync: {new Date(s.verifiedAt).toLocaleDateString()}</span>
                      </div>
                   </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive border-destructive/20 hover:bg-destructive/5 font-black uppercase text-[10px] tracking-widest"
                  onClick={() => handleRevoke(s.id, `${s.uid}_${s.id}`)}
                >
                  <ShieldX className="size-4 mr-2" /> Revoke Access
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
