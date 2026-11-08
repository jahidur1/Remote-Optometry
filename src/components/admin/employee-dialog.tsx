
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, User, Fingerprint, Loader2, Lock, Eye, EyeOff, Mail, Phone, ShieldCheck, Building2 } from 'lucide-react';
import { updateEmployeeRecordAction, provisionIdentityAction } from '@/services/identity-actions';

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
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  // Dynamic Office Registry
  const registryQuery = useMemo(() => query(
    collection(db, 'offices'), 
    where('status', '==', 'Active'),
    orderBy('officeName', 'asc')
  ), [db]);

  const { data: registryOffices } = useCollection(registryQuery);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    employeeId: '',
    role: 'user',
    status: 'Active',
    gender: 'Male',
    age: '',
    office: '',
    officeIds: [] as string[],
    whatsappNumber: '',
    department: 'Remote Optometry',
    designation: 'Staff Professional',
  });

  useEffect(() => {
    if (employee && open) {
      setFormData({
        fullName: employee.fullName || employee.displayName || '',
        email: employee.email || '',
        employeeId: employee.employeeId || employee.id || '',
        role: (employee.role || 'user').toLowerCase(),
        status: employee.status || 'Active',
        gender: employee.gender || 'Male',
        age: employee.age?.toString() || '',
        office: employee.office || '',
        officeIds: employee.officeIds || (employee.office ? [employee.office] : []),
        whatsappNumber: (employee.whatsappNumber || employee.phoneNumber || '').replace('+91', ''),
        department: employee.department || 'Remote Optometry',
        designation: employee.designation || 'Staff Professional',
      });
      setPassword('');
    } else if (!employee && open) {
      setFormData({
        fullName: '',
        email: '',
        employeeId: '',
        role: 'user',
        status: 'Active',
        gender: 'Male',
        age: '',
        office: '',
        officeIds: [],
        whatsappNumber: '',
        department: 'Remote Optometry',
        designation: 'Staff Professional',
      });
      setPassword('');
    }
  }, [employee, open]);

  const handleRoleChange = (role: string) => {
    setFormData(prev => ({
      ...prev,
      role,
      // If promoting to admin and officeIds is empty, pre-select the primary office
      officeIds: (role === 'admin' || role === 'super_admin') && prev.officeIds.length === 0 && prev.office 
        ? [prev.office] 
        : (role === 'user' ? [] : prev.officeIds)
    }));
  };

  const handleToggleOffice = (officeId: string) => {
    setFormData(prev => {
      const current = prev.officeIds || [];
      const updated = current.includes(officeId) 
        ? current.filter(id => id !== officeId)
        : [...current, officeId];
      return { ...prev, officeIds: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const payload = {
        ...formData,
        whatsappNumber: `+91${formData.whatsappNumber.replace(/\D/g, '').slice(-10)}`,
        age: parseInt(formData.age) || 0
      };

      if (employee) {
        const result = await updateEmployeeRecordAction(idToken, formData.employeeId, payload);
        if (result.success) {
          toast({ title: 'Registry Synchronized', description: `Institutional record for ${formData.fullName} has been updated.` });
          onOpenChange(false);
        } else throw new Error(result.error);
      } else {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (!formData.office) throw new Error("Primary ROC center is required.");

        const result = await provisionIdentityAction(idToken, payload, password);
        if (result.success) {
          toast({ title: 'Enrollment Successful', description: `Identity [${formData.employeeId}] provisioned in master registry.` });
          onOpenChange(false);
        } else throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ title: 'Registry Error', description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isAdminRole = formData.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] rounded-[3rem] border-none shadow-2xl bg-white p-0 overflow-hidden">
        <div className="bg-primary p-12 text-white relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            {employee ? <User size={200} /> : <ShieldCheck size={200} />}
          </div>
          <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none relative z-10 text-white">
            {employee ? 'Edit Identity Profile' : 'Enroll New Professional'}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mt-4 relative z-10">
            Institutional Trusted Backend Identity Protocol — Cycle 2026
          </DialogDescription>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <form onSubmit={handleSubmit} id="employee-dialog-form" className="p-12 space-y-10">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Full Legal Name</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 bg-white focus:border-secondary transition-all text-black"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Identity Key (ID)</Label>
                <div className="relative group">
                  <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 bg-slate-50 uppercase disabled:opacity-50"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.toUpperCase() })}
                    required
                    disabled={!!employee}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Official Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    type="email"
                    className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 bg-white focus:border-secondary transition-all text-black"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Mobile Endpoint</Label>
                <div className="flex gap-3">
                  <div className="flex h-14 w-16 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-black text-lg">+91</div>
                  <Input
                    className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-white text-black"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    required
                  />
                </div>
              </div>
            </div>

            {!employee && (
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Institutional Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="MIN 8 CHARACTERS" 
                    className="font-black h-14 pl-12 pr-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required={!employee}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-primary">
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Primary ROC Center</Label>
                <Select value={formData.office} onValueChange={(val) => setFormData({ ...formData, office: val })}>
                  <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                    <SelectValue placeholder="Select Hub..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white p-2">
                    {registryOffices?.map(o => (
                      <SelectItem key={o.officeId} value={o.officeId} className="font-bold text-[11px] uppercase py-3 rounded-xl">
                        {o.officeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Authorization Role</Label>
                <Select value={formData.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white p-2">
                    <SelectItem value="user" className="font-bold text-[11px] uppercase py-3">Staff Professional</SelectItem>
                    <SelectItem value="admin" className="font-bold text-[11px] uppercase py-3 text-secondary">Cluster Admin</SelectItem>
                    <SelectItem value="super_admin" className="font-bold text-[11px] uppercase py-3 text-primary">System Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(isAdminRole || formData.role === 'super_admin') && (
              <div className="p-8 rounded-[2rem] bg-secondary/5 border-2 border-secondary/10 space-y-6 animate-in slide-in-from-top-2">
                 <div className="flex items-center gap-3">
                    <Building2 className="size-5 text-secondary" />
                    <Label className="text-[11px] font-black uppercase tracking-widest text-primary">Authorized Hub Access</Label>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    {registryOffices?.map(o => (
                      <div key={o.officeId} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-white transition-all group">
                        <Checkbox 
                          id={`office-${o.officeId}`} 
                          checked={formData.officeIds?.includes(o.officeId)}
                          onCheckedChange={() => handleToggleOffice(o.officeId)}
                        />
                        <label htmlFor={`office-${o.officeId}`} className="text-[11px] font-black uppercase cursor-pointer group-hover:text-secondary transition-colors">
                          {o.officeName}
                        </label>
                      </div>
                    ))}
                 </div>
                 <p className="text-[9px] font-bold text-muted-foreground uppercase leading-relaxed px-1">
                   {formData.role === 'super_admin' ? "Super Admins retain global access, but explicit assignments assist in targeted hub selection." : "Cluster Admins are strictly restricted to accessing data for these authorized hubs only."}
                 </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Gender</Label>
                <Select value={formData.gender} onValueChange={(val) => setFormData({ ...formData, gender: val })}>
                  <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white p-2">
                    <SelectItem value="Male" className="font-bold py-3 uppercase text-[11px]">Male</SelectItem>
                    <SelectItem value="Female" className="font-bold py-3 uppercase text-[11px]">Female</SelectItem>
                    <SelectItem value="Other" className="font-bold py-3 uppercase text-[11px]">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Age</Label>
                <Input type="number" className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-white" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white p-2">
                    <SelectItem value="Active" className="font-bold py-3 uppercase text-[11px] text-emerald-600">Active</SelectItem>
                    <SelectItem value="Suspended" className="font-bold py-3 uppercase text-[11px] text-destructive">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="p-12 bg-slate-50 border-t border-slate-100">
          <Button type="submit" form="employee-dialog-form" disabled={loading} className="w-full h-18 font-black uppercase tracking-[0.25em] text-[15px] rounded-3xl shadow-2xl bg-primary hover:bg-black text-white transition-all">
            {loading ? <Loader2 className="animate-spin mr-3 size-6" /> : <Zap className="size-6 mr-3 fill-secondary text-secondary" />}
            {loading ? 'SYNCING REGISTRY...' : employee ? 'Update Institutional Record' : 'Authorize & Enroll Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
