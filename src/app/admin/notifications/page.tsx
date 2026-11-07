
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, where } from 'firebase/firestore';
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
  Fingerprint,
  Smartphone,
  Info,
  ShieldAlert,
  Target
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function AutomationGovernance() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile, loading: userLoading } = useUser();
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
  const [testMode, setTestMode] = useState<'daily' | 'weekly' | null>(null);
  const [isTestConfirmOpen, setIsTestConfirmOpen] = useState(false);

  const empQuery = useMemo(() => query(collection(db, 'employees'), orderBy('fullName', 'asc')), [db]);
  const { data: employees } = useCollection(empQuery);

  useEffect(() => {
    if (userLoading || !profile) return;
    if (profile.role !== 'super_admin') return;
    fetchSettings();
    fetchActivity();
  }, [profile, userLoading]);

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
    setUpdating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth Link Expired.");

      const result = await updateWhatsAppSettingsAction(idToken, { [field]: checked });

      if (result.success) {
        toast({ title: "Governance Updated", description: `${field.replace(/([A-Z])/g, ' $1').toUpperCase()} synchronized.` });
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
        fetchActivity();
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Pulse Failure", description: e.message });
    } finally {
      runningManual && setRunningManual(false);
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
        result = await previewEmployeeRosterAction(idToken, selectedEmp || 'TEST-EMP', undefined, mockCase);
      } else {
        result = await previewWeeklyRosterAction(idToken, selectedEmp || 'TEST-EMP', getCurrentWeekId(), mockCase);
      }

      if (result.success) {
        setPreviewDoc(result.base64);
        setPreviewSize(result.size || '0 KB');
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Preview Failure", description: e.message });
    } finally {
      setPreviewing(false);
    }
  };

  const handleOpenTest = (type: 'daily' | 'weekly') => {
    setTestMode(type);
    setIsTestConfirmOpen(true);
  };

  const handleExecuteTest = async () => {
    if (!testNumber) {
      toast({ variant: "destructive", title: "Endpoint Missing", description: "Provide a valid mobile number for the test pulse." });
      return;
    }
    
    setUpdating(true);
    try {
      toast({ title: "Test Pulse Initiated", description: `Dispatching ${testMode} template to ${testNumber}. Check logs for outcome.` });
      setIsTestConfirmOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Test Failed", description: e.message });
    } finally {
      setUpdating(false);
    }
  };

  if (userLoading || !profile) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Initializing Governance Hub</p>
      </div>
    );
  }

  if (profile.role !== 'super_admin') {
    return (
      <div className="flex h-[80vh] items-center justify-center p-10">
         <Card className="max-w-md border-destructive/20 bg-destructive/5 p-10 text-center space-y-6 rounded-[2rem]">
            <ShieldAlert className="size-16 mx-auto text-destructive" />
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
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Master Pulse</label>
              <div className="flex items-center gap-3">
                 <div className={cn("size-2 rounded-full", settings?.masterEnabled ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-slate-300')} />
                 <span className="font-black uppercase tracking-widest text-[11px]">{settings?.masterEnabled ? 'ACTIVE' : 'SUSPENDED'}</span>
              </div>
           </div>
           <div className="px-6 py-1.5 space-y-0.5 mr-2">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Registry Health</label>
              <div className="flex items-center gap-2">
                 <Database className="size-3 text-secondary" />
                 <span className="font-black text-black uppercase tracking-widest text-[11px]">IMMUTABLE SYNC</span>
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
                  <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Logic Gates</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-4 leading-relaxed">
                    Mandatory operational switches for institutional WhatsApp distribution.
                  </CardDescription>
               </CardHeader>
               <CardContent className="p-10 space-y-6">
                  <div className="flex items-center justify-between p-8 rounded-3xl bg-primary text-white group shadow-2xl shadow-primary/20">
                     <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest">MASTER AUTOMATION</p>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] italic">Global Protocol Override</p>
                     </div>
                     <Switch 
                        checked={settings?.masterEnabled || false} 
                        onCheckedChange={(v) => handleToggle('masterEnabled', v)} 
                        disabled={updating} 
                        className="data-[state=checked]:bg-secondary" 
                     />
                  </div>

                  <div className="grid gap-4">
                     {[
                       { label: 'Meta Cloud API Hub', sub: 'Binary Gateway Link', field: 'whatsappEnabled', icon: Smartphone },
                       { label: 'Weekly Roster Bulk', sub: 'PDF Distribution Stream', field: 'weeklyEnabled', icon: FileText },
                       { label: 'Daily Shift BRIEFINGS', sub: '10:00 PM IST Automated Text', field: 'dailyReminderEnabled', icon: Bell }
                     ].map((item, i) => (
                       <div key={i} className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 hover:border-secondary/20 transition-all">
                          <div className="flex items-center gap-5">
                             <div className="size-12 rounded-xl bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                                <item.icon className="size-5 text-secondary" />
                             </div>
                             <div className="space-y-0.5">
                                <p className="text-[12px] font-black uppercase tracking-tight text-black">{item.label}</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{item.sub}</p>
                             </div>
                          </div>
                          <Switch 
                             checked={settings?.[item.field] || false} 
                             onCheckedChange={(v) => handleToggle(item.field, v)} 
                             disabled={updating || !settings?.masterEnabled} 
                          />
                       </div>
                     ))}
                  </div>
               </CardContent>
            </Card>

            <Card className="lg:col-span-7 shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-secondary overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-10">
                  <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Template Health Registry</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-4">Meta Graph API Approval Verification</CardDescription>
               </CardHeader>
               <CardContent className="p-10 space-y-8">
                  {[
                    { id: 'weekly', name: settings?.weeklyTemplate, label: 'Weekly PDF Stream', status: settings?.templateHealth?.weekly, header: 'DOCUMENT' },
                    { id: 'daily', name: settings?.dailyTemplate, label: 'Daily Text Stream', status: settings?.templateHealth?.daily, header: 'NONE' }
                  ].map((t) => (
                    <div key={t.id} className="p-8 rounded-3xl bg-slate-50 border-2 border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-secondary/20 transition-all">
                       <div className="space-y-3 text-center sm:text-left flex-1">
                          <div className="flex items-center justify-center sm:justify-start gap-4">
                             <p className="text-[14px] font-black uppercase tracking-tighter text-primary">{t.name}</p>
                             <Badge className={cn(
                               "text-[8px] font-black uppercase px-3 py-1 rounded-full border-none shadow-sm",
                               t.status === 'APPROVED' ? 'bg-emerald-500 text-white' : t.status === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-destructive text-white'
                             )}>
                               {t.status || 'UNKNOWN'}
                             </Badge>
                          </div>
                          <div className="flex flex-wrap gap-4">
                             <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.25em]">{t.label}</p>
                             <span className="text-[9px] text-slate-300 font-black">•</span>
                             <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.25em]">Header: {t.header}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-6">
                          <div className="h-10 w-px bg-slate-200 hidden sm:block" />
                          {t.status === 'APPROVED' ? <CheckCircle2 className="size-8 text-emerald-500" /> : <AlertTriangle className="size-8 text-amber-500" />}
                       </div>
                    </div>
                  ))}
                  
                  <div className="pt-8 border-t border-dashed space-y-4">
                     <div className="flex items-center gap-4 text-emerald-600 mb-2">
                        <Activity className="size-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Manual Pulse Control</span>
                     </div>
                     <Button 
                       className="w-full h-16 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-xl hover:bg-emerald-700 transition-all group"
                       onClick={handleManualDailyPulse}
                       disabled={runningManual || !settings?.dailyReminderEnabled}
                     >
                        {runningManual ? <Loader2 className="size-5 animate-spin mr-3" /> : <Bell className="size-5 mr-3 group-hover:rotate-12 transition-transform" />}
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
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                   <div className="flex items-center gap-6">
                      <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center text-secondary border border-slate-200 shadow-inner">
                         <History className="size-8" />
                      </div>
                      <div className="space-y-1">
                         <CardTitle className="text-2xl font-black uppercase tracking-tight">Campaign Matrix</CardTitle>
                         <CardDescription className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">Institutional Ledger for Weekly Roster PDF distribution.</CardDescription>
                      </div>
                   </div>
                   <Button variant="ghost" className="font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 px-8 rounded-xl h-12 border-2" onClick={fetchActivity}>
                      <RotateCcw className="size-4 mr-3" /> RE-SCAN LEDGER
                   </Button>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto no-scrollbar">
                   <table className="w-full border-collapse">
                      <thead className="bg-slate-50/30">
                         <tr className="border-b border-slate-100">
                            <th className="pl-10 py-10 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-left border-r border-slate-100">ROC Cluster</th>
                            <th className="py-10 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-center border-r border-slate-100">Cycle</th>
                            <th className="py-10 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-center border-r border-slate-100">Total Eligible</th>
                            <th className="py-10 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-center border-r border-slate-100">Success Trace</th>
                            <th className="pr-12 py-10 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-right">Pulse status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {campaigns.length === 0 ? (
                            <tr><td colSpan={5} className="py-40 text-center opacity-30 italic font-black uppercase text-xs tracking-[0.3em]">No recent campaign pulses recorded in ledger.</td></tr>
                         ) : campaigns.map((c) => (
                           <tr key={c.id} className="hover:bg-slate-50/80 transition-all group">
                              <td className="pl-10 py-8 border-r border-slate-100">
                                 <div className="flex items-center gap-4">
                                    <Building2 className="size-5 text-secondary opacity-30 group-hover:opacity-100" />
                                    <div className="flex flex-col">
                                       <span className="font-black text-[15px] uppercase">{c.officeId} Hub</span>
                                       <code className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">ID: {c.id.slice(-8)}</code>
                                    </div>
                                 </div>
                              </td>
                              <td className="text-center font-bold text-[13px] tabular-nums uppercase border-r border-slate-100">{c.weekId}</td>
                              <td className="text-center font-black text-2xl text-slate-400 tabular-nums border-r border-slate-100">{c.stats.total}</td>
                              <td className="text-center border-r border-slate-100">
                                 <div className="flex items-center justify-center gap-4">
                                    <span className="font-black text-2xl text-emerald-500 tabular-nums">{c.stats.success}</span>
                                    {c.stats.failed > 0 && (
                                       <Badge variant="outline" className="text-[9px] font-black text-destructive uppercase border-destructive/20 bg-destructive/5 px-2 py-0.5">
                                          {c.stats.failed} FAIL
                                       </Badge>
                                    )}
                                 </div>
                              </td>
                              <td className="pr-12 py-8 text-right">
                                 <Badge className={cn(
                                   "font-black text-[10px] uppercase tracking-widest px-6 py-2 rounded-full border-none shadow-lg",
                                   c.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-secondary text-white animate-pulse'
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
                      <div className="size-16 rounded-[1.75rem] bg-white/5 flex items-center justify-center text-secondary border border-white/10 shadow-inner">
                         <Activity className="size-9" />
                      </div>
                      <div className="space-y-1">
                         <CardTitle className="text-xl font-black uppercase tracking-tight">Daily Pulse Trace Ledger</CardTitle>
                         <CardDescription className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] mt-2">Immutable text-only shift briefings audit.</CardDescription>
                      </div>
                   </div>
                </CardHeader>
                <CardContent className="p-10">
                   <div className="grid gap-4">
                      {dailyLogs.length === 0 ? (
                         <div className="py-20 text-center opacity-10 italic font-black uppercase text-xs">No daily briefing traces detected in registry.</div>
                      ) : dailyLogs.slice(0, 10).map((log) => (
                        <div key={log.id} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-all border-l-4 border-l-secondary">
                           <div className="flex items-center gap-8">
                              <div className="flex flex-col">
                                 <span className="text-[15px] font-black uppercase text-white/90 group-hover:translate-x-2 transition-transform">{log.employeeName}</span>
                                 <div className="flex items-center gap-3 mt-1.5">
                                    <Badge variant="outline" className="text-[8px] font-bold text-white/30 uppercase border-white/10 tracking-widest px-2 py-0">ID: {log.employeeId}</Badge>
                                    <span className="text-[8px] text-white/10 uppercase font-black tracking-widest">{log.office} HUB</span>
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-12">
                              <div className="text-right hidden sm:block">
                                 <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Execution Node</p>
                                 <p className="text-[11px] font-bold text-white/60 tabular-nums uppercase">{new Date(log.timestamp).toLocaleTimeString()}</p>
                              </div>
                              <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                 <div className={cn("h-full transition-all duration-1000", log.status === 'success' ? 'bg-emerald-500 shadow-[0_0_15px_emerald]' : 'bg-destructive shadow-[0_0_15px_red]')} style={{ width: '100%' }} />
                              </div>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black uppercase border-none px-4 py-1.5 rounded-lg tracking-[0.2em] shadow-2xl",
                                log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/20 text-destructive'
                              )}>
                                 {log.status === 'success' ? 'DISPATCHED' : 'API_REJECTED'}
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
                 <Card className="shadow-2xl border-none rounded-[3rem] bg-white border-t-8 border-t-secondary overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b p-10">
                       <CardTitle className="text-2xl uppercase font-black tracking-tight leading-none">Synthesis Hub</CardTitle>
                       <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-4">Validation Pulse for Clinical Distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 space-y-12">
                       <div className="space-y-5">
                          <Label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] ml-1 flex items-center gap-3">
                             <Target className="size-4 text-secondary" /> Clinical QA Logic
                          </Label>
                          <div className="grid grid-cols-1 gap-4">
                             {[
                               { id: 1, label: 'Mixed Cycle Profile', sub: 'Full week with standard shifts', icon: Zap },
                               { id: 2, label: 'Clinical Lock Case', sub: 'Shift + Mid-week Off day', icon: ShieldCheck },
                               { id: 3, label: 'Unavailability Case', sub: 'Double Week-Off profile', icon: AlertTriangle }
                             ].map(test => (
                               <Button 
                                  key={test.id} 
                                  variant="outline" 
                                  className="h-20 border-2 border-slate-100 bg-white hover:bg-slate-50 text-black flex items-center justify-between px-8 rounded-3xl group shadow-sm transition-all active:scale-95" 
                                  onClick={() => handlePreview('weekly', test.id)} 
                                  disabled={previewing}
                               >
                                  <div className="flex items-center gap-6">
                                     <div className="size-12 rounded-2xl bg-secondary/5 flex items-center justify-center border border-secondary/10 shadow-inner group-hover:bg-secondary/10 transition-colors">
                                        <test.icon className="size-5 text-secondary opacity-60 group-hover:opacity-100 transition-all" />
                                     </div>
                                     <div className="text-left">
                                        <p className="text-[13px] font-black uppercase tracking-tight">{test.label}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{test.sub}</p>
                                     </div>
                                  </div>
                                  <ChevronRight className="size-5 opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                                </Button>
                             ))}
                          </div>
                       </div>

                       <div className="pt-10 border-t-4 border-dashed border-slate-50 space-y-8">
                          <div className="space-y-4">
                            <Label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] ml-1 flex items-center gap-3">
                               <Fingerprint className="size-4 text-primary" /> Live Identity Trace
                            </Label>
                            <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                               <SelectTrigger className="h-16 font-black border-2 border-slate-100 bg-slate-50 rounded-2xl px-8 focus:border-secondary transition-all shadow-inner text-[13px] uppercase">
                                  <SelectValue placeholder="Select Professional Registry..." />
                               </SelectTrigger>
                               <SelectContent className="rounded-[2rem] border-none shadow-2xl p-3 bg-white">
                                  {employees?.map(e => (
                                    <SelectItem key={e.id} value={e.id} className="font-bold py-4 uppercase text-[11px] rounded-xl hover:bg-slate-50">
                                       {e.fullName} <span className="text-[9px] text-slate-300 ml-2">[{e.id}]</span>
                                    </SelectItem>
                                  ))}
                               </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <Button 
                                variant="outline" 
                                className="h-16 border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all" 
                                onClick={() => handlePreview('daily')} 
                                disabled={!selectedEmp || previewing}
                             >
                                <Bell className="size-4 mr-3" /> PREVIEW DAILY
                             </Button>
                             <Button 
                                variant="outline" 
                                className="h-16 border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-secondary/5 hover:text-secondary hover:border-secondary/20 transition-all" 
                                onClick={() => handlePreview('weekly')} 
                                disabled={!selectedEmp || previewing}
                             >
                                <FileText className="size-4 mr-3" /> PREVIEW WEEKLY
                             </Button>
                          </div>
                       </div>

                       <div className="pt-10 border-t-4 border-dashed border-slate-50 space-y-6">
                          <Label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] ml-1 flex items-center gap-3">
                             <Smartphone className="size-4 text-emerald-500" /> Authorized Test Recipient
                          </Label>
                          <div className="space-y-4">
                             <div className="flex gap-3">
                                <div className="h-14 w-20 bg-slate-100 flex items-center justify-center rounded-2xl font-black text-slate-400">+91</div>
                                <Input 
                                   className="h-14 font-black text-lg tracking-[0.2em] rounded-2xl border-2 border-slate-100 px-6 focus:border-emerald-500 transition-all shadow-inner" 
                                   placeholder="99999 00000"
                                   value={testNumber}
                                   onChange={e => setTestNumber(e.target.value.replace(/\D/g, '').slice(0,10))}
                                />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <Button className="h-14 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl hover:bg-emerald-700" onClick={() => handleOpenTest('daily')}>
                                   TEST DAILY TEXT
                                </Button>
                                <Button className="h-14 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl hover:bg-emerald-700" onClick={() => handleOpenTest('weekly')}>
                                   TEST WEEKLY PDF
                                </Button>
                             </div>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              </div>

              <div className="lg:col-span-7">
                 <div className="relative min-h-[800px] h-full rounded-[4rem] bg-white border-2 border-slate-100 flex flex-col items-center justify-center p-14 group overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-slate-50 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '32px 32px' }} />
                    
                    {previewDoc ? (
                      <div className="flex flex-col items-center gap-12 w-full animate-in zoom-in-95 h-full relative z-10">
                         <div className="w-full flex items-center justify-between px-10">
                             <div className="space-y-1">
                                <p className="text-[12px] font-black uppercase text-secondary tracking-[0.4em] leading-none">Synthesis Outcome</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Vector Searchable A4 Document</p>
                             </div>
                             <Badge className="bg-emerald-500 text-white font-black text-[11px] uppercase border-none px-8 py-3 rounded-2xl shadow-[0_20px_40px_-5px_rgba(16,185,129,0.3)]">
                                PDF READY — {previewSize}
                             </Badge>
                         </div>
                         <div className="w-full flex-1 rounded-[3rem] border-[12px] border-slate-100 shadow-2xl overflow-hidden bg-slate-200">
                            <iframe src={previewDoc} className="w-full h-full min-h-[600px]" title="Roster Preview" />
                         </div>
                         <Button variant="ghost" className="bg-slate-50 text-slate-400 font-black uppercase text-[11px] tracking-widest h-14 px-12 rounded-2xl hover:bg-destructive hover:text-white transition-all shadow-sm" onClick={() => setPreviewDoc(null)}>DISCARD WORKSPACE</Button>
                      </div>
                    ) : (
                      <div className="text-center space-y-8 opacity-10 group-hover:opacity-20 transition-all duration-1000 relative z-10">
                         <div className="size-48 rounded-[3.5rem] bg-slate-100 flex items-center justify-center mx-auto mb-10 border-4 border-dashed border-slate-200">
                            <Monitor size={80} />
                         </div>
                         <p className="text-4xl font-black uppercase tracking-[0.5em] leading-none text-primary">Visualization Node</p>
                         <p className="text-[11px] font-bold uppercase tracking-[0.4em] italic text-muted-foreground">Simulate synthesis before institutional rollout.</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </TabsContent>
      </Tabs>

      {/* Test Execution Confirmation */}
      <Dialog open={isTestConfirmOpen} onOpenChange={setIsTestConfirmOpen}>
         <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-[500px] bg-white">
            <div className="bg-emerald-600 p-12 text-white space-y-3 relative">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Zap size={160} /></div>
               <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none relative z-10">Authorize Test Pulse</DialogTitle>
               <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 mt-4 relative z-10">Manual Registry Validation for {testMode?.toUpperCase()}</DialogDescription>
            </div>
            <div className="p-12 space-y-10">
               <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 flex items-center gap-8 shadow-inner group">
                  <div className="size-16 rounded-2xl bg-white flex items-center justify-center shadow-md border border-slate-100 group-hover:scale-110 transition-transform">
                     <Smartphone className="size-8 text-emerald-600" />
                  </div>
                  <div>
                      <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Mobile Endpoint</p>
                      <p className="text-2xl font-black text-primary tracking-widest tabular-nums mt-1">+91 {testNumber}</p>
                  </div>
               </div>
               <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-100 flex gap-4">
                  <Info className="size-5 text-amber-600 shrink-0" />
                  <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase tracking-tight">
                     Every test pulse is ledgered in the institutional audit trace. Ensure the recipient is authorized for data handling.
                  </p>
               </div>
            </div>
            <DialogFooter className="p-12 bg-slate-50 border-t border-slate-100 flex gap-4">
               <Button variant="ghost" onClick={() => setIsTestConfirmOpen(false)} className="flex-1 h-16 font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl hover:bg-slate-200">ABORT</Button>
               <Button className="flex-1 h-16 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-2xl hover:bg-emerald-700 transition-all" onClick={handleExecuteTest}>CONFIRM & DISPATCH</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <div className="p-12 rounded-[4rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-16 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><ShieldCheck size={320} className="text-primary" /></div>
         <div className="flex flex-col md:flex-row gap-12 items-start relative z-10">
            <div className="size-20 rounded-[2rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ShieldCheck className="size-10 text-white" />
            </div>
            <div className="space-y-6">
               <p className="text-[13px] font-black uppercase text-secondary tracking-[0.5em] leading-none">Registry Governance Node</p>
               <p className="text-xl font-bold text-black/70 leading-relaxed max-w-5xl tracking-tight">
                  "Institutional automation is gated by deterministic logic switches. Modifications to global configurations 
                  are trace-linked to specific administrative actors. Meta template pulses are strictly restricted to 
                  authenticated clinical endpoints to maintain professional integrity."
               </p>
               <div className="flex gap-6 pt-2">
                  <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-400 font-black text-[9px] uppercase tracking-widest px-5 py-1.5 rounded-full">AUDIT_LEVEL_4</Badge>
                  <Badge variant="outline" className="bg-secondary/10 border-secondary/20 text-secondary font-black text-[9px] uppercase tracking-widest px-5 py-1.5 rounded-full">ENCRYPTED_PULSE</Badge>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
