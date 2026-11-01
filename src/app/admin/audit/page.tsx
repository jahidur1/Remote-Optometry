
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Download, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const logs = [
  { id: "A120", user: "Admin (J. Smith)", action: "Published Roster", target: "Week 24", time: "2023-10-25 14:20", status: "Success" },
  { id: "A119", user: "Sarah Optom", action: "Booked Day Off", target: "2023-11-02", time: "2023-10-25 11:05", status: "Success" },
  { id: "A118", user: "Admin (J. Smith)", action: "Run Solver", target: "Week 25", time: "2023-10-25 09:30", status: "Success" },
  { id: "A117", user: "System", action: "WhatsApp Sync", target: "All Employees", time: "2023-10-25 08:00", status: "Success" },
  { id: "A116", user: "Mike Support", action: "Login Attempt", target: "Portal", time: "2023-10-24 22:15", status: "Failure" },
  { id: "A115", user: "Admin (J. Smith)", action: "Modify Quota", target: "Night Shift", time: "2023-10-24 16:45", status: "Success" },
]

export default function AuditLogs() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Audit Trail</h1>
          <p className="text-muted-foreground">Immutable logs of all sensitive administrative and employee actions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline">
             Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-secondary" />
              <CardTitle>System Activity</CardTitle>
            </div>
            <div className="flex gap-2 w-full max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search logs..." className="pl-8" />
              </div>
              <Button variant="ghost" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Log ID</TableHead>
                <TableHead>User / Source</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Element</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.id}</TableCell>
                  <TableCell className="font-medium">{log.user}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.target}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{log.time}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={log.status === 'Success' ? 'default' : 'destructive'} className={log.status === 'Success' ? 'bg-green-500' : ''}>
                      {log.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
