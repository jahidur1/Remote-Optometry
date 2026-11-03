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
  MessageSquare,
  Settings,
  LogOut,
  Stethoscope,
  CalendarRange,
  PlaneTakeoff,
  UserCheck,
  Target,
  BarChart3,
  ShieldAlert,
  CreditCard,
  ArrowRightLeft,
  ChevronRight
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
      { title: "Clinical Leaves", url: "/admin/leaves", icon: PlaneTakeoff, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Exchange Hub", url: "/admin/swaps", icon: ArrowRightLeft, roles: ["SUPER_ADMIN", "ADMIN"] },
    ]
  },
  {
    label: "Governance",
    items: [
      { title: "Session Audit", url: "/admin/sessions", icon: ShieldAlert, roles: ["SUPER_ADMIN"] },
      { title: "Institutional Logs", url: "/admin/audit", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
      { title: "Cost Monitor", url: "/admin/auth-costs", icon: CreditCard, roles: ["SUPER_ADMIN"] },
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

  // Ensure navigation always closes mobile sidebar and clears interaction state
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-primary/95 dark:bg-black/95">
      <SidebarHeader className="h-24 flex justify-center px-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center gap-3 transition-all duration-300",
              state === "collapsed" ? "justify-center" : "justify-start"
            )}>
              <div className="flex aspect-square size-12 items-center justify-center rounded-2xl bg-secondary text-white shadow-xl shadow-secondary/20">
                <Stethoscope className="size-7" />
              </div>
              {state === "expanded" && (
                <div className="flex flex-col">
                  <span className="text-base font-black uppercase tracking-tighter text-white">ROC Workforce</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary/80">Intelligence Node</span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        {navGroups.map((group) => {
          const filteredItems = group.items.filter(item => 
            !item.roles || (profile && item.roles.includes(profile.role))
          )
          
          if (filteredItems.length === 0) return null

          return (
            <SidebarGroup key={group.label} className="mt-6">
              <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 px-4 mb-3">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.url || (item.url !== '/admin' && pathname.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive} 
                          tooltip={item.title}
                          className={cn(
                            "h-12 px-4 rounded-2xl transition-all duration-300 group",
                            isActive 
                              ? "bg-secondary text-white shadow-2xl shadow-secondary/50" 
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          )}
                        >
                          <Link href={item.url} onClick={handleNavClick} className="flex items-center gap-4">
                            <item.icon className={cn("size-5", isActive ? "text-white stroke-[2.5px]" : "group-hover:scale-110 group-hover:text-secondary transition-all")} />
                            <span className="font-bold text-[14px] tracking-tight uppercase">{item.title}</span>
                            {isActive && <div className="ml-auto size-1.5 rounded-full bg-white shadow-[0_0_10px_white] animate-pulse" />}
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

      <SidebarFooter className="p-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="h-14 rounded-2xl text-white/40 hover:text-white hover:bg-destructive/10 hover:text-destructive px-5 transition-all duration-300 group"
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