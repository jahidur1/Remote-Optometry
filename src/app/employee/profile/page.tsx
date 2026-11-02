
'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, ShieldCheck, Loader2, Save, LogOut, Building2, Calendar, Lock } from "lucide-react";
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
  
  const [empData, setEmpData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    age: '',
  });

  // Listen to the source employee record for real-time institutional data
  useEffect(() => {
    if (!profile?.employeeId || !db) return;
    const unsub = onSnapshot(doc(db, 'employees', profile.employeeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEmpData(data);
        setFormData({
          email: data.email || '',
          age: data.age?.toString() || '',
        });
      }
    });
    return () => unsub();
  }, [profile, db]);

  const handleSave = async () => {
    if (!profile?.employeeId) return;
    setSaving(true);
    try {
      const empRef = doc(db, 'employees', profile.employeeId);
      await updateDoc(empRef, {
        email: formData.email.toLowerCase(),
        age: parseInt(formData.age) || 0,
        updatedAt: new Date().toISOString()
      });
      
      logAudit(db, profile.uid, 'UPDATE_PERSONAL_PROFILE', profile.employeeId, { email: formData.email, age: formData.age });
      toast({ title: "Profile Synchronized", description: "Personal professional data updated successfully." });
    } catch (e: any) {
      toast({ title: "Update Blocked", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (userLoading || !empData) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">My Identity</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive font-black uppercase text-[10px] tracking-widest">
            <LogOut className="size-4 mr-2" /> De-Authorize Device
        </Button>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
        <CardHeader className="bg-primary p-8 text-primary-foreground">
          <div className="flex items-center gap-6">
            <div className="size-20 rounded-[1.5rem] bg-secondary flex items-center justify-center border-4 border-white/10 shadow-xl">
                <User className="size-10 text-white" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight">{empData.fullName}</CardTitle>
              <div className="flex flex-wrap gap-2">
                 <Badge className="bg-white/10 text-white border-none font-black text-[9px] uppercase tracking-widest py-1 px-3">
                    ID: {empData.id}
                 </Badge>
                 <Badge className="bg-secondary text-white border-none font-black text-[9px] uppercase tracking-widest py-1 px-3">
                    {empData.role}
                 </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Locked Fields */}
            <div className="space-y-2 opacity-60 grayscale">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <Lock className="size-3" /> Professional Name (Locked)
                </Label>
                <div className="h-12 flex items-center px-4 rounded-xl bg-muted border font-bold text-sm">
                  {empData.fullName}
                </div>
            </div>
            <div className="space-y-2 opacity-60 grayscale">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <Lock className="size-3" /> Clinical Office (Locked)
                </Label>
                <div className="h-12 flex items-center px-4 rounded-xl bg-muted border font-bold text-sm">
                  <Building2 className="size-4 mr-2 text-primary" /> {empData.office}
                </div>
            </div>
            <div className="space-y-2 opacity-60 grayscale">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <Lock className="size-3" /> Mobile Endpoint (Locked)
                </Label>
                <div className="h-12 flex items-center px-4 rounded-xl bg-muted border font-bold text-sm">
                  <Phone className="size-4 mr-2 text-primary" /> {empData.whatsappNumber}
                </div>
            </div>
            <div className="space-y-2 opacity-60 grayscale">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <Lock className="size-3" /> Gender (Locked)
                </Label>
                <div className="h-12 flex items-center px-4 rounded-xl bg-muted border font-bold text-sm uppercase">
                  {empData.gender}
                </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-2 md:col-span-1">
                <Label htmlFor="age" className="text-[10px] font-black uppercase text-secondary tracking-widest flex items-center gap-2">
                  <Calendar className="size-3" /> Age (Self-Managed)
                </Label>
                <Input 
                  id="age"
                  type="number"
                  className="h-12 font-black border-2 border-secondary/20 focus:border-secondary rounded-xl transition-all"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                />
            </div>
            <div className="space-y-2 md:col-span-1">
                <Label htmlFor="email" className="text-[10px] font-black uppercase text-secondary tracking-widest flex items-center gap-2">
                  <Mail className="size-3" /> Work Email (Self-Managed)
                </Label>
                <Input 
                  id="email"
                  className="h-12 font-black border-2 border-secondary/20 focus:border-secondary rounded-xl transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 p-8 flex justify-between items-center border-t border-dashed">
            <div className="flex items-center gap-3">
               <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="size-5 text-emerald-600" />
               </div>
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-tight text-primary">Identity Verified</p>
                  <p className="text-[9px] font-bold uppercase text-muted-foreground">Server-Side Enforcement Active</p>
               </div>
            </div>
            <Button className="bg-primary h-14 px-10 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 transition-all" onClick={handleSave} disabled={saving}>
                {saving ? 'Syncing...' : 'Preserve Changes'}
            </Button>
        </CardFooter>
      </Card>
      
      <div className="p-6 rounded-[1.5rem] bg-muted/20 border-2 border-dashed flex gap-4 items-start">
          <Building2 className="size-6 text-muted-foreground/30 mt-1 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tight">
            Institutional Notice: Core identity details (Name, Office, ID, Mobile) are managed exclusively by the Human Resources and IT Board. 
            Contact support to request administrative modifications.
          </p>
      </div>
    </div>
  );
}
