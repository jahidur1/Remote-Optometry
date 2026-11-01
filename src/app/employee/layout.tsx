
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
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center px-4 md:px-8">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Stethoscope className="size-5 text-secondary" />
              <span className="font-headline tracking-tight">ROC Workforce</span>
            </div>
          </div>
        </header>
        <main className="flex-1 container py-6 px-4 md:px-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </RoleGuard>
  )
}
