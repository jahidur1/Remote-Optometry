
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Clock, MapPin, CalendarDays, MessageCircle, AlertCircle } from "lucide-react"

export default function EmployeePortal() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  const upcomingShifts = [
    { day: "Today", shift: "Morning Optom", time: "08:00 - 16:00", location: "Remote Station 4" },
    { day: "Tomorrow", shift: "Mid-Day Optom", time: "11:00 - 19:00", location: "Main Center" },
    { day: "Friday, June 20", shift: "Morning Optom", time: "08:00 - 16:00", location: "Remote Station 2" },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Welcome back, Sarah</h1>
        <p className="text-muted-foreground">Manage your upcoming shifts and weekly-off requests.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Shifts</CardTitle>
            <CardDescription>Your confirmed schedule for the next 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingShifts.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Clock className="size-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-bold">{s.shift}</p>
                    <p className="text-xs text-muted-foreground">{s.day} • {s.time}</p>
                    <p className="text-xs flex items-center gap-1 mt-1">
                      <MapPin className="size-3" /> {s.location}
                    </p>
                  </div>
                </div>
                <Badge variant={i === 0 ? "default" : "secondary"} className={i === 0 ? "bg-accent" : ""}>
                  {i === 0 ? "Current" : "Confirmed"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CalendarDays className="size-4 text-accent" /> Book Weekly-Off
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border mx-auto"
              />
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  <AlertCircle className="inline size-3 mr-1" /> 
                  Atomic booking: Limited slots available for weekdays.
                </p>
                <Button className="w-full bg-primary" size="sm">Request Day Off</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary text-secondary-foreground">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageCircle className="size-4" /> Shift Swap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs mb-4 opacity-90">Need to change a shift? Start a request to your colleagues.</p>
              <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white" size="sm">
                Initiate Swap
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
