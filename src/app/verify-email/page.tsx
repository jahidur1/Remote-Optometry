'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, LogOut, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmailPage() {
  const { user, loading, emailVerified } = useUser();
  const [resending, setResending] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && emailVerified) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);

  // Automatically trigger verification on mount if not yet sent
  useEffect(() => {
    if (user && !emailVerified && !loading) {
       // Firebase handles throttling this call automatically
       sendEmailVerification(user).catch(err => {
         console.warn("Verification already sent or throttled:", err.message);
       });
    }
  }, [user, emailVerified, loading]);

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
      toast({
        title: "Verification Sent",
        description: "Check your inbox for a new verification link.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend verification email.",
      });
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-md shadow-2xl bg-white border-none rounded-[3rem] overflow-hidden">
        <CardHeader className="text-center p-12 pb-8">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-secondary/10 text-secondary shadow-inner">
            <Mail className="size-10" />
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tight text-primary leading-none mb-2">Verify Identity</CardTitle>
          <CardDescription className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            A pulse has been sent to: <br /><span className="text-primary mt-1 inline-block">{user?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center px-12">
          <p className="text-sm font-medium text-muted-foreground leading-relaxed uppercase tracking-tight">
            Please check your official ROC email and click the verification node to activate your clinical profile.
          </p>
          <div className="flex justify-center">
            <div className="flex items-center gap-3 px-6 py-2 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              <CheckCircle2 className="size-3 text-secondary" />
              STATUS: VALIDATION PENDING
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 p-12 pt-6">
          <Button className="w-full h-16 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all" onClick={handleRefresh}>
            <RefreshCcw className="mr-3 h-5 w-5" /> RE-SCAN IDENTITY
          </Button>
          <div className="grid grid-cols-2 gap-4 w-full">
            <Button variant="outline" className="h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest border-2" onClick={handleResend} disabled={resending}>
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "RESEND PULSE"}
            </Button>
            <Button variant="ghost" className="h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest text-destructive hover:bg-destructive/5" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> ABORT
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
