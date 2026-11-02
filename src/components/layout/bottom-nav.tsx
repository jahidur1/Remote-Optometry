"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, User, Clock, MessageSquare, Laptop } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { title: "Shifts", icon: Clock, href: "/employee/portal" },
    { title: "Reservations", icon: Calendar, href: "/employee/book-off" },
    { title: "Exchanges", icon: MessageSquare, href: "/employee/swaps" },
    { title: "Security", icon: Laptop, href: "/employee/sessions" },
    { title: "Identity", icon: User, href: "/employee/profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-white/10 bg-primary/95 backdrop-blur-2xl px-4 md:hidden rounded-t-[2.5rem] shadow-2xl">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 transition-all duration-300 flex-1 h-full",
              isActive ? "text-secondary scale-110" : "text-white/40 hover:text-white/60"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-all duration-300",
              isActive ? "bg-secondary/10 shadow-inner" : ""
            )}>
              <item.icon className={cn("size-5", isActive ? "stroke-[3px]" : "stroke-[2px]")} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{item.title}</span>
            {isActive && <div className="size-1 rounded-full bg-secondary animate-pulse" />}
          </Link>
        )
      })}
    </nav>
  )
}