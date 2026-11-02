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
import { UserPlus, ArrowLeft, ShieldCheck, Mail, Phone, Loader2, Key, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { createOrUpdateSession } from '@/lib/session-utils';
import Link from 'next/link';

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
    designation: 'Staff Professional'
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
      toast({
        variant: "destructive",
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit Indian mobile number.",
      });
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = `+91${formData.phone}`;
      
      // 1. Check for duplicates
      const phoneQuery = query(collection(db, 'employees'), where('whatsappNumber', '==', formattedPhone));
      const phoneSnap = await getDocs(phoneQuery);

      if (!phoneSnap.empty) {
        throw new Error("This phone number is already registered in the clinical directory.");
      }

      // 2. Initialize reCAPTCHA and trigger OTP
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
      
      toast({
        title: "Code Sent",
        description: "A verification code has been sent to your mobile.",
      });
    } catch (error: any) {
      console.error("OTP Error:", error);
      toast({
        variant: "destructive",
        title: "Enrollment Blocked",
        description: error.message || "An unexpected error occurred.",
      });
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
      await setPersistence(auth, browserLocalPersistence);
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
        status: 'Active',
        joinedAt: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        eligibility: ["OP", "MD", "C1"],
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

      await setDoc(empRef, payload).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: empRef.path,
          operation: 'create',
          requestResourceData: payload,
        }));
      });

      await setDoc(userRef, userData).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRef.path,
          operation: 'create',
          requestResourceData: userData,
        }));
      });

      await createOrUpdateSession(db, user.uid, empId);
      
      logAudit(db, user.uid, 'USER_SELF_REGISTER', empId, { role: formData.role });

      toast({
        title: "Enrollment Complete",
        description: "Your professional account is now verified and active.",
      });
      
      if (formData.role === 'ADMIN' || formData.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/employee/portal');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "Invalid code. Please retry or request a new one.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[120px]"></div>
      </div>

      <Card className="w-full max-w-xl shadow-2xl relative z-10 border-white/10 bg-card/95 backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20">
            <UserPlus className="size-8" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline text-foreground">Clinical <span className="text-secondary">Enrollment</span></CardTitle>
          <CardDescription className="text-muted-foreground/80 font-medium">
            {step === 'details' ? 'Step 1: Provide professional identity details' : 'Step 2: Verify mobile ownership via OTP'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 'details' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="JAHIDUR RAHAMAN" 
                    className="h-11 font-bold text-foreground"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                    <Input 
                      id="email" 
                      type="email"
                      placeholder="professional@roc.example" 
                      className="pl-10 h-11 font-bold text-foreground"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Mobile Number (+91)</Label>
                  <div className="flex gap-2">
                    <div className="flex h-11 items-center justify-center rounded-md border bg-muted/50 px-3 font-bold text-muted-foreground">
                      +91
                    </div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="9832441153"
                        className="pl-10 h-11 text-lg font-bold tracking-[0.1em] text-foreground"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Assigned Role</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                    <SelectTrigger className="h-11 font-bold text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Clinical Professional</SelectItem>
                      <SelectItem value="ADMIN">System Administrator</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Executive Board</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Gender Identity</Label>
                    <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                      <SelectTrigger className="h-11 font-bold text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Clinical Department</Label>
                    <Input 
                      placeholder="Remote Optometry" 
                      className="h-11 font-bold text-foreground"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                    />
                </div>
              </div>

              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-bold shadow-lg shadow-accent/10 group transition-all" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                Send Verification Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndComplete} className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="otp" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Enter 6-Digit Code</Label>
                  <button type="button" onClick={() => setStep('details')} className="text-[10px] text-secondary font-black hover:underline uppercase">Change details</button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="pl-10 h-14 text-3xl text-center font-black tracking-[0.5em] text-foreground bg-muted/20"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex justify-between items-center px-1">
                   <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Sent to +91 {formData.phone}</p>
                   {resendCooldown > 0 ? (
                     <p className="text-[10px] text-accent font-black">Resend in {resendCooldown}s</p>
                   ) : (
                     <button type="button" onClick={handleSendOtp} className="text-[10px] text-secondary font-black hover:underline flex items-center gap-1 uppercase">
                       <RefreshCcw className="size-2.5" /> Resend SMS
                     </button>
                   )}
                </div>
              </div>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-bold shadow-lg shadow-accent/10" type="submit" disabled={loading || otp.length < 6}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Create Account"}
              </Button>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            Already have an account? 
            <Link href="/login" className="text-secondary font-black hover:underline flex items-center gap-1">
               Go to Secure Login <ArrowLeft className="size-3 rotate-180" />
            </Link>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border-none flex gap-3 items-start">
             <ShieldCheck className="size-5 text-emerald-600 mt-0.5 shrink-0" />
             <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase tracking-tight">
                Institutional Policy: Verification via mobile OTP is required to provision clinical access. 
                This ensures each professional identity is linked to a verified mobile endpoint.
             </p>
          </div>
        </CardFooter>
      </Card>
      <div id="recaptcha-container"></div>
    </div>
  );
}
