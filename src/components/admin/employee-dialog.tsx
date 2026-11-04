'use client';

import { useState, useEffect } from 'react';
import { useAuth, useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
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
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, User, Fingerprint, Loader2 } from 'lucide-react';
import { updateEmployeeRecordAction } from '@/services/identity-actions';
import Link from 'next/link';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: any;
}

export function EmployeeDialog({ open, onOpenChange, employee }: EmployeeDialogProps) {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Dynamic Office Registry (Active Nodes Only)
  const { data: registryOffices, loading: registryLoading } = useCollection(
    query(collection(db, 'offices'), where('status', '==', 'Active'))
  );

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'EMPLOYEE',
    status: 'Active',
    gender: 'Male',
    age: '',
    office: '',
    whatsappNumber: '',
    department: 'Remote Optometry',
    designation: 'Staff Professional',
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        fullName: employee.fullName || '',
        email: employee.email || '',
        role: employee.role || 'EMPLOYEE',
        status: employee.status || 'Active',
        gender: employee.gender || 'Male',
        age: employee.age?.toString() || '',
        office: employee.office || '',
        whatsappNumber: employee.whatsappNumber?.replace('+91', '') || '',
        department: employee.department || 'Remote Optometry',
        designation: employee.designation || 'Staff Professional',
      });
    }
  }, [employee, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const updates = {
        ...formData,
        whatsappNumber: `+91${formData.whatsappNumber.replace(/\D/g, '').slice(-10)}`,
        age: parseInt(formData.age) || 0
      };

      const result = await updateEmployeeRecordAction(idToken, employee.id, updates);
      
      if (result.success) {
        toast({
          title: 'Registry Synchronized',
          description: `Institutional record for ${formData.fullName} secured via Trusted Node.`,
        });
        onOpenChange(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ title: 'Registry Error', description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] rounded-[3rem] border-none shadow-2xl bg-white p-0 overflow-hidden">
        <div className="bg-primary p-12 text-white relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><User size={200} /></div>
          <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none relative z-10 text-white">
            {employee ? 'Edit Identity Node' : 'Registry Alert'}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mt-4 relative z-10">
            Trusted Backend Identity Protocol — Dynamic Registry Sync
          </DialogDescription>
        </div>

        <ScrollArea className="max-h-[65vh]">
          {employee ? (
            <form onSubmit={handleSubmit} className="p-12 space-y-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Identity Key</Label>
                  <div className="h-14 flex items-center px-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-black/80 uppercase">
                     <Fingerprint className="size-4 mr-3 opacity-30" /> {employee.id}
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Full Legal Name</Label>
                  <Input
                    className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-white focus:border-secondary transition-all text-black"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Mobile Endpoint</Label>
                    <div className="flex gap-3">
                      <div className="flex h-14 w-16 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-black text-lg">+91</div>
                      <Input
                        className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-white text-black"
                        value={formData.whatsappNumber}
                        onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        required
                        placeholder="99999 00000"
                      />
                    </div>
                 </div>
                 <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Official Email</Label>
                  <Input
                    type="email"
                    className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-white focus:border-secondary transition-all text-black"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">ROC Cluster Node</Label>
                    <Select value={formData.office} onValueChange={(val) => setFormData({ ...formData, office: val })}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                        <SelectValue placeholder={registryLoading ? "Syncing..." : "Select Node"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
                        {registryOffices?.map(o => (
                          <SelectItem key={o.officeId} value={o.officeId} className="font-bold text-[11px] uppercase py-3 rounded-xl">
                            {o.officeName} [{o.shortCode}]
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Authorization Role</Label>
                    <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val as any })}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
                        <SelectItem value="EMPLOYEE" className="font-bold text-[11px] uppercase py-3">Staff Professional</SelectItem>
                        <SelectItem value="ADMIN" className="font-bold text-[11px] uppercase py-3">Cluster Admin</SelectItem>
                        <SelectItem value="SUPER_ADMIN" className="font-bold text-[11px] uppercase py-3">System Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Gender Node</Label>
                    <Select value={formData.gender} onValueChange={(val) => setFormData({ ...formData, gender: val })}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
                        <SelectItem value="Male" className="font-bold text-[11px] uppercase py-3">Male</SelectItem>
                        <SelectItem value="Female" className="font-bold py-3 uppercase text-[11px]">Female</SelectItem>
                        <SelectItem value="Other" className="font-bold py-3 uppercase text-[11px]">Other</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Age</Label>
                    <Input
                      type="number"
                      className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-white text-black"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Registry Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
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
          ) : (
            <div className="p-12 text-center space-y-8">
               <div className="mx-auto size-24 rounded-[2rem] bg-secondary/5 flex items-center justify-center border-2 border-dashed border-secondary/20">
                  <Zap className="size-10 text-secondary/30" />
               </div>
               <div className="space-y-3">
                  <p className="text-xl font-black text-black uppercase tracking-tight">Provisioning Hub Required</p>
                  <p className="text-[12px] text-black/40 font-bold uppercase leading-relaxed max-w-sm mx-auto tracking-widest">
                    To maintain institutional security, new authentication accounts must be initialized via the Enrollment Hub.
                  </p>
               </div>
               <Link href="/register" onClick={() => onOpenChange(false)}>
                  <Button className="h-16 px-14 bg-primary text-white font-black uppercase tracking-[0.25em] rounded-2xl shadow-2xl hover:bg-black transition-all">
                    Launch Provisioning Hub
                  </Button>
               </Link>
            </div>
          )}
        </ScrollArea>

        {employee && (
          <DialogFooter className="p-12 bg-slate-50 border-t border-slate-100">
            <Button type="submit" disabled={loading} className="w-full h-18 font-black uppercase tracking-[0.25em] text-[15px] rounded-3xl shadow-2xl bg-primary hover:bg-black text-white transition-all" onClick={handleSubmit}>
              {loading ? <Loader2 className="animate-spin mr-3 size-6" /> : <Zap className="mr-3 size-6 fill-white" />}
              {loading ? 'SYNCING REGISTRY...' : 'Update Institutional Record'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
