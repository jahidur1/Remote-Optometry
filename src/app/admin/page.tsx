
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Calendar, Activity, CheckCircle2 } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { DemoBadge } from "@/components/ui/demo-badge"

const weeklyData = [
  { day: "Mon", scheduled: 12, required: 12 },
  { day: "Tue", scheduled: 11, required: 12 },
  { day: "Wed", scheduled: 12, required: 12 },
  { day: "Thu", scheduled: 10, required: 12 },
  { day: "Fri", scheduled: 14, required: 12 },
  { day: "Sat", scheduled: 8, required: 8 },
  { day: "Sun", scheduled: 6, required: 8 },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Workforce Overview</h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground">Monitor staffing levels, solver performance, and upcoming rosters.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-secondary shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">3 shifts understaffed</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Roster</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Week 24</div>
            <p className="text-xs text-muted-foreground">Published 2 days ago</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Conflicts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Staffing Quota Matrix</CardTitle>
            <CardDescription>Actual scheduled vs. Required staff count.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <span className="font-bold text-xs">Scheduled:</span>
                              <span className="text-xs">{payload[0].value}</span>
                              <span className="font-bold text-xs">Required:</span>
                              <span className="text-xs">{payload[1].value}</span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="scheduled" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="required" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Solver Activity</CardTitle>
            <CardDescription>Engine performance metrics.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {[
                { time: "2 hours ago", status: "Optimal", msg: "Week 25 Generation Completed" },
                { time: "5 hours ago", status: "Feasible", msg: "Gender Balance Optimization" },
                { time: "Yesterday", status: "Conflict", msg: "Constraint Violation Detected (Mid-Shift)" }
              ].map((log, i) => (
                <div key={i} className="flex items-center">
                  <div className={`mr-4 size-2 rounded-full ${log.status === 'Optimal' ? 'bg-accent' : log.status === 'Conflict' ? 'bg-destructive' : 'bg-secondary'}`} />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{log.msg}</p>
                    <p className="text-sm text-muted-foreground">{log.time} • Status: {log.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
