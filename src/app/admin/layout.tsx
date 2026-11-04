import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { RoleGuard } from "@/components/auth/role-guard"
import { Separator } from "@/components/ui/separator"
import { OfficeProvider } from "@/context/office-context"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <OfficeProvider>
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset>
            <header className="flex h-16 md:h-20 shrink-0 items-center gap-4 border-b border-slate-100 px-4 md:px-8 transition-all ease-in-out bg-white/80 backdrop-blur-3xl sticky top-0 z-40">
              <SidebarTrigger className="-ml-1 size-9 md:size-10 rounded-lg md:rounded-xl hover:bg-slate-50" />
              <Separator orientation="vertical" className="mr-2 h-6" />
              <div className="flex items-center gap-3">
                <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-black/30 truncate max-w-[120px] md:max-w-none">Institutional Control</span>
              </div>
              <div className="ml-auto flex items-center gap-3 md:gap-6">
                 <div className="size-8 md:size-10 rounded-full bg-slate-50 border-2 border-slate-100 flex items-center justify-center animate-pulse">
                    <div className="size-1.5 md:size-2 rounded-full bg-emerald-500" />
                 </div>
              </div>
            </header>
            <main className="flex-1 flex-col gap-4 md:gap-8 p-4 md:p-10 overflow-auto animate-in duration-700">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </OfficeProvider>
    </RoleGuard>
  )
}
