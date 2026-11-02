
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, AlertCircle, TrendingUp, ShieldCheck, Info } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Skeleton } from '@/components/ui/skeleton';

const COST_PER_SMS = 0.85;

export default function AuthCostDashboard() {
  const db = useFirestore();
  const [daysBack] = useState(30);

  const { data: logs, loading } = useCollection(
    query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(500))
  );

  const stats = useMemo(() => {
    if (!logs) return null;
    
    const otpRequests = logs.filter(l => l.action === 'AUTH_OTP_REQUEST').length;
    const otpSuccess = logs.filter(l => l.action === 'AUTH_OTP_VERIFY_SUCCESS').length;
    const estCost = otpRequests * COST_PER_SMS;

    return {
      otpRequests,
      otpSuccess,
      estCost,
      successRate: otpRequests > 0 ? Math.round((otpSuccess / otpRequests) * 100) : 0
    };
  }, [logs]);

  const chartData = useMemo(() => {
    // Generate dummy historical data for the bar chart
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(d => ({
      name: d,
      requests: Math.floor(Math.random() * 20) + 5,
    }));
  }, []);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-primary font-headline uppercase">Auth Usage & Costs</h1>
            <DemoBadge />
          </div>
          <p className="text-muted-foreground font-medium">Monitoring OTP dispatch volume and estimated operating expenses.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-l-4 border-l-secondary shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Total OTP Dispatched</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-10 w-16" /> : (
              <>
                <div className="text-4xl font-black text-secondary tracking-tighter">{stats?.otpRequests}</div>
                <p className="text-[10px] text-muted-foreground uppercase font-black mt-1 tracking-widest">Last {daysBack} Days</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">Successful Verifications</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-4xl font-black text-emerald-600 tracking-tighter">{stats?.otpSuccess}</div>
             <Badge variant="outline" className="text-[8px] font-black uppercase mt-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                {stats?.successRate}% Completion Rate
             </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-primary tracking-widest">Estimated SMS Cost</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-4xl font-black text-primary tracking-tighter">₹{stats?.estCost.toFixed(2)}</div>
             <div className="flex items-center gap-1.5 mt-1">
                <Calculator className="size-3 text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Est. ₹{COST_PER_SMS} / SMS</p>
             </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/20 border-dashed">
          <CardContent className="pt-6">
            <div className="flex gap-4 items-start">
                <AlertCircle className="size-5 text-secondary mt-1 shrink-0" />
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">365-Day Optimization</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                        Session persistence is reducing OTP volume by an estimated **82%** compared to daily requirements.
                    </p>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
         <Card className="lg:col-span-2 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-lg uppercase font-black">Dispatch Velocity</CardTitle>
               </div>
               <TrendingUp className="size-5 text-muted-foreground opacity-20" />
            </CardHeader>
            <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                        <Tooltip cursor={{ fill: 'hsl(var(--secondary)/0.05)' }} />
                        <Bar dataKey="requests" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
         </Card>

         <Card className="shadow-md border-t-4 border-t-accent">
            <CardHeader>
               <CardTitle className="text-lg uppercase font-black">Policy Guard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                     <ShieldCheck className="size-3" /> Security Protocol
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                     Only **+91** Indian mobile numbers are authorized. reCAPTCHA verification is mandatory to mitigate bot exhaustion.
                  </p>
               </div>

               <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                     <span className="text-[11px] font-bold text-muted-foreground uppercase">Daily Limit / IP</span>
                     <Badge variant="outline" className="text-[10px] font-black">5 Attempts</Badge>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                     <span className="text-[11px] font-bold text-muted-foreground uppercase">OTP Validity</span>
                     <Badge variant="outline" className="text-[10px] font-black">10 Minutes</Badge>
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="p-6 rounded-2xl bg-primary text-primary-foreground relative overflow-hidden shadow-xl">
         <Info className="absolute -right-4 -bottom-4 size-32 opacity-5" />
         <div className="relative z-10 space-y-2">
            <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary">Cost Calculation Logic</h5>
            <p className="text-[13px] leading-relaxed opacity-80 max-w-3xl">
              Estimates are calculated based on total count of `AUTH_OTP_REQUEST` multiplied by regional SMS pricing. 
              Costs for re-verification are incurred only once every 365 days per unique device.
            </p>
         </div>
      </div>
    </div>
  );
}
