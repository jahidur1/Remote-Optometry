
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
      });
    }
  }, [employee, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Basic validation for new employees
      if (!employee) {
        const q = query(collection(db, 'employees'), where('email', '==', formData.email));
        const emailSnap = await getDocs(q);
        if (!emailSnap.empty) {
          toast({ title: 'Validation Error', description: 'Email already exists.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        const idSnap = await getDocs(query(collection(db, 'employees'), where('id', '==', formData.id)));
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
      });

      toast({
        title: employee ? 'Employee Updated' : 'Employee Created',
        description: `${formData.fullName} has been saved successfully.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save employee.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          <DialogDescription>
            Enter professional details for the ROC workforce record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">Employee ID</Label>
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
                placeholder="Jane Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane.doe@roc.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
                placeholder="Optometry"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinedAt">Joined Date</Label>
              <Input
                id="joinedAt"
                type="date"
                value={formData.joinedAt}
                onChange={(e) => setFormData({ ...formData, joinedAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : employee ? 'Update Record' : 'Create Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
