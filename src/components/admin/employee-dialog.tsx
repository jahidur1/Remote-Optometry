
'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, Zap, Lock, Mail, User } from 'lucide-react';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: any;
}

const OFFICES = [
  { id: "KOLKATA_ROC", name: "Kolkata ROC" },
  { id: "GURGAON_ROC", name: "Gurgaon ROC" },
  { id: "LUCKNOW_ROC", name: "Lucknow ROC" }
];

export function EmployeeDialog({ open, onOpenChange, employee }: EmployeeDialogProps) {
  const db = useFirestore();
  const { profile } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    fullName: '',
    email: '',
    role: 'EMPLOYEE',
    status: 'Active',
    gender: 'Male',
    age: '',
    office: 'KOLKATA_ROC',
    whatsappNumber: '',
    department: 'Remote Optometry',
    designation: 'Staff Professional',
    joinedAt: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        id: employee.id || '',
        fullName: employee.fullName || '',
        email: employee.email || '',
        role: employee.role || 'EMPLOYEE',
        status: employee.status || 'Active',
        gender: employee.gender || 'Male',
        age: employee.age?.toString() || '',
        office: employee.office || 'KOLKATA_ROC',
        whatsappNumber: employee.whatsappNumber || '',
        department: employee.department || '',
        designation: employee.designation || '',
        joinedAt: employee.joinedAt || new Date().toISOString().split('T')[0],
      });
    } else {
      setFormData({
        id: '',
        fullName: '',
        email: '',
        role: 'EMPLOYEE',
        status: 'Active',
        gender: 'Male',
        age: '',
        office: 'KOLKATA_ROC',
        whatsappNumber: '',
        department: 'Remote Optometry',
        designation: 'Staff Professional',
        joinedAt: new Date().toISOString().split('T')[0],
      });
    }
  }, [employee, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const docId = employee ? employee.id : formData.id;
      const employeeRef = doc(db, 'employees', docId);

      const payload = {
        ...formData,
        age: parseInt(formData.age) || 0,
        updatedAt: new Date().toISOString(),
      };

      if (employee) {
        await updateDoc(employeeRef, payload);
        
        // SYNC: Update corresponding user record if it exists
        const userQuery = query(collection(db, 'users'), where('employeeId', '==', docId));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          await updateDoc(userSnap.docs[0].ref, {
            displayName: formData.fullName,
            email: formData.email.toLowerCase(),
            role: formData.role,
            office: formData.office,
            status: formData.status
          });
        }
      } else {
        // Double-check unique constraints
        const qId = query(collection(db, 'employees'), where('id', '==', formData.id));
        const idSnap = await getDocs(qId);
        if (!idSnap.empty) throw new Error('Employee ID already registered.');

        await setDoc(employeeRef, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }

      logAudit(db, profile?.uid || 'system', employee ? 'ADMIN_UPDATE_EMPLOYEE' : 'ADMIN_PROVISION_EMPLOYEE', docId);

      toast({
        title: employee ? 'Registry Updated' : 'Identity Provisioned',
        description: `Institutional record for ${formData.fullName} secured.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Registry Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] rounded-[3rem] border-none shadow-2xl bg-white p-0 overflow-hidden">
        <div className="bg-primary p-12 text-white relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><User size={200} /></div>
          <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none relative z-10">
            {employee ? 'Edit Identity' : 'Enroll Professional'}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mt-4 relative z-10">
            Identity Provisioning Node — Cluster Sync v2.1
          </DialogDescription>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <form onSubmit={handleSubmit} className="p-12 space-y-10">
            {!employee && (
               <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-100 flex gap-4 items-start">
                  <ShieldAlert className="size-5 text-amber-600 shrink-0 mt-1" />
                  <p className="text-[11px] font-bold text-amber-900 uppercase leading-relaxed tracking-tight">
                     Note: For Email Auth, use the Registration Hub to automatically initialize the authentication node and dispatch a verification pulse.
                  </p>
               </div>
            )}

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Professional ID</Label>
                <Input
                  className="font-black h-14 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-secondary transition-all"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                  disabled={!!employee}
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Full Legal Name</Label>
                <Input
                  className="font-black h-14 rounded-2xl border-2 border-slate-100 bg-white focus:border-secondary transition-all"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">ROC Cluster Node</Label>
                <Select value={formData.office} onValueChange={(val) => setFormData({ ...formData, office: val })}>
                  <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
                    {OFFICES.map(o => <SelectItem key={o.id} value={o.id} className="font-bold text-[11px] uppercase py-3 rounded-xl">{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Official Email</Label>
                <Input
                  type="email"
                  className="font-black h-14 rounded-2xl border-2 border-slate-100 bg-white focus:border-secondary transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Gender Node</Label>
                  <Select value={formData.gender} onValueChange={(val) => setFormData({ ...formData, gender: val })}>
                    <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
                      <SelectItem value="Male" className="font-bold text-[11px] uppercase py-3">Male</SelectItem>
                      <SelectItem value="Female" className="font-bold text-[11px] uppercase py-3">Female</SelectItem>
                      <SelectItem value="Other" className="font-bold text-[11px] uppercase py-3">Other</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Professional Age</Label>
                  <Input
                    type="number"
                    className="font-black h-14 rounded-2xl border-2 border-slate-100 bg-white"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Registry Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                    <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
                      <SelectItem value="Active" className="font-bold text-[11px] uppercase py-3 text-emerald-600">Active Node</SelectItem>
                      <SelectItem value="Suspended" className="font-bold text-[11px] uppercase py-3 text-destructive">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="p-12 bg-slate-50 border-t border-slate-100">
          <Button type="submit" disabled={loading} className="w-full h-18 font-black uppercase tracking-[0.25em] text-[15px] rounded-3xl shadow-2xl bg-primary hover:bg-black text-white transition-all" onClick={handleSubmit}>
            {loading ? <Loader2 className="animate-spin mr-3 size-6" /> : <Zap className="mr-3 size-6 fill-white" />}
            {loading ? 'SYNCING REGISTRY...' : employee ? 'Update Audit Trail' : 'Enroll Identity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
