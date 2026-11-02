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
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Analytics", url: "/admin/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "ADMIN"] },
    ]
  },
  {
    label: "Operations",
    items: [
      { title: "Roster Solver", url: "/admin/roster", icon: Calendar, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Shift Quotas", url: "/admin/quotas", icon: Target, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Weekly-Off Config", url: "/admin/weekoff-config", icon: CalendarRange, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Shift Master", url: "/admin/shifts", icon: Clock, roles: ["SUPER_ADMIN", "ADMIN"] },
    ]
  },
  {
    label: "Workforce",
    items: [
      { title: "Employees", url: "/admin/employees", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Availability", url: "/admin/availability", icon: UserCheck, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Leave Logs", url: "/admin/leaves", icon: PlaneTakeoff, roles: ["SUPER_ADMIN", "ADMIN"] },
      { title: "Exchange Hub", url: "/admin/swaps", icon: ArrowRightLeft, roles: ["SUPER_ADMIN", "ADMIN"] },
    ]
  },
  {
    label: "Governance",
    items: [
      { title: "Session Audit", url: "/admin/sessions", icon: ShieldAlert, roles: ["SUPER_ADMIN"] },
      { title: "Security Logs", url: "/admin/audit", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
      { title: "Cost Monitor", url: "/admin/auth-costs", icon: CreditCard, roles: ["SUPER_ADMIN"] },
    ]
  }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { profile } = useUser()
  const auth = useAuth()
  const { state } = useSidebar()

  const handleLogout = async () => {
    await signOut(auth)
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-primary">
      <SidebarHeader className="h-20 flex justify-center px-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center gap-3 transition-all duration-300",
              state === "collapsed" ? "justify-center" : "justify-start"
            )}>
              <div className="flex aspect-square size-10 items-center justify-center rounded-2xl bg-secondary text-white shadow-lg shadow-secondary/20">
                <Stethoscope className="size-6" />
              </div>
              {state === "expanded" && (
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-tighter text-white">ROC Workforce</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary/70">Institutional</span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="px-3">
        {navGroups.map((group) => {
          const filteredItems = group.items.filter(item => 
            !item.roles || (profile && item.roles.includes(profile.role))
          )
          
          if (filteredItems.length === 0) return null

          return (
            <SidebarGroup key={group.label} className="mt-4">
              <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-4 mb-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={pathname === item.url} 
                        tooltip={item.title}
                        className={cn(
                          "h-11 px-4 rounded-xl transition-all duration-200 group",
                          pathname === item.url 
                            ? "bg-secondary text-white shadow-lg shadow-secondary/20" 
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <Link href={item.url} className="flex items-center gap-3">
                          <item.icon className={cn("size-5", pathname === item.url ? "text-white" : "group-hover:scale-110 transition-transform")} />
                          <span className="font-bold text-[13px] tracking-tight">{item.title}</span>
                          {pathname === item.url && <ChevronRight className="ml-auto size-3" />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="h-12 rounded-2xl text-white/60 hover:text-white hover:bg-white/5 px-4"
              onClick={handleLogout}
            >
              <LogOut className="size-5" />
              <span className="font-bold text-[13px]">De-authorize Session</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}