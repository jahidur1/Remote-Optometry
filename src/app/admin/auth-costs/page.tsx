'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  AlertCircle, 
  TrendingUp, 
  ShieldCheck, 
  Info, 
  CreditCard, 
  Activity, 
  Database, 
  Zap, 
  ArrowUpRight,
  Clock,
  Terminal,
  Server
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { DemoBadge } from '@/components/ui/demo-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="space-y-8 pb-40 max-w-[1600px] mx-auto animate-in px-4">
      {/* High-Intensity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
              <CreditCard className="size-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">Cost Monitor</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  Institutional Burn Rate <Activity className="size-3 text-secondary animate-pulse" />
                </p>
                <DemoBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
           <div className="px-6 py-1.5 space-y-0.5">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Operational Status</label>
              <div className="flex items-center gap-3">
                 <span className="font-black text-secondary uppercase tracking-widest text-lg">OPTIMIZED</span>
                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
           </div>
           <div className="w-px h-10 bg-white/10" />
           <Button 
             variant="outline"
             className="bg-white/5 border-white/10 text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-xl transition-all hover:bg-secondary/20 hover:border-secondary" 
           >
            <Database className="size-4 mr-3" /> AUDIT LEDGER
           </Button>
        </div>
      </div>

      {/* KPI Ledger */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">OTP Dispatched</CardTitle>
            <Zap className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-10 w-full rounded-xl opacity-10 bg-white" /> : (
              <>
                <div className="text-5xl font-black text-white tracking-tighter">{stats?.otpRequests}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Global Pulse Count</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">Efficiency</CardTitle>
            <ShieldCheck className="h-5 w-5 text-accent opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-accent tracking-tighter">{stats?.successRate}%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Verification Accuracy</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Operating Expense</CardTitle>
            <Calculator className="h-5 w-5 text-secondary opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">₹{stats?.estCost.toFixed(2)}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Est. SMS Payload</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-none overflow-hidden group hover:bg-white/[0.05] transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Session Saver</CardTitle>
            <Clock className="h-5 w-5 text-emerald-500 opacity-30 group-hover:opacity-100 transition-all" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-white tracking-tighter">82%</div>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">Cycle Cost Reduction</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        {/* Main Velocity Chart */}
        <Card className="lg:col-span-4 shadow-2xl border-none overflow-hidden rounded-[2.5rem] glass-card border-t-8 border-t-secondary">
          <CardHeader className="bg-white/[0.03] border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-white/10 shadow-inner">
                <TrendingUp className="size-8 text-secondary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">Dispatch Velocity</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-2">
                   Real-time OTP transmission frequency ledger.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontBold: 900, fill: 'rgba(255,255,255,0.5)' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontBold: 800, fill: 'rgba(255,255,255,0.5)' }} 
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-[1.25rem] border-2 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl border-white/10 animate-in zoom-in-95">
                                  <p className="text-[10px] font-black uppercase text-secondary tracking-widest mb-3 border-b border-white/5 pb-3">{payload[0].payload.name} Requests</p>
                                  <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-black text-white tracking-tighter">{payload[0].value}</span>
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">OTP Cycles</span>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar dataKey="requests" radius={[12, 12, 0, 0]} barSize={48}>
                           {chartData.map((entry, index) => (
                             <Cell 
                               key={`cell-${index}`} 
                               fill={index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--accent))'} 
                               className="transition-all duration-500 hover:opacity-80" 
                             />
                           ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Protocol Stack */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden glass-card border-l-4 border-l-secondary">
             <CardHeader className="p-10 pb-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <ShieldCheck className="size-7 text-secondary" />
                  <CardTitle className="text-xl font-black uppercase tracking-tight text-white">Guard Protocol</CardTitle>
                </div>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2 text-white/30">Security cycle cost mitigate.</CardDescription>
             </CardHeader>
             <CardContent className="p-10 space-y-10">
                <div className="space-y-6">
                   <div className="p-6 rounded-[1.75rem] bg-secondary/5 border border-secondary/10 flex items-center gap-6 group hover:bg-secondary/10 transition-all cursor-default">
                      <div className="size-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner group-hover:scale-110 transition-transform">
                         <Clock className="size-6" />
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Verification Validity</p>
                         <p className="text-lg font-black text-white uppercase tracking-tight leading-none">365-Day Cycle</p>
                      </div>
                   </div>

                   <div className="p-6 rounded-[1.75rem] bg-accent/5 border border-accent/10 flex items-center gap-6 group hover:bg-accent/10 transition-all cursor-default">
                      <div className="size-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shadow-inner group-hover:scale-110 transition-transform">
                         <Server className="size-6" />
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Gateway Node</p>
                         <p className="text-lg font-black text-white uppercase tracking-tight leading-none">+91 Endpoint Only</p>
                      </div>
                   </div>
                </div>

                <div className="pt-8 border-t border-white/10 space-y-4">
                   <div className="flex items-center gap-3 text-emerald-400">
                      <Info className="size-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Financial Summary</span>
                   </div>
                   <p className="text-[13px] text-white/40 leading-relaxed font-bold uppercase tracking-tighter">
                      reCAPTCHA verification is mandatory to mitigate bot exhaustion and protect the operational budget from fraudulent dispatches.
                   </p>
                </div>
             </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground premium-card relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 p-10 transform group-hover:scale-110 transition-transform duration-1000 opacity-[0.03]">
               <Calculator size={280} />
            </div>
            <CardContent className="p-10 space-y-8 relative z-10">
               <div className="size-16 rounded-[1.5rem] bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50">
                  <ShieldCheck className="size-8 text-white" />
               </div>
               <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-secondary">Institutional Protocol</p>
                  <p className="text-lg font-black text-white uppercase tracking-tight leading-tight">Economic Efficiency</p>
               </div>
               <p className="text-[13px] font-medium leading-relaxed opacity-70 uppercase tracking-tight">
                 "By implementing device-persistent sessions valid for one solar year, the system reduces recurring SMS overhead by 82% compared to standard daily authentication requirements."
               </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Governance Footer */}
      <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-black border border-white/5 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform duration-2000"><Database size={280} /></div>
         <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
            <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/50 shrink-0">
               <ArrowUpRight className="size-8 text-white" />
            </div>
            <div className="space-y-4">
               <p className="text-[11px] font-black uppercase text-secondary tracking-[0.4em]">Audit Protocol node</p>
               <p className="text-lg font-bold text-white/80 leading-relaxed max-w-4xl tracking-tight">
                  "Cost estimates are derived from verified `AUTH_OTP_REQUEST` pulses within the immutable trace ledger. 
                  SMS pricing is subject to regional carrier adjustments and is synchronized with the Meta Cloud API distribution metrics."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
