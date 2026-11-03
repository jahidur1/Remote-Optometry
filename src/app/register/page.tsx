
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, ShieldCheck, Mail, Phone, Loader2, Key, RefreshCcw, ArrowLeft, ShieldAlert, Lock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { createOrUpdateSession } from '@/lib/session-utils';
import { RoleGuard } from '@/components/auth/role-guard';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    gender: 'Male',
    department: 'Remote Optometry',
    designation: 'Staff Professional',
    office: 'KOLKATA_ROC'
  });
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const initializeRecaptcha = () => {
    if (!auth) return;
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const validateInput = async () => {
    // 1. Phone Unique Check
    const phoneQ = query(collection(db, 'employees'), where('whatsappNumber', '==', `+91${formData.phone}`));
    const phoneSnap = await getDocs(phoneQ);
    if (!phoneSnap.empty) throw new Error("Phone number already registered.");

    // 2. Email Unique Check
    const emailQ = query(collection(db, 'employees'), where('email', '==', formData.email.toLowerCase()));
    const emailSnap = await getDocs(emailQ);
    if (!emailSnap.empty) throw new Error("Email already registered.");
  };

  const handleRegisterEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await validateInput();
      
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: formData.fullName });
      await sendEmailVerification(user);

      const empId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      await commitRecords(user.uid, empId);

      toast({ title: "Enrollment Pulse Successful", description: "Verification pulse dispatched to inbox." });
      
      // Auto sign-out to prevent session collision with admin
      await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: error.message });
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await validateInput();
      initializeRecaptcha();
      const verifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, `+91${formData.phone}`, verifier);
      setConfirmationResult(result);
      setStep('otp');
      toast({ title: "Code Dispatched", description: "Verification pulse sent to mobile endpoint." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Blocked", description: error.message });
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    try {
      const userCredential = await confirmationResult.confirm(otp);
      const user = userCredential.user;
      const empId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      
      await commitRecords(user.uid, empId);
      toast({ title: "Enrollment Complete", description: "Identity secured in registry." });
      
      await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Verification Failed", description: error.message });
      setLoading(false);
    }
  };

  const commitRecords = async (uid: string, empId: string) => {
    const empRef = doc(db, 'employees', empId);
    const userRef = doc(db, 'users', uid);

    const payload = {
      id: empId,
      fullName: formData.fullName,
      email: formData.email.toLowerCase(),
      whatsappNumber: method === 'phone' ? `+91${formData.phone}` : null,
      role: formData.role,
      gender: formData.gender,
      department: formData.department,
      designation: formData.designation,
      office: formData.office,
      status: 'Active',
      joinedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authUid: uid
    };

    const userData = {
      uid,
      email: formData.email.toLowerCase(),
      role: formData.role as any,
      displayName: formData.fullName,
      employeeId: empId,
      phoneNumber: method === 'phone' ? `+91${formData.phone}` : null,
      office: formData.office,
      status: 'Active' as const,
      lastLogin: new Date().toISOString()
    };

    await setDoc(empRef, payload);
    await setDoc(userRef, userData);
    logAudit(db, uid, 'ADMIN_PROVISION_EMPLOYEE', empId);
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-body text-black">
        <Card className="w-full max-w-2xl shadow-3xl bg-white border-none rounded-[3.5rem] overflow-hidden">
          <CardHeader className="p-12 bg-primary text-white relative">
             <div className="flex items-center justify-between mb-8 relative z-10">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 rounded-xl px-6">
                   <ArrowLeft className="mr-3 size-4" /> Exit Node
                </Button>
                <div className="size-14 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                    <UserPlus className="size-7" />
                </div>
             </div>
             <CardTitle className="text-4xl font-black uppercase tracking-tight leading-none relative z-10">Enroll Professional</CardTitle>
             <CardDescription className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 mt-4 relative z-10">Institutional Identity Node — Sync v2.2</CardDescription>
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Zap size={240} /></div>
          </CardHeader>
          
          <CardContent className="p-12">
            <Tabs defaultValue="phone" className="w-full" onValueChange={v => setMethod(v as any)}>
              <TabsList className="grid w-full grid-cols-2 h-16 bg-slate-100 rounded-2xl p-1.5 mb-12">
                <TabsTrigger value="phone" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">Phone OTP Node</TabsTrigger>
                <TabsTrigger value="email" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">Email Auth Node</TabsTrigger>
              </TabsList>

              <TabsContent value="phone" className="space-y-10">
                {step === 'details' ? (
                  <form onSubmit={handleSendOtp} className="space-y-10">
                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Full Legal Name</Label>
                          <Input className="font-black h-14 rounded-2xl border-2 border-slate-100 focus:border-primary transition-all" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required />
                       </div>
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Official Mobile</Label>
                          <div className="flex gap-3">
                             <div className="flex h-14 w-16 items-center justify-center rounded-2xl border-2 bg-slate-50 font-black">+91</div>
                             <Input className="font-black h-14 rounded-2xl border-2 border-slate-100 flex-1" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0,10)})} required />
                          </div>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">ROC Cluster Node</Label>
                          <Select value={formData.office} onValueChange={v => setFormData({...formData, office: v})}>
                            <SelectTrigger className="h-14 font-black rounded-2xl border-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                              <SelectItem value="KOLKATA_ROC" className="font-bold py-3 uppercase text-[11px]">Kolkata ROC</SelectItem>
                              <SelectItem value="GURGAON_ROC" className="font-bold py-3 uppercase text-[11px]">Gurgaon ROC</SelectItem>
                              <SelectItem value="LUCKNOW_ROC" className="font-bold py-3 uppercase text-[11px]">Lucknow ROC</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Gender Node</Label>
                          <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}>
                            <SelectTrigger className="h-14 font-black rounded-2xl border-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                              <SelectItem value="Male" className="font-bold py-3 uppercase text-[11px]">Male</SelectItem>
                              <SelectItem value="Female" className="font-bold py-3 uppercase text-[11px]">Female</SelectItem>
                              <SelectItem value="Other" className="font-bold py-3 uppercase text-[11px]">Other</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                    </div>

                    <Button className="w-full bg-primary text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all" type="submit" disabled={loading}>
                      {loading ? <Loader2 className="animate-spin size-6 mr-3" /> : "Initiate Phone Handshake"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-10 text-center">
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">OTP Verification Key</Label>
                      <Input maxLength={6} className="h-20 text-5xl text-center font-black tracking-[0.6em] rounded-2xl border-4 border-slate-100 bg-slate-50" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))} required />
                    </div>
                    <Button className="w-full bg-secondary text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl transition-all" type="submit" disabled={loading}>
                       {loading ? <Loader2 className="animate-spin size-6 mr-3" /> : "Confirm Enrollment Pulse"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="email" className="space-y-10">
                <form onSubmit={handleRegisterEmail} className="space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Official Name</Label>
                        <Input className="font-black h-14 rounded-2xl border-2" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required />
                     </div>
                     <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Target Email</Label>
                        <Input type="email" className="font-black h-14 rounded-2xl border-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Initial Password</Label>
                        <Input type="password" placeholder="Min 8 characters" className="font-black h-14 rounded-2xl border-2" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                     </div>
                     <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">ROC Cluster Node</Label>
                        <Select value={formData.office} onValueChange={v => setFormData({...formData, office: v})}>
                          <SelectTrigger className="h-14 font-black rounded-2xl border-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                            {OFFICES.map(o => <SelectItem key={o.id} value={o.id} className="font-bold py-3 uppercase text-[11px]">{o.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="p-8 rounded-2xl bg-secondary/5 border-2 border-secondary/10 flex gap-6 items-start shadow-inner">
                    <ShieldCheck className="size-10 text-secondary shrink-0" />
                    <p className="text-[11px] font-bold text-primary uppercase leading-relaxed tracking-tight">
                       This action will initialize the Firebase Authentication node and dispatch a verification pulse to the target email. You will be signed out as an administrator after completion.
                    </p>
                  </div>

                  <Button className="w-full bg-primary text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl transition-all" type="submit" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin size-6 mr-3" /> : "Authorize & Deploy Identity"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          
          <CardFooter className="bg-slate-50 p-12 border-t border-slate-100 flex gap-8 items-start">
             <div className="size-14 rounded-[1.5rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                <ShieldCheck className="size-8" />
             </div>
             <p className="text-[11px] text-black/40 uppercase leading-relaxed font-black tracking-tight">
                Governance Protocol: Enrollment creates an immutable clinical identity record and initializes the authentication node. 
                All provisioning pulses are ledgered for institutional compliance.
             </p>
          </CardFooter>
        </Card>
        <div id="recaptcha-container"></div>
      </div>
    </RoleGuard>
  );
}
