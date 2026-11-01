
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
import { Stethoscope, Loader2, Phone, Key, AlertCircle, ArrowRight, RefreshCcw, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createOrUpdateSession } from '@/lib/session-utils';
import { logAudit } from '@/lib/audit';
import Link from 'next/link';

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

  useEffect(() => {
    if (!auth) return;
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }, [auth]);

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
      
      const q = query(collection(db, 'employees'), where('whatsappNumber', '==', formattedPhone));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("This mobile number is not authorized for portal access.");
      }

      const employee = snap.docs[0].data();
      if (employee.status === 'Suspended' || employee.status === 'Inactive') {
        throw new Error(`Access restricted: Status is ${employee.status.toLowerCase()}.`);
      }

      const verifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      
      setConfirmationResult(result);
      setStep('otp');
      setResendCooldown(60);
      
      logAudit(db, 'system', 'AUTH_OTP_REQUEST', phoneNumber, { source: 'web_portal' });
      
      toast({ title: "OTP Sent", description: "Verification code sent to your registered mobile." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Failed to send verification code.",
      });
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.render().then((widgetId: any) => {
           (window as any).recaptchaVerifier.reset(widgetId);
        });
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
        const userRef = doc(db, 'users', user.uid);
        
        await setDoc(userRef, {
          uid: user.uid,
          email: employee.email || null,
          role: employee.role,
          displayName: employee.fullName,
          employeeId: employee.id,
          phoneNumber: user.phoneNumber,
          status: 'Active',
          lastLogin: new Date().toISOString()
        }, { merge: true });

        await createOrUpdateSession(db, user.uid, employee.id);
        
        logAudit(db, user.uid, 'AUTH_OTP_VERIFY_SUCCESS', employee.id);

        toast({
          title: "Verified",
          description: `Welcome, ${employee.fullName}.`,
        });
        router.push('/employee/portal');
      } else {
        throw new Error("Authorization failed. Please retry.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "Invalid or expired OTP. Please try again.",
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

      <Card className="w-full max-w-md shadow-2xl relative z-10 border-white/10 bg-card/95 backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20">
            <Stethoscope className="size-8" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight font-headline">ROC <span className="text-accent">Workforce</span></CardTitle>
          <CardDescription className="text-muted-foreground/80 font-medium">
            Clinical Portal Authentication
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 'phone' ? (
            <div className="space-y-6">
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Registered Mobile Number</Label>
                  <div className="flex gap-2">
                    <div className="flex h-11 items-center justify-center rounded-md border bg-muted/50 px-3 font-bold text-muted-foreground">
                      +91
                    </div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="99999 00000"
                        className="pl-10 h-11 text-lg font-bold tracking-[0.1em]"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                      />
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-secondary hover:bg-secondary/90 h-12 text-base font-bold shadow-lg shadow-secondary/10 group transition-all" type="submit" disabled={loading || phoneNumber.length < 10}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                  Get Verification Code
                </Button>
              </form>
              
              <div className="pt-4 border-t text-center space-y-4">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">New clinical staff?</p>
                <Link href="/register">
                  <Button variant="outline" className="w-full border-dashed border-2 font-bold h-11 transition-all hover:bg-muted">
                    <UserPlus className="mr-2 size-4" /> Provision Trial Record
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="otp" className="text-xs font-black uppercase tracking-widest text-muted-foreground">6-Digit Code</Label>
                  <button type="button" onClick={() => setStep('phone')} className="text-[10px] text-secondary font-black hover:underline">CHANGE NUMBER</button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="pl-10 h-11 text-2xl text-center font-black tracking-[0.5em]"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <div className="flex justify-between items-center px-1">
                   <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Sent to +91 {phoneNumber}</p>
                   {resendCooldown > 0 ? (
                     <p className="text-[10px] text-accent font-black">Resend in {resendCooldown}s</p>
                   ) : (
                     <button type="button" onClick={handleSendOtp} className="text-[10px] text-secondary font-black hover:underline flex items-center gap-1">
                       <RefreshCcw className="size-2.5" /> RESEND
                     </button>
                   )}
                </div>
              </div>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-bold shadow-lg shadow-accent/10" type="submit" disabled={loading || otp.length < 6}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Access Portal"}
              </Button>
            </form>
          )}
        </CardContent>
        
        <CardFooter>
          <Alert variant="default" className="bg-muted/30 border-none">
            <AlertCircle className="h-4 w-4 text-secondary" />
            <AlertTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Security Policy</AlertTitle>
            <AlertDescription className="text-[11px] text-muted-foreground leading-relaxed font-medium">
              365-day verification cycle active per device. Unauthorized numbers cannot self-register.
            </AlertDescription>
          </Alert>
        </CardFooter>
      </Card>
      <div id="recaptcha-container"></div>
    </div>
  );
}
