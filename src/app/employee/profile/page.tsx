
'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, Bell, ShieldCheck, Loader2, Save, LogOut } from "lucide-react";
import { logAudit } from '@/lib/audit';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';

export default function EmployeeProfile() {
  const { profile, loading: userLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    whatsappNumber: '',
    whatsappEnabled: true,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        whatsappNumber: profile.whatsappNumber || '',
        whatsappEnabled: true,
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.uid || !profile.employeeId) return;
    setSaving(true);
    try {
      const empRef = doc(db, 'employees', profile.employeeId);
      await updateDoc(empRef, {
        whatsappNumber: formData.whatsappNumber,
        updatedAt: new Date().toISOString()
      });
      
      logAudit(db, profile.uid, 'UPDATE_PERSONAL_PROFILE', profile.employeeId, { whatsappNumber: formData.whatsappNumber });
      toast({ title: "Profile Updated", description: "Your clinical contact preferences have been preserved." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (userLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">Professional Account</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive font-black uppercase text-[10px] tracking-widest">
            <LogOut className="size-4 mr-2" /> Sign Out
        </Button>
      </div>

      <Card className="shadow-md border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="bg-muted/5 border-b">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center border-4 border-white shadow-sm">
                <User className="size-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">{profile?.displayName}</CardTitle>
              <CardDescription className="text-xs font-black uppercase tracking-widest text-secondary">{profile?.role} • ID: {profile?.employeeId}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Institutional Email (Read Only)</Label>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-dashed">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground/70">{profile?.email}</span>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">WhatsApp Broadcast Target</Label>
                <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="whatsapp"
                        className="pl-10 h-11 font-black uppercase tracking-widest"
                        placeholder="+91 00000 00000"
                        value={formData.whatsappNumber}
                        onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    />
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed italic px-1 font-bold">
                    Shift briefings are dispatched daily at 22:00 Asia/Kolkata via Meta Cloud API.
                </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                  <Bell className="size-3" /> Communication Preferences
              </h4>
              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                  <div className="space-y-0.5">
                      <p className="text-sm font-black uppercase tracking-tight">Daily Briefing Sync</p>
                      <p className="text-[9px] text-muted-foreground font-black uppercase">Automated WhatsApp dispatches for upcoming shifts</p>
                  </div>
                  <Switch checked={formData.whatsappEnabled} />
              </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/5 border-t p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground">
                <ShieldCheck className="size-4 text-emerald-600" /> Secure Workforce Record
            </div>
            <Button className="bg-primary shadow-lg shadow-primary/10 h-10 px-6 font-black uppercase tracking-widest" onClick={handleSave} disabled={saving}>
                <Save className="size-4 mr-2" /> {saving ? 'Syncing...' : 'Save Preferences'}
            </Button>
        </CardFooter>
      </Card>
      
      <Card className="bg-destructive/5 border-destructive/20 border-dashed">
        <CardContent className="pt-6">
            <div className="flex gap-4 items-start">
                <AlertCircle className="size-5 text-destructive mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-black text-destructive uppercase tracking-widest">Access Restriction</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed font-bold uppercase">
                        Account deactivation or suspension will result in immediate loss of portal access. 
                        Historical roster data will be preserved for institutional compliance.
                    </p>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
