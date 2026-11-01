
'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
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
    whatsappNumber: '',
    department: '',
    designation: '',
    joinedAt: new Date().toISOString().split('T')[0],
    eligibility: [] as string[],
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
        whatsappNumber: employee.whatsappNumber || '',
        department: employee.department || '',
        designation: employee.designation || '',
        joinedAt: employee.joinedAt || new Date().toISOString().split('T')[0],
        eligibility: employee.eligibility || [],
      });
    } else {
      setFormData({
        id: '',
        fullName: '',
        email: '',
        role: 'EMPLOYEE',
        status: 'Active',
        gender: 'Male',
        whatsappNumber: '',
        department: '',
        designation: '',
        joinedAt: new Date().toISOString().split('T')[0],
        eligibility: [],
      });
    }
  }, [employee, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!employee) {
        // Validation for new employees
        const qEmail = query(collection(db, 'employees'), where('email', '==', formData.email));
        const emailSnap = await getDocs(qEmail);
        if (!emailSnap.empty) {
          toast({ title: 'Validation Error', description: 'Work email already exists.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        const qId = query(collection(db, 'employees'), where('id', '==', formData.id));
        const idSnap = await getDocs(qId);
        if (!idSnap.empty) {
          toast({ title: 'Validation Error', description: 'Employee ID already exists.', variant: 'destructive' });
          setLoading(false);
          return;
        }
      }

      const docId = employee ? employee.id : formData.id;
      const employeeRef = doc(db, 'employees', docId);

      const payload = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      if (employee) {
        updateDoc(employeeRef, payload).catch(async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: employeeRef.path,
            operation: 'update',
            requestResourceData: payload,
          }));
        });
      } else {
        setDoc(employeeRef, {
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

      logAudit(db, profile?.uid || 'system', employee ? 'UPDATE_EMPLOYEE' : 'CREATE_EMPLOYEE', docId, {
        fullName: formData.fullName,
        role: formData.role,
        status: formData.status
      });

      toast({
        title: employee ? 'Employee Updated' : 'Employee Created',
        description: `${formData.fullName} (ID: ${formData.id}) has been saved.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process employee record.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit Workforce Record' : 'Provision New Employee'}</DialogTitle>
          <DialogDescription>
            Maintain accurate professional data for scheduling and operational reports.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="id">Employee ID (Permanent)</Label>
                <Input
                  id="id"
                  placeholder="EMP001"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={!!employee}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Johnathan Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work Email (Unique)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@roc.example"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp (Notifications)</Label>
                <Input
                  id="whatsapp"
                  placeholder="+91 99999 99999"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(val) => setFormData({ ...formData, gender: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    {profile?.role === 'SUPER_ADMIN' && (
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dept">Department</Label>
                <Input
                  id="dept"
                  placeholder="Remote Optometry"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  placeholder="Senior Optometrist"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="joinedAt">Joining Date</Label>
              <Input
                id="joinedAt"
                type="date"
                value={formData.joinedAt}
                onChange={(e) => setFormData({ ...formData, joinedAt: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? 'Processing...' : employee ? 'Update Record' : 'Provision Account'}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
