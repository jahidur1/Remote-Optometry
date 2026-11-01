
'use client';

import { useFirestore, useCollection } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldX, Search, Filter, Loader2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';

export default function AdminSessionManager() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: sessions, loading } = useCollection(query(collection(db, 'sessions'), orderBy('lastActive', 'desc'), limit(100)));
  const { data: employees } = useCollection(collection(db, 'employees'));

  const handleRevokeAll = async (uid: string, employeeId: string) => {
    if (!confirm(`Revoke ALL sessions for employee ${employeeId}? This will force a logout on all their devices.`)) return;
    
    try {
      const userSessions = sessions?.filter(s => s.uid === uid && s.status === 'active');
      for (const s of (userSessions || [])) {
        await updateDoc(doc(db, 'sessions', `${s.uid}_${s.id}`), { status: 'revoked' });
      }
      logAudit(db, 'admin', 'REVOKE_ALL_SESSIONS', employeeId, { uid });
      toast({ title: "All Sessions Revoked" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filteredSessions = sessions?.filter(s => {
    const emp = employees?.find(e => e.id === s.employeeId);
    return emp?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || s.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">Institutional Session Audit</h1>
          <p className="text-muted-foreground">Monitoring active 365-day precision sessions across the workforce.</p>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-secondary" />
            <CardTitle className="text-lg uppercase font-black">Active Grid</CardTitle>
          </div>
          <div className="flex gap-2 w-full max-w-sm">
             <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter by professional..." 
                  className="pl-8 bg-white h-9"
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
                <TableHead>Device Detail</TableHead>
                <TableHead>Session Deadline</TableHead>
                <TableHead>Pulse</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="py-8"><Loader2 className="animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                ))
              ) : filteredSessions?.map((s: any) => {
                const emp = employees?.find(e => e.id === s.employeeId);
                const deadline = new Date(s.deadlineAt);
                const expired = new Date() > deadline;

                return (
                  <TableRow key={`${s.uid}_${s.id}`} className={s.status === 'revoked' ? 'opacity-40 grayscale bg-muted/5' : ''}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black text-sm">{emp?.fullName || 'Unknown'}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{s.employeeId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                       <p className="text-[11px] font-medium truncate text-muted-foreground">{s.label}</p>
                       <p className="text-[9px] font-black text-secondary uppercase tracking-widest mt-1">ID: {s.id.slice(-6)}</p>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                          <Clock className={`size-3 ${expired ? 'text-destructive' : 'text-emerald-500'}`} />
                          <span className={`text-xs font-black ${expired ? 'text-destructive' : ''}`}>{deadline.toLocaleDateString()}</span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <Badge variant={s.status === 'active' ? 'default' : 'outline'} className={s.status === 'active' ? 'bg-emerald-500' : ''}>
                          {s.status.toUpperCase()}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="text-destructive hover:bg-destructive/5 font-black text-[10px] uppercase tracking-widest"
                         onClick={() => handleRevokeAll(s.uid, s.employeeId)}
                       >
                          <ShieldX className="size-4 mr-2" /> Revoke Global
                       </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
