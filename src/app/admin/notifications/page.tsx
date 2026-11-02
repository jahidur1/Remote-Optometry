'use client';

import { useState } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, BellRing, CheckCircle2, XCircle, Search, Filter, Info, Send, Terminal, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';
import { useToast } from '@/hooks/use-toast';
import { sendWhatsAppTestMessage } from '@/services/whatsapp-action';

export default function NotificationDashboard() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [testing, setTesting] = useState(false);

  // Fetch Delivery Logs (PII Masked in the DB logic or UI)
  const logsQuery = query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(100));
  const { data: logs, loading } = useCollection(logsQuery);
  const { data: employees } = useCollection(query(collection(db, 'employees')));

  const filteredLogs = logs?.filter(log => {
    const emp = employees?.find(e => e.id === log.employeeId);
    return emp?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           log.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleTestConnection = async () => {
    const targetEmp = employees?.find(e => e.whatsappNumber);
    if (!targetEmp) {
      toast({ title: "No Test Target", description: "Register an employee with a WhatsApp number first.", variant: "destructive" });
      return;
    }

    setTesting(true);
    try {
      const result = await sendWhatsAppTestMessage(targetEmp.whatsappNumber);
      if (result.success) {
        toast({ title: "API Connected", description: `Test message sent to ${targetEmp.fullName}.` });
      } else {
        toast({ title: "API Warning", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Connectivity Failed", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8 pb-24 max-w-[1600px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary font-headline uppercase leading-none">Notification Center</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
             Meta Cloud API Node • Automated Shift Briefings <MessageCircle className="size-3 text-secondary" />
          </p>
        </div>
        <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="bg-white border-2 border-secondary/20 text-secondary font-black uppercase text-[11px] tracking-widest h-12 px-8 rounded-2xl transition-all hover:bg-secondary/5"
              onClick={handleTestConnection}
              disabled={testing}
            >
                {testing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Terminal className="size-4 mr-2" />}
                Validate API Link
            </Button>
            <Button className="bg-secondary shadow-2xl shadow-secondary/20 font-black uppercase text-[11px] tracking-widest h-12 px-10 rounded-2xl transition-all hover:scale-105 active:scale-95">
                <BellRing className="size-4 mr-2" /> Broadcast Pulse
            </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-4">
          <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden glass-card bg-emerald-500/5">
              <CardContent className="p-8">
                  <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-4">Delivered (24h)</p>
                  <div className="text-5xl font-black text-emerald-600 tracking-tighter">
                    {logs?.filter(l => l.status === 'success').length || 0}
                  </div>
                  <Badge variant="outline" className="text-[8px] font-black uppercase mt-4 border-emerald-500/20 text-emerald-600 bg-white">
                    Institutional Verified
                  </Badge>
              </CardContent>
          </Card>
          <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden glass-card bg-destructive/5">
              <CardContent className="p-8">
                  <p className="text-[10px] font-black uppercase text-destructive tracking-widest mb-4">API Rejected</p>
                  <div className="text-5xl font-black text-destructive tracking-tighter">
                    {logs?.filter(l => l.status === 'failed').length || 0}
                  </div>
                  <p className="text-[9px] text-destructive/60 uppercase font-black mt-4 tracking-tighter italic">Requires Validation</p>
              </CardContent>
          </Card>
          <Card className="md:col-span-2 bg-primary text-primary-foreground shadow-2xl rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700"><MessageCircle size={160} /></div>
            <CardContent className="p-10 relative z-10">
                <div className="flex gap-8 items-start">
                    <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
                       <Info className="size-8 text-white" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[11px] font-black uppercase text-secondary tracking-[0.3em]">Scheduler Policy</p>
                        <p className="text-sm font-medium leading-relaxed opacity-80 max-w-md">
                            Shift briefings are dispatched daily at **22:00 IST**. 
                            The engine exclusively pulls data from the **active published roster version**. 
                            Drafts are never notified to employees.
                        </p>
                    </div>
                </div>
            </CardContent>
          </Card>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card">
        <CardHeader className="bg-muted/30 border-b p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
               <MessageCircle className="size-6" />
            </div>
            <CardTitle className="text-xl font-black uppercase tracking-tight">Transmission Ledger</CardTitle>
          </div>
          <div className="flex gap-3 w-full max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/40" />
                <Input 
                  placeholder="Filter by professional or ID..." 
                  className="pl-11 h-11 text-[11px] font-bold bg-white border-none shadow-inner rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-2">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="py-5 px-8 text-left">Professional</th>
                <th className="px-8 text-left">Masked Target</th>
                <th className="px-8 text-left">Roster Ver.</th>
                <th className="px-8 text-center">Status</th>
                <th className="px-8 text-right pr-12">Dispatch (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/30">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="p-8"><Skeleton className="h-6 w-full rounded-full" /></td></tr>
                ))
              ) : filteredLogs?.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center opacity-30 italic font-black uppercase text-xs">No active logs found.</td></tr>
              ) : (
                filteredLogs?.map((log, i) => {
                  const emp = employees?.find(e => e.id === log.employeeId);
                  return (
                    <tr key={i} className="group hover:bg-muted/10 transition-colors">
                      <td className="py-6 px-8">
                        <div className="flex flex-col">
                            <span className="font-black text-[13px] text-primary tracking-tight">{emp?.fullName || log.employeeId}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{log.employeeId}</span>
                        </div>
                      </td>
                      <td className="px-8 font-mono text-[11px] font-black text-secondary tracking-tighter">{log.maskedPhone}</td>
                      <td className="px-8">
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/10 text-primary/40 bg-white">
                            V{log.rosterVersion?.toString().slice(-4) || '---'}
                        </Badge>
                      </td>
                      <td className="px-8 text-center">
                         {log.status === 'success' ? (
                           <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-[10px] uppercase">
                              <CheckCircle2 className="size-3.5" /> Delivered
                           </div>
                         ) : (
                           <div className="flex items-center justify-center gap-2 text-destructive font-black text-[10px] uppercase">
                              <XCircle className="size-3.5" /> API Error
                           </div>
                         )}
                      </td>
                      <td className="px-8 text-right pr-12 text-[10px] font-black text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
