
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence,
  signOut
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Stethoscope, Loader2, Phone, Key, AlertCircle, ArrowRight, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createOrUpdateSession } from '@/lib/session-utils';
import { logAudit } from '@/lib/audit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
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

  useEffect(() => {
    return () => {
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const validatePhone = (num: string) => {
    const regex = /^[6-9]\d{9}$/;
    return regex.test(num);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validatePhone(phoneNumber)) {
      toast({
        variant: "destructive",
        title: "Invalid Number",
        description: "Please enter a valid 10-digit Indian mobile number.",
      });
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = `+91${phoneNumber}`;
      
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
      
      logAudit(db, 'system', 'AUTH_OTP_REQUEST', phoneNumber, { source: 'web_portal' });
      
      toast({ title: "Verification Initiated", description: "Standard security code dispatched via SMS." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Node Access Denied",
        description: error.message || "Failed to initiate verification sequence.",
      });
      
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || otp.length < 6) return;
    setLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await confirmationResult.confirm(otp);
      const user = userCredential.user;

      const q = query(collection(db, 'employees'), where('whatsappNumber', '==', user.phoneNumber));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const employee = snap.docs[0].data();
        
        if (employee.status === 'Suspended' || employee.status === 'Inactive') {
          await signOut(auth);
          throw new Error(`Account Status: ${employee.status.toUpperCase()}. Access restricted.`);
        }

        const userRef = doc(db, 'users', user.uid);
        const userData = {
          uid: user.uid,
          email: employee.email || null,
          role: employee.role,
          displayName: employee.fullName,
          employeeId: employee.id,
          phoneNumber: user.phoneNumber,
          status: 'Active',
          lastLogin: new Date().toISOString()
        };

        await setDoc(userRef, userData, { merge: true }).catch(async (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: userData,
          }));
        });

        await createOrUpdateSession(db, user.uid, employee.id);
        logAudit(db, user.uid, 'AUTH_OTP_VERIFY_SUCCESS', employee.id);

        toast({
          title: "Identity Verified",
          description: `Welcome to the cluster, ${employee.fullName.split(' ')[0]}.`,
        });

        if (employee.role === 'ADMIN' || employee.role === 'SUPER_ADMIN') {
          router.push('/admin');
        } else {
          router.push('/employee/portal');
        }
      } else {
        await signOut(auth);
        throw new Error("This terminal is not authorized for portal access. Contact administrative nodes.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failure",
        description: error.message || "Invalid or expired OTP sequence.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] p-4 relative overflow-hidden font-body">
      {/* Precision Background */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#14B8A6] rounded-full blur-[140px] opacity-20"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#3B82F6] rounded-full blur-[140px] opacity-20"></div>
      </div>

      <Card className="w-full max-w-md shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] relative z-10 border-white/10 bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden animate-in">
        <CardHeader className="space-y-4 text-center p-10 pb-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-[1.25rem] bg-[#3B82F6] text-white shadow-2xl shadow-blue-500/20 group">
            <Stethoscope className="size-9 group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black tracking-tight font-headline uppercase leading-none text-white">Access <span className="text-[#3B82F6]">Node</span></CardTitle>
            <CardDescription className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em]">Institutional Workforce Pulse</CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-10 pb-10">
          {step === 'phone' ? (
            <div className="space-y-8">
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Verified Mobile Endpoint</Label>
                  <div className="flex gap-3">
                    <div className="flex h-14 items-center justify-center rounded-2xl border-2 border-slate-700 bg-slate-800/50 px-5 font-black text-slate-400">
                      +91
                    </div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-4 top-5 h-4 w-4 text-slate-500" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="99999 00000"
                        className="pl-12 h-14 text-lg font-black tracking-[0.1em] rounded-2xl border-2 border-slate-700 bg-slate-800/50 text-white focus:border-blue-500 transition-all placeholder:text-slate-600"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                      />
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-[#3B82F6] text-white hover:bg-white hover:text-[#0F172A] h-16 text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-blue-500/20 group transition-all border-none" type="submit" disabled={loading || phoneNumber.length < 10}>
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />}
                  Request OTP Pulse
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="otp" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verification Key</Label>
                  <button type="button" onClick={() => setStep('phone')} className="text-[10px] text-blue-400 font-black hover:text-blue-300 transition-colors tracking-widest uppercase">Update Number</button>
                </div>
                <div className="relative">
                  <Key className="absolute left-4 top-5 h-4 w-4 text-slate-500" />
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="pl-12 h-16 text-3xl text-center font-black tracking-[0.5em] rounded-2xl border-2 border-slate-700 bg-slate-800/50 text-white focus:border-teal-500 placeholder:text-slate-700"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <div className="flex justify-between items-center px-2">
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Target: +91 {phoneNumber}</p>
                   {resendCooldown > 0 ? (
                     <p className="text-[10px] text-teal-400 font-black uppercase tracking-widest">Resend in {resendCooldown}s</p>
                   ) : (
                     <button type="button" onClick={handleSendOtp} className="text-[10px] text-blue-400 font-black hover:underline flex items-center gap-1.5 uppercase tracking-widest">
                       <RefreshCcw className="size-3" /> Resend Pulse
                     </button>
                   )}
                </div>
              </div>
              <Button className="w-full bg-[#14B8A6] text-white hover:bg-white hover:text-[#0F172A] h-16 text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-teal-500/20 transition-all border-none" type="submit" disabled={loading || otp.length < 6}>
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Authorize Node Access"}
              </Button>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="bg-white/5 p-8 border-t border-white/5">
          <div className="flex gap-4 items-start">
             <div className="size-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 shadow-sm border border-blue-500/20">
                <ShieldCheck className="size-5 text-blue-400" />
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-200">Zero-Trust Environment</p>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  365-day security deadline active. Access logs are immutable and monitored for institutional compliance.
                </p>
             </div>
          </div>
        </CardFooter>
      </Card>
      <div id="recaptcha-container"></div>
    </div>
  );
}
