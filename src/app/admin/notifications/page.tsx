
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  MessageCircle, 
  BellRing, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Info, 
  Terminal, 
  Loader2, 
  Settings2, 
  Image as ImageIcon, 
  Zap, 
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DemoBadge } from '@/components/ui/demo-badge';
import { useToast } from '@/hooks/use-toast';
import { getWhatsAppSettingsAction, updateWhatsAppSettingsAction } from '@/services/whatsapp-settings-action';
import { runManualRosterBriefingAction } from '@/services/roster-notification-service';

export default function NotificationDashboard() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Governance State
  const [wsSettings, setWsSettings] = useState({ enabled: false, logoBase64: '' });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringManual, setTriggeringManual] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const data = await getWhatsAppSettingsAction();
      setWsSettings({ enabled: data?.whatsappEnabled || false, logoBase64: data?.logoBase64 || '' });
      setSettingsLoading(false);
    }
    fetchSettings();
  }, []);

  const handleToggleIntegration = async (checked: boolean) => {
    setWsSettings(prev => ({ ...prev, enabled: checked }));
    setSavingSettings(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      await updateWhatsAppSettingsAction(idToken, { enabled: checked, logoBase64: wsSettings.logoBase64 });
      toast({ title: "Integration Pulse Updated", description: `WhatsApp briefings are now ${checked ? 'enabled' : 'disabled'}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200000) { // Limit base64 size for firestore (approx 200KB)
      toast({ variant: "destructive", title: "File too large", description: "Logo should be a small PNG/JPG for optimal image generation." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setWsSettings(prev => ({ ...prev, logoBase64: base64 }));
      setSavingSettings(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;
        await updateWhatsAppSettingsAction(idToken, { enabled: wsSettings.enabled, logoBase64: base64 });
        toast({ title: "Branding Secured", description: "Institutional logo updated in generation engine." });
      } catch (e: any) {
        toast({ variant: "destructive", title: "Sync Failed", description: e.message });
      } finally {
        setSavingSettings(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerManual = async () => {
    if (!confirm("EMERGENCY PULSE: This will immediately generate roster images and dispatch WhatsApp messages to all active staff for the next 2 days. Proceed?")) return;
    
    setTriggeringManual(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const result = await runManualRosterBriefingAction(idToken);
      if (result.success) {
        toast({ title: "Orchestration Complete", description: `Dispatched ${result.count} briefings to active professionals.` });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Broadcast Failed", description: e.message });
    } finally {
      setTriggeringManual(false);
    }
  };

  const logsQuery = useMemo(() => query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(100)), [db]);
  const { data: logs, loading: logsLoading } = useCollection(logsQuery);

  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <div className="space-y-8 pb-40 max-w-[1600px] mx-auto animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary font-headline uppercase leading-none">Notification Hub</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
             Meta Cloud API • Automated Shift Briefings <MessageCircle className="size-3 text-secondary" />
          </p>
        </div>
        <div className="flex gap-4">
            {isSuperAdmin && (
              <Button 
                variant="outline" 
                className="bg-white border-2 border-secondary/20 text-secondary font-black uppercase text-[11px] tracking-widest h-12 px-8 rounded-2xl transition-all hover:bg-secondary/5"
                onClick={handleTriggerManual}
                disabled={triggeringManual || !wsSettings.enabled}
              >
                  {triggeringManual ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Zap className="size-4 mr-2" />}
                  Manual Broadcast Pulse
              </Button>
            )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Governance Settings - Super Admin Only */}
        {isSuperAdmin && (
          <div className="lg:col-span-4 space-y-8">
            <Card className="shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden border-t-8 border-t-secondary">
              <CardHeader className="bg-slate-50/50 border-b p-10 space-y-4">
                <div className="flex items-center gap-6">
                  <div className="size-14 rounded-2xl bg-primary flex items-center justify-center text-secondary shadow-inner">
                    <Settings2 className="size-7" />
                  </div>
                  <div>
                    <CardTitle className="text-xl uppercase font-black tracking-tight text-black leading-none">Governance</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2">Meta API Control Node</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border-2 border-slate-100">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-black uppercase text-black tracking-widest">Meta Integration</Label>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Enable Automated 10PM Pulse</p>
                  </div>
                  <Switch 
                    checked={wsSettings.enabled} 
                    onCheckedChange={handleToggleIntegration} 
                    disabled={savingSettings || settingsLoading}
                  />
                </div>

                <div className="space-y-6">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Institutional Mark (Base64)</Label>
                  <div className="group relative">
                    <div className="h-40 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4 transition-all group-hover:border-secondary group-hover:bg-secondary/5 overflow-hidden">
                      {wsSettings.logoBase64 ? (
                        <>
                          <img src={wsSettings.logoBase64} alt="Branding" className="size-20 object-contain" />
                          <p className="text-[9px] font-black text-secondary uppercase tracking-widest">Logo Secured</p>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-10 text-slate-300" />
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Upload PNG/JPG</p>
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

                <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-4">
                  <ShieldCheck className="size-5 text-amber-600 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-tight">
                    Logo is used to generate personalized roster images for employees. Maximum size for optimal speed is 60KB per image.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#0F172A] text-white shadow-2xl rounded-[2.5rem] p-10 space-y-6 relative overflow-hidden group border-none">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700"><ImageIcon size={160} /></div>
              <div className="flex items-center gap-5 text-secondary">
                 <Info className="size-6" />
                 <p className="text-[11px] font-black uppercase tracking-[0.3em]">Protocol Specs</p>
              </div>
              <div className="space-y-4 pt-2">
                <p className="text-[12px] text-white/40 leading-relaxed font-medium uppercase tracking-widest">
                  Roster images are dynamically rendered server-side using the Singleton ID protocol. Images are cached for 48h before auto-purging.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Transmission Ledger */}
        <div className={isSuperAdmin ? "lg:col-span-8" : "lg:col-span-12"}>
          <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.75rem] flex items-center justify-center shadow-inner bg-primary border border-slate-200">
                  <Terminal className="size-8 text-secondary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tight">Transmission Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Historical Meta API trace pulses.</CardDescription>
                </div>
              </div>
              <div className="relative w-full max-w-md">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter Identity..." 
                  className="pl-12 h-12 rounded-xl text-[11px] font-bold" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <table className="w-full">
                <thead className="bg-slate-50/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-6 px-10 text-left">Professional</th>
                    <th className="px-8 text-left">Transmission Endpoint</th>
                    <th className="px-8 text-center">Status Pulse</th>
                    <th className="px-10 text-right">IST Execution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logsLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i}><td colSpan={4} className="p-10"><Skeleton className="h-10 w-full rounded-xl" /></td></tr>
                    ))
                  ) : logs?.length === 0 ? (
                    <tr><td colSpan={4} className="py-40 text-center opacity-30 italic font-black uppercase text-xs">No active notification traces in registry.</td></tr>
                  ) : (
                    logs?.filter(l => l.employeeId.includes(searchTerm)).map((log, i) => (
                      <tr key={i} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-8 px-10">
                          <div className="flex flex-col">
                              <span className="font-black text-[14px] text-primary tracking-tight">{log.employeeId}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">ID Trace: {log.id?.slice(-8)}</span>
                          </div>
                        </td>
                        <td className="px-8">
                           <code className="text-secondary font-black text-[12px] bg-secondary/5 px-4 py-1.5 rounded-lg border border-secondary/10 shadow-inner">{log.maskedPhone}</code>
                        </td>
                        <td className="px-8 text-center">
                           <Badge className={cn(
                             "text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full",
                             log.status === 'success' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-destructive text-white shadow-lg shadow-destructive/20"
                           )}>
                             {log.status === 'success' ? 'DISPATCHED' : 'API_REJECTED'}
                           </Badge>
                        </td>
                        <td className="px-10 text-right text-[12px] font-black text-black/60 tabular-nums">
                          {new Date(log.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
