
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4 text-primary-foreground">
      <Card className="w-full max-w-md bg-card text-card-foreground border-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-10" />
          </div>
          <CardTitle className="text-2xl font-bold font-headline">Access Denied</CardTitle>
          <CardDescription>
            You do not have the necessary permissions to view this resource.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact your system administrator or check your login role.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full bg-secondary hover:bg-secondary/90" onClick={() => router.push('/')}>
            <Home className="mr-2 h-4 w-4" /> Return to Home
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
