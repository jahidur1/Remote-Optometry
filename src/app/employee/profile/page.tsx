
'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, ShieldCheck, Loader2, LogOut, Building2, Calendar, Lock, ArrowLeft, Laptop } from "lucide-react";
import { logAudit } from '@/lib/audit';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
      toast({ title: "Identity Synchronized", description: "Age and Official Email updated successfully." });
    } catch (e: any) {
      toast({ title: "Operation Blocked", description: "Mandatory identity fields can only be managed by Administration.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (userLoading || !empData) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
      <Loader2 className="size-14 animate-spin text-secondary opacity-30" />
      <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Syncing Clinical Profile</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 pt-6 animate-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
           <Link href="/employee/portal">
             <Button variant="ghost" size="icon" className="rounded-2xl border-2 hover:bg-muted size-12 transition-all shadow-sm">
                <ArrowLeft className="size-6 text-primary" />
             </Button>
           </Link>
           <h1 className="text-3xl font-black tracking-tight text-primary uppercase">My Identity</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive font-black uppercase text-[10px] tracking-widest hover:bg-destructive/5 rounded-xl px-4">
            <LogOut className="size-4 mr-2" /> De-Authorize
        </Button>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-primary p-10 text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5"><User size={200} /></div>
          <div className="flex items-center gap-8 relative z-10">
            <div className="size-24 rounded-[2rem] bg-secondary flex items-center justify-center border-4 border-white/10 shadow-2xl">
                <User className="size-12 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-black uppercase tracking-tight leading-none">{empData.fullName}</CardTitle>
              <div className="flex flex-wrap gap-3">
                 <Badge className="bg-white/10 text-white border-none font-black text-[9px] uppercase tracking-widest py-1.5 px-4 rounded-full">ID: {empData.id}</Badge>
                 <Badge className="bg-secondary text-white border-none font-black text-[9px] uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg">{empData.office?.replace('_', ' ')}</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { label: 'Official Name', value: empData.fullName, icon: User },
              { label: 'ROC Cluster', value: empData.office?.replace('_', ' '), icon: Building2 },
              { label: 'Mobile Auth', value: empData.whatsappNumber, icon: Phone },
              { label: 'Gender Node', value: empData.gender, icon: ShieldCheck },
            ].map((field, i) => (
              <div key={i} className="space-y-3 group opacity-60">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] flex items-center gap-3 ml-1">
                  <Lock className="size-3" /> {field.label}
                </Label>
                <div className="h-14 flex items-center px-6 rounded-2xl bg-muted/50 border-2 border-transparent font-black text-sm text-primary/70">
                   <field.icon className="size-4 mr-3 opacity-30" /> {field.value}
                </div>
              </div>
            ))}

            <div className="space-y-3">
                <Label htmlFor="age" className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] flex items-center gap-3 ml-1">
                  <Calendar className="size-3" /> Professional Age
                </Label>
                <Input id="age" type="number" className="h-14 font-black border-2 border-secondary/10 focus:border-secondary rounded-2xl px-6 text-lg transition-all" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
            </div>
            <div className="space-y-3">
                <Label htmlFor="email" className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] flex items-center gap-3 ml-1">
                  <Mail className="size-3" /> Official Email
                </Label>
                <Input id="email" className="h-14 font-black border-2 border-secondary/10 focus:border-secondary rounded-2xl px-6 transition-all" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
          </div>
          
          <div className="pt-6 border-t border-dashed">
            <Link href="/employee/sessions" className="block">
              <Button variant="outline" className="w-full h-14 border-2 border-primary/5 hover:bg-muted font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl transition-all">
                <Laptop className="size-4 mr-3 text-secondary" /> Manage Authorized Devices
              </Button>
            </Link>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 p-10 flex flex-col sm:flex-row justify-between items-center gap-8 border-t">
            <div className="flex items-center gap-5">
               <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="size-7" />
               </div>
               <div className="space-y-0.5">
                  <p className="text-[11px] font-black uppercase text-primary tracking-tight">Identity Secure</p>
                  <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest opacity-60">Audit Protection Level 4</p>
               </div>
            </div>
            <Button className="w-full sm:w-auto bg-primary h-16 px-14 font-black uppercase tracking-[0.25em] rounded-2xl shadow-2xl hover:scale-105 transition-all" onClick={handleSave} disabled={saving}>
                {saving ? 'Syncing...' : 'Update Records'}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
