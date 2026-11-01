
'use client';

import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Save, Clock, Info, ShieldCheck } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeekOffConfiguration() {
  const [weekId, setWeekId] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [quotas, setQuotas] = useState<Record<string, number>>(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: 15 }), {})
  );
  const [loading, setLoading] = useState(false);

  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!weekId || !openTime || !closeTime) {
      toast({ title: "Validation Error", description: "All window fields are required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const configRef = doc(db, 'weekoff_configs', weekId);
      const payload = {
        weekId,
        bookingOpen: openTime,
        bookingClose: closeTime,
        quotas,
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
        actorId: profile?.uid,
      };

      await setDoc(configRef, payload);

      logAudit(db, profile?.uid || 'system', 'CONFIGURE_WEEKOFF', weekId, {
        openTime,
        closeTime,
        quotas
      });

      toast({ title: "Configuration Saved", description: `Weekly-off window for ${weekId} has been scheduled.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleQuotaChange = (day: string, val: string) => {
    setQuotas({ ...quotas, [day]: parseInt(val) || 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Weekly-Off Control</h1>
        <p className="text-muted-foreground">Configure the FCFS booking window and daily staff limits.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <CardTitle>Booking Window</CardTitle>
              </div>
              <CardDescription>Asia/Kolkata (GMT+5:30)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weekId">Roster Week (YYYY-WW)</Label>
                <Input 
                  id="weekId" 
                  placeholder="e.g. 2024-25" 
                  value={weekId}
                  onChange={(e) => setWeekId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="open">Opening Time</Label>
                <Input 
                  id="open" 
                  type="datetime-local" 
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close">Closing Time</Label>
                <Input 
                  id="close" 
                  type="datetime-local" 
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <ShieldCheck className="size-5 text-secondary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-secondary">FCFS Protection</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Once the window opens, slots are allocated via atomic server-side transactions. 
                    Priority is strictly determined by commit time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent" />
              <CardTitle>Daily Slot Quotas</CardTitle>
            </div>
            <CardDescription>Maximum employees allowed to be OFF on each weekday.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {DAYS.map((day) => (
                <div key={day} className="space-y-2 p-3 rounded-lg border bg-muted/20">
                  <Label className="text-[10px] uppercase tracking-wider font-bold opacity-70">{day}</Label>
                  <Input 
                    type="number" 
                    className="h-9 font-bold text-center"
                    value={quotas[day]}
                    onChange={(e) => handleQuotaChange(day, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/5">
            <Button className="w-full sm:w-auto ml-auto bg-secondary" onClick={handleSave} disabled={loading}>
              <Save className="mr-2 h-4 w-4" /> {loading ? 'Saving...' : 'Publish Booking Window'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="size-5 text-accent mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-accent-foreground">Operational Rule</p>
              <p className="text-xs text-muted-foreground">
                Total weekly-off quota across all 7 days should align with the total workforce size 
                to ensure staffing feasibility. (e.g. 120 employees = 120 total off-slots per week).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
