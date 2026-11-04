
import { RoleGuard } from "@/components/auth/role-guard"
import { BottomNav } from "@/components/layout/bottom-nav"
import Image from "next/image";
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <RoleGuard allowedRoles={['user', 'admin', 'super_admin']}>
      <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
        <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-3xl supports-[backdrop-filter]:bg-white/60">
          <div className="container flex h-20 items-center px-6 md:px-10">
            <div className="flex items-center gap-4 font-black text-black">
              {logo && (
                <div className="relative size-10 transform hover:rotate-6 transition-transform">
                  <Image 
                    src={logo.imageUrl} 
                    alt="Remote Optometry" 
                    fill 
                    className="object-contain"
                    data-ai-hint="remote optometry"
                  />
                </div>
              )}
              <span className="font-headline tracking-tighter text-2xl uppercase">Remote <span className="text-primary italic">Optometry</span></span>
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
