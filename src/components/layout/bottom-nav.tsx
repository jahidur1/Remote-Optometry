
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, User, Clock, MessageSquare, Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { title: "My Shifts", icon: Clock, href: "/employee/portal" },
    { title: "Book Off", icon: Calendar, href: "/employee/book-off" },
    { title: "Preferences", icon: Star, href: "/employee/preferences" },
    { title: "Swaps", icon: MessageSquare, href: "/employee/swaps" },
    { title: "Profile", icon: User, href: "/employee/profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/80 backdrop-blur-lg px-2 md:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              isActive ? "text-secondary" : "text-muted-foreground"
            )}
          >
            <item.icon className="size-5" />
            <span className="text-[10px] font-medium">{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}
