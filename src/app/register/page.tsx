'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Lock, Loader2, ArrowLeft, Zap, ShieldAlert, Fingerprint, Eye, EyeOff, Phone, ShieldCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from '@/components/auth/role-guard';
import { provisionIdentityAction } from '@/services/identity-actions';

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
    office: ''
  });
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // Dynamic Office Subscription (Only Active)
  const { data: registryOffices, loading: registryLoading } = useCollection(
    query(collection(db, 'offices'), where('status', '==', 'Active'))
  );

  const handleProvisionIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Security Alert", description: "Institutional passwords must be at least 8 characters." });
      return;
    }
    if (!formData.office) {
      toast({ variant: "destructive", title: "Validation Error", description: "Target ROC Cluster node is required." });
      return;
    }

    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session Expired: Please re-authenticate.");

      const result = await provisionIdentityAction(idToken, formData, password);
      
      if (result.success) {
        toast({ 
          title: "Enrollment Successful", 
          description: `Identity [${formData.employeeId}] provisioned in cluster registry.` 
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
          office: ''
        });
        setPassword('');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: error.message });
    } finally {
      setLoading(false);
    }
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
             <CardDescription className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mt-4 relative z-10">Institutional Trusted Backend Provisioning — Dynamic Registry Integration</CardDescription>
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Zap size={240} /></div>
          </CardHeader>
          
          <CardContent className="p-12 space-y-10">
            <form onSubmit={handleProvisionIdentity} className="space-y-10">
              <div className="p-6 rounded-2xl bg-secondary/5 border-2 border-secondary/10 flex gap-6 items-start">
                  <ShieldAlert className="size-6 text-secondary shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-primary uppercase tracking-widest">Trusted Node Authentication</p>
                    <p className="text-[12px] font-bold text-black/60 uppercase leading-relaxed tracking-tight">
                        Enrollment uses a server-side atomic pulse. Direct client-side writes are restricted to maintain institutional registry integrity.
                    </p>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Full Legal Name</Label>
                    <div className="relative group">
                        <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-primary transition-colors" />
                        <Input className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-primary text-black transition-all bg-white" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required placeholder="JANE DOE" />
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
                        <SelectValue placeholder={registryLoading ? "Syncing Registry..." : "Select Active Node"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                        {registryOffices?.map(o => (
                          <SelectItem key={o.officeId} value={o.officeId} className="font-bold py-3 uppercase text-[11px]">
                            {o.officeName} [{o.shortCode}]
                          </SelectItem>
                        ))}
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

              <Button className="w-full bg-primary text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all group" type="submit" disabled={loading || !formData.office}>
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
                Institutional protocol: Enrollment utilizes the Trusted Server Action `provisionIdentityAction`. Every operation is ledgered for institutional compliance.
             </p>
          </CardFooter>
        </Card>
      </div>
    </RoleGuard>
  );
}
