
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut
} from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ShieldCheck, Mail, Lock, Loader2, ArrowLeft, Zap, ShieldAlert, Fingerprint } from 'lucide-react';
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
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    employeeId: '',
    role: 'EMPLOYEE',
    gender: 'Male',
    department: 'Remote Optometry',
    designation: 'Staff Professional',
    office: 'KOLKATA_ROC'
  });
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const validateInput = async () => {
    // 1. Employee ID Unique Check
    const idQ = query(collection(db, 'employees'), where('id', '==', formData.employeeId.toUpperCase()));
    const idSnap = await getDocs(idQ);
    if (!idSnap.empty) throw new Error("Employee ID is already registered in the institutional registry.");

    // 2. Email Unique Check
    const emailQ = query(collection(db, 'employees'), where('email', '==', formData.email.toLowerCase()));
    const emailSnap = await getDocs(emailQ);
    if (!emailSnap.empty) throw new Error("This email is already bound to an active identity node.");
  };

  const handleProvisionIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Security Alert", description: "Institutional passwords must be at least 8 characters." });
      return;
    }

    setLoading(true);
    try {
      await validateInput();
      
      // 1. Initialize Auth Node
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, password);
      const user = userCredential.user;
      
      // 2. Secure Metadata
      await updateProfile(user, { displayName: formData.fullName });
      
      // 3. Dispatch Verification Pulse
      await sendEmailVerification(user);

      // 4. Atomic Dual-Commit to Registry
      await commitRecords(user.uid);

      toast({ 
        title: "Enrollment Successful", 
        description: "Authentication node initialized. Verification pulse dispatched to user." 
      });
      
      // Mandatory sign-out to clear admin session and prevent collision
      await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: error.message });
      setLoading(false);
    }
  };

  const commitRecords = async (uid: string) => {
    const empRef = doc(db, 'employees', formData.employeeId.toUpperCase());
    const userRef = doc(db, 'users', uid);

    const commonData = {
      fullName: formData.fullName,
      email: formData.email.toLowerCase(),
      role: formData.role,
      office: formData.office,
      status: 'Active',
      updatedAt: new Date().toISOString()
    };

    // Master Employee Record
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

    // Auth Profile Record
    await setDoc(userRef, {
      ...commonData,
      uid,
      displayName: formData.fullName,
      employeeId: formData.employeeId.toUpperCase(),
      lastLogin: new Date().toISOString()
    });

    logAudit(db, uid, 'ADMIN_PROVISION_IDENTITY', formData.employeeId, { email: formData.email });
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 font-body text-black">
        <Card className="w-full max-w-2xl shadow-3xl bg-white border-none rounded-[3.5rem] overflow-hidden border-4 border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)]">
          <CardHeader className="p-12 bg-primary text-white relative">
             <div className="flex items-center justify-between mb-8 relative z-10">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 rounded-xl px-6">
                   <ArrowLeft className="mr-3 size-4" /> Exit Node
                </Button>
                <div className="size-14 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                    <UserPlus className="size-7" />
                </div>
             </div>
             <CardTitle className="text-4xl font-black uppercase tracking-tight leading-none relative z-10">Enroll Professional</CardTitle>
             <CardDescription className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mt-4 relative z-10">Email & Password Auth Hub — Sync v3.0</CardDescription>
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Zap size={240} /></div>
          </CardHeader>
          
          <CardContent className="p-12 space-y-10">
            <form onSubmit={handleProvisionIdentity} className="space-y-10">
              <div className="p-6 rounded-2xl bg-secondary/5 border-2 border-secondary/10 flex gap-6 items-start">
                  <ShieldAlert className="size-6 text-secondary shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-primary uppercase tracking-widest">Protocol Notice</p>
                    <p className="text-[12px] font-bold text-black/60 uppercase leading-relaxed tracking-tight">
                        Creating an identity node will automatically cycle the current administrative session. Ensure all registry tasks are saved before initiating.
                    </p>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Full Legal Name</Label>
                    <div className="relative group">
                        <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all bg-white" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required placeholder="JANE DOE" />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Target ID Node</Label>
                    <div className="relative group">
                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all bg-slate-50 uppercase" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value.toUpperCase()})} required placeholder="EMP-0000" />
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Official Email</Label>
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input type="email" className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} required placeholder="PROFESSIONAL@ROC.INTERNAL" />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Institutional Password</Label>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input type="password" placeholder="MIN 8 CHARACTERS" className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">ROC Cluster Node</Label>
                    <Select value={formData.office} onValueChange={v => setFormData({...formData, office: v})}>
                      <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                        {OFFICES.map(o => <SelectItem key={o.id} value={o.id} className="font-bold py-3 uppercase text-[11px]">{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">Gender Node</Label>
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
                Institutional protocol: Enrollment initializes the authentication node and dispatches a verification pulse. 
                All identities are synchronized across the master employee registry and auth profiles for institutional compliance.
             </p>
          </CardFooter>
        </Card>
      </div>
    </RoleGuard>
  );
}
