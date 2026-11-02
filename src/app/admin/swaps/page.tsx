
'use client';

import { useState } from 'react';
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, CheckCircle2, XCircle, Clock, User, Filter, Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { DemoBadge } from '@/components/ui/demo-badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminSwapsManager() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: swaps, loading: swapsLoading } = useCollection(
    query(collection(db, 'shift_swaps'), orderBy('createdAt', 'desc'))
  );
  
  const { data: employees } = useCollection(query(collection(db, 'employees')));

  const handleUpdateStatus = async (swapId: string, status: 'approved' | 'rejected') => {
    try {
      const swapRef = doc(db, 'shift_swaps', swapId);
      await updateDoc(swapRef, {
        status,
        updatedAt: serverTimestamp(),
        actionedBy: profile?.uid
      });

      logAudit(db, profile?.uid || 'system', `SWAP_${status.toUpperCase()}`, swapId, { status });
      
      toast({ 
        title: `Swap ${status.charAt(0).toUpperCase() + status.slice(1)}`, 
        description: `The request has been updated in the clinical registry.` 
      });
    } catch (e: any) {
      toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
    }
  };

  const filteredSwaps = swaps?.filter(s => {
    const requester = employees?.find(e => e.id === s.requesterId);
    const target = employees?.find(e => e.id === s.targetEmployeeId);
    const text = `${requester?.fullName} ${target?.fullName} ${s.requesterId} ${s.targetEmployeeId}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase leading-none">Shift Exchange Hub</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium mt-2">Oversee and validate bilateral shift swaps requested by clinical professionals.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1 bg-primary text-primary-foreground shadow-xl rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <ArrowRightLeft size={120} />
          </div>
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-secondary">Policy: Clinical Swaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-[12px] leading-relaxed opacity-80">
              Swaps are bilateral agreements. Administrators must verify that the exchange does not violate daily pod quotas or gender balance targets.
            </p>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Integrity Check</span>
              </div>
              <p className="text-[10px] opacity-60">Approval moves the status to 'approved' but does not automatically re-publish the roster. Manual amendment may be required.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-md">
          <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input 
                placeholder="Search by professional..." 
                className="h-9 w-64 text-[11px] font-bold bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5">
                {swaps?.filter(s => s.status === 'pending').length || 0} Pending Validation
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="text-[10px] font-black uppercase tracking-widest">
                  <TableHead>Requester</TableHead>
                  <TableHead>Target Colleague</TableHead>
                  <TableHead>Proposed Date</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Management</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {swapsLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                  ))
                ) : filteredSwaps?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-24 text-center opacity-30 italic font-black uppercase text-xs">No swap requests in the registry.</TableCell>
                  </TableRow>
                ) : filteredSwaps?.map(s => {
                  const requester = employees?.find(e => e.id === s.requesterId);
                  const target = employees?.find(e => e.id === s.targetEmployeeId);
                  
                  return (
                    <TableRow key={s.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-black text-[13px] tracking-tight text-primary">{requester?.fullName || s.requesterId}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{s.requesterId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-black text-[13px] tracking-tight text-primary">{target?.fullName || s.targetEmployeeId}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{s.targetEmployeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-[11px] uppercase text-secondary">
                        {s.date}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-[10px] font-medium leading-relaxed truncate group-hover:whitespace-normal transition-all" title={s.reason}>
                          {s.reason || 'No justification provided.'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'pending' ? 'outline' : s.status === 'approved' ? 'default' : 'destructive'} className="text-[9px] font-black uppercase px-3 bg-opacity-10">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {s.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-8 w-8 text-emerald-600 rounded-full hover:bg-emerald-50" onClick={() => handleUpdateStatus(s.id, 'approved')}>
                              <CheckCircle2 size={16} />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 text-destructive rounded-full hover:bg-destructive/5" onClick={() => handleUpdateStatus(s.id, 'rejected')}>
                              <XCircle size={16} />
                            </Button>
                          </div>
                        )}
                        {s.status !== 'pending' && (
                           <span className="text-[10px] font-bold text-muted-foreground uppercase">Actioned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
