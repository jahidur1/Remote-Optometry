
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, User, Clock, Laptop, LayoutDashboard, ArrowRightLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { title: "Portal", icon: LayoutDashboard, href: "/employee/portal" },
    { title: "Reservations", icon: Calendar, href: "/employee/book-off" },
    { title: "Exchanges", icon: ArrowRightLeft, href: "/employee/swaps" },
    { title: "Identity", icon: User, href: "/employee/profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-24 items-center justify-around border-t border-white/10 bg-primary/98 backdrop-blur-3xl px-4 md:hidden rounded-t-[3rem] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-2 transition-all duration-500 flex-1 h-full relative group",
              isActive ? "text-secondary" : "text-white/40 hover:text-white/60"
            )}
          >
            <div className={cn(
              "p-3 rounded-2xl transition-all duration-500 transform",
              isActive ? "bg-secondary/15 scale-110 shadow-[0_0_20px_rgba(59,130,246,0.2)]" : "group-hover:scale-105"
            )}>
              <item.icon className={cn("size-6", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
            </div>
            <span className={cn(
                "text-[8px] font-black uppercase tracking-[0.2em] leading-none transition-all duration-500",
                isActive ? "opacity-100 translate-y-0" : "opacity-40 translate-y-1"
            )}>
                {item.title}
            </span>
            {isActive && (
                <div className="absolute -bottom-1 size-1.5 rounded-full bg-secondary shadow-[0_0_10px_blue] animate-pulse" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
