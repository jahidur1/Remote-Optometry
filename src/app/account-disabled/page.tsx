
'use client';

import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserX, LogOut, Mail } from 'lucide-react';

export default function AccountDisabledPage() {
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-destructive/5 p-4">
      <Card className="w-full max-w-md border-destructive/20 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <UserX className="size-10" />
          </div>
          <CardTitle className="text-2xl font-bold font-headline text-destructive">Account Disabled</CardTitle>
          <CardDescription>
            Your access to the ROC Workforce portal has been suspended.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Administrative action has been taken on your account. You can no longer access workforce data, rosters, or booking tools.
          </p>
          <div className="p-4 bg-muted rounded-lg border text-left flex items-start gap-3">
            <Mail className="size-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What to do next?</p>
              <p className="text-sm mt-1">Please contact human resources or your system administrator for further information regarding this status.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" variant="destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
