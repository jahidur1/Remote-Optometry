'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Loader2, UserPlus, ArrowLeft, ShieldCheck, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import Link from 'next/link';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    gender: 'Male',
    department: 'Remote Optometry',
    designation: 'Staff Professional'
  });
  
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      toast({
        variant: "destructive",
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit Indian mobile number.",
      });
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = `+91${formData.phone}`;
      
      const phoneQuery = query(collection(db, 'employees'), where('whatsappNumber', '==', formattedPhone));
      const phoneSnap = await getDocs(phoneQuery);

      if (!phoneSnap.empty) {
        throw new Error("This phone number is already registered in the clinical directory.");
      }

      const empId = `EMP-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
      const empRef = doc(db, 'employees', empId);

      const payload = {
        id: empId,
        fullName: formData.fullName,
        email: formData.email.toLowerCase(),
        whatsappNumber: formattedPhone,
        role: formData.role,
        gender: formData.gender,
        department: formData.department,
        designation: formData.designation,
        status: 'Active',
        joinedAt: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        eligibility: ["OP", "MD", "C1"]
      };

      await setDoc(empRef, payload);
      
      logAudit(db, 'system_register', 'USER_SELF_REGISTER', empId, { role: formData.role });

      toast({
        title: "Record Provisioned",
        description: "Clinical authorization successful. Please proceed to Phone OTP verification.",
      });
      
      router.push('/login');
    } catch (error: any) {
      console.error("Registration Error:", error);
      toast({
        variant: "destructive",
        title: "Provisioning Failed",
        description: error.message || "Permission denied. Ensure your Firestore Security Rules are published.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[120px]"></div>
      </div>

      <Card className="w-full max-w-xl shadow-2xl relative z-10 border-white/10 bg-card/95 backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20">
            <UserPlus className="size-8" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline">Clinical <span className="text-secondary">Enrollment</span></CardTitle>
          <CardDescription className="text-muted-foreground/80 font-medium">
            Authorize your professional record for Phone OTP access
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Dr. Dr. Sarah Smith" 
                  className="h-11 font-bold"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Work Email</Label>
                <div className="relative">
                   <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                   <Input 
                    id="email" 
                    type="email"
                    placeholder="name@roc.example" 
                    className="pl-10 h-11 font-bold"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required 
                   />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Mobile Number (+91)</Label>
                <div className="flex gap-2">
                  <div className="flex h-11 items-center justify-center rounded-md border bg-muted/50 px-3 font-bold text-muted-foreground">
                    +91
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="99999 00000"
                      className="pl-10 h-11 text-lg font-bold tracking-[0.1em]"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Assigned Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Clinical Professional</SelectItem>
                    <SelectItem value="ADMIN">System Administrator</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Executive Board</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Gender Identity</Label>
                  <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                    <SelectTrigger className="h-11 font-bold">
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
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Clinical Department</Label>
                  <Input 
                    placeholder="e.g. Remote Optometry" 
                    className="h-11 font-bold"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  />
               </div>
            </div>

            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-bold shadow-lg shadow-accent/10 group transition-all" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Provision Professional Record
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            Already authorized? 
            <Link href="/login" className="text-secondary font-black hover:underline flex items-center gap-1">
               Go to Secure Login <ArrowLeft className="size-3 rotate-180" />
            </Link>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border-none flex gap-3 items-start">
             <ShieldCheck className="size-5 text-emerald-600 mt-0.5 shrink-0" />
             <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase tracking-tight">
                Institutional Policy: Public self-registration is strictly for sandbox testing. In production, 
                all clinical records must be provisioned by the HR department.
             </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}