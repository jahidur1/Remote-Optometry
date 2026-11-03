
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser } from "@/firebase"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  Activity,
  LogOut,
  Stethoscope,
  CalendarRange,
  UserCheck,
  Target,
  BarChart3,
  ShieldAlert,
  ArrowRightLeft,
  Key
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase"
import { cn } from "@/lib/utils"

const navGroups = [
  {
    label: "Intelligence",
    items: [
      { title: "Command Center", url: "/admin", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Analytics Hub", url: "/admin/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "ADMIN"] },
    ]
  },
  {
    label: "Operations",
    items: [
      { title: "Roster Solver", url: "/admin/roster", icon: Calendar, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Shift Quotas", url: "/admin/quotas", icon: Target, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Weekly-Off Matrix", url: "/admin/weekoff-config", icon: CalendarRange, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Shift Master", url: "/admin/shifts", icon: Clock, roles: ["SUPER_ADMIN", "ADMIN"] },
    ]
  },
  {
    label: "Workforce",
    items: [
      { title: "Directory", url: "/admin/employees", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Availability", url: "/admin/availability", icon: UserCheck, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Exchange Hub", url: "/admin/swaps", icon: ArrowRightLeft, roles: ["SUPER_ADMIN", "ADMIN"] },
    ]
  },
  {
    label: "Governance",
    items: [
      { title: "OTP Monitor", url: "/admin/otp-monitor", icon: Key, roles: ["SUPER_ADMIN"] },
      { title: "Session Audit", url: "/admin/sessions", icon: ShieldAlert, roles: ["SUPER_ADMIN"] },
      { title: "Institutional Logs", url: "/admin/audit", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
    ]
  }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { profile } = useUser()
  const auth = useAuth()
  const { state, isMobile, setOpenMobile } = useSidebar()

  const handleLogout = async () => {
    await signOut(auth)
  }

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-[#0F172A] text-white">
      <SidebarHeader className="h-28 flex justify-center px-8">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center gap-4 transition-all duration-500",
              state === "collapsed" ? "justify-center" : "justify-start"
            )}>
              <div className="flex aspect-square size-14 items-center justify-center rounded-2xl bg-white text-primary shadow-2xl transform hover:rotate-6 transition-transform">
                <Stethoscope className="size-8" />
              </div>
              {state === "expanded" && (
                <div className="flex flex-col">
                  <span className="text-xl font-black uppercase tracking-tighter text-white leading-none">ROC</span>
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mt-1">Workforce</span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="px-5 mt-4">
        {navGroups.map((group) => {
          const filteredItems = group.items.filter(item => 
            !item.roles || (profile && item.roles.includes(profile.role))
          )
          
          if (filteredItems.length === 0) return null

          return (
            <SidebarGroup key={group.label} className="mt-8">
              <SidebarGroupLabel className="text-[11px] font-black uppercase tracking-[0.4em] text-white/20 px-4 mb-4">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.url || (item.url !== '/admin' && pathname.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive} 
                          tooltip={item.title}
                          className={cn(
                            "h-14 px-5 rounded-2xl transition-all duration-300 group",
                            isActive 
                              ? "bg-white text-[#0F172A] shadow-2xl scale-[1.02]" 
                              : "text-white/50 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <Link href={item.url} onClick={handleNavClick} className="flex items-center gap-5">
                            <item.icon className={cn("size-5", isActive ? "text-[#0F172A] stroke-[3px]" : "group-hover:text-white transition-all duration-300")} />
                            <span className="font-bold text-[14px] tracking-tight uppercase leading-none">{item.title}</span>
                            {isActive && <div className="ml-auto size-2 rounded-full bg-secondary animate-pulse" />}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="p-8">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="h-16 rounded-2xl text-white/30 hover:text-white hover:bg-destructive/20 hover:text-destructive px-6 transition-all duration-500 group border-t border-white/5"
              onClick={handleLogout}
            >
              <LogOut className="size-5 group-hover:rotate-12 transition-transform" />
              <span className="font-black uppercase text-[12px] tracking-widest">De-authorize</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
