
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
  ArrowRightLeft
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
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase"

const adminItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Reports & Exports",
    url: "/admin/reports",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Shift Master",
    url: "/admin/shifts",
    icon: Clock,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Weekly-Off Config",
    url: "/admin/weekoff-config",
    icon: CalendarRange,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Shift Quotas",
    url: "/admin/quotas",
    icon: Target,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Adjacency Rules",
    url: "/admin/adjacency",
    icon: ArrowRightLeft,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Shift Swaps",
    url: "/admin/swaps",
    icon: ArrowRightLeft,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Employees",
    url: "/admin/employees",
    icon: Users,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Leave Management",
    url: "/admin/leaves",
    icon: PlaneTakeoff,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Daily Availability",
    url: "/admin/availability",
    icon: UserCheck,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Roster Solver",
    url: "/admin/roster",
    icon: Calendar,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    title: "Session Audit",
    url: "/admin/sessions",
    icon: ShieldAlert,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Auth Usage",
    url: "/admin/auth-costs",
    icon: CreditCard,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Audit Logs",
    url: "/admin/audit",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
  },
]

const aiTools = [
  {
    title: "Analysis",
    url: "/admin/analysis",
    icon: Activity,
  },
  {
    title: "Notifications",
    url: "/admin/notifications",
    icon: MessageSquare,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { profile } = useUser()
  const auth = useAuth()

  const handleLogout = async () => {
    await signOut(auth)
  }

  const filteredItems = adminItems.filter(item => 
    !item.roles || (profile && item.roles.includes(profile.role))
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Stethoscope className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ROC Workforce</span>
                <span className="truncate text-xs text-sidebar-foreground/70">Intelligent System</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Intelligent Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiTools.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings">
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
