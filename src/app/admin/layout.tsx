import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { RoleGuard } from "@/components/auth/role-guard"
import { Separator } from "@/components/ui/separator"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-white/50 backdrop-blur-md sticky top-0 z-40">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">Institutional Control</span>
            </div>
            <div className="ml-auto flex items-center gap-4">
               <div className="size-8 rounded-full bg-muted/20 animate-pulse" />
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-8 overflow-auto animate-in fade-in slide-in-from-bottom-1 duration-200">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleGuard>
  )
}
