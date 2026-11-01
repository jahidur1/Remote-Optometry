
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Save, Trash2, Info, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { DemoBadge } from '@/components/ui/demo-badge';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function EmployeePreferences() {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [weekId] = useState('2024-52'); // Simplified for demo

  // Fetch available shifts and existing preferences
  const { data: shifts } = useCollection(query(collection(db, 'shift_master')));
  const prefQuery = useMemo(() => {
    if (!profile?.employeeId) return null;
    return query(collection(db, 'employee_preferences'), where('employeeId', '==', profile.employeeId), where('weekId', '==', weekId));
  }, [profile, weekId]);
  
  const { data: preferences, loading: prefLoading } = useCollection(prefQuery);

  const handleSavePref = async (day: string, shiftId: string) => {
    if (!profile?.employeeId) return;
    setLoading(true);
    try {
      const prefId = `${weekId}_${profile.employeeId}_${day}`;
      const prefRef = doc(db, 'employee_preferences', prefId);
      
      if (!shiftId || shiftId === 'none') {
        await deleteDoc(prefRef);
      } else {
        await setDoc(prefRef, {
          id: prefId,
          employeeId: profile.employeeId,
          weekId,
          dayOfWeek: day,
          shiftId,
          type: 'preferShift',
          updatedAt: new Date().toISOString()
        });
      }
      toast({ title: "Preference Saved", description: "This will be treated as a soft optimization goal by the solver." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (prefLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Shift Preferences</h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground font-medium">Week Cycle: {weekId} • Preferred Shift Targets</p>
      </div>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-start">
             <div className="size-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm border">
                <Info className="size-5 text-accent" />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-black text-primary uppercase tracking-wider">Optimization Note</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Preferences are **soft constraints**. The OR-Tools engine will attempt to satisfy these 
                  where possible, but hard constraints (Quotas, Weekly-Offs, Leave) always take priority. 
                  Confirmed Weekly-Offs cannot be overridden by preferences.
                </p>
             </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {DAYS.map(day => {
          const existing = preferences?.find(p => p.dayOfWeek === day);
          return (
            <Card key={day} className="group hover:border-secondary transition-all">
              <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                      <Star className={`size-5 ${existing ? 'text-secondary fill-secondary' : 'text-muted-foreground'}`} />
                   </div>
                   <span className="font-black text-lg uppercase tracking-tighter w-32">{day}</span>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Select 
                    onValueChange={(val) => handleSavePref(day, val)} 
                    defaultValue={existing?.shiftId || 'none'}
                  >
                    <SelectTrigger className="w-full sm:w-64 h-11 font-bold">
                      <SelectValue placeholder="No preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific preference</SelectItem>
                      {shifts?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
