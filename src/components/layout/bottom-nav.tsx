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
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-24 items-center justify-around border-t border-slate-100 bg-white/95 backdrop-blur-3xl px-6 md:hidden shadow-[0_-15px_40px_rgba(0,0,0,0.08)] rounded-t-[2.5rem]">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-2 transition-all duration-500 flex-1 h-full relative group",
              isActive ? "text-primary" : "text-black/30 hover:text-primary"
            )}
          >
            <div className={cn(
              "p-3 rounded-2xl transition-all duration-500 transform",
              isActive ? "bg-primary/5 scale-110 shadow-inner" : "group-hover:scale-110"
            )}>
              <item.icon className={cn("size-6", isActive ? "stroke-[3px] text-primary" : "stroke-[2.5px]")} />
            </div>
            <span className={cn(
                "text-[9px] font-black uppercase tracking-[0.2em] leading-none transition-all duration-500",
                isActive ? "opacity-100 translate-y-0" : "opacity-40 translate-y-1"
            )}>
                {item.title}
            </span>
            {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-primary rounded-b-full shadow-[0_0_15px_rgba(15,23,42,0.3)] animate-in" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}