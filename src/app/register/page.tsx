
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
    office: 'Kolkata ROC'
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
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-xl shadow-xl bg-white border-2">
          <CardHeader className="text-center space-y-2">
             <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest">
                   <ArrowLeft className="mr-2 size-3" /> Back to Directory
                </Button>
                <div className="size-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                    <UserPlus className="size-6" />
                </div>
             </div>
             <CardTitle className="text-2xl font-black uppercase tracking-tight">Provision Professional</CardTitle>
             <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Administrative Identity Enrollment Hub</CardDescription>
          </CardHeader>
          
          <CardContent>
            {step === 'details' ? (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Full Name</Label>
                    <Input className="font-bold h-11" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Official Email</Label>
                    <Input type="email" className="font-bold h-11" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Mobile (+91)</Label>
                    <Input className="font-bold h-11" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Office</Label>
                    <Select value={formData.office} onValueChange={(v) => setFormData({...formData, office: v})}>
                      <SelectTrigger className="h-11 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kolkata ROC">Kolkata ROC</SelectItem>
                        <SelectItem value="Gurgaon ROC">Gurgaon ROC</SelectItem>
                        <SelectItem value="Lucknow ROC">Lucknow ROC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Role</Label>
                      <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                        <SelectTrigger className="h-11 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Professional</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPER_ADMIN">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Gender</Label>
                      <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                        <SelectTrigger className="h-11 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>

                <Button className="w-full bg-primary h-14 font-black uppercase tracking-[0.2em] shadow-lg" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Verify Identity & Provision"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndComplete} className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-center block">OTP Verification Required</Label>
                  <Input
                    maxLength={6}
                    placeholder="000000"
                    className="h-14 text-3xl text-center font-black tracking-[0.5em] bg-muted/20"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground text-center uppercase font-black">Code sent to: +91 {formData.phone}</p>
                </div>
                <Button className="w-full bg-accent text-accent-foreground h-14 font-black uppercase tracking-[0.2em]" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Confirm Enrollment"}
                </Button>
              </form>
            )}
          </CardContent>
          
          <CardFooter className="bg-muted/30 border-t p-6 flex gap-4 items-start">
             <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
             <p className="text-[10px] text-muted-foreground uppercase leading-relaxed font-bold">
                Institutional Security: Enrollment requires a unique mobile endpoint and verified administrative authorization. 
                Provisioning actions are logged to the immutable audit ledger.
             </p>
          </CardFooter>
        </Card>
        <div id="recaptcha-container"></div>
      </div>
    </RoleGuard>
  );
}
