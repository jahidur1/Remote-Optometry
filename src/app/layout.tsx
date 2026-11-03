import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import { SessionTimeout } from '@/components/auth/session-timeout';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Remote Optometry — Intelligent Workforce & Shift Management',
  description: 'Enterprise shift management for Remote Optometry Centres',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`light ${inter.variable}`}>
      <body className="font-body antialiased selection:bg-secondary/30">
        <FirebaseClientProvider>
          <SessionTimeout />
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
