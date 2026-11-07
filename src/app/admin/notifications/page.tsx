'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { useFirestore, useUser, useAuth, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Zap, 
  ShieldCheck, 
  Activity, 
  MessageSquare, 
  Loader2, 
  Eye, 
  Clock, 
  ImageIcon,
  Settings2,
  Save,
  RotateCcw,
  FileText,
  Calendar,
  ChevronRight,
  Monitor,
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  History,
  Send,
  Building2,
  User,
  Fingerprint
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWhatsAppSettingsAction, updateWhatsAppSettingsAction } from '@/services/whatsapp-settings-action';
import { previewEmployeeRosterAction } from '@/services/roster-notification-service';
import { previewWeeklyRosterAction, getRecentCampaignsAction } from '@/services/weekly-roster-pdf-service';
import { runDailyShiftReminders } from '@/services/daily-reminder-service';
import { cn } from '@/lib/utils';
import { getCurrentWeekId } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';

export default function AutomationGovernance() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [runningManual, setRunningManual] = useState(false);
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);

  // Sandbox States
  const [selectedEmp, setSelectedEmp] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const empQuery = useMemo(() => query(collection(db, 'employees'), orderBy('fullName', 'asc')), [db]);
  const { data: employees } = useCollection(empQuery);

  useEffect(() => {
    if (profile?.role !== 'super_admin') return;
    fetchSettings();
    fetchActivity();
  }, [profile]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getWhatsAppSettingsAction();
      setSettings(data);
    } catch (e: any) {
      toast({ title: "Fetch Failure", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const campRes = await getRecentCampaignsAction();
      if (campRes.success) setCampaigns(campRes.campaigns);

      // Latest daily logs
      const q = query(collection(db, 'whatsapp_logs'), where('notificationType', '==', 'daily_shift_reminder'), orderBy('timestamp', 'desc'), limit(50));
      onSnapshot(q, (snap) => {
        setDailyLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } catch (e) {}
  };

  const handleToggle = async (field: string, checked: boolean) => {
    const prevValue = settings?.[field];
    if (!confirm(`MODIFICATION PULSE: Confirm changing ${field} from ${prevValue} to ${checked}?`)) return;

    setUpdating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth Link Expired.");

      const result = await updateWhatsAppSettingsAction(idToken, { [field]: checked });

      if (result.success) {
        toast({ title: "Institutional Registry Synchronized" });
        fetchSettings();
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Governance Conflict", description: e.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleManualDailyPulse = async () => {
    if (!confirm("EMERGENCY PULSE: Dispatch text reminders to all eligible professionals immediately?")) return;
    
    setRunningManual(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const result = await runDailyShiftReminders(true, idToken);
      if (result.success) {
        toast({ 
          title: "Pulse Complete", 
          description: `Success: ${result.stats.success}, Failed: ${result.stats.fail}, Skipped: ${result.stats.skipped}` 
        });
        fetchSettings();
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Pulse Failure", description: e.message });
    } finally {
      setRunningManual(false);
    }
  };

  const handlePreview = async (type: 'daily' | 'weekly', mockCase?: number) => {
    setPreviewing(true);
    setPreviewDoc(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth Link Missing.");

      let result;
      if (type === 'daily') {
        result = await previewEmployeeRosterAction(idToken, selectedEmp || 'TEST-EMP', mockCase);
      } else {
        result = await previewWeeklyRosterAction(idToken, selectedEmp || 'TEST-EMP', getCurrentWeekId(), mockCase);
      }

      if (result.success) {
        setPreviewDoc(result.base64);
        setPreviewSize(result.size);
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Preview Failure", description: e.message });
    } finally {
      setPreviewing(false);
    }
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex h-[80vh] items-center justify-center p-10">
         <Card className="max-w-md border-destructive/20 bg-destructive/5 p-10 text-center space-y-6 rounded-[2rem]">
            <ShieldCheck className="size-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-black uppercase text-primary tracking-tighter">Privileged Node Restricted</h2>
            <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed">
              WhatsApp Governance and global automation controls are restricted to active Super Administrative accounts only.
            </p>
         </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
      {/* Precision Header Hub */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Zap className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight uppercase leading-none">WhatsApp Governance</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Automation Hub <ShieldCheck className="size-3 text-secondary animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
           <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Master Switch</label>
              <div className="flex items-center gap-3">
                 <div className={cn("size-2 rounded-full", settings?.masterEnabled ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-slate-300')} />
                 <span className="font-black uppercase tracking-widest text-[11px]">{settings?.masterEnabled ? 'ACTIVE' : 'SUSPENDED'}</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">API Health</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black uppercase tracking-widest text-[11px]">SYNCED</span>
              </div>
           </div>
        </div>
      </div>

      <Tabs defaultValue="controls" className="space-y-10">
        <TabsList className="h-16 bg-white border-2 border-slate-100 rounded-2xl p-1.5 shadow-sm overflow-x-auto no-scrollbar">
          <TabsTrigger value="controls" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
             <Settings2 className="size-3.5 mr-3" /> System Controls
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
             <Activity className="size-3.5 mr-3" /> Intelligence Matrix
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
             <Monitor className="size-3.5 mr-3" /> Sandbox Lab
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: System Controls */}
        <TabsContent value="controls" className="space-y-10 animate-in">
          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-5 shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-primary overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-10">
                  <CardTitle className="text-xl uppercase font-black tracking-tight">Governance Switches</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-3">Mandatory logic gates for institutional dispatches.</CardDescription>
               </CardHeader>
               <CardContent className="p-10 space-y-6">
                  <div className="flex items-center justify-between p-6 rounded-2xl bg-primary text-white group">
                     <div className="space-y-1">
                        <p className="text-[12px] font-black uppercase tracking-tight">MASTER AUTOMATION</p>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest italic">Global Logic Override</p>
                     </div>
                     <Switch checked={settings?.masterEnabled || false} onCheckedChange={(v) => handleToggle('masterEnabled', v)} disabled={updating} className="data-[state=checked]:bg-secondary" />
                  </div>

                  <div className="space-y-4">
                     {[
                       { label: 'Meta Cloud API', sub: 'Binary Dispatch Link', field: 'whatsappEnabled' },
                       { label: 'Weekly Roster Bulk', sub: 'PDF Campaign Trigger', field: 'weeklyEnabled' },
                       { label: 'Daily shift reminders', sub: '10PM IST Pulse', field: 'dailyReminderEnabled' }
                     ].map((item, i) => (
                       <div key={i} className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
                          <div className="space-y-1">
                             <p className="text-[11px] font-black uppercase tracking-tight text-black">{item.label}</p>
                             <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{item.sub}</p>
                          </div>
                          <Switch checked={settings?.[item.field] || false} onCheckedChange={(v) => handleToggle(item.field, v)} disabled={updating || !settings?.masterEnabled} />
                       </div>
                     ))}
                  </div>
               </CardContent>
            </Card>

            <Card className="lg:col-span-7 shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-secondary overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-10">
                  <CardTitle className="text-xl uppercase font-black tracking-tight">Template Health</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-3">Meta Graph API Approval Verification</CardDescription>
               </CardHeader>
               <CardContent className="p-10 space-y-8">
                  {[
                    { id: 'weekly', name: settings?.weeklyTemplate, label: 'Weekly PDF Stream', status: settings?.templateHealth?.weekly },
                    { id: 'daily', name: settings?.dailyTemplate, label: 'Daily Text Stream', status: settings?.templateHealth?.daily }
                  ].map((t) => (
                    <div key={t.id} className="p-8 rounded-3xl bg-slate-50 border-2 border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-secondary/20 transition-all">
                       <div className="space-y-2 text-center sm:text-left">
                          <div className="flex items-center justify-center sm:justify-start gap-3">
                             <p className="text-[11px] font-black uppercase tracking-widest text-primary">{t.name}</p>
                             <Badge className={cn(
                               "text-[8px] font-black uppercase px-2 py-0 rounded-md border-none shadow-sm",
                               t.status === 'APPROVED' ? 'bg-emerald-500' : t.status === 'PENDING' ? 'bg-amber-500' : 'bg-destructive'
                             )}>
                               {t.status || 'UNKNOWN'}
                             </Badge>
                          </div>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.25em]">{t.label}</p>
                       </div>
                       <div className="flex items-center gap-6">
                          <div className="h-10 w-px bg-slate-200 hidden sm:block" />
                          <div className="text-right hidden sm:block">
                             <p className="text-[8px] font-black uppercase text-slate-300 tracking-widest">Metadata</p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Category: Utility</p>
                          </div>
                          {t.status === 'APPROVED' ? <CheckCircle2 className="size-6 text-emerald-500" /> : <AlertTriangle className="size-6 text-amber-500" />}
                       </div>
                    </div>
                  ))}
                  
                  <div className="pt-6 border-t border-dashed">
                     <Button 
                       className="w-full h-14 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl hover:bg-emerald-700 transition-all"
                       onClick={handleManualDailyPulse}
                       disabled={runningManual || !settings?.dailyReminderEnabled}
                     >
                        {runningManual ? <Loader2 className="size-4 animate-spin mr-3" /> : <Bell className="size-4 mr-3" />}
                        EXECUTE MANUAL DAILY PULSE (T+1 & T+2)
                     </Button>
                  </div>
               </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Intelligence Matrix (Monitoring) */}
        <TabsContent value="monitoring" className="space-y-10 animate-in">
           <div className="grid gap-10 lg:grid-cols-1">
              <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
                <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                   <div className="flex items-center gap-6">
                      <div className="size-14 rounded-2xl bg-primary flex items-center justify-center text-secondary shadow-inner">
                         <History className="size-8" />
                      </div>
                      <div className="space-y-1">
                         <CardTitle className="text-2xl font-black uppercase tracking-tight">Campaign Ledger</CardTitle>
                         <CardDescription className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Live tracking for Weekly Roster PDF batches.</CardDescription>
                      </div>
                   </div>
                   <Button variant="ghost" className="font-black uppercase text-[9px] tracking-widest hover:bg-slate-100" onClick={fetchActivity}>
                      <RotateCcw className="size-3 mr-2" /> RE-SCAN LEDGER
                   </Button>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto no-scrollbar">
                   <table className="w-full border-collapse">
                      <thead className="bg-slate-50/30">
                         <tr className="border-b border-slate-100">
                            <th className="pl-10 py-8 uppercase text-[10px] font-black tracking-[0.3em] text-primary/60 text-left">Target Center</th>
                            <th className="py-8 uppercase text-[10px] font-black tracking-[0.3em] text-primary/60 text-center">Cycle</th>
                            <th className="py-8 uppercase text-[10px] font-black tracking-[0.3em] text-primary/60 text-center">Eligible Pool</th>
                            <th className="py-8 uppercase text-[10px] font-black tracking-[0.3em] text-primary/60 text-center">Success Pulse</th>
                            <th className="pr-12 py-8 uppercase text-[10px] font-black tracking-[0.3em] text-primary/60 text-right">Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {campaigns.length === 0 ? (
                            <tr><td colSpan={5} className="py-24 text-center opacity-30 italic font-black uppercase text-xs">No recent campaign pulses recorded.</td></tr>
                         ) : campaigns.map((c) => (
                           <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                              <td className="pl-10 py-8">
                                 <div className="flex items-center gap-4">
                                    <Building2 className="size-4 text-secondary opacity-30 group-hover:opacity-100" />
                                    <span className="font-black text-[14px] uppercase">{c.officeId}</span>
                                 </div>
                              </td>
                              <td className="text-center font-bold text-[12px] tabular-nums uppercase">{c.weekId}</td>
                              <td className="text-center font-black text-lg text-slate-400 tabular-nums">{c.stats.total}</td>
                              <td className="text-center">
                                 <div className="flex items-center justify-center gap-3">
                                    <span className="font-black text-lg text-emerald-500 tabular-nums">{c.stats.success}</span>
                                    {c.stats.failed > 0 && <span className="text-[10px] font-black text-destructive uppercase">/ {c.stats.failed} FAIL</span>}
                                 </div>
                              </td>
                              <td className="pr-12 py-8 text-right">
                                 <Badge className={cn(
                                   "font-black text-[9px] uppercase tracking-widest px-4 py-1 rounded-full",
                                   c.status === 'completed' ? 'bg-emerald-500' : 'bg-secondary animate-pulse'
                                 )}>
                                   {c.status}
                                 </Badge>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </CardContent>
              </Card>

              <Card className="shadow-2xl border border-slate-100 rounded-[2.5rem] bg-[#0F172A] text-white overflow-hidden">
                <CardHeader className="p-10 pb-6 border-b border-white/5 flex flex-row items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className="size-14 rounded-2xl bg-white/5 flex items-center justify-center text-secondary border border-white/10 shadow-inner">
                         <Activity className="size-8" />
                      </div>
                      <div className="space-y-1">
                         <CardTitle className="text-xl font-black uppercase tracking-tight">Daily Pulse Trace</CardTitle>
                         <CardDescription className="text-[10px] font-black uppercase text-white/30 tracking-widest">Immutable text-only shift briefings ledger.</CardDescription>
                      </div>
                   </div>
                </CardHeader>
                <CardContent className="p-10">
                   <div className="grid gap-4">
                      {dailyLogs.slice(0, 10).map((log) => (
                        <div key={log.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-all">
                           <div className="flex items-center gap-6">
                              <div className="flex flex-col">
                                 <span className="text-[13px] font-black uppercase text-white/90">{log.employeeName}</span>
                                 <code className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1">ID: {log.employeeId}</code>
                              </div>
                           </div>
                           <div className="flex items-center gap-10">
                              <div className="text-right hidden sm:block">
                                 <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Dispatch Node</p>
                                 <p className="text-[10px] font-bold text-white/60 uppercase">{log.office}</p>
                              </div>
                              <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                                 <div className={cn("h-full", log.status === 'success' ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-destructive')} style={{ width: '100%' }} />
                              </div>
                              <Badge variant="outline" className={cn(
                                "text-[8px] font-black uppercase border-white/10 tracking-widest",
                                log.status === 'success' ? 'text-emerald-400' : 'text-destructive'
                              )}>
                                 {log.status === 'success' ? 'SUBMITTED' : 'API_REJECTED'}
                              </Badge>
                           </div>
                        </div>
                      ))}
                   </div>
                </CardContent>
              </Card>
           </div>
        </TabsContent>

        {/* Tab 3: Sandbox Lab */}
        <TabsContent value="sandbox" className="space-y-10 animate-in">
           <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5 space-y-10">
                 <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-secondary overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b p-10">
                       <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Synthesis Workspace</CardTitle>
                       <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-3">Validation Pulse for Clinical Briefings</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] ml-1">QA Validation Cases</Label>
                          <div className="grid grid-cols-1 gap-3">
                             {[
                               { id: 1, label: 'Standard Roster', sub: 'Full working week profile' },
                               { id: 2, label: 'Shift + Week-Off', sub: 'Mixed clinical status' },
                               { id: 3, label: 'Double Week-Off', sub: 'High unavailability case' }
                             ].map(test => (
                               <Button key={test.id} variant="outline" className="h-16 border-2 border-slate-100 bg-white hover:bg-slate-50 text-black flex items-center justify-between px-6 rounded-2xl group" onClick={() => handlePreview('weekly', test.id)} disabled={previewing}>
                                  <div className="flex items-center gap-4">
                                     <FileText className="size-4 text-secondary opacity-40 group-hover:opacity-100" />
                                     <div className="text-left">
                                        <p className="text-[11px] font-black uppercase">{test.label}</p>
                                        <p className="text-[9px] text-slate-400 uppercase font-bold">{test.sub}</p>
                                     </div>
                                  </div>
                                  <ChevronRight className="size-4 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </Button>
                             ))}
                          </div>
                       </div>

                       <div className="pt-10 border-t border-dashed space-y-6">
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] ml-1">Live Professional Trace</Label>
                            <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                               <SelectTrigger className="h-14 font-black border-2 border-slate-100 bg-slate-50 rounded-2xl px-6 focus:border-secondary">
                                  <SelectValue placeholder="Select Professional..." />
                               </SelectTrigger>
                               <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
                                  {employees?.map(e => (
                                    <SelectItem key={e.id} value={e.id} className="font-bold py-3 uppercase text-[10px] rounded-xl">{e.fullName} [{e.id}]</SelectItem>
                                  ))}
                               </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <Button variant="outline" className="h-14 border-2 border-slate-100 text-black font-black uppercase text-[9px] tracking-widest rounded-xl hover:bg-slate-50 transition-all" onClick={() => handlePreview('daily')} disabled={!selectedEmp || previewing}>
                                <Activity className="size-4 mr-2 text-secondary" /> PREVIEW DAILY TEXT
                             </Button>
                             <Button variant="outline" className="h-14 border-2 border-slate-100 text-black font-black uppercase text-[9px] tracking-widest rounded-xl hover:bg-slate-50 transition-all" onClick={() => handlePreview('weekly')} disabled={!selectedEmp || previewing}>
                                <FileText className="size-4 mr-2 text-primary" /> PREVIEW WEEKLY PDF
                             </Button>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              </div>

              <div className="lg:col-span-7">
                 <div className="relative min-h-[600px] h-full rounded-[3.5rem] bg-white border-2 border-slate-100 flex flex-col items-center justify-center p-12 group overflow-hidden shadow-2xl">
                    {previewDoc ? (
                      <div className="flex flex-col items-center gap-10 w-full animate-in zoom-in-95 h-full">
                         <div className="w-full flex items-center justify-between px-6">
                             <div className="space-y-1">
                                <p className="text-[11px] font-black uppercase text-secondary tracking-widest leading-none">Synthesis Outcome</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">Vector Searchable Document</p>
                             </div>
                             <Badge className="bg-emerald-500 text-white font-black text-[10px] uppercase border-none px-6 py-2 rounded-xl shadow-lg">
                                PDF READY — {previewSize}
                             </Badge>
                         </div>
                         <iframe src={previewDoc} className="w-full flex-1 rounded-[2rem] border-8 border-slate-50 shadow-inner min-h-[500px]" />
                         <Button variant="ghost" className="bg-slate-100 text-slate-400 font-black uppercase text-[10px] h-12 px-10 rounded-xl hover:bg-destructive hover:text-white transition-all" onClick={() => setPreviewDoc(null)}>CLEAR WORKSPACE</Button>
                      </div>
                    ) : (
                      <div className="text-center space-y-6 opacity-10 group-hover:opacity-20 transition-all duration-700">
                         <Monitor size={120} className="mx-auto" />
                         <p className="text-2xl font-black uppercase tracking-[0.5em] leading-none">Visualization Node</p>
                         <p className="text-[10px] font-bold uppercase tracking-widest italic">Simulate synthesis before institutional rollout.</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

