
'use client';

import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldX, Search, Loader2, Clock, Users, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';

export default function AdminSessionManager() {
  const db = useFirestore();
  const { profile: adminProfile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [revokingAll, setRevokingAll] = useState(false);

  const { data: sessions, loading } = useCollection(
    query(collection(db, 'sessions'), orderBy('deadlineAt', 'asc'), limit(100))
  );
  
  const { data: employees } = useCollection(collection(db, 'employees'));

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
      toast({ title: "Session Terminated" });
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
      toast({ title: `Terminated ${promises.length} sessions for ${employeeId}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRevokingAll(false);
    }
  };

  const filteredSessions = sessions?.filter(s => {
    const emp = employees?.find(e => e.id === s.employeeId);
    const text = `${emp?.fullName} ${s.employeeId} ${s.label}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">Session Governance</h1>
          <p className="text-muted-foreground">Oversight and emergency revocation of 365-day verified sessions.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="h-10 px-6 border-2 font-black uppercase text-[10px] tracking-widest bg-white/50">
             <ShieldCheck className="size-4 mr-2 text-emerald-600" /> Policy: Server-Enforced
           </Badge>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-secondary" />
            <CardTitle className="text-lg uppercase font-black">Institutional Device Grid</CardTitle>
          </div>
          <div className="flex gap-2 w-full max-w-md">
             <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by professional or ID..." 
                  className="pl-8 bg-white h-9 text-[11px] font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="uppercase text-[10px] font-black tracking-widest">
                <TableHead>Professional</TableHead>
                <TableHead>Device Intelligence</TableHead>
                <TableHead>Verification Pulse</TableHead>
                <TableHead>365-Day Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Governance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6} className="py-8"><Loader2 className="animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                ))
              ) : filteredSessions?.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic font-medium">No matching active sessions found.</TableCell>
                </TableRow>
              ) : filteredSessions?.map((s: any) => {
                const emp = employees?.find(e => e.id === s.employeeId);
                const deadline = new Date(s.deadlineAt);
                const expired = new Date() > deadline;

                return (
                  <TableRow key={`${s.uid}_${s.id}`} className={s.status === 'revoked' ? 'opacity-40 grayscale bg-muted/5' : 'group hover:bg-muted/5 transition-colors'}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black text-[13px] tracking-tight">{emp?.fullName || 'Unmapped'}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{s.employeeId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                       <p className="text-[11px] font-medium truncate text-muted-foreground">{s.label}</p>
                       <p className="text-[9px] font-black text-secondary uppercase tracking-widest mt-0.5">ID: {s.id.slice(-6)}</p>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold">{new Date(s.verifiedAt).toLocaleDateString()}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Latest OTP</span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                          <Clock className={`size-3 ${expired ? 'text-destructive' : 'text-emerald-500'}`} />
                          <span className={`text-[11px] font-black ${expired ? 'text-destructive' : 'text-foreground'}`}>{deadline.toLocaleDateString()}</span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <Badge variant={s.status === 'active' ? 'default' : 'outline'} className={`text-[9px] font-black uppercase px-2 py-0.5 ${s.status === 'active' ? 'bg-emerald-500' : ''}`}>
                          {s.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                          {s.status === 'active' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:bg-destructive/5 font-black text-[9px] uppercase tracking-widest h-8"
                                onClick={() => handleRevoke(s.uid, s.id, s.employeeId)}
                              >
                                <ShieldX className="size-3 mr-2" /> Revoke
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-2 text-[9px] font-black uppercase tracking-widest h-8 group-hover:bg-muted"
                                onClick={() => handleRevokeAllForEmployee(s.uid, s.employeeId)}
                                disabled={revokingAll}
                              >
                                <Users className="size-3 mr-2" /> All Devices
                              </Button>
                            </>
                          )}
                       </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="p-6 rounded-2xl bg-destructive/5 border-2 border-destructive/10 flex gap-6 items-start">
         <ShieldAlert className="size-8 text-destructive shrink-0" />
         <div className="space-y-1">
            <p className="text-sm font-black text-destructive uppercase tracking-widest">Privileged Action Protocol</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed font-medium">
               Revocation is immediate. Target device will be locked out upon its next network activity and redirected to the verification barrier. 
               This action is logged to the institutional audit trail for compliance.
            </p>
         </div>
      </div>
    </div>
  );
}
