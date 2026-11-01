
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
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Stethoscope, Loader2, Phone, Key, AlertCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createOrUpdateSession } from '@/lib/session-utils';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!auth) return;
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
  }, [auth]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Authorization Check: Must exist in employee directory
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const q = query(collection(db, 'employees'), where('whatsappNumber', '==', formattedPhone));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("This mobile number is not authorized for portal access. Please contact your administrator.");
      }

      const employee = snap.docs[0].data();
      if (employee.status !== 'Active') {
        throw new Error("Your employee account is currently suspended.");
      }

      // 2. Firebase Phone Auth
      const verifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      setStep('otp');
      toast({ title: "OTP Dispatched", description: "Please check your mobile for the verification code." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Blocked",
        description: error.message || "Failed to send OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await confirmationResult.confirm(otp);
      
      // 3. Session Creation (365-day rolling)
      const q = query(collection(db, 'employees'), where('whatsappNumber', '==', userCredential.user.phoneNumber));
      const snap = await getDocs(q);
      const employee = snap.docs[0].data();

      await createOrUpdateSession(db, userCredential.user.uid, employee.id);

      toast({
        title: "Verified",
        description: "Welcome back to ROC Workforce.",
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "Invalid OTP. Please try again.",
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
          <CardDescription className="text-muted-foreground/80">
            Enterprise OTP Authentication System
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Authorized Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="99999 00000"
                    className="pl-10 h-11 text-lg font-bold tracking-widest"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest px-1">
                   Institutional Login • Only +91 Supported
                </p>
              </div>
              <Button className="w-full bg-secondary hover:bg-secondary/90 h-12 text-base font-bold shadow-lg" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Get Verification Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">6-Digit Verification Code</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="pl-10 h-11 text-2xl text-center font-black tracking-[0.5em]"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-bold shadow-lg" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Access Portal"}
              </Button>
              <Button variant="link" className="w-full text-xs text-muted-foreground" onClick={() => setStep('phone')} type="button">
                Change Phone Number
              </Button>
            </form>
          )}
        </CardContent>
        
        <CardFooter>
          <Alert variant="default" className="bg-muted/50 border-none">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Security Policy</AlertTitle>
            <AlertDescription className="text-[11px] text-muted-foreground leading-relaxed">
              Self-registration is disabled. Mobile numbers must be pre-provisioned by clinical administration.
            </AlertDescription>
          </Alert>
        </CardFooter>
      </Card>
      
      <div id="recaptcha-container"></div>
      <div className="absolute bottom-6 text-white/40 text-[10px] font-black tracking-widest uppercase">
        &copy; 2024 ROC WORKFORCE • Secure Device Sessions Enabled
      </div>
    </div>
  );
}
