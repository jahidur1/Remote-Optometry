
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence,
  signOut
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Phone, Key, ArrowRight, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createOrUpdateSession } from '@/lib/session-utils';
import { logAudit } from '@/lib/audit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { addHours } from 'date-fns';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

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
      
      // GENERATE FRESH BACKUP OTP FOR ADMINISTRATIVE SUPPORT (TTL: 12h)
      const backupCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpRef = doc(db, 'otp_registry', formattedPhone);
      
      setDoc(otpRef, {
        phone: formattedPhone,
        otp: backupCode,
        expiresAt: addHours(new Date(), 12).toISOString(),
        createdAt: serverTimestamp()
      }, { merge: true }).catch(async (error) => {
         // Silently handle backup OTP permission failures for non-superadmins
      });

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
      setTimeout(() => setLoading(false), 500);
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

      // HANDSHAKE: Find the employee record matching the verified phone number
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
          office: employee.office || null,
          status: 'Active' as const,
          lastLogin: new Date().toISOString()
        };

        // Non-blocking profile synchronization
        setDoc(userRef, userData, { merge: true }).catch(async (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userRef.path,
            operation: 'write',
            requestResourceData: userData,
          } satisfies SecurityRuleContext));
        });

        // Initialize secure device session
        createOrUpdateSession(db, user.uid, employee.id);
        logAudit(db, user.uid, 'AUTH_OTP_VERIFY_SUCCESS', employee.id);

        toast({
          title: "Identity Verified",
          description: `Welcome, ${employee.fullName.split(' ')[0]}.`,
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
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 relative overflow-hidden font-body text-black">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <Card className="w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative z-10 border-white bg-white/95 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden animate-in border-4">
        <CardHeader className="space-y-6 text-center p-12 pb-8">
          {logo && (
            <div className="mx-auto relative size-20 transform rotate-3 hover:rotate-0 transition-transform">
              <Image 
                src={logo.imageUrl} 
                alt="Remote Optometry" 
                fill 
                className="object-contain"
                data-ai-hint="remote optometry"
              />
            </div>
          )}
          <div className="space-y-1">
            <CardTitle className="text-4xl font-black tracking-tight font-headline uppercase leading-none text-black">Access <span className="text-primary">Node</span></CardTitle>
            <CardDescription className="text-black/30 font-black uppercase text-[10px] tracking-[0.4em]">Remote Optometry Identity Pulse</CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-12 pb-12">
          {step === 'phone' ? (
            <div className="space-y-8">
              <form onSubmit={handleSendOtp} className="space-y-8">
                <div className="space-y-4">
                  <Label htmlFor="phone" className="text-[11px] font-black uppercase tracking-widest text-black/40 ml-1">Verified Mobile Endpoint</Label>
                  <div className="flex gap-4">
                    <div className="flex h-14 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-primary text-lg">
                      +91
                    </div>
                    <div className="relative flex-1 group">
                      <Phone className="absolute left-4 top-5 h-4 w-4 text-black/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="99999 00000"
                        className="pl-12 h-14 text-xl font-bold rounded-2xl border-2 border-slate-100 bg-white text-black focus:border-primary transition-all shadow-sm"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                      />
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-primary text-white hover:bg-black h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl transition-all border-none group" type="submit" disabled={loading || phoneNumber.length < 10}>
                  {loading ? <Loader2 className="mr-3 size-6 animate-spin" /> : (
                    <>
                      Request OTP Pulse
                      <ArrowRight className="ml-3 size-6 group-hover:translate-x-2 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-10">
              <div className="space-y-6">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="otp" className="text-[11px] font-black uppercase tracking-widest text-black/40">Verification Key</Label>
                  <button type="button" onClick={() => setStep('phone')} className="text-[10px] text-primary font-black hover:underline tracking-widest uppercase">Edit Number</button>
                </div>
                <div className="relative">
                  <Key className="absolute left-4 top-7 h-5 w-5 text-black/20" />
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="pl-12 h-20 text-5xl text-center font-black tracking-[0.6em] rounded-2xl border-4 border-slate-100 bg-white text-black focus:border-primary shadow-inner"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <div className="flex justify-between items-center px-4 bg-slate-50 py-3 rounded-xl border border-slate-100">
                   <p className="text-[10px] text-black/60 uppercase font-black tabular-nums">+91 {phoneNumber}</p>
                   {resendCooldown > 0 ? (
                     <p className="text-[10px] text-primary font-black uppercase tracking-widest">Resend: {resendCooldown}s</p>
                   ) : (
                     <button type="button" onClick={handleSendOtp} className="text-[10px] text-primary font-black hover:underline flex items-center gap-1.5 uppercase tracking-widest">
                       <RefreshCcw className="size-3" /> Resend Pulse
                     </button>
                   )}
                </div>
              </div>
              <Button className="w-full bg-primary text-white hover:bg-black h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl transition-all border-none" type="submit" disabled={loading || otp.length < 6}>
                {loading ? <Loader2 className="mr-3 size-6 animate-spin" /> : "Authorize Node Access"}
              </Button>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="bg-slate-50 p-10 border-t border-slate-100">
          <div className="flex gap-5 items-start">
             <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                <ShieldCheck className="size-6 text-primary" />
             </div>
             <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Zero-Trust Environment</p>
                <p className="text-[12px] text-black/40 leading-relaxed font-bold uppercase tracking-tight">
                  12-hour backup pulse valid. Access logs are immutable and monitored for institutional compliance.
                </p>
             </div>
          </div>
        </CardFooter>
      </Card>
      <div id="recaptcha-container"></div>
    </div>
  );
}
