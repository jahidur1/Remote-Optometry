
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, where, doc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser, useAuth, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Zap, 
  ShieldCheck, 
  Activity, 
  MessageSquare, 
  Loader2, 
  Settings2,
  RotateCcw,
  FileText,
  Monitor,
  Bell,
  CheckCircle2,
  AlertTriangle,
  History,
  Building2,
  Smartphone,
  ShieldAlert,
  Target,
  Send
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWhatsAppSettingsAction, updateWhatsAppSettingsAction } from '@/services/whatsapp-settings-action';
import { previewEmployeeRosterAction, sendTestWhatsAppAction } from '@/services/roster-notification-service';
import { runDailyShiftReminders } from '@/services/daily-reminder-service';
import { cn } from '@/lib/utils';
import { getCurrentWeekId } from '@/lib/date-utils';

function safeFormatTime(ts: any): string {
  if (!ts) return '---';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(date.getTime()) ? '---' : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '---';
  }
}

export default function AutomationGovernance() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile, loading: userLoading } = useUser();
  const { toast } = useToast();

  const [settings, setSettings] = useState<any>(null);
  const [fetchingSettings, setFetchingSettings] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [runningManual, setRunningManual] = useState(false);

  // Sandbox States
  const [selectedEmp, setSelectedEmp] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

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
        toast({ title: "Governance Updated" });
        fetchSettings();
      } else throw new Error(result.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Conflict", description: e.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleManualDailyPulse = async () => {
    if (!confirm("Dispatch text reminders immediately?")) return;
    setRunningManual(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const result = await runDailyShiftReminders(true, idToken);
      if (result.success) {
        toast({ title: "Pulse Complete", description: `Success: ${result.stats?.success || 0}` });
      } else throw new Error(result.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Pulse Failure", description: e.message });
    } finally {
      setRunningManual(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedEmp) return;
    setPreviewing(true);
    setPreviewDoc(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const result = await previewEmployeeRosterAction(idToken, selectedEmp, getCurrentWeekId());
      if (result.success) setPreviewDoc(result.base64!);
      else throw new Error(result.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Preview Failed", description: e.message });
    } finally {
      setPreviewing(false);
    }
  };

  const handleSendTest = async (type: 'daily' | 'weekly') => {
    if (!selectedEmp) return;
    setSendingTest(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const result = await sendTestWhatsAppAction(idToken, selectedEmp, type);
      if (result.success) {
        toast({ title: "Test Dispatched", description: `Meta Message ID: ${result.messageId}` });
      } else throw new Error(result.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "API Conflict", description: e.message });
    } finally {
      setSendingTest(false);
    }
  };

  if (userLoading || fetchingSettings) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Establishing Governance Hub</p>
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
         </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Zap className="size-8 text-secondary" />
            </div>
            <h1 className="text-4xl font-black tracking-tight uppercase leading-none">WhatsApp Governance</h1>
          </div>
        </div>
      </div>

      <Tabs defaultValue="controls" className="space-y-10">
        <TabsList className="h-16 bg-white border-2 border-slate-100 rounded-2xl p-1.5 shadow-sm overflow-x-auto no-scrollbar">
          <TabsTrigger value="controls" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">System Controls</TabsTrigger>
          <TabsTrigger value="monitoring" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Intelligence Matrix</TabsTrigger>
          <TabsTrigger value="sandbox" className="h-full rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Sandbox Lab</TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="space-y-10">
           <div className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-8">
                <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-primary p-10 space-y-10">
                   <div className="flex items-center justify-between p-8 rounded-3xl bg-primary text-white shadow-2xl shadow-primary/20">
                      <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest">MASTER AUTOMATION</p>
                        <p className="text-[9px] text-white/40 font-bold uppercase italic tracking-[0.2em]">Global Logic Switch</p>
                      </div>
                      <Switch checked={settings?.masterEnabled || false} onCheckedChange={(v) => handleToggle('masterEnabled', v)} disabled={updating} />
                   </div>
                   <div className="grid gap-4">
                      {[
                        { label: 'Meta Cloud API Hub', field: 'whatsappEnabled', icon: Smartphone },
                        { label: 'Weekly Roster Bulk', field: 'weeklyEnabled', icon: FileText },
                        { label: 'Daily Shift Briefings', field: 'dailyReminderEnabled', icon: Bell }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border-2 border-slate-100">
                           <div className="flex items-center gap-4">
                              <item.icon className="size-5 text-secondary" />
                              <span className="text-[12px] font-black uppercase">{item.label}</span>
                           </div>
                           <Switch checked={settings?.[item.field] || false} onCheckedChange={(v) => handleToggle(item.field, v)} disabled={updating || !settings?.masterEnabled} />
                        </div>
                      ))}
                   </div>
                </Card>
              </div>
              <div className="lg:col-span-6">
                <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-secondary p-10">
                   <CardTitle className="text-xl uppercase font-black tracking-tight mb-8">Manual Overrides</CardTitle>
                   <Button className="w-full h-16 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-xl hover:bg-emerald-700 transition-all" onClick={handleManualDailyPulse} disabled={runningManual || !settings?.dailyReminderEnabled}>
                      {runningManual ? <Loader2 className="size-5 animate-spin mr-3" /> : <Bell className="size-5 mr-3" />}
                      EXECUTE MANUAL DAILY PULSE
                   </Button>
                </Card>
              </div>
           </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-10">
           <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
              <CardHeader className="bg-slate-50/50 border-b p-10"><CardTitle className="text-2xl font-black uppercase">Campaign Matrix</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto no-scrollbar">
                 <table className="w-full border-collapse">
                    <thead className="bg-slate-50/30">
                       <tr className="border-b border-slate-100">
                          <th className="pl-10 py-8 uppercase text-[10px] font-black tracking-[0.4em] text-primary/60 text-left">ROC Hub</th>
                          <th className="py-8 text-center uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Success</th>
                          <th className="pr-12 py-8 text-right uppercase text-[10px] font-black tracking-[0.4em] text-primary/60">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {campaigns?.map((c) => (
                         <tr key={c.id} className="hover:bg-slate-50/80 transition-all group">
                            <td className="pl-10 py-8 font-black uppercase text-[14px]">{c.officeId} Center</td>
                            <td className="text-center font-black text-emerald-500 tabular-nums">{c.stats?.success || 0} / {c.stats?.total || 0}</td>
                            <td className="pr-12 py-8 text-right">
                               <Badge className={cn("font-black text-[10px] uppercase px-4 py-1.5 rounded-full", c.status === 'completed' ? 'bg-emerald-500' : 'bg-secondary')}>
                                 {c.status?.toUpperCase() || 'PENDING'}
                               </Badge>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="sandbox" className="space-y-10 animate-in">
           <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5 space-y-10">
                 <Card className="shadow-2xl border-none rounded-[3rem] bg-white border-t-8 border-t-secondary p-10 space-y-10">
                    <div className="space-y-6">
                       <Label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center gap-3">
                          <Target className="size-4 text-secondary" /> Identity Trace Hub
                       </Label>
                       <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                          <SelectTrigger className="h-16 font-black border-2 border-slate-100 bg-slate-50 rounded-2xl px-8 focus:border-secondary transition-all text-[13px] uppercase">
                             <SelectValue placeholder="Select Professional..." />
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

                    <div className="grid gap-4">
                       <div className="grid grid-cols-2 gap-4">
                          <Button variant="outline" className="h-16 border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-slate-50" onClick={handlePreview} disabled={!selectedEmp || previewing}>PREVIEW WEEKLY PDF</Button>
                          <Button className="h-16 bg-primary text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl hover:scale-105 transition-all" onClick={() => handleSendTest('weekly')} disabled={!selectedEmp || sendingTest}>
                             {sendingTest ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 mr-2" />}
                             SEND TEST WEEKLY
                          </Button>
                       </div>
                       <Button variant="outline" className="h-16 border-2 border-slate-100 text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-slate-50 w-full" onClick={() => handleSendTest('daily')} disabled={!selectedEmp || sendingTest}>
                          {sendingTest ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4 mr-2" />}
                          SEND TEST DAILY TEXT
                       </Button>
                    </div>
                 </Card>
              </div>

              <div className="lg:col-span-7">
                 <div className="relative min-h-[700px] h-full rounded-[4rem] bg-white border-2 border-slate-100 flex flex-col items-center justify-center p-14 overflow-hidden shadow-2xl">
                    {previewDoc ? (
                       <iframe src={previewDoc} className="w-full h-full min-h-[600px] rounded-2xl border-none shadow-inner bg-slate-200" title="Roster Preview" />
                    ) : (
                       <div className="text-center opacity-10"><Monitor size={80} className="mx-auto mb-6" /><p className="text-3xl font-black uppercase tracking-widest">Visualization Node</p></div>
                    )}
                 </div>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
