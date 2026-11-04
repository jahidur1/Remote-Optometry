
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
  signOut,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Phone, Key, ArrowRight, ShieldCheck, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createOrUpdateSession } from '@/lib/session-utils';
import { logAudit } from '@/lib/audit';
import { addHours } from 'date-fns';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { syncProfileOnLoginAction } from '@/services/identity-actions';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'email'>('phone');
  const [loading, setLoading] = useState(false);
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

  const handleSyncProfile = async (user: any) => {
    try {
      const idToken = await user.getIdToken(true);
      const result = await syncProfileOnLoginAction(idToken);
      
      if (result.success) {
        await createOrUpdateSession(db, user.uid, result.employeeId!);
        logAudit(db, user.uid, 'AUTH_LOGIN_SUCCESS', result.employeeId!);

        toast({
          title: "Identity Verified",
          description: `Welcome, ${result.fullName!.split(' ')[0]}.`,
        });

        if (result.role === 'admin' || result.role === 'super_admin') {
          router.push('/admin');
        } else {
          router.push('/employee/portal');
        }
      } else {
        await signOut(auth);
        throw new Error(result.error);
      }
    } catch (e: any) {
        toast({ variant: "destructive", title: "Identity Error", description: e.message });
        setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleSyncProfile(userCredential.user);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Auth Failure", description: "Invalid credentials or unauthorized identity." });
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ variant: "destructive", title: "Input Required", description: "Please enter your official email address." });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Reset Pulse Dispatched", description: `A password reset link has been sent to ${email}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Pulse Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await handleSyncProfile(userCredential.user);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Google Auth Failed", description: error.message });
      setLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      toast({ variant: "destructive", title: "Invalid Number", description: "10-digit Indian mobile number required." });
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = `+91${phoneNumber}`;
      initializeRecaptcha();
      const verifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      
      await setDoc(doc(db, 'otp_registry', formattedPhone), {
        phone: formattedPhone,
        otp: "DISPATCHED",
        expiresAt: addHours(new Date(), 12).toISOString(),
        createdAt: serverTimestamp()
      }, { merge: true });

      setConfirmationResult(result);
      setStep('otp');
      toast({ title: "Verification Initiated", description: "Security code dispatched." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Access Denied", description: error.message });
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
      await handleSyncProfile(userCredential.user);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Verification Failure", description: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 relative overflow-hidden font-body text-black">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <Card className="w-full max-w-md shadow-[0_30px_60px_rgba(0,0,0,0.1)] relative z-10 border-white bg-white/95 backdrop-blur-2xl rounded-[3rem] overflow-hidden animate-in border-4">
        <CardHeader className="space-y-6 text-center p-12 pb-8">
          {logo && (
            <div className="mx-auto relative size-20 transform hover:rotate-3 transition-transform duration-500">
              <Image src={logo.imageUrl} alt="Remote Optometry" fill className="object-contain" />
            </div>
          )}
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black tracking-tight font-headline uppercase leading-none text-black">Institutional <span className="text-secondary">Authentication</span></CardTitle>
            <CardDescription className="text-black/30 font-black uppercase text-[10px] tracking-[0.4em]">Remote Optometry Identity Pulse</CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-10 pb-10">
          <Tabs defaultValue="phone" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-14 bg-slate-100 rounded-2xl p-1.5 mb-8">
              <TabsTrigger value="phone" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">Mobile OTP</TabsTrigger>
              <TabsTrigger value="email" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">Email Auth</TabsTrigger>
            </TabsList>

            <TabsContent value="phone">
              {step !== 'otp' ? (
                <form onSubmit={handleSendOtp} className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Mobile Endpoint</Label>
                    <div className="flex gap-3">
                      <div className="flex h-14 w-16 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-primary text-lg">+91</div>
                      <div className="relative flex-1 group">
                        <Phone className="absolute left-4 top-5 h-4 w-4 text-black/20 group-focus-within:text-primary transition-colors" />
                        <Input
                          placeholder="99999 00000"
                          className="pl-12 h-14 text-xl font-bold rounded-2xl border-2 border-slate-100 bg-white text-black focus:border-primary transition-all shadow-inner"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <Button className="w-full bg-primary text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all group" type="submit" disabled={loading || phoneNumber.length < 10}>
                    {loading ? <Loader2 className="mr-3 size-6 animate-spin" /> : <>Request OTP <ArrowRight className="ml-3 size-6 group-hover:translate-x-2 transition-transform" /></>}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-10">
                  <div className="space-y-6 text-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">Verification Key</Label>
                    <div className="relative">
                      <Key className="absolute left-4 top-7 h-5 w-5 text-black/20" />
                      <Input
                        maxLength={6}
                        placeholder="000000"
                        className="pl-12 h-20 text-5xl text-center font-black tracking-[0.6em] rounded-2xl border-4 border-slate-100 bg-white text-black shadow-inner"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>
                    <button type="button" onClick={() => setStep('phone')} className="text-[10px] font-black uppercase text-primary hover:underline">Edit Number</button>
                  </div>
                  <Button className="w-full bg-primary text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl transition-all" type="submit" disabled={loading || otp.length < 6}>
                    {loading ? <Loader2 className="mr-3 size-6 animate-spin" /> : "Verify Identity"}
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="email" className="space-y-8">
              <form onSubmit={handleEmailLogin} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Official Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/20 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="email" 
                        placeholder="professional@roc.internal" 
                        className="pl-12 h-14 font-bold border-2 border-slate-100 rounded-2xl focus:border-primary transition-all" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">Password</Label>
                      <button 
                        type="button" 
                        onClick={handleForgotPassword}
                        className="text-[9px] font-black uppercase text-secondary hover:underline transition-all"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/20 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        className="pl-12 pr-12 h-14 font-bold border-2 border-slate-100 rounded-2xl focus:border-primary text-black transition-all" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-primary text-white h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-3 size-5 animate-spin" /> : "Authorize Access"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                <div className="relative flex justify-center text-[9px] uppercase font-black"><span className="bg-white px-4 text-black/20 tracking-widest">Or Cloud Integration</span></div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-16 border-2 border-slate-100 hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-sm"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" width={18} height={18} className="mr-3" />
                Sign in with Google Account
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className="bg-slate-50 p-10 border-t border-slate-100">
          <div className="flex gap-5 items-start">
             <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                <ShieldCheck className="size-6 text-primary" />
             </div>
             <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Zero-Trust Protocol</p>
                <p className="text-[12px] text-black/40 leading-relaxed font-bold uppercase tracking-tight">
                  Authorized personnel only. Access pulses are ledgered for institutional compliance.
                </p>
             </div>
          </div>
        </CardFooter>
      </Card>
      <div id="recaptcha-container"></div>
    </div>
  );
}
