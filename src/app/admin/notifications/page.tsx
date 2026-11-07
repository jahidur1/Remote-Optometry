
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
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
  Target,
  Upload
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWhatsAppSettingsAction, updateWhatsAppSettingsAction } from '@/services/whatsapp-settings-action';
import { previewEmployeeRosterAction } from '@/services/roster-notification-service';
import { previewWeeklyRosterAction } from '@/services/weekly-roster-pdf-service';
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
  const [fetchingSettings, setFetchingSettings] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [runningManual, setRunningManual] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  // Sandbox States
  const [selectedEmp, setSelectedEmp] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [testMode, setTestMode] = useState<'daily' | 'weekly' | null>(null);
  const [isTestConfirmOpen, setIsTestConfirmOpen] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Standardized Data Fetches
  const empQuery = useMemo(() => query(collection(db, 'employees'), orderBy('fullName', 'asc')), [db]);
  const { data: employees } = useCollection(empQuery);

  const campQuery = useMemo(() => query(collection(db, 'weekly_roster_campaigns'), orderBy('createdAt', 'desc'), limit(10)), [db]);
  const { data: campaigns } = useCollection(campQuery);

  const dailyLogQuery = useMemo(() => query(
    collection(db, 'whatsapp_logs'), 
    where('notificationType', '==', 'daily_shift_reminder'), 
    orderBy('timestamp', 'desc'), 
    limit(20)
  ), [db]);
  const { data: dailyLogs } = useCollection(dailyLogQuery);

  useEffect(() => {
    if (userLoading || !profile) return;
    const role = profile.role?.toLowerCase();
    if (role === 'super_admin') {
      fetchSettings();
    }
  }, [profile, userLoading]);

  const fetchSettings = async () => {
    setFetchingSettings(true);
    try {
      const data = await getWhatsAppSettingsAction();
      setSettings(data);
    } catch (e: any) {
      toast({ title: "Fetch Failure", description: e.message, variant: "destructive" });
    } finally {
      setFetchingSettings(false);
    }
  };

  const handleToggle = async (field: string, checked: boolean) => {
    setUpdating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth Link Expired.");

      const result = await updateWhatsAppSettingsAction(idToken, { [field]: checked });

      if (result.success) {
        toast({ title: "Governance Updated", description: `${field.toUpperCase()} synchronized.` });
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Auth missing.");

        const result = await updateWhatsAppSettingsAction(idToken, { logoBase64: base64 });
        if (result.success) {
          toast({ title: "Logo Synchronized", description: "Institutional branding updated." });
          fetchSettings();
        } else {
          throw new Error(result.error);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failure", description: err.message });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleManualDailyPulse = async () => {
    if (!confirm("EMERGENCY PULSE: Dispatch text reminders immediately?")) return;
    
    setRunningManual(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const result = await runDailyShiftReminders(true, idToken);
      if (result.success) {
        toast({ 
          title: "Pulse Complete", 
          description: `Success: ${result.stats?.success || 0}, Failed: ${result.stats?.fail || 0}` 
        });
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
      toast({ variant: "destructive", title: "Endpoint Missing" });
      return;
    }
    toast({ title: "Test Pulse Initiated", description: "Checking Meta Cloud logs." });
    setIsTestConfirmOpen(false);
  };

  if (userLoading || fetchingSettings) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Initializing Governance Hub</p>
      </div>
    );
  }

  const role = profile?.role?.toLowerCase();
  if (role !== 'super_admin') {
    return (
      <div className="flex h-[80vh] items-center justify-center p-10">
         <Card className="max-w-md border-destructive/20 bg-destructive/5 p-10 text-center space-y-6 rounded-[2rem]">
            <ShieldAlert className="size-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-black uppercase text-primary tracking-tighter">Privileged Node Restricted</h2>
            <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed">
              WhatsApp Governance is restricted to active Super Administrative accounts only.
            </p>
         </Card>
      </div>
    );
  }

  const activeCampaign = campaigns?.find(c => c.status === 'processing');

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
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

        <TabsContent value="controls" className="space-y-10 animate-in">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-8">
              <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-primary overflow-hidden">
                 <CardHeader className="bg-slate-50/50 border-b p-10">
                    <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Logic Gates</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-4">Operational Switches</CardDescription>
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
                         { label: 'Daily Shift BRIEFINGS', sub: 'Scheduled Text', field: 'dailyReminderEnabled', icon: Bell }
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

              <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-secondary overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-10">
                  <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Branding Hub</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-4">Institutional PDF Identity</CardDescription>
                </CardHeader>
                <CardContent className="p-10 space-y-8">
                   <div className="flex flex-col items-center gap-8">
                      <div className="size-40 rounded-[2rem] bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group relative">
                         {settings?.logoBase64 ? (
                           <img src={settings.logoBase64} alt="Brand Logo" className="w-full h-full object-contain p-4" />
                         ) : (
                           <ImageIcon className="size-12 text-slate-200" />
                         )}
                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="ghost" className="text-white font-black uppercase text-[10px] tracking-widest" onClick={() => logoInputRef.current?.click()}>
                               {logoUploading ? <Loader2 className="animate-spin" /> : 'REPLACE'}
                            </Button>
                         </div>
                      </div>
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/png,image/jpeg" onChange={handleLogoUpload} />
                      <Button className="w-full bg-slate-100 text-black hover:bg-slate-200 font-black uppercase text-[10px] tracking-widest h-12 rounded-xl" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                        <Upload className="size-4 mr-3" /> {logoUploading ? 'SYNCING...' : 'UPLOAD BRAND LOGO'}
                      </Button>
                   </div>
                </CardContent>
              </Card>
            </div>

            <Card className="lg:col-span-7 shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-secondary overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-10">
                  <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Template Health Registry</CardTitle>
               </CardHeader>
               <CardContent className="p-10 space-y-8">
                  {[
                    { id: 'weekly', name: settings?.weeklyTemplate, label: 'Weekly PDF Stream', status: settings?.templateHealth?.weekly, header: 'DOCUMENT' },
                    { id: 'daily', name: settings?.dailyTemplate, label: 'Daily Text Stream', status: settings?.templateHealth?.daily, header: 'NONE' }
                  ].map((t) => (
                    <div key={t.id} className="p-8 rounded-3xl bg-slate-50 border-2 border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-secondary/20 transition-all">
                       <div className="space-y-3 text-center sm:text-left flex-1">
                          <div className="flex items-center justify-center sm:justify-start gap-4">
                             <p className="text-[14px] font-black uppercase tracking-tighter text-primary">{t.name || 'UNSET'}</p>
                             <Badge className={cn("text-[8px] font-black uppercase px-3 py-1 rounded-full border-none", t.status === 'APPROVED' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white')}>
                               {t.status || 'UNKNOWN'}
                             </Badge>
                          </div>
                          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.25em]">{t.label}</p>
                       </div>
                       {t.status === 'APPROVED' ? <CheckCircle2 className="size-8 text-emerald-500" /> : <AlertTriangle className="size-8 text-amber-500" />}
                    </div>
                  ))}
                  
                  <div className="pt-8 border-t border-dashed">
                     <Button className="w-full h-16 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-xl hover:bg-emerald-700 transition-all" onClick={handleManualDailyPulse} disabled={runningManual || !settings?.dailyReminderEnabled}>
                        {runningManual ? <Loader2 className="size-5 animate-spin mr-3" /> : <Bell className="size-5 mr-3" />}
                        EXECUTE MANUAL DAILY PULSE
                     </Button>
                  </div>
               </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-10 animate-in">
           <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
              <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                 <div className="flex items-center gap-6">
                    <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center text-secondary border border-slate-200">
                       <History className="size-8" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Campaign Matrix</CardTitle>
                 </div>
                 <Button variant="ghost" className="font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 px-8 rounded-xl h-12 border-2" onClick={fetchSettings}>
                    <RotateCcw className="size-4 mr-3" /> RE-SCAN LEDGER
                 </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto no-scrollbar">
                 <table className="w-full border-collapse">
                    <thead className="bg-slate-50/30">
                       <tr className="border-b border-slate-100">
                          <th className="pl-10 py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-left border-r">ROC Hub</th>
                          <th className="py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-center border-r">Cycle</th>
                          <th className="py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-center border-r">Success</th>
                          <th className="pr-12 py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-right">status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {campaigns?.length === 0 ? (
                          <tr><td colSpan={4} className="py-40 text-center opacity-30 italic font-black uppercase text-xs">No campaign pulses recorded.</td></tr>
                       ) : campaigns?.map((c) => (
                         <tr key={c.id} className="hover:bg-slate-50/80 transition-all group">
                            <td className="pl-10 py-8 border-r">
                               <div className="flex items-center gap-4">
                                  <Building2 className="size-5 text-secondary opacity-30" />
                                  <span className="font-black text-[15px] uppercase">{c.officeId} Hub</span>
                               </div>
                            </td>
                            <td className="text-center font-bold text-[13px] uppercase border-r">{c.weekId}</td>
                            <td className="text-center border-r font-black text-emerald-500 tabular-nums">{c.stats?.success || 0} / {c.stats?.total || 0}</td>
                            <td className="pr-12 py-8 text-right">
                               <Badge className={cn("font-black text-[10px] uppercase px-4 py-1.5 rounded-full", c.status === 'completed' ? 'bg-emerald-500' : 'bg-secondary animate-pulse')}>
                                 {c.status || 'PENDING'}
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
                   <div className="size-16 rounded-[1.75rem] bg-white/5 flex items-center justify-center text-secondary border border-white/10">
                      <Activity className="size-9" />
                   </div>
                   <CardTitle className="text-xl font-black uppercase tracking-tight">Daily Pulse Trace Ledger</CardTitle>
                </div>
             </CardHeader>
             <CardContent className="p-10">
                <div className="grid gap-4">
                   {dailyLogs?.length === 0 ? (
                      <div className="py-20 text-center opacity-10 italic font-black uppercase text-xs">No daily traces detected.</div>
                   ) : dailyLogs?.map((log) => {
                     const dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                     const timeStr = isNaN(dateObj.getTime()) ? '---' : dateObj.toLocaleTimeString();

                     return (
                       <div key={log.id} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-all border-l-4 border-l-secondary">
                          <div className="flex flex-col">
                             <span className="text-[15px] font-black uppercase text-white/90">{log.employeeName || 'Anonymous'}</span>
                             <span className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-1">{log.office || 'GLOBAL'} HUB</span>
                          </div>
                          <div className="flex items-center gap-12">
                             <span className="text-[11px] font-bold text-white/60 tabular-nums uppercase">{timeStr}</span>
                             <Badge variant="outline" className={cn("text-[9px] font-black uppercase border-none px-4 py-1.5 rounded-lg", log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/20 text-destructive')}>
                                {log.status || 'FAILED'}
                             </Badge>
                          </div>
                       </div>
                     );
                   })}
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="sandbox" className="space-y-10 animate-in">
           <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5 space-y-10">
                 <Card className="shadow-2xl border-none rounded-[3rem] bg-white border-t-8 border-t-secondary overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b p-10">
                       <CardTitle className="text-2xl uppercase font-black tracking-tight leading-none">Synthesis Hub</CardTitle>
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
                               <Button key={test.id} variant="outline" className="h-20 border-2 border-slate-100 bg-white hover:bg-slate-50 text-black flex items-center justify-between px-8 rounded-3xl group shadow-sm transition-all" onClick={() => handlePreview('weekly', test.id)} disabled={previewing}>
                                  <div className="flex items-center gap-6">
                                     <div className="size-12 rounded-2xl bg-secondary/5 flex items-center justify-center border border-secondary/10 group-hover:bg-secondary/10 transition-colors">
                                        <test.icon className="size-5 text-secondary" />
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
                               <SelectTrigger className="h-16 font-black border-2 border-slate-100 bg-slate-50 rounded-2xl px-8 focus:border-secondary transition-all text-[13px] uppercase">
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
                             <Button variant="outline" className="h-16 border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-emerald-50" onClick={() => handlePreview('daily')} disabled={!selectedEmp || previewing}>PREVIEW DAILY</Button>
                             <Button variant="outline" className="h-16 border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-secondary/5" onClick={() => handlePreview('weekly')} disabled={!selectedEmp || previewing}>PREVIEW WEEKLY</Button>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              </div>

              <div className="lg:col-span-7">
                 <div className="relative min-h-[800px] h-full rounded-[4rem] bg-white border-2 border-slate-100 flex flex-col items-center justify-center p-14 overflow-hidden shadow-2xl">
                    {previewDoc ? (
                      <div className="flex flex-col items-center gap-12 w-full animate-in zoom-in-95 h-full relative z-10">
                         <div className="w-full flex items-center justify-between px-10">
                             <div className="space-y-1">
                                <p className="text-[12px] font-black uppercase text-secondary tracking-[0.4em] leading-none">Synthesis Outcome</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Vector Searchable A4 Document</p>
                             </div>
                             <Badge className="bg-emerald-500 text-white font-black text-[11px] uppercase border-none px-8 py-3 rounded-2xl">READY — {previewSize}</Badge>
                         </div>
                         <div className="w-full flex-1 rounded-[3rem] border-[12px] border-slate-100 shadow-2xl overflow-hidden bg-slate-200">
                            <iframe src={previewDoc} className="w-full h-full min-h-[600px]" title="Roster Preview" />
                         </div>
                         <Button variant="ghost" className="bg-slate-50 text-slate-400 font-black uppercase text-[11px] tracking-widest h-14 px-12 rounded-2xl" onClick={() => setPreviewDoc(null)}>DISCARD WORKSPACE</Button>
                      </div>
                    ) : (
                      <div className="text-center space-y-8 opacity-10 relative z-10">
                         <div className="size-48 rounded-[3.5rem] bg-slate-100 flex items-center justify-center mx-auto mb-10 border-4 border-dashed border-slate-200">
                            <Monitor size={80} />
                         </div>
                         <p className="text-4xl font-black uppercase tracking-[0.5em] leading-none text-primary">Visualization Node</p>
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
