
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
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Mail className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold font-headline">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to <span className="font-semibold text-foreground">{user?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Please check your email and click the link to activate your account. If you don't see it, check your spam folder.
          </p>
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-xs font-medium">
              <CheckCircle2 className="size-4 text-accent" />
              Status: Verification Pending
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleRefresh}>
            <RefreshCcw className="mr-2 h-4 w-4" /> I've Verified My Email
          </Button>
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button variant="outline" onClick={handleResend} disabled={resending}>
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend Link"}
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
