
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Save, Clock, Users } from "lucide-react"

const shifts = [
  { id: "S1", name: "Morning (Optom)", start: "08:00", end: "16:00", defaultQuota: 4 },
  { id: "S2", name: "Morning (Support)", start: "08:30", end: "16:30", defaultQuota: 2 },
  { id: "S3", name: "Mid-Day (Optom)", start: "11:00", end: "19:00", defaultQuota: 2 },
  { id: "S4", name: "Afternoon (Optom)", start: "14:00", end: "22:00", defaultQuota: 4 },
  { id: "S5", name: "Evening (Support)", start: "15:00", end: "23:00", defaultQuota: 2 },
  { id: "S6", name: "Night Remote (Optom)", start: "22:00", end: "06:00", defaultQuota: 1 },
]

export default function ShiftMaster() {
  const [quotaMatrix, setQuotaMatrix] = useState(
    shifts.map(s => Array(7).fill(s.defaultQuota))
  )

  const handleQuotaChange = (shiftIdx: number, dayIdx: number, val: string) => {
    const newVal = parseInt(val) || 0
    const newMatrix = [...quotaMatrix]
    newMatrix[shiftIdx][dayIdx] = newVal
    setQuotaMatrix(newMatrix)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Shift Master</h1>
          <p className="text-muted-foreground">Configure shifts and manage the 7-day employee quota matrix.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Add Shift
          </Button>
          <Button className="bg-secondary">
            <Save className="mr-2 h-4 w-4" /> Save Configuration
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-secondary" />
              <CardTitle>Shift Records</CardTitle>
            </div>
            <CardDescription>Primary shift definitions for the ROC.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{shift.name}</p>
                    <p className="text-xs text-muted-foreground">{shift.start} - {shift.end}</p>
                  </div>
                  <Badge variant="outline">{shift.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              <CardTitle>Staffing Quota Matrix</CardTitle>
            </div>
            <CardDescription>Daily staff requirements per shift (Mon - Sun).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Shift</TableHead>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <TableHead key={day} className="text-center">{day}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift, sIdx) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      {quotaMatrix[sIdx].map((val, dIdx) => (
                        <TableCell key={dIdx}>
                          <Input
                            type="number"
                            value={val}
                            className="w-12 mx-auto text-center h-8 px-1"
                            onChange={(e) => handleQuotaChange(sIdx, dIdx, e.target.value)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
