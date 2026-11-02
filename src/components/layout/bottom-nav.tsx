"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, User, LayoutDashboard, ArrowRightLeft } from "lucide-react"
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-white/5 bg-primary/95 backdrop-blur-3xl px-4 md:hidden rounded-t-[2.5rem] shadow-[0_-15px_40px_-10px_rgba(0,0,0,0.4)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 transition-all duration-300 flex-1 h-full relative group",
              isActive ? "text-secondary" : "text-white/30 hover:text-white/50"
            )}
          >
            <div className={cn(
              "p-2.5 rounded-xl transition-all duration-300 transform",
              isActive ? "bg-secondary/15 scale-110 shadow-pulse-secondary" : "group-hover:scale-105"
            )}>
              <item.icon className={cn("size-5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
            </div>
            <span className={cn(
                "text-[7px] font-black uppercase tracking-[0.2em] leading-none transition-all duration-300",
                isActive ? "opacity-100 translate-y-0" : "opacity-40 translate-y-0.5"
            )}>
                {item.title}
            </span>
            {isActive && (
                <div className="absolute bottom-2 size-1 rounded-full bg-secondary shadow-[0_0_8px_hsl(var(--secondary))] animate-pulse" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
