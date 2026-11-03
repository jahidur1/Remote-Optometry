
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut
} from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { useFirestore, firebaseConfig, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ShieldCheck, Mail, Lock, Loader2, ArrowLeft, Zap, ShieldAlert, Fingerprint, Eye, EyeOff, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import { RoleGuard } from '@/components/auth/role-guard';

const OFFICES = [
  { id: "KOLKATA_ROC", name: "KOLKATA ROC" },
  { id: "GURGAON_ROC", name: "GURGAON ROC" },
  { id: "LUCKNOW_ROC", name: "LUCKNOW ROC" }
];

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    employeeId: '',
    whatsappNumber: '',
    role: 'EMPLOYEE',
    gender: 'Male',
    department: 'Remote Optometry',
    designation: 'Staff Professional',
    office: 'KOLKATA_ROC'
  });
  
  const mainDb = useFirestore();
  const { profile: adminProfile } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const validateInput = async () => {
    const idQ = query(collection(mainDb, 'employees'), where('id', '==', formData.employeeId.toUpperCase()));
    const idSnap = await getDocs(idQ);
    if (!idSnap.empty) throw new Error("Employee ID is already registered in the institutional registry.");

    const emailQ = query(collection(mainDb, 'employees'), where('email', '==', formData.email.toLowerCase()));
    const emailSnap = await getDocs(emailQ);
    if (!emailSnap.empty) throw new Error("This email is already bound to an active identity node.");

    if (formData.whatsappNumber.length < 10) throw new Error("A valid 10-digit mobile number is required.");
  };

  const handleProvisionIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Security Alert", description: "Institutional passwords must be at least 8 characters." });
      return;
    }

    setLoading(true);
    
    // SECURITY: Use temporary Firebase App to provision new user without logging out the current admin session.
    const tempAppName = `temp-provision-${Date.now()}`;
    let tempApp;
    
    try {
      await validateInput();
      
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, formData.email, password);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, { displayName: formData.fullName.toUpperCase() });
      await sendEmailVerification(newUser);

      // Final identity synchronization
      await commitRecords(newUser.uid);
      await signOut(tempAuth);
      await deleteApp(tempApp);

      toast({ 
        title: "Enrollment Successful", 
        description: `Identity [${formData.employeeId}] provisioned. Verification pulse dispatched.` 
      });
      
      setFormData({
        fullName: '',
        email: '',
        employeeId: '',
        whatsappNumber: '',
        role: 'EMPLOYEE',
        gender: 'Male',
        department: 'Remote Optometry',
        designation: 'Staff Professional',
        office: 'KOLKATA_ROC'
      });
      setPassword('');
      
    } catch (error: any) {
      if (tempApp) await deleteApp(tempApp);
      toast({ variant: "destructive", title: "Enrollment Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const commitRecords = async (uid: string) => {
    const empRef = doc(mainDb, 'employees', formData.employeeId.toUpperCase());
    const userRef = doc(mainDb, 'users', uid);
    const phoneFormatted = `+91${formData.whatsappNumber.replace(/\D/g, '').slice(-10)}`;

    const commonData = {
      fullName: formData.fullName.toUpperCase(),
      email: formData.email.toLowerCase(),
      whatsappNumber: phoneFormatted,
      role: formData.role,
      office: formData.office,
      status: 'Active',
      updatedAt: new Date().toISOString()
    };

    // Commit to Master Employee Registry
    await setDoc(empRef, {
      ...commonData,
      id: formData.employeeId.toUpperCase(),
      gender: formData.gender,
      department: formData.department,
      designation: formData.designation,
      joinedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      authUid: uid
    });

    // Commit to Authentication Profile Registry
    await setDoc(userRef, {
      ...commonData,
      uid,
      displayName: formData.fullName.toUpperCase(),
      employeeId: formData.employeeId.toUpperCase(),
      phoneNumber: phoneFormatted,
      lastLogin: new Date().toISOString()
    });

    logAudit(mainDb, adminProfile?.uid || 'ADMIN', 'ADMIN_PROVISION_IDENTITY', formData.employeeId, { role: formData.role, email: formData.email });
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 font-body text-black">
        <Card className="w-full max-w-3xl shadow-3xl bg-white border-none rounded-[3.5rem] overflow-hidden border-4 border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)]">
          <CardHeader className="p-12 bg-primary text-white relative">
             <div className="flex items-center justify-between mb-8 relative z-10">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 rounded-xl px-6">
                   <ArrowLeft className="mr-3 size-4" /> Exit Node
                </Button>
                <div className="size-14 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                    <UserPlus className="size-7" />
                </div>
             </div>
             <CardTitle className="text-4xl font-black uppercase tracking-tight leading-none relative z-10 text-white">Enroll Professional</CardTitle>
             <CardDescription className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mt-4 relative z-10">Institutional Authentication Deployment — v3.1</CardDescription>
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Zap size={240} /></div>
          </CardHeader>
          
          <CardContent className="p-12 space-y-10">
            <form onSubmit={handleProvisionIdentity} className="space-y-10">
              <div className="p-6 rounded-2xl bg-secondary/5 border-2 border-secondary/10 flex gap-6 items-start">
                  <ShieldAlert className="size-6 text-secondary shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-primary uppercase tracking-widest">Administrative Guard</p>
                    <p className="text-[12px] font-bold text-black/60 uppercase leading-relaxed tracking-tight">
                        Enrollment provisions both the clinical registry and authentication node. Roles are immutably mapped during deployment.
                    </p>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Full Legal Name</Label>
                    <div className="relative group">
                        <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all bg-white" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value.toUpperCase()})} required placeholder="JANE DOE" />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Target ID Node</Label>
                    <div className="relative group">
                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all bg-slate-50 uppercase" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value.toUpperCase()})} required placeholder="EMP-0000" />
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Official Email</Label>
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input type="email" className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} required placeholder="PROFESSIONAL@ROC.INTERNAL" />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Mobile (OTP Auth)</Label>
                    <div className="flex gap-3">
                      <div className="flex h-14 w-16 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-black text-lg">+91</div>
                      <div className="relative flex-1 group">
                        <Phone className="absolute left-4 top-5 h-4 w-4 text-black/20 group-focus-within:text-primary transition-colors" />
                        <Input
                          placeholder="99999 00000"
                          className="pl-12 h-14 text-lg font-black rounded-2xl border-2 border-slate-100 bg-white text-black focus:border-primary transition-all"
                          value={formData.whatsappNumber}
                          onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                          required
                        />
                      </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Institutional Password</Label>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="MIN 8 CHARACTERS" 
                          className="font-black h-14 pl-12 pr-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all" 
                          value={password} 
                          onChange={e => setPassword(e.target.value)} 
                          required 
                          minLength={8} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                        </button>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">ROC Cluster Node</Label>
                    <Select value={formData.office} onValueChange={v => setFormData({...formData, office: v})}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                        {OFFICES.map(o => <SelectItem key={o.id} value={o.id} className="font-bold py-3 uppercase text-[11px]">{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Gender Node</Label>
                    <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                        <SelectItem value="Male" className="font-bold py-3 uppercase text-[11px]">Male</SelectItem>
                        <SelectItem value="Female" className="font-bold py-3 uppercase text-[11px]">Female</SelectItem>
                        <SelectItem value="Other" className="font-bold py-3 uppercase text-[11px]">Other</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Authorization Role</Label>
                    <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v as any})}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                        <SelectItem value="EMPLOYEE" className="font-bold py-3 uppercase text-[11px]">Staff Professional</SelectItem>
                        <SelectItem value="ADMIN" className="font-bold py-3 uppercase text-[11px]">Cluster Admin</SelectItem>
                        <SelectItem value="SUPER_ADMIN" className="font-bold py-3 uppercase text-[11px]">System Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              <Button className="w-full bg-primary text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all group" type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin size-6 mr-3" /> : <Zap className="size-6 mr-3 group-hover:rotate-12 transition-transform" />}
                Authorize & Deploy Identity
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="bg-slate-50 p-12 border-t border-slate-100 flex gap-8 items-start">
             <div className="size-14 rounded-[1.5rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                <ShieldCheck className="size-8" />
             </div>
             <p className="text-[11px] text-black/60 uppercase leading-relaxed font-black tracking-tight">
                Institutional protocol: Enrollment provisions both the clinical registry and authentication node. Every identity is assigned a permanent `role` (SUPER_ADMIN, ADMIN, or EMPLOYEE) that governs platform-wide access logic.
             </p>
          </CardFooter>
        </Card>
        <div id="recaptcha-container"></div>
      </div>
    </RoleGuard>
  );
}
