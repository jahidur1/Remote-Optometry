
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Network, 
  Plus, 
  Edit2, 
  ShieldAlert, 
  CheckCircle2, 
  MapPin, 
  Globe, 
  Activity, 
  Zap, 
  Database, 
  Building2,
  Clock,
  Search,
  Filter,
  Loader2,
  Info,
  ShieldCheck,
  ChevronRight,
  MoreVertical
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { createOfficeAction, updateOfficeAction, setOfficeStatusAction } from '@/services/office-actions';
import { DemoBadge } from '@/components/ui/demo-badge';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/auth/role-guard';

export default function ClusterManager() {
  const db = useFirestore();
  const auth = useAuth();
  const { profile } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    officeId: '',
    officeName: '',
    shortCode: '',
    city: '',
    state: '',
    country: 'India'
  });

  // Memoized Query for stable performance
  const officesQuery = useMemo(() => query(collection(db, 'offices'), orderBy('officeName', 'asc')), [db]);
  const { data: offices, loading } = useCollection(officesQuery);

  const filteredOffices = useMemo(() => 
    offices?.filter(o => 
      o.officeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.officeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.shortCode.toLowerCase().includes(searchTerm.toLowerCase())
    )
  , [offices, searchTerm]);

  const stats = useMemo(() => ({
    total: offices?.length || 0,
    active: offices?.filter(o => o.status === 'Active').length || 0,
    inactive: offices?.filter(o => o.status === 'Inactive').length || 0,
  }), [offices]);

  const handleOpenCreate = () => {
    setEditingOffice(null);
    setFormData({
      officeId: '',
      officeName: '',
      shortCode: '',
      city: '',
      state: '',
      country: 'India'
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (office: any) => {
    setEditingOffice(office);
    setFormData({
      officeId: office.officeId,
      officeName: office.officeName,
      shortCode: office.shortCode,
      city: office.city,
      state: office.state,
      country: office.country
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const result = editingOffice 
        ? await updateOfficeAction(idToken, editingOffice.officeId, formData)
        : await createOfficeAction(idToken, formData);

      if (result.success) {
        toast({ 
          title: "Registry Updated", 
          description: `${formData.officeName} is now secured in the cluster registry.` 
        });
        setIsDialogOpen(false);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ title: "Registry Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const toggleStatus = async (officeId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    if (currentStatus === 'Active' && !confirm("DEACTIVATION PROTOCOL: New operational writes will be blocked for this ROC unit. Historical data remains preserved. Proceed?")) return;
    
    setProcessing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Session expired.");

      const result = await setOfficeStatusAction(idToken, officeId, newStatus);
      if (result.success) {
        toast({ title: "Status Updated", description: `Center ${officeId} is now ${newStatus}.` });
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <div className="space-y-10 max-w-[1600px] mx-auto animate-in pb-40 px-4">
        {/* Dynamic Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pt-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
                <Network className="size-8 text-secondary" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-black uppercase leading-none">Cluster Manager</h1>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                    Institutional Registry Hub <Activity className="size-3 text-secondary animate-pulse" />
                  </p>
                  <DemoBadge />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl">
             <div className="px-6 py-1.5 border-r border-slate-100 space-y-0.5">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Operational Pulse</label>
                <div className="flex items-center gap-2">
                   <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                   <span className="font-black text-black uppercase tracking-widest text-[11px]">GLOBAL ACTIVE</span>
                </div>
             </div>
             <Button 
               className="bg-primary text-white shadow-xl shadow-primary/20 h-10 px-8 font-black uppercase text-[10px] tracking-[0.15em] transition-all hover:scale-105 rounded-xl group" 
               onClick={handleOpenCreate}
             >
              <Plus className="size-4 mr-2" />
              PROVISION HUB
             </Button>
          </div>
        </div>

        {/* Overview Matrix */}
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { label: 'Total Registry', value: stats.total, sub: 'Cluster Centers', icon: Globe, color: 'text-primary' },
            { label: 'Operational', value: stats.active, sub: 'Active Hubs', icon: Zap, color: 'text-secondary' },
            { label: 'Decommissioned', value: stats.inactive, sub: 'Historical Only', icon: ShieldAlert, color: 'text-destructive' }
          ].map((kpi, i) => (
            <Card key={i} className="glass-card border-none overflow-hidden group hover:bg-slate-50 transition-all shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</CardTitle>
                <kpi.icon className={cn("size-5 opacity-30 group-hover:opacity-100 transition-all", kpi.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-black text-black tracking-tighter">{kpi.value}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Registry Ledger */}
        <Card className="shadow-2xl border border-slate-100 overflow-hidden rounded-[2.5rem] bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                 <div className="size-16 rounded-[1.75rem] bg-primary flex items-center justify-center border border-slate-200 shadow-inner">
                    <ShieldCheck className="size-8 text-white" />
                 </div>
                 <div className="space-y-1">
                    <CardTitle className="text-2xl uppercase font-black tracking-tight text-black leading-none">Cluster Registry Ledger</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
                       Verified ROC cluster hubs within the institutional cloud.
                    </CardDescription>
                 </div>
              </div>
              <div className="flex gap-4 w-full max-w-xl">
                <div className="relative w-full group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search Center Name, ID, or Short Code..." 
                    className="pl-14 h-14 font-black uppercase text-[11px] tracking-widest bg-white border-2 border-slate-100 rounded-2xl focus:border-primary transition-all text-black"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto no-scrollbar">
            <Table className="border-collapse">
              <TableHeader className="bg-slate-50/30">
                <TableRow className="border-b border-slate-100">
                  <TableHead className="w-[120px] pl-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Pulse ID</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">ROC Cluster Hub</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100">Geo Metadata</TableHead>
                  <TableHead className="py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60 border-r border-slate-100 text-center">Status Hub</TableHead>
                  <TableHead className="text-right pr-10 py-8 uppercase text-[11px] font-black tracking-[0.4em] text-primary/60">Registry Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-100"><TableCell colSpan={5} className="py-12 px-10"><Loader2 className="animate-spin mx-auto size-6 opacity-20" /></TableCell></TableRow>
                  ))
                ) : filteredOffices?.map((o) => (
                  <TableRow key={o.officeId} className={cn(
                    "hover:bg-slate-50 transition-all duration-300 group border-b border-slate-100 last:border-0",
                    o.status !== 'Active' && "opacity-60 grayscale"
                  )}>
                    <TableCell className="pl-10 py-8 border-r border-slate-100">
                      <code className="text-secondary font-black text-[13px] bg-secondary/5 px-4 py-1.5 rounded-lg border border-secondary/20 shadow-inner">
                        {o.shortCode}
                      </code>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100">
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-[17px] text-black tracking-tight group-hover:translate-x-1 transition-transform leading-none uppercase">{o.officeName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{o.officeId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200 shadow-inner group-hover:bg-secondary/10 transition-all">
                          <MapPin className="size-4 text-secondary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-black uppercase text-black/80">{o.city}, {o.state}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{o.country}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-8 border-r border-slate-100 text-center">
                       <Badge 
                        className={cn(
                          "font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full border-none shadow-xl transition-all",
                          o.status === 'Active' ? 'bg-emerald-500 text-white' : 'bg-destructive text-white'
                        )}
                      >
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-10 py-8">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-10 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all">
                               <MoreVertical className="size-5 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-2xl border border-slate-100 bg-white p-2">
                             <DropdownMenuItem className="h-12 font-black uppercase text-[10px] tracking-[0.2em] rounded-xl focus:bg-primary focus:text-white" onClick={() => handleOpenEdit(o)}>
                                <Edit2 className="mr-3 size-4" /> Edit Registry Metadata
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                              className={cn(
                                "h-12 font-black uppercase text-[10px] tracking-[0.2em] rounded-xl focus:text-white",
                                o.status === 'Active' ? "text-destructive focus:bg-destructive" : "text-emerald-500 focus:bg-emerald-500"
                              )}
                              onClick={() => toggleStatus(o.officeId, o.status)}
                             >
                                {o.status === 'Active' ? <><ShieldAlert className="mr-3 size-4" /> Deactivate Center</> : <><CheckCircle2 className="mr-3 size-4" /> Reactivate Center</>}
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="bg-muted/5 border-t p-6">
             <div className="flex items-center gap-8 text-[11px] font-black uppercase text-muted-foreground tracking-[0.1em]">
                <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-emerald-500" /> Operational Hubs Enabled</div>
                <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-destructive" /> Operational Hubs Restricted</div>
                <div className="ml-auto flex items-center gap-2 text-secondary"><Database className="size-3" /> Registry Synced: {new Date().toLocaleTimeString()}</div>
             </div>
          </CardFooter>
        </Card>

        {/* Creation/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
            <div className="bg-primary p-12 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Building2 size={180} /></div>
              <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none relative z-10 text-white">
                {editingOffice ? 'Update Registry Metadata' : 'Provision Cluster Center'}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mt-4 relative z-10">
                Institutional Infrastructure Protocol — v6.0
              </DialogDescription>
            </div>

            <form onSubmit={handleSubmit} className="p-12 space-y-8">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Office ID (Immutable)</Label>
                    <Input 
                      className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-slate-50 uppercase disabled:opacity-50" 
                      value={formData.officeId} 
                      onChange={e => setFormData({...formData, officeId: e.target.value.toUpperCase()})}
                      placeholder="MUMBAI_ROC"
                      disabled={!!editingOffice || processing}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Short Code (Unique)</Label>
                    <Input 
                      className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 bg-slate-50 uppercase disabled:opacity-50" 
                      value={formData.shortCode} 
                      onChange={e => setFormData({...formData, shortCode: e.target.value.toUpperCase()})}
                      placeholder="MUM"
                      maxLength={3}
                      disabled={!!editingOffice || processing}
                      required
                    />
                  </div>
               </div>

               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">Official Center Name</Label>
                  <Input 
                    className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100 focus:border-secondary transition-all" 
                    value={formData.officeName} 
                    onChange={e => setFormData({...formData, officeName: e.target.value})}
                    placeholder="Mumbai ROC"
                    disabled={processing}
                    required
                  />
               </div>

               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">City</Label>
                    <Input className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} required disabled={processing} />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-black/60 ml-1">State</Label>
                    <Input className="font-black h-14 pl-6 rounded-2xl border-2 border-slate-100" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} required disabled={processing} />
                  </div>
               </div>

               <Button 
                className="w-full bg-primary text-white h-18 text-base font-black uppercase tracking-[0.25em] rounded-3xl shadow-2xl hover:bg-black transition-all group mt-6" 
                type="submit" 
                disabled={processing}
              >
                {processing ? <Loader2 className="animate-spin size-6 mr-3" /> : <Zap className="size-6 mr-3 group-hover:rotate-12 transition-transform" />}
                {editingOffice ? 'AUTHORIZE HUB UPDATE' : 'DEPLOY CLUSTER HUB'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
