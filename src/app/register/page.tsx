
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ShieldCheck, Mail, Phone, Loader2, Key, RefreshCcw, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { createOrUpdateSession } from '@/lib/session-utils';
import { RoleGuard } from '@/components/auth/role-guard';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const initializeRecaptcha = () => {
    if (!auth) return;
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      toast({ variant: "destructive", title: "Invalid Phone", description: "10-digit number required." });
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = `+91${formData.phone}`;
      
      // Check for duplicates
      const phoneQuery = query(collection(db, 'employees'), where('whatsappNumber', '==', formattedPhone));
      const phoneSnap = await getDocs(phoneQuery);

      if (!phoneSnap.empty) {
        throw new Error("This phone number is already registered.");
      }

      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
      initializeRecaptcha();
      
      const verifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      
      setConfirmationResult(result);
      setStep('otp');
      setResendCooldown(60);
      
      toast({ title: "Code Sent", description: "Verification code sent to administrative target." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Blocked", description: error.message });
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || otp.length < 6) return;
    
    setLoading(true);
    try {
      const userCredential = await confirmationResult.confirm(otp);
      const user = userCredential.user;

      const empId = `EMP-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
      const empRef = doc(db, 'employees', empId);
      const userRef = doc(db, 'users', user.uid);

      const payload = {
        id: empId,
        fullName: formData.fullName,
        email: formData.email.toLowerCase(),
        whatsappNumber: user.phoneNumber,
        role: formData.role,
        gender: formData.gender,
        department: formData.department,
        designation: formData.designation,
        office: formData.office,
        status: 'Active',
        joinedAt: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authUid: user.uid
      };

      const userData = {
        uid: user.uid,
        email: formData.email.toLowerCase(),
        role: formData.role,
        displayName: formData.fullName,
        employeeId: empId,
        phoneNumber: user.phoneNumber,
        status: 'Active',
        lastLogin: new Date().toISOString()
      };

      await setDoc(empRef, payload);
      await setDoc(userRef, userData);
      await createOrUpdateSession(db, user.uid, empId);
      
      logAudit(db, user.uid, 'ADMIN_PROVISION_EMPLOYEE', empId, { role: formData.role });

      toast({ title: "Enrollment Complete", description: "Clinical profile provisioned successfully." });
      router.push('/admin/employees');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-xl shadow-2xl bg-white border-none rounded-[2.5rem] overflow-hidden">
          <CardHeader className="text-center space-y-2 p-10 bg-primary text-white relative">
             <div className="flex items-center justify-between mb-4 relative z-10">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 rounded-xl">
                   <ArrowLeft className="mr-2 size-3" /> Back to Directory
                </Button>
                <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                    <UserPlus className="size-6" />
                </div>
             </div>
             <CardTitle className="text-3xl font-black uppercase tracking-tight leading-none relative z-10">Provision Professional</CardTitle>
             <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 relative z-10">Administrative Identity Enrollment Hub</CardDescription>
             <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><UserPlus size={160} /></div>
          </CardHeader>
          
          <CardContent className="p-10">
            {step === 'details' ? (
              <form onSubmit={handleSendOtp} className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-black/60">Full Name</Label>
                    <Input className="font-black h-12 rounded-xl border-2 border-slate-100 text-black placeholder:text-slate-300" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-black/60">Official Email</Label>
                    <Input type="email" className="font-black h-12 rounded-xl border-2 border-slate-100 text-black placeholder:text-slate-300" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-black/60">Mobile (OTP Auth)</Label>
                    <div className="flex gap-2">
                      <div className="flex h-12 w-14 items-center justify-center rounded-xl border-2 border-slate-100 bg-slate-50 font-black text-black text-sm shrink-0">
                        +91
                      </div>
                      <Input 
                        placeholder="10-digit number"
                        className="font-black h-12 border-2 border-slate-100 rounded-xl flex-1 text-black placeholder:text-slate-300" 
                        value={formData.phone} 
                        onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-black/60">Office Node</Label>
                    <Select value={formData.office} onValueChange={(v) => setFormData({...formData, office: v})}>
                      <SelectTrigger className="h-12 font-black rounded-xl border-2 border-slate-100 text-black bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                        <SelectItem value="KOLKATA_ROC" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Kolkata ROC</SelectItem>
                        <SelectItem value="GURGAON_ROC" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Gurgaon ROC</SelectItem>
                        <SelectItem value="LUCKNOW_ROC" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Lucknow ROC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-black/60">Institutional Role</Label>
                      <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                        <SelectTrigger className="h-12 font-black rounded-xl border-2 border-slate-100 text-black bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                          <SelectItem value="EMPLOYEE" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Professional</SelectItem>
                          <SelectItem value="ADMIN" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Admin</SelectItem>
                          <SelectItem value="SUPER_ADMIN" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-black/60">Gender Node</Label>
                      <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                        <SelectTrigger className="h-12 font-black rounded-xl border-2 border-slate-100 text-black bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl bg-white p-2">
                          <SelectItem value="Male" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Male</SelectItem>
                          <SelectItem value="Female" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Female</SelectItem>
                          <SelectItem value="Other" className="font-bold text-[11px] uppercase py-2.5 rounded-lg">Other</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>

                <Button className="w-full bg-primary hover:bg-secondary text-white h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all border-none" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin size-6 mr-3" /> : "Verify Identity & Provision"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndComplete} className="space-y-8 text-center">
                <div className="space-y-6">
                  <Label className="text-[11px] font-black uppercase tracking-widest ml-1 text-black/40 block">OTP Verification Key</Label>
                  <Input
                    maxLength={6}
                    placeholder="000000"
                    className="h-20 text-5xl text-center font-black tracking-[0.6em] rounded-2xl border-4 border-slate-100 bg-slate-50/50 text-black shadow-inner"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <p className="text-[10px] text-black/60 uppercase font-black tabular-nums tracking-widest">Dispatched to: +91 {formData.phone}</p>
                </div>
                <Button className="w-full bg-secondary text-white h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 transition-all border-none" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin size-6 mr-3" /> : "Confirm Enrollment Pulse"}
                </Button>
                <button type="button" onClick={() => setStep('details')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Edit Registration Details</button>
              </form>
            )}
          </CardContent>
          
          <CardFooter className="bg-slate-50 p-8 border-t border-slate-100 flex gap-6 items-start">
             <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                <ShieldCheck className="size-7" />
             </div>
             <p className="text-[11px] text-black/50 uppercase leading-relaxed font-bold tracking-tight">
                Institutional Security: Enrollment requires a unique 10-digit mobile endpoint and verified administrative authorization. 
                All provisioning pulses are immutably ledgered in the audit registry.
             </p>
          </CardFooter>
        </Card>
        <div id="recaptcha-container"></div>
      </div>
    </RoleGuard>
  );
}
