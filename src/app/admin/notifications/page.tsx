
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser, useAuth, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  MessageCircle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Terminal, 
  Loader2, 
  Settings2, 
  Image as ImageIcon, 
  Zap, 
  ShieldCheck,
  UploadCloud,
  History,
  Activity,
  ArrowRight,
  RefreshCcw,
  AlertTriangle,
  Info
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';
import { useToast } from '@/hooks/use-toast';
import { getWhatsAppSettingsAction, updateWhatsAppSettingsAction } from '@/services/whatsapp-settings-action';
import { runManualRosterBriefingAction } from '@/services/roster-notification-service';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE HUB (PART 2)
 * 
 * Privileged Command Center for SUPER_ADMIN only.
 * Manages institutional branding, master automation toggles, and Meta API telemetry.
 */
export default function NotificationDashboard() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Governance State
  const [wsSettings, setWsSettings] = useState<any>({ whatsappEnabled: false, automation: { masterEnabled: false, base64Logo: '', lastRun: null, lastStats: { success: 0, fail: 0, total: 0 } } });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringManual, setTriggeringManual] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await getWhatsAppSettingsAction();
        setWsSettings(data);
      } catch (e) {
        console.error("Registry Fetch Failure:", e);
      } finally {
        setSettingsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleToggleAutomation = async (checked: boolean) => {
    if (!confirm(`CONFIRMATION PROTOCOL: ${checked ? 'Initiate' : 'Suspend'} entire automated clinical briefing workflow?`)) return;
    
    const prev = { ...wsSettings };
    setWsSettings((prev: any) => ({ 
      ...prev, 
      whatsappEnabled: checked,
      automation: { ...prev.automation, masterEnabled: checked } 
    }));
    
    setSavingSettings(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;
      const res = await updateWhatsAppSettingsAction(idToken, { 
        enabled: checked, 
        masterEnabled: checked 
      });
      if (!res.success) throw new Error(res.error);
      toast({ title: "Governance Pulse Updated", description: `Automation is now ${checked ? 'ACTIVE' : 'SUSPENDED'}.` });
    } catch (e: any) {
      setWsSettings(prev);
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 150000) { 
      toast({ variant: "destructive", title: "Constraint Alert", description: "Logo must be < 150KB for optimized synthesis." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setSavingSettings(true);
      try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) return;
        const res = await updateWhatsAppSettingsAction(idToken, { 
            enabled: wsSettings.whatsappEnabled, 
            logoBase64: base64
        });
        if (!res.success) throw new Error(res.error);
        setWsSettings((prev: any) => ({ ...prev, automation: { ...prev.automation, base64Logo: base64 } }));
        toast({ title: "Branding Secured", description: "Institutional mark updated in image engine." });
      } catch (e: any) {
        toast({ variant: "destructive", title: "Upload Failed", description: e.message });
      } finally {
        setSavingSettings(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerManual = async () => {
    if (!confirm("EMERGENCY TEST PULSE: Initiate image synthesis and Meta API dispatch for active shifts. Proceed?")) return;
    
    setTriggeringManual(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;
      const result = await runManualRosterBriefingAction(idToken);
      if (result.success) {
        toast({ title: "Orchestration Complete", description: `Dispatched ${result.count} briefings successfully.` });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Broadcast Failure", description: e.message });
    } finally {
      setTriggeringManual(false);
    }
  };

  const logsQuery = useMemo(() => query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(50)), [db]);
  const { data: logs, loading: logsLoading } = useCollection(logsQuery);

  const isSuperAdmin = profile?.role === 'super_admin';

  if (!isSuperAdmin && !settingsLoading) return (
      <div className="flex h-[80vh] items-center justify-center animate-in">
          <Card className="max-w-md border-destructive/20 bg-destructive/5 p-12 text-center space-y-8 rounded-[3rem]">
              <div className="size-24 rounded-[2rem] bg-destructive/10 flex items-center justify-center mx-auto">
                 <AlertTriangle className="size-12 text-destructive" />
              </div>
              <div className="space-y-3">
                 <h2 className="text-3xl font-black uppercase tracking-tight text-primary">Access Restricted</h2>
                 <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed tracking-widest">
                    Automation governance is restricted to active system SUPER_ADMIN accounts only.
                 </p>
              </div>
              <Button variant="outline" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-2" onClick={() => window.history.back()}>
                 Return to Hub
              </Button>
          </Card>
      </div>
  );

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <MessageCircle className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Roster Automation</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                   Institutional Command Hub <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
            <Button 
                variant="outline" 
                className="bg-white border-2 border-secondary/20 text-secondary font-black uppercase text-[11px] tracking-widest h-14 px-10 rounded-[1.5rem] transition-all hover:bg-secondary hover:text-white group shadow-xl"
                onClick={handleTriggerManual}
                disabled={triggeringManual || !wsSettings.whatsappEnabled}
            >
                {triggeringManual ? <Loader2 className="size-5 mr-3 animate-spin" /> : <Zap className="size-5 mr-3 group-hover:rotate-12 transition-transform" />}
                Run Test Pulse
            </Button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-10">
          {/* Governance Node */}
          <Card className="shadow-2xl border-none rounded-[3rem] bg-white overflow-hidden border-t-8 border-t-primary">
            <CardHeader className="bg-slate-50/50 border-b p-10 space-y-4">
               <div className="flex items-center gap-6">
                  <div className="size-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
                    <Settings2 className="size-7" />
                  </div>
                  <div>
                    <CardTitle className="text-xl uppercase font-black tracking-tight leading-none text-black">Governance</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2">Master Toggle Logic</CardDescription>
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
                <div className="flex items-center justify-between p-8 rounded-3xl bg-slate-50 border-2 border-slate-100 group">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-black uppercase text-black tracking-widest">Master Pulse</Label>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">10:00 PM Daily Cycle</p>
                  </div>
                  <Switch 
                    checked={wsSettings.whatsappEnabled} 
                    onCheckedChange={handleToggleAutomation} 
                    disabled={savingSettings || settingsLoading}
                    className="data-[state=checked]:bg-emerald-500 scale-125"
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Organizational Mark</Label>
                  <div className="group relative">
                    <div className="h-44 rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4 transition-all group-hover:border-secondary group-hover:bg-secondary/5 overflow-hidden shadow-inner">
                      {wsSettings.automation?.base64Logo ? (
                        <>
                          <img src={wsSettings.automation.base64Logo} alt="Branding" className="h-24 object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <RefreshCcw className="size-8 text-white animate-spin-slow" />
                          </div>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-12 text-slate-300" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-8">PNG / JPG <br/><span className="text-[8px] opacity-40">MAX 150KB</span></p>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleLogoUpload}
                      disabled={savingSettings}
                    />
                  </div>
                </div>

                <div className="p-8 rounded-3xl bg-amber-50 border-2 border-amber-100 flex gap-6 items-start">
                   <ShieldCheck className="size-6 text-amber-600 shrink-0 mt-1" />
                   <div className="space-y-2">
                      <p className="text-[11px] font-black uppercase text-amber-700 tracking-tight">Zero-Config Optimization</p>
                      <p className="text-[10px] font-medium text-amber-600 leading-relaxed uppercase">
                        The system recursively reduces quality until the final roster PNG is strictly below the 60KB WhatsApp threshold.
                      </p>
                   </div>
                </div>
            </CardContent>
          </Card>

          {/* Connection Status Node */}
          <Card className="bg-[#0F172A] text-white shadow-2xl rounded-[3rem] p-10 space-y-8 relative overflow-hidden group border-none">
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:rotate-12 transition-transform duration-[2s]"><ImageIcon size={180} /></div>
              <div className="flex items-center gap-5 text-secondary">
                 <ShieldCheck className="size-6" />
                 <p className="text-[11px] font-black uppercase tracking-[0.4em]">Protocol Specs</p>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                   <span className="text-[10px] uppercase font-black text-white/40">Next Execution</span>
                   <span className="text-[11px] font-black text-emerald-400 tabular-nums">TODAY 22:00 IST</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                   <span className="text-[10px] uppercase font-black text-white/40">Retention Cycle</span>
                   <span className="text-[11px] font-black text-secondary">48H PURGE SYNC</span>
                </div>
                <div className="flex justify-between items-center pb-4">
                   <span className="text-[10px] uppercase font-black text-white/40">Cloud Node</span>
                   <span className="text-[11px] font-black text-white/80 uppercase">Asia/South-1</span>
                </div>
              </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-10">
          <div className="grid gap-6 md:grid-cols-3">
             {[
               { label: 'Success Pulse', value: wsSettings.automation?.lastStats?.success || 0, icon: CheckCircle2, color: 'text-emerald-500' },
               { label: 'Failure Trace', value: wsSettings.automation?.lastStats?.fail || 0, icon: XCircle, color: 'text-destructive' },
               { label: 'Cloud Synthesis', value: wsSettings.automation?.lastStats?.total || 0, icon: ImageIcon, color: 'text-secondary' }
             ].map((stat, i) => (
               <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all shadow-xl">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                   <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{stat.label}</CardTitle>
                   <stat.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", stat.color)} />
                 </CardHeader>
                 <CardContent>
                    <div className="text-5xl font-black text-black tracking-tighter tabular-nums">{stat.value}</div>
                 </CardContent>
               </Card>
             ))}
          </div>

          {/* Execution History Table */}
          <Card className="shadow-2xl border-none overflow-hidden rounded-[3rem] bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-slate-200">
                  <Terminal className="size-8 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tight text-black leading-none">Execution Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Meta API transmission tracing.</CardDescription>
                </div>
              </div>
              <div className="relative w-full max-w-sm group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-secondary transition-colors" />
                <Input 
                  placeholder="Filter Employee ID..." 
                  className="pl-12 h-12 rounded-2xl text-[11px] font-bold border-2 border-slate-100" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="w-[180px] pl-10 py-8 uppercase text-[10px] font-black tracking-[0.4em] border-r">Professional</TableHead>
                    <TableHead className="py-8 uppercase text-[10px] font-black tracking-[0.4em] border-r text-center">Byte Weight</TableHead>
                    <TableHead className="py-8 uppercase text-[10px] font-black tracking-[0.4em] border-r text-center">Dispatch Pulse</TableHead>
                    <TableHead className="text-right pr-12 py-8 uppercase text-[10px] font-black tracking-[0.4em]">IST Trace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    Array(8).fill(0).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={4} className="p-10"><Skeleton className="h-10 w-full rounded-xl opacity-10 bg-slate-200" /></TableCell></TableRow>
                    ))
                  ) : logs?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-40 text-center opacity-30 italic font-black uppercase text-xs tracking-[0.3em]">No transmission traces in institutional ledger.</TableCell></TableRow>
                  ) : (
                    logs?.filter(l => l.employeeId?.includes(searchTerm)).map((log, i) => (
                      <TableRow key={log.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                        <td className="py-8 px-10 border-r border-slate-100">
                          <div className="flex flex-col">
                              <span className="font-black text-[14px] text-primary tracking-tight uppercase group-hover:translate-x-1 transition-transform">{log.employeeId}</span>
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">TRC_{log.executionId?.slice(-8)}</span>
                          </div>
                        </td>
                        <td className="px-8 border-r border-slate-100 text-center">
                           <code className={cn(
                             "text-secondary font-black text-[11px] bg-secondary/5 px-3 py-1 rounded-md border border-secondary/10 shadow-inner",
                             log.imgSize?.includes('KB') && parseFloat(log.imgSize) > 60 ? 'text-destructive border-destructive/20 bg-destructive/5' : ''
                           )}>
                              {log.imgSize || '-- KB'}
                           </code>
                        </td>
                        <td className="px-8 border-r border-slate-100 text-center">
                           <Badge className={cn(
                             "text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg",
                             log.status === 'success' ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-destructive text-white shadow-destructive/20"
                           )}>
                             {log.status === 'success' ? 'DISPATCHED' : 'FAILED'}
                           </Badge>
                        </td>
                        <td className="px-10 text-right text-[12px] font-black text-black/40 tabular-nums">
                          {new Date(log.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="bg-slate-50/50 p-8 border-t border-slate-100">
               <div className="flex items-center gap-10">
                  <div className="size-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner">
                     <History className="size-6" />
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40">Audit Protocol Active</p>
                     <p className="text-[11px] font-medium text-black/70 leading-relaxed uppercase max-w-4xl tracking-tight">
                        Transmissions are strictly ledgered with 48-hour Storage TTL. Failures during the test pulse can be re-triggered manually without duplicating successful dispatches.
                     </p>
                  </div>
               </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
