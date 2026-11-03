import { RoleGuard } from "@/components/auth/role-guard"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Stethoscope } from "lucide-react"

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}>
      <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
        <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-3xl supports-[backdrop-filter]:bg-white/60">
          <div className="container flex h-20 items-center px-6 md:px-10">
            <div className="flex items-center gap-3 font-black text-black">
              <div className="p-2 rounded-xl bg-primary text-white shadow-lg">
                <Stethoscope className="size-6" />
              </div>
              <span className="font-headline tracking-tighter text-2xl uppercase">ROC <span className="text-primary italic">Workforce</span></span>
            </div>
          </div>
        </header>
        <main className="flex-1 container py-10 px-6 md:px-10 animate-in">
          {children}
        </main>
        <BottomNav />
      </div>
    </RoleGuard>
  )
}