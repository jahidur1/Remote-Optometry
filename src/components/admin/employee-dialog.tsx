
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';

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
      if (!employee) {
        // Unique ID check
        const qId = query(collection(db, 'employees'), where('id', '==', formData.id));
        const idSnap = await getDocs(qId);
        if (!idSnap.empty) {
          toast({ title: 'Conflict Error', description: 'Employee ID already exists in the clinical registry.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        // Unique Mobile check
        const qPhone = query(collection(db, 'employees'), where('whatsappNumber', '==', formData.whatsappNumber));
        const phoneSnap = await getDocs(qPhone);
        if (!phoneSnap.empty) {
          toast({ title: 'Conflict Error', description: 'Mobile number is already registered to another professional.', variant: 'destructive' });
          setLoading(false);
          return;
        }
      }

      const docId = employee ? employee.id : formData.id;
      const employeeRef = doc(db, 'employees', docId);

      const payload = {
        ...formData,
        age: parseInt(formData.age) || 0,
        updatedAt: new Date().toISOString(),
      };

      if (employee) {
        await updateDoc(employeeRef, payload).catch(async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: employeeRef.path,
            operation: 'update',
            requestResourceData: payload,
          }));
        });
      } else {
        await setDoc(employeeRef, {
          ...payload,
          createdAt: new Date().toISOString(),
        }).catch(async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: employeeRef.path,
            operation: 'create',
            requestResourceData: payload,
          }));
        });
      }

      logAudit(db, profile?.uid || 'system', employee ? 'ADMIN_UPDATE_EMPLOYEE' : 'ADMIN_PROVISION_EMPLOYEE', docId, {
        fullName: formData.fullName,
        office: formData.office,
        role: formData.role
      });

      toast({
        title: employee ? 'Registry Updated' : 'Professional Provisioned',
        description: `${formData.fullName} (ID: ${formData.id}) record secured for ${formData.office}.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Registry Error',
        description: error.message || 'Failed to commit employee record.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="uppercase font-black tracking-tight text-primary text-xl">Identity Enrollment</DialogTitle>
          <DialogDescription className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
            Mandatory clinical fields are locked for self-modification by professionals.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] pr-4 pt-4">
          <form onSubmit={handleSubmit} className="space-y-6 pb-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Professional ID</Label>
                <Input
                  placeholder="EMP000"
                  className="font-black h-12 rounded-xl border-2"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                  disabled={!!employee}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Legal Name</Label>
                <Input
                  placeholder="Clinical Professional"
                  className="font-black h-12 rounded-xl border-2"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">ROC Cluster Node</Label>
                <Select
                  value={formData.office}
                  onValueChange={(val) => setFormData({ ...formData, office: val })}
                >
                  <SelectTrigger className="h-12 font-black rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {OFFICES.map(o => <SelectItem key={o.id} value={o.id} className="font-bold">{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mobile (OTP Auth)</Label>
                <Input
                  placeholder="+91"
                  className="font-black h-12 rounded-xl border-2"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(val) => setFormData({ ...formData, gender: val })}
                >
                  <SelectTrigger className="h-12 font-black rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="Male" className="font-bold">Male</SelectItem>
                    <SelectItem value="Female" className="font-bold">Female</SelectItem>
                    <SelectItem value="Other" className="font-bold">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Age</Label>
                <Input
                  type="number"
                  placeholder="25"
                  className="font-black h-12 rounded-xl border-2"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="h-12 font-black rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="Active" className="font-bold text-emerald-600">Active</SelectItem>
                    <SelectItem value="Inactive" className="font-bold">Inactive</SelectItem>
                    <SelectItem value="Suspended" className="font-bold text-destructive">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Official Email Address</Label>
              <Input
                type="email"
                placeholder="professional@roc.internal"
                className="font-black h-12 rounded-xl border-2"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit Department</Label>
                <Input
                  placeholder="Remote Optometry"
                  className="font-black h-12 rounded-xl border-2"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Institutional Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val })}
                >
                  <SelectTrigger className="h-12 font-black rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="EMPLOYEE" className="font-bold">Clinical Professional</SelectItem>
                    <SelectItem value="ADMIN" className="font-bold">Administrator</SelectItem>
                    <SelectItem value="SUPER_ADMIN" className="font-bold">Executive Board</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-8">
              <Button type="submit" disabled={loading} className="w-full h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl bg-primary hover:bg-secondary transition-all">
                {loading ? 'Committing Registry...' : employee ? 'Update Audit Trail' : 'Enroll Professional'}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
