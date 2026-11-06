
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
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
  Trash2, 
  Eye, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Image as ImageIcon,
  Smartphone,
  Server,
  Info
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWhatsAppSettingsAction, updateWhatsAppSettingsAction } from '@/services/whatsapp-settings-action';
import { previewEmployeeRosterAction, sendTestBriefingAction } from '@/services/roster-notification-service';
import { RoleGuard } from '@/components/auth/role-guard';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function AutomationGovernance() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Diagnostic State
  const [selectedEmp, setSelectedEmp] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState('');

  // Stable Registry Fetches
  const empQuery = useMemo(() => query(collection(db, 'employees'), orderBy('fullName', 'asc')), [db]);
  const logsQuery = useMemo(() => query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(50)), [db]);

  const { data: employees } = useCollection(empQuery);
  const { data: logs, loading: logsLoading } = useCollection(logsQuery);

  useEffect(() => {
    fetchSettings();
  }, []);

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

  const handleToggle = async (type: 'master' | 'api', checked: boolean) => {
    const actionName = checked ? "Enabling" : "Disabling";
    if (!confirm(`${actionName} Pulse: Confirm institutional logic override?`)) return;

    setUpdating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth link failed.");

      const updates = type === 'master' ? { masterEnabled: checked } : { enabled: checked };
      const result = await updateWhatsAppSettingsAction(idToken, updates);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      toast({ variant: "destructive", title: "Image Weight Alert", description: "Institutional logos must be under 200KB." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setUpdating(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Auth link failed.");

        const result = await updateWhatsAppSettingsAction(idToken, { logoBase64: base64 });
        if (result.success) {
          toast({ title: "Branding Updated" });
          fetchSettings();
        }
      } catch (e: any) {
        toast({ variant: "destructive", title: "Upload Failure", description: e.message });
      } finally {
        setUpdating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePreview = async () => {
    if (!selectedEmp) return;
    setPreviewing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth link failed.");

      const result = await previewEmployeeRosterAction(idToken, selectedEmp);
      if (result.success) {
        setPreviewImage(result.base64);
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

  const handleTestDispatch = async () => {
    if (!selectedEmp || !testPhone) return;
    if (!confirm(`Trigger real dispatch to ${testPhone}?`)) return;

    setDispatching(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Auth link failed.");

      const result = await sendTestBriefingAction(idToken, selectedEmp, testPhone);
      if (result.success) {
        toast({ title: "Test Pulse Successful", description: `Message dispatched to ${testPhone}.` });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Dispatch Failure", description: e.message });
    } finally {
      setDispatching(false);
    }
  };

  if (loading) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
      <Loader2 className="size-12 animate-spin text-secondary opacity-30" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Syncing Governance Hub</p>
    </div>
  );

  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <div className="space-y-10 pb-40 max-w-[1600px] mx-auto animate-in px-4 text-black">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
                <Zap className="size-8 text-secondary fill-secondary/20" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight uppercase leading-none">Automation Hub</h1>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                    Super Admin Console <ShieldCheck className="size-3 text-secondary animate-pulse" />
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
             <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Master Pulse</label>
                <div className="flex items-center gap-3">
                   <div className={cn("size-2 rounded-full", settings?.automation?.masterEnabled ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-slate-300')} />
                   <span className="font-black uppercase tracking-widest text-[11px]">{settings?.automation?.masterEnabled ? 'ACTIVE' : 'SUSPENDED'}</span>
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
          {/* CONTROL CENTER */}
          <div className="lg:col-span-4 space-y-8">
            <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white border-t-8 border-t-primary">
              <CardHeader className="bg-slate-50/50 border-b p-10">
                <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Protocol Switches</CardTitle>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                 <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100 group">
                    <div className="space-y-1">
                       <p className="text-[12px] font-black uppercase tracking-tight">Master Automation</p>
                       <p className="text-[9px] text-muted-foreground font-bold uppercase">10 PM IST Briefing Loop</p>
                    </div>
                    <Switch checked={settings?.automation?.masterEnabled} onCheckedChange={(v) => handleToggle('master', v)} disabled={updating} />
                 </div>

                 <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="space-y-1">
                       <p className="text-[12px] font-black uppercase tracking-tight">Meta Gateway</p>
                       <p className="text-[9px] text-muted-foreground font-bold uppercase">Cloud API Transmission</p>
                    </div>
                    <Switch checked={settings?.whatsappEnabled} onCheckedChange={(v) => handleToggle('api', v)} disabled={updating} />
                 </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
               <CardHeader className="bg-slate-50/50 border-b p-10">
                 <CardTitle className="text-xl uppercase font-black tracking-tight leading-none">Institutional Branding</CardTitle>
               </CardHeader>
               <CardContent className="p-10 space-y-8">
                  {settings?.automation?.base64Logo ? (
                    <div className="relative aspect-video rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 p-8 flex items-center justify-center group overflow-hidden">
                       <img src={settings.automation.base64Logo} alt="Logo" className="max-h-24 object-contain" />
                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => updateWhatsAppSettingsAction(auth.currentUser!.uid, { logoBase64: '' }).then(() => fetchSettings())}>
                             <Trash2 className="size-6" />
                          </Button>
                       </div>
                    </div>
                  ) : (
                    <div className="aspect-video rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 group hover:border-secondary transition-all">
                       <ImageIcon className="size-10 text-slate-300 group-hover:scale-110 transition-transform" />
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No Logo Registry Found</p>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                     <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Update Brand Asset</Label>
                     <div className="relative">
                        <Input type="file" accept="image/*" className="h-14 pt-4 font-bold border-2 border-slate-100 rounded-xl cursor-pointer" onChange={handleLogoUpload} disabled={updating} />
                        <Upload className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-slate-300 pointer-events-none" />
                     </div>
                  </div>
               </CardContent>
            </Card>
          </div>

          {/* DIAGNOSTIC HUB */}
          <div className="lg:col-span-8 space-y-8">
            <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-[#0F172A] text-white border-t-8 border-t-secondary">
               <CardHeader className="p-10 pb-4 border-b border-white/5 flex flex-col md:flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl uppercase font-black tracking-tight">Intelligence Diagnostics</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-white/30 tracking-widest mt-3">Preview synthesis & test dispatches</CardDescription>
                  </div>
                  <div className="flex items-center gap-4 px-6 py-2 bg-white/5 rounded-xl border border-white/10">
                     <Clock className="size-4 text-secondary" />
                     <span className="text-[11px] font-black uppercase tracking-widest tabular-nums">10:00 PM IST DAILY PULSE</span>
                  </div>
               </CardHeader>
               <CardContent className="p-10 grid gap-10 md:grid-cols-2">
                  <div className="space-y-8">
                     <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">1. Select Target Professional</Label>
                        <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                           <SelectTrigger className="h-14 font-black border-2 border-white/10 bg-white/5 rounded-2xl px-6 focus:border-secondary">
                              <SelectValue placeholder="Clinical Registry..." />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-[#0F172A] text-white">
                              {employees?.map(e => (
                                <SelectItem key={e.id} value={e.id} className="font-bold py-3 uppercase text-[10px] rounded-xl focus:bg-white/10">{e.fullName} [{e.id}]</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] ml-1">2. Target Test Endpoint</Label>
                        <div className="relative">
                           <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-white/20" />
                           <Input className="h-14 pl-12 font-black border-2 border-white/10 bg-white/5 rounded-2xl focus:border-secondary" placeholder="99999 00000" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 pt-4">
                        <Button variant="outline" className="h-16 border-2 border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all" onClick={handlePreview} disabled={!selectedEmp || previewing}>
                           {previewing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Eye className="size-4 mr-2" />} PREVIEW IMAGE
                        </Button>
                        <Button className="h-16 bg-secondary text-white shadow-2xl shadow-secondary/20 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all" onClick={handleTestDispatch} disabled={!selectedEmp || !testPhone || dispatching}>
                           {dispatching ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />} TEST DISPATCH
                        </Button>
                     </div>
                  </div>

                  <div className="relative min-h-[300px] rounded-[2.5rem] bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center p-8 group overflow-hidden">
                     {previewImage ? (
                       <>
                         <img src={previewImage} alt="Preview" className="rounded-2xl shadow-2xl max-w-full h-auto animate-in zoom-in-95" />
                         <Badge className="absolute top-6 right-6 bg-emerald-500 text-white font-black text-[9px] uppercase border-none px-3 py-1">WEIGHT: {previewSize}</Badge>
                         <Button variant="ghost" className="absolute bottom-6 bg-black/60 text-white font-black uppercase text-[9px] h-8 rounded-lg" onClick={() => setPreviewImage(null)}>CLEAR</Button>
                       </>
                     ) : (
                       <div className="text-center space-y-4 opacity-20 group-hover:opacity-40 transition-opacity">
                          <ImageIcon size={64} className="mx-auto" />
                          <p className="text-[11px] font-black uppercase tracking-[0.4em]">Synthesis Workspace</p>
                       </div>
                     )}
                  </div>
               </CardContent>
            </Card>

            <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
               <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-row items-center justify-between">
                  <CardTitle className="text-xl uppercase font-black tracking-tight">Execution Trace</CardTitle>
                  <Activity className="size-5 text-secondary animate-pulse" />
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto no-scrollbar max-h-[400px]">
                  <table className="w-full border-collapse">
                     <thead className="bg-slate-50/30 sticky top-0 z-10">
                        <tr className="border-b">
                           <th className="pl-10 py-6 text-left uppercase text-[10px] font-black tracking-widest text-muted-foreground border-r">Professional</th>
                           <th className="px-6 py-6 text-center uppercase text-[10px] font-black tracking-widest text-muted-foreground border-r">Status</th>
                           <th className="px-6 py-6 text-center uppercase text-[10px] font-black tracking-widest text-muted-foreground border-r">Payload</th>
                           <th className="pr-10 py-6 text-right uppercase text-[10px] font-black tracking-widest text-muted-foreground">Pulse Time</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {logsLoading ? (
                           Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={4} className="p-8"><div className="h-4 w-full bg-slate-100 animate-pulse rounded" /></td></tr>)
                        ) : logs?.length === 0 ? (
                           <tr><td colSpan={4} className="py-24 text-center text-muted-foreground font-black uppercase text-[10px] tracking-widest opacity-30">No execution history found</td></tr>
                        ) : logs?.map((log) => (
                           <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                              <td className="pl-10 py-6 border-r">
                                 <div className="flex flex-col">
                                    <span className="font-black text-[13px] uppercase">{log.employeeName || 'System Sync'}</span>
                                    <span className="text-[9px] font-bold text-slate-400">ID: {log.employeeId}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-6 text-center border-r">
                                 <Badge className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-md", log.status === 'success' ? 'bg-emerald-500 text-white' : 'bg-destructive text-white')}>
                                    {log.status}
                                 </Badge>
                              </td>
                              <td className="px-6 py-6 text-center border-r">
                                 <span className="text-[10px] font-mono font-bold text-slate-400">{log.imgSize || '-- KB'}</span>
                              </td>
                              <td className="pr-10 py-6 text-right">
                                 <div className="flex flex-col items-end">
                                    <span className="text-[11px] font-black tabular-nums">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span className="text-[8px] font-bold text-slate-300 uppercase">{new Date(log.timestamp).toLocaleDateString()}</span>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden group shadow-2xl">
           <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-[2s]"><Server size={280} className="text-primary" /></div>
           <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
              <div className="size-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shrink-0">
                 <ShieldCheck className="size-8 text-white" />
              </div>
              <div className="space-y-4">
                 <p className="text-[11px] font-black uppercase text-primary tracking-[0.4em]">Institutional Governance Protocol</p>
                 <p className="text-lg font-bold text-black/70 leading-relaxed max-w-4xl tracking-tight">
                    "Automation toggles and branding assets represent core clinical logic nodes. Every modification is 
                    immutably linked to the actor's UID and ledgered within the institutional audit trace. Enable master 
                    automation only after successful Meta template verification."
                 </p>
              </div>
           </div>
        </div>
      </div>
    </RoleGuard>
  );
}
