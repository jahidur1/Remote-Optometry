
'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, Bell, ShieldCheck, Loader2, Save } from "lucide-react";
import { logAudit } from '@/lib/audit';

export default function EmployeeProfile() {
  const { profile, loading: userLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    whatsappNumber: profile?.whatsappNumber || '',
    whatsappEnabled: true,
  });

  const handleSave = async () => {
    if (!profile?.uid) return;
    setSaving(true);
    try {
      const empRef = doc(db, 'employees', profile.employeeId!);
      await updateDoc(empRef, {
        whatsappNumber: formData.whatsappNumber,
        updatedAt: new Date().toISOString()
      });
      
      logAudit(db, profile.uid, 'UPDATE_PERSONAL_PROFILE', profile.employeeId!, { whatsappNumber: formData.whatsappNumber });
      toast({ title: "Profile Updated", description: "Your contact information has been saved successfully." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (userLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">My Account</h1>
      </div>

      <Card className="shadow-md border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="bg-muted/5 border-b">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white shadow-sm">
                <User className="size-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{profile?.displayName}</CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-secondary">{profile?.role} • ID: {profile?.employeeId}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Work Email (System Only)</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{profile?.email}</span>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">WhatsApp Number (For Shift Updates)</Label>
                <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="whatsapp"
                        className="pl-10 h-11 font-bold"
                        placeholder="+91 00000 00000"
                        defaultValue={profile?.whatsappNumber}
                        onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    />
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed italic px-1">
                    Notifications are dispatched daily at 10:00 PM IST via Meta Cloud API.
                </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Bell className="size-3" /> Communication Preferences
              </h4>
              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                  <div className="space-y-0.5">
                      <p className="text-sm font-bold">Automated Daily Briefing</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">Receive tomorrow's shift details on WhatsApp</p>
                  </div>
                  <Switch checked={formData.whatsappEnabled} />
              </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/5 border-t p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground">
                <ShieldCheck className="size-4 text-emerald-600" /> Authorized Personnel Only
            </div>
            <Button className="bg-primary shadow-lg shadow-primary/10" onClick={handleSave} disabled={saving}>
                <Save className="size-4 mr-2" /> {saving ? 'Updating...' : 'Save Settings'}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
