
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Stethoscope, ShieldCheck, User } from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary p-6 text-primary-foreground">
      <div className="max-w-4xl w-full space-y-12 text-center">
        <div className="space-y-4">
          <div className="mx-auto size-20 rounded-2xl bg-secondary flex items-center justify-center shadow-lg mb-8">
            <Stethoscope className="size-10" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight font-headline sm:text-6xl">
            ROC <span className="text-accent">Workforce</span>
          </h1>
          <p className="mx-auto max-w-[700px] text-lg text-primary-foreground/80">
            Intelligent Workforce & Shift Management System for Remote Optometry Centres. 
            Powered by Google OR-Tools and Advanced AI.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Link href="/admin">
            <div className="group relative overflow-hidden rounded-xl bg-white/10 p-8 border border-white/20 hover:bg-white/20 transition-all cursor-pointer text-left">
              <ShieldCheck className="size-8 text-secondary mb-4" />
              <h3 className="text-xl font-bold">Administrator Portal</h3>
              <p className="text-sm text-primary-foreground/70 mt-2">
                Manage shifts, run the roster solver, and interpret complex constraints with AI tools.
              </p>
              <div className="mt-6 flex items-center text-sm font-bold text-secondary">
                Access Admin Dashboard →
              </div>
            </div>
          </Link>

          <Link href="/employee/portal">
            <div className="group relative overflow-hidden rounded-xl bg-white/10 p-8 border border-white/20 hover:bg-white/20 transition-all cursor-pointer text-left">
              <User className="size-8 text-accent mb-4" />
              <h3 className="text-xl font-bold">Employee Self-Service</h3>
              <p className="text-sm text-primary-foreground/70 mt-2">
                View your shifts, book weekly-offs, and request shift swaps with colleagues.
              </p>
              <div className="mt-6 flex items-center text-sm font-bold text-accent">
                Access My Portal →
              </div>
            </div>
          </Link>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-wrap justify-center gap-8 opacity-60 grayscale transition-all hover:grayscale-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest">Powered By</span>
            <span className="text-sm font-bold">OR-Tools CP-SAT</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest">Infrastructure</span>
            <span className="text-sm font-bold">Firebase Studio</span>
          </div>
        </div>
      </div>
    </div>
  )
}
