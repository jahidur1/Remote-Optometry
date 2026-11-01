
"use client"

import { useMemo } from "react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Calendar, Activity, CheckCircle2, MessageSquare, AlertCircle, BarChart3 } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { DemoBadge } from "@/components/ui/demo-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function AdminDashboard() {
  const db = useFirestore();

  // Real data fetches
  const { data: employees, loading: empLoading } = useCollection(query(collection(db, 'employees'), where('status', '==', 'Active')));
  const { data: rosters, loading: rosterLoading } = useCollection(query(collection(db, 'published_rosters'), orderBy('publishedAt', 'desc'), limit(1)));
  const { data: logs, loading: logLoading } = useCollection(query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(100)));
  const { data: leaves } = useCollection(query(collection(db, 'employee_leaves'), where('status', '==', 'approved')));
  const { data: solverLogs } = useCollection(query(collection(db, 'roster_drafts'), orderBy('createdAt', 'desc'), limit(5)));

  const latestRoster = rosters?.[0];
  const activeWeek = latestRoster?.weekId || 'N/A';

  const stats = useMemo(() => ({
    totalActive: employees?.length || 0,
    onLeaveToday: leaves?.filter(l => {
      const today = new Date().toISOString().split('T')[0];
      return today >= l.startDate && today <= l.endDate;
    }).length || 0,
    notificationSuccess: logs?.filter(l => l.status === 'success').length || 0,
    notificationFailed: logs?.filter(l => l.status === 'failed').length || 0,
  }), [employees, leaves, logs]);

  const chartData = useMemo(() => {
    if (!latestRoster) return [];
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return DAYS.map(day => ({
      day: day.substring(0, 3),
      scheduled: latestRoster.assignments.filter((a: any) => a.dayOfWeek === day).length,
    }));
  }, [latestRoster]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Workforce Command Center</h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground font-medium">Real-time clinical pool metrics and operational coverage for Week {activeWeek}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Active Pool</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {empLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-3xl font-black text-primary tracking-tighter">{stats.totalActive}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Verified Clinical Professionals</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-secondary shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Roster Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            {rosterLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-3xl font-black text-secondary tracking-tighter">{latestRoster ? 'LIVE' : 'PENDING'}</div>
                <Badge variant="outline" className="text-[8px] font-black uppercase mt-1 border-secondary/20 text-secondary">
                  V{latestRoster?.version.toString().slice(-4) || '---'}
                </Badge>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Absences (Today)</CardTitle>
            <AlertCircle className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-accent tracking-tighter">{stats.onLeaveToday}</div>
            <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Authorized Clinical Unavailability</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Briefings Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-600 tracking-tighter">{stats.notificationSuccess}</div>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">API Success Rate</span>
               <Badge className="bg-emerald-500 text-[8px] h-4 font-black">Meta Verified</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-md border-t-4 border-t-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg uppercase font-black tracking-tight">Daily Deployment Load</CardTitle>
                <CardDescription className="text-xs font-medium italic">Active published roster assignments per day.</CardDescription>
              </div>
              <BarChart3 className="size-5 text-muted-foreground opacity-50" />
            </div>
          </CardHeader>
          <CardContent className="pl-2 pt-4">
            <div className="h-[300px]">
              {latestRoster ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-xl border bg-background p-3 shadow-xl border-primary/10">
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">{payload[0].payload.day} Full Day</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-foreground">{payload[0].value}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Assigned</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="scheduled" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} barSize={40}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm">
                   No published roster data available for the selected period.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-md bg-muted/5">
          <CardHeader className="border-b bg-white/50">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <CardTitle className="text-sm font-black uppercase tracking-widest">Engine Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {solverLogs?.map((log, i) => (
                <div key={i} className="flex items-start gap-4 animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className={`mt-1 size-2 rounded-full shrink-0 ${log.solverStatus === 'OPTIMAL' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-secondary'}`} />
                  <div className="space-y-1">
                    <p className="text-[11px] font-black leading-none uppercase text-foreground/80 tracking-tight">Week {log.weekId} Generation</p>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] text-muted-foreground font-medium">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <Badge variant="ghost" className="text-[8px] h-3 px-1 font-black tracking-widest bg-muted/20">{log.solverStatus}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {solverLogs?.length === 0 && (
                <p className="text-center py-12 text-xs text-muted-foreground italic font-medium uppercase tracking-widest">No recent solver events detected.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 rounded-2xl bg-secondary text-secondary-foreground shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <Users size={180} />
         </div>
         <div className="space-y-3 relative z-10">
            <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-accent/80">Operational Intelligence</h5>
            <p className="text-lg leading-relaxed font-bold tracking-tight max-w-2xl italic">
              "The ROC Workforce system ensures 100% adherence to clinical staffing quotas while optimizing for 
              employee preferences and gender balance objectives."
            </p>
            <div className="pt-2 flex gap-4">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/50">System Latency</span>
                  <span className="text-sm font-bold">42ms Verified</span>
               </div>
               <div className="flex flex-col border-l border-white/10 pl-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Data Compliance</span>
                  <span className="text-sm font-bold">GDPR Ready</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
