
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
  const [weekId] = useState('2024-52');

  const shiftQuery = useMemo(() => query(collection(db, 'shift_master')), [db]);
  const { data: shifts } = useCollection(shiftQuery);

  const prefQuery = useMemo(() => {
    if (!profile?.employeeId) return null;
    return query(collection(db, 'employee_preferences'), where('employeeId', '==', profile.employeeId), where('weekId', '==', weekId));
  }, [db, profile, weekId]);
  
  const { data: preferences, loading: prefLoading } = useCollection(prefQuery);

  const handleSavePref = async (day: string, shiftId: string) => {
    if (!profile?.employeeId || !profile?.office) return;
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
          office: profile.office, // Add for security rules isolation
          weekId,
          dayOfWeek: day,
          shiftId,
          type: 'preferShift',
          updatedAt: new Date().toISOString()
        });
      }
      toast({ title: "Preference Saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (prefLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Shift Preferences</h1>
        <p className="text-muted-foreground font-medium">Cycle: {weekId} • Scoped to Cluster: {profile?.office?.replace('_', ' ')}</p>
      </div>

      <div className="grid gap-4 mt-8">
        {DAYS.map(day => {
          const existing = preferences?.find(p => p.dayOfWeek === day);
          return (
            <Card key={day} className="group hover:border-secondary transition-all">
              <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                      <Star className={`size-5 ${existing ? 'text-secondary fill-secondary' : 'text-muted-foreground'}`} />
                   </div>
                   <span className="font-black text-xl uppercase tracking-tighter w-32">{day}</span>
                </div>
                
                <Select onValueChange={(val) => handleSavePref(day, val)} defaultValue={existing?.shiftId || 'none'}>
                  <SelectTrigger className="w-full sm:w-72 h-12 font-bold rounded-xl border-2">
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-white p-2">
                    <SelectItem value="none" className="font-bold">No specific preference</SelectItem>
                    {shifts?.map(s => (
                      <SelectItem key={s.id} value={s.id} className="font-bold uppercase text-[11px] py-3">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
