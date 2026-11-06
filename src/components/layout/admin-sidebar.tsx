"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useUser } from "@/firebase"
import { useOffice } from "@/context/office-context"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  Activity,
  LogOut,
  UserCheck,
  Target,
  BarChart3,
  ShieldAlert,
  ArrowRightLeft,
  Network,
  Globe,
  Building2,
  ChevronDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase"
import { cn } from "@/lib/utils"
import { PlaceHolderImages } from '@/lib/placeholder-images';

const navGroups = [
  {
    label: "Intelligence",
    items: [
      { title: "Command Center", url: "/admin", icon: LayoutDashboard, roles: ["super_admin", "admin"] },
      { title: "Regional Hub", url: "/admin/regional", icon: Globe, roles: ["super_admin"] },
      { title: "Analytics Hub", url: "/admin/reports", icon: BarChart3, roles: ["super_admin", "admin"] },
    ]
  },
  {
    label: "Operations",
    items: [
      { title: "Roster Solver", url: "/admin/roster", icon: Calendar, roles: ["super_admin", "admin"] },
      { title: "Shift Master", url: "/admin/shifts", icon: Clock, roles: ["super_admin", "admin"] },
      { title: "Off Matrix", url: "/admin/weekoff-config", icon: Target, roles: ["super_admin", "admin"] },
    ]
  },
  {
    label: "Workforce",
    items: [
      { title: "User Details", url: "/admin/employees", icon: Users, roles: ["super_admin", "admin"] },
      { title: "Master Matrix", url: "/admin/availability", icon: UserCheck, roles: ["super_admin", "admin"] },
      { title: "Exchange Hub", url: "/admin/swaps", icon: ArrowRightLeft, roles: ["super_admin", "admin"] },
      { title: "Absence Registry", url: "/admin/leaves", icon: Activity, roles: ["super_admin", "admin"] },
    ]
  },
  {
    label: "Governance",
    items: [
      { title: "Cluster Registry", url: "/admin/offices", icon: Network, roles: ["super_admin"] },
      { title: "Session Audit", url: "/admin/sessions", icon: ShieldAlert, roles: ["super_admin"] },
      { title: "Institutional Logs", url: "/admin/audit", icon: ShieldCheck, roles: ["super_admin"] },
    ]
  }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { profile } = useUser()
  const { selectedOffice, setSelectedOffice, authorizedOffices } = useOffice()
  const auth = useAuth()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleLogout = async () => {
    await signOut(auth)
  }

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const currentOffice = authorizedOffices.find(o => o.officeId === selectedOffice);

  const showOfficeSelector = profile?.role === 'admin' || (profile?.role === 'super_admin' && authorizedOffices.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-[#0F172A] text-white">
      <SidebarHeader className="h-40 flex flex-col justify-center px-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center gap-4 transition-all duration-500 mb-6",
              state === "collapsed" ? "justify-center" : "justify-start"
            )}>
              {logo && (
                <div className="relative size-10 transform hover:rotate-6 transition-transform shrink-0">
                  <Image 
                    src={logo.imageUrl} 
                    alt="Remote Optometry" 
                    fill 
                    className="object-contain"
                    data-ai-hint="remote optometry"
                  />
                </div>
              )}
              {state === "expanded" && (
                <div className="flex flex-col">
                  <span className="text-lg font-black uppercase tracking-tighter text-white leading-none">Remote</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mt-1">Optometry</span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
          
          {state === "expanded" && showOfficeSelector && (
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="bg-white/5 border border-white/10 h-14 rounded-2xl group hover:bg-white/10 transition-all">
                    <Building2 className="size-5 text-secondary shrink-0" />
                    <div className="flex flex-col flex-1 text-left">
                      <span className="text-[11px] font-black uppercase text-white/90 truncate">
                        {currentOffice?.officeName || "Select Center"}
                      </span>
                      <span className="text-[9px] font-bold uppercase text-white/30 truncate">
                        {currentOffice?.shortCode || "ROC"} Hub
                      </span>
                    </div>
                    {authorizedOffices.length > 1 && <ChevronDown className="size-4 text-white/20 ml-2" />}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                {authorizedOffices.length > 1 && (
                  <DropdownMenuContent className="w-64 bg-[#0F172A] border-white/10 text-white rounded-2xl p-2" align="start">
                    {authorizedOffices.map((office) => (
                      <DropdownMenuItem 
                        key={office.officeId} 
                        className={cn(
                          "h-12 font-black uppercase text-[10px] tracking-widest rounded-xl focus:bg-white/10 cursor-pointer",
                          selectedOffice === office.officeId && "bg-secondary text-white focus:bg-secondary"
                        )}
                        onClick={() => setSelectedOffice(office.officeId)}
                      >
                        {office.officeName}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="px-5 mt-4">
        {navGroups.map((group) => {
          const filteredItems = group.items.filter(item => 
            !item.roles || (profile && item.roles.includes(profile.role))
          )
          
          if (filteredItems.length === 0) return null

          return (
            <SidebarGroup key={group.label} className="mt-4">
              <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 px-4 mb-3">
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
                            "h-12 px-4 rounded-xl transition-all duration-300 group",
                            isActive 
                              ? "bg-white text-[#0F172A] shadow-2xl scale-[1.02]" 
                              : "text-white/50 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <Link href={item.url} onClick={handleNavClick} className="flex items-center gap-4">
                            <item.icon className={cn("size-4", isActive ? "text-[#0F172A] stroke-[3px]" : "group-hover:text-white")} />
                            <span className="font-bold text-[13px] tracking-tight uppercase leading-none">{item.title}</span>
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
