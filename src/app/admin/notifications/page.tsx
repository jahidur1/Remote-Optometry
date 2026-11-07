'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
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
  Upload, 
  Eye, 
  Clock, 
  Image as ImageIcon,
  Settings2,
  Save,
  RotateCcw,
  FileJson,
  FileText,
  Calendar,
  ChevronRight,
  Monitor,
  Bell
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWhatsAppSettingsAction, updateWhatsAppSettingsAction } from '@/services/whatsapp-settings-action';
import { previewEmployeeRosterAction } from '@/services/roster-notification-service';
import { previewWeeklyRosterAction } from '@/services/weekly-roster-pdf-service';
import { runDailyShiftReminders } from '@/services/daily-reminder-service';
import { cn } from '@/lib/utils';
import { getCurrentWeekId } from '@/lib/date-utils';

export default function AutomationGovernance() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [runningManual, setRunningManual] = useState(false);
  
  const [stagedLogo, setStagedLogo] = useState<string | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);

  const [selectedEmp, setSelectedEmp] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState('');

  const [activeTab, setActiveTab] = useState('daily');

  const empQuery = useMemo(() => query(collection(db, 'employees'), orderBy('fullName', 'asc')), [db]);
  const { data: employees } = useCollection(empQuery);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getWhatsAppSettingsAction();
      setSettings(data);
      if (data?.automation?.base64Logo) {
        setStagedLogo(data.automation.base64Logo);
      }
    } catch (e: any) {
      toast({ title: "Fetch Failure", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (field: string, checked: boolean) => {
    const actionName = checked ? "Enabling" : "Disabling";
    if (!confirm(`${actionName} Pulse: Confirm institutional logic override?`)) return;

    setUpdating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth link failed.");

      const result = await updateWhatsAppSettingsAction(idToken, { [field]: checked });

      if (result.success) {
        toast({ title: "Settings Synchronized" });
        fetchSettings();
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update Conflict", description: e.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleManualReminderPulse = async () => {
    if (!confirm("Initiate Manual Daily Pulse? This will send text reminders to all eligible professionals immediately.")) return;
    
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

  const handleFileToBase64 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setStagedLogo(base64);
      toast({ title: "Base64 Staged", description: "Ready for institutional commit." });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async () => {
    if (!stagedLogo) return;
    setSavingBranding(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth link failed.");

      const result = await updateWhatsAppSettingsAction(idToken, { 
        logoBase64: stagedLogo,
        rawLogoBase64: stagedLogo 
      });
      
      if (result.success) {
        toast({ title: "Registry Synchronized" });
        fetchSettings();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failure", description: e.message });
    } finally {
      setSavingBranding(false);
    }
  };

  const handlePreview = async (mockCase?: number) => {
    if (!selectedEmp && mockCase === undefined) {
      toast({ title: "Validation Error", description: "Select professional or use mock case.", variant: "destructive" });
      return;
    }
    setPreviewing(true);
    setPreviewDoc(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth link failed.");

      let result;
      if (activeTab === 'daily') {
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
      toast({ variant: "destructive", title: "Preview Conflict", description: e.message });
    } finally {
      setPreviewing(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const hasUnsavedChanges = stagedLogo !== settings?.automation?.base64Logo;

  return (
    <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <Zap className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight uppercase leading-none">Automation Hub</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Document Pulse <ShieldCheck className="size-3 text-secondary animate-pulse" />
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
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Meta API Link</label>
              <div className="flex items-center gap-2">
                 <div className={cn("size-2 rounded-full", settings?.whatsappEnabled ? 'bg-emerald-500' : 'bg-destructive')} />
                 <span className="font-black uppercase tracking-widest text-[11px]">{settings?.whatsappEnabled ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-8">
          <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-primary">
            <CardHeader className="bg-slate-50/50 border-b p-10">
              <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Protocol Switches</CardTitle>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
               <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-1">
                     <p className="text-[12px] font-black uppercase tracking-tight">Master Automation</p>
                     <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Global Logic Gate</p>
                  </div>
                  <Switch checked={settings?.masterEnabled || false} onCheckedChange={(v) => handleToggle('masterEnabled', v)} disabled={updating} />
               </div>

               <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-1">
                     <p className="text-[12px] font-black uppercase tracking-tight">WhatsApp API Gateway</p>
                     <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Binary Transmission Link</p>
                  </div>
                  <Switch checked={settings?.whatsappEnabled || false} onCheckedChange={(v) => handleToggle('whatsappEnabled', v)} disabled={updating} />
               </div>

               <div className="flex items-center justify-between p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <div className="space-y-1">
                     <p className="text-[12px] font-black uppercase tracking-tight text-emerald-900">Daily 10PM Reminders</p>
                     <p className="text-[9px] text-emerald-600/60 font-bold uppercase tracking-widest">Autonomous Text Pulse</p>
                  </div>
                  <Switch checked={settings?.dailyReminderEnabled || false} onCheckedChange={(v) => handleToggle('dailyReminderEnabled', v)} disabled={updating} />
               </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 p-10 border-t border-slate-100">
               <div className="w-full space-y-6">
                  <div className="flex justify-between items-center">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Latest Daily Pulse</p>
                     <p className="text-[10px] font-bold uppercase text-black">{settings?.automation?.dailyLastRun ? new Date(settings.automation.dailyLastRun).toLocaleString() : 'NEVER'}</p>
                  </div>
                  <Button 
                    className="w-full h-14 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all"
                    onClick={handleManualReminderPulse}
                    disabled={runningManual}
                  >
                    {runningManual ? <Loader2 className="size-4 animate-spin mr-2" /> : <Bell className="size-4 mr-2" />}
                    INITIATE MANUAL DAILY PULSE
                  </Button>
               </div>
            </CardFooter>
          </Card>

          <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white border-t-8 border-t-secondary">
             <CardHeader className="bg-slate-50/50 border-b p-10">
               <CardTitle className="text-xl uppercase font-black tracking-tight leading-none flex items-center gap-3">
                 <Settings2 className="size-5 text-secondary" /> Institutional Branding
               </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-8">
                <div className="relative aspect-video rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 p-8 flex items-center justify-center group overflow-hidden shadow-inner">
                   {stagedLogo ? (
                     <img src={stagedLogo} alt="Institutional Logo" className="max-h-32 object-contain animate-in zoom-in-95" />
                   ) : (
                     <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                        <ImageIcon className="size-12 text-slate-300" />
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">No Logo Registry Found</p>
                     </div>
                   )}
                </div>
                
                <div className="space-y-6">
                   <div className="space-y-3">
                      <div className="flex justify-between items-center ml-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                          <FileJson className="size-3" /> Base64 Payload
                        </Label>
                        <Label className="cursor-pointer text-[10px] font-black text-secondary hover:underline flex items-center gap-2">
                           <Upload className="size-3" /> Load File
                           <input type="file" className="hidden" accept="image/*" onChange={handleFileToBase64} />
                        </Label>
                      </div>
                      <Textarea 
                        className="h-32 font-mono text-[10px] border-2 border-slate-100 rounded-2xl bg-slate-50 focus:border-secondary transition-all resize-none shadow-inner"
                        value={stagedLogo || ''}
                        onChange={(e) => setStagedLogo(e.target.value)}
                        disabled={savingBranding}
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] tracking-widest rounded-xl border-2" onClick={() => setStagedLogo(settings?.automation?.base64Logo || null)} disabled={!hasUnsavedChanges || savingBranding}>
                         <RotateCcw className="size-4 mr-2" /> Reset
                      </Button>
                      <Button className="h-14 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl transition-all" onClick={handleSaveBranding} disabled={!hasUnsavedChanges || savingBranding}>
                         {savingBranding ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />} Commit Branding
                      </Button>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-8">
          <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-[#0F172A] text-white border-t-8 border-t-secondary">
             <CardHeader className="p-10 pb-4 border-b border-white/5">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl uppercase font-black tracking-tight leading-none">Synthesis Workspace</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase text-white/30 tracking-widest mt-3">Validation Pulse for Clinical Briefings</CardDescription>
                    </div>
                    <TabsList className="bg-white/5 border border-white/10 h-10 rounded-xl p-1">
                      <TabsTrigger value="daily" className="rounded-lg px-6 font-black uppercase text-[9px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary">Daily Briefing</TabsTrigger>
                      <TabsTrigger value="weekly" className="rounded-lg px-6 font-black uppercase text-[9px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary">Weekly Roster</TabsTrigger>
                    </TabsList>
                  </div>
                </Tabs>
             </CardHeader>
             <CardContent className="p-10 grid gap-10 md:grid-cols-2">
                <div className="space-y-8">
                   <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">QA Validation Cases</Label>
                      <div className="grid grid-cols-1 gap-3">
                         {activeTab === 'daily' ? (
                           <>
                             {[
                               { id: 1, label: 'Two Working Days', sub: 'Consecutive Shifts' },
                               { id: 2, label: 'Work + Week Off', sub: 'Mixed Eligibility' },
                               { id: 3, label: 'Double Week Off', sub: 'Clinical Closure' }
                             ].map(test => (
                               <Button key={test.id} variant="outline" className="h-14 border-2 border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-between px-6 rounded-xl group" onClick={() => handlePreview(test.id)} disabled={previewing}>
                                  <div className="flex items-center gap-4">
                                     <FileText className="size-4 text-secondary opacity-40 group-hover:opacity-100" />
                                     <div className="text-left">
                                        <p className="text-[11px] font-black uppercase">{test.label}</p>
                                        <p className="text-[9px] text-white/30 uppercase">{test.sub}</p>
                                     </div>
                                  </div>
                                  <ChevronRight className="size-4 opacity-20" />
                                </Button>
                             ))}
                           </>
                         ) : (
                           <>
                             {[
                               { id: 1, label: 'Full Spectrum Week', sub: 'Varied Shift Distribution' },
                               { id: 2, label: 'Standard Week', sub: '1 Off-Day Protocol' },
                               { id: 3, label: 'High Availability', sub: 'Multiple Week-Offs' }
                             ].map(test => (
                               <Button key={test.id} variant="outline" className="h-14 border-2 border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-between px-6 rounded-xl group" onClick={() => handlePreview(test.id)} disabled={previewing}>
                                  <div className="flex items-center gap-4">
                                     <Calendar className="size-4 text-secondary opacity-40 group-hover:opacity-100" />
                                     <div className="text-left">
                                        <p className="text-[11px] font-black uppercase">{test.label}</p>
                                        <p className="text-[9px] text-white/30 uppercase">{test.sub}</p>
                                     </div>
                                  </div>
                                  <ChevronRight className="size-4 opacity-20" />
                               </Button>
                             ))}
                           </>
                         )}
                      </div>
                   </div>

                   <div className="pt-6 border-t border-white/10 space-y-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">Live Professional Trace</Label>
                        <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                           <SelectTrigger className="h-14 font-black border-2 border-white/10 bg-white/5 rounded-2xl px-6 focus:border-secondary">
                              <SelectValue placeholder="Select Professional..." />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-[#0F172A] text-white">
                              {employees?.map(e => (
                                <SelectItem key={e.id} value={e.id} className="font-bold py-3 uppercase text-[10px] rounded-xl focus:bg-white/10">{e.fullName} [{e.id}]</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full h-14 bg-secondary text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 transition-all" onClick={() => handlePreview()} disabled={!selectedEmp || previewing}>
                        {previewing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Eye className="size-4 mr-2" />} PREVIEW DOCUMENT
                      </Button>
                   </div>
                </div>

                <div className="relative min-h-[400px] rounded-[2.5rem] bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center p-8 group overflow-hidden">
                   {previewDoc ? (
                     <div className="flex flex-col items-center gap-6 w-full animate-in zoom-in-95 h-full">
                        <iframe src={previewDoc} className="w-full h-[350px] rounded-xl border-4 border-white/10 shadow-2xl" />
                        <div className="flex flex-col items-center gap-2">
                           <Badge className="bg-emerald-500 text-white font-black text-[10px] uppercase border-none px-4 py-1.5 shadow-lg">
                             PDF GENERATED — {previewSize}
                           </Badge>
                           <p className="text-[9px] text-white/30 uppercase font-black tracking-widest">Vector Searchable Document</p>
                        </div>
                        <Button variant="ghost" className="bg-black/60 text-white font-black uppercase text-[9px] h-8 rounded-lg mt-2" onClick={() => setPreviewDoc(null)}>CLEAR WORKSPACE</Button>
                     </div>
                   ) : (
                     <div className="text-center space-y-4 opacity-20 group-hover:opacity-40 transition-opacity">
                        <FileText size={64} className="mx-auto" />
                        <p className="text-[11px] font-black uppercase tracking-[0.4em]">Synthesis Workspace</p>
                     </div>
                   )}
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
