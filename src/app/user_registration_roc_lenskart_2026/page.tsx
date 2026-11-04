'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Lock, Loader2, ArrowLeft, Zap, ShieldCheck, Fingerprint, Phone, Building2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { selfRegisterAction } from '@/services/identity-actions';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import Link from 'next/link';

export default function PublicRegistrationPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    employeeId: '',
    whatsappNumber: '',
    office: '',
    password: '',
  });

  // Dynamic Office Registry Subscription - Resilient Fetching (No Index Required)
  const officesRef = useMemo(() => collection(db, 'offices'), [db]);
  const { data: rawOffices, loading: registryLoading } = useCollection(officesRef);

  const activeOffices = useMemo(() => {
    if (!rawOffices) return [];
    return rawOffices
      .filter(o => o.status === 'Active')
      .sort((a, b) => (a.officeName || '').localeCompare(b.officeName || ''));
  }, [rawOffices]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      toast({ variant: "destructive", title: "Security Alert", description: "Password must be at least 8 characters." });
      return;
    }
    if (!formData.office) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please select your assigned ROC Cluster Center." });
      return;
    }

    setLoading(true);
    try {
      const result = await selfRegisterAction(formData, formData.password);
      
      if (result.success) {
        setSuccess(true);
        toast({ 
          title: "Enrollment Complete", 
          description: "Your identity has been provisioned. Verification is required." 
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 font-body text-black relative overflow-hidden">
        <Card className="w-full max-w-md shadow-3xl bg-white border-none rounded-[3.5rem] overflow-hidden border-4 border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] relative z-10">
           <CardContent className="p-16 text-center space-y-8">
              <div className="mx-auto size-24 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
                 <CheckCircle2 className="size-12" />
              </div>
              <div className="space-y-3">
                 <h2 className="text-3xl font-black uppercase tracking-tight text-primary leading-none">Identity Provisioned</h2>
                 <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed tracking-tight">
                    Your clinical account for **{formData.fullName}** has been created. 
                 </p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 text-left space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="size-2 rounded-full bg-secondary shadow-[0_0_10px_blue]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Mandatory Next Step</span>
                 </div>
                 <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed">
                    Please log in using your official email. The system will automatically trigger a verification pulse to your inbox. Access remains restricted until the email link is clicked.
                 </p>
              </div>
              <Link href="/login" className="block pt-4">
                 <Button className="w-full h-16 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl">
                    Proceed to Login
                 </Button>
              </Link>
           </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 font-body text-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <Card className="w-full max-w-2xl shadow-3xl bg-white border-none rounded-[3.5rem] overflow-hidden border-4 border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] relative z-10">
        <CardHeader className="p-12 bg-[#0F172A] text-white relative">
          <div className="flex items-center justify-between mb-8 relative z-10">
             <Link href="/">
                <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 rounded-xl px-6">
                   <ArrowLeft className="mr-3 size-4" /> Hub Terminal
                </Button>
             </Link>
             {logo && (
               <div className="size-14 relative transform hover:rotate-6 transition-all">
                  <Image src={logo.imageUrl} alt="ROC" fill className="object-contain" />
               </div>
             )}
          </div>
          <CardTitle className="text-4xl font-black uppercase tracking-tight leading-none relative z-10 text-white">Enrollment Hub</CardTitle>
          <CardDescription className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mt-4 relative z-10">Self-Service Institutional Onboarding — Cycle 2026</CardDescription>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Building2 size={200} /></div>
        </CardHeader>
        
        <CardContent className="p-12 space-y-10">
          <form onSubmit={handleRegister} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Full Legal Name</Label>
                  <div className="relative group">
                      <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/20 group-focus-within:text-secondary transition-colors" />
                      <Input 
                        className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-secondary text-black transition-all bg-white shadow-inner" 
                        value={formData.fullName} 
                        onChange={e => setFormData({...formData, fullName: e.target.value.toUpperCase()})} 
                        required 
                        placeholder="PROFESSIONAL NAME" 
                      />
                  </div>
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Identity key (Employee ID)</Label>
                  <div className="relative group">
                      <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-secondary transition-colors" />
                      <Input 
                        className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-secondary text-black transition-all bg-slate-50 uppercase" 
                        value={formData.employeeId} 
                        onChange={e => setFormData({...formData, employeeId: e.target.value.toUpperCase()})} 
                        required 
                        placeholder="EMP-0000" 
                      />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Official Email</Label>
                  <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/10 group-focus-within:text-secondary transition-colors" />
                      <Input 
                        type="email" 
                        className="font-black h-14 pl-12 rounded-2xl border-2 border-slate-100 focus:border-secondary text-black transition-all" 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} 
                        required 
                        placeholder="NAME@ROC.INTERNAL" 
                      />
                  </div>
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Mobile Auth Link</Label>
                  <div className="flex gap-3">
                    <div className="flex h-14 w-16 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-black">+91</div>
                    <div className="relative flex-1 group">
                      <Phone className="absolute left-4 top-5 h-4 w-4 text-black/20 group-focus-within:text-secondary transition-colors" />
                      <Input
                        placeholder="99999 00000"
                        className="pl-12 h-14 text-lg font-black rounded-2xl border-2 border-slate-100 bg-white text-black focus:border-secondary transition-all"
                        value={formData.whatsappNumber}
                        onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                        required
                      />
                    </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Target Cluster Center</Label>
                  <Select value={formData.office} onValueChange={v => setFormData({...formData, office: v})}>
                    <SelectTrigger className="h-14 font-black rounded-2xl border-2 border-slate-100 bg-white text-black shadow-inner">
                      <SelectValue placeholder={registryLoading ? "Syncing Registry..." : "Select ROC Center"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-2xl border-none shadow-2xl p-2">
                      {activeOffices?.map(o => (
                        <SelectItem key={o.officeId} value={o.officeId} className="font-bold py-3 uppercase text-[11px] rounded-xl">
                          {o.officeName} [{o.shortCode}]
                        </SelectItem>
                      ))}
                      {!registryLoading && activeOffices.length === 0 && (
                        <div className="p-4 text-[10px] font-black uppercase text-destructive text-center">No active centers found.</div>
                      )}
                    </SelectContent>
                  </Select>
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Institutional Password</Label>
                  <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/20 group-focus-within:text-secondary transition-colors" />
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="MIN 8 CHARACTERS" 
                        className="font-black h-14 pl-12 pr-12 rounded-2xl border-2 border-slate-100 focus:border-secondary text-black transition-all" 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        required 
                        minLength={8} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-secondary transition-colors"
                      >
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                  </div>
               </div>
            </div>

            <Button 
              className="w-full bg-[#0F172A] text-white h-20 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all group mt-6" 
              type="submit" 
              disabled={loading || registryLoading}
            >
              {loading ? <Loader2 className="animate-spin size-6 mr-3" /> : <Zap className="size-6 mr-3 group-hover:rotate-12 transition-transform text-secondary fill-secondary" />}
              Authorize & Enroll Profile
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="bg-slate-50 p-12 border-t border-slate-100 flex flex-col md:flex-row gap-8 items-center justify-between">
           <div className="flex gap-6 items-start">
             <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                <ShieldCheck className="size-8" />
             </div>
             <p className="text-[11px] text-black/60 uppercase leading-relaxed font-black tracking-tight max-sm:text-center">
                Enrollment initiates the email verification protocol. You must confirm your address before the clinical portal is authorized.
             </p>
           </div>
           <Link href="/login">
              <Button variant="link" className="text-[10px] font-black uppercase tracking-widest text-secondary hover:text-primary transition-colors">
                 Existing Account? Authenticate
              </Button>
           </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
