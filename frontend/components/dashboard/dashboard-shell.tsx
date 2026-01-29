"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, LayoutDashboard, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function NavLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string
  active: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      className={cn(
        "justify-start transition-all duration-300",
        active
          ? "shadow-sm shadow-slate-500/10 bg-gradient-to-r from-slate-600 to-slate-700 border-slate-400/50 ring-1 ring-slate-300/50 text-white font-semibold"
          : "hover:bg-slate-100/80 hover:border-slate-300/60 hover:text-slate-700",
      )}
    >
      <Link href={href} className="gap-2">
        <Icon className={cn("size-4 transition-transform", active && "scale-110")} />
        <span className={cn("font-medium", active && "text-foreground")}>{label}</span>
      </Link>
    </Button>
  )
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isOverview = pathname === "/dashboard"
  const isAnalytics = pathname?.startsWith("/dashboard/analytics")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 text-slate-900">
      <div className="sticky top-0 z-40 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/90 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className={cn("flex items-center gap-3", mounted && "fade-in-up")}>
            <div className="size-10 rounded-xl border border-slate-300/50 bg-gradient-to-br from-slate-200/60 via-slate-100/80 to-slate-200/60 flex items-center justify-center shadow-sm ring-1 ring-slate-200/50 transition-all hover:ring-slate-300/60 hover:scale-105">
              <ShieldCheck className="size-5 text-slate-600" />
            </div>
            <div>
              <div className="font-bold leading-tight bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
                GuardianID Command Center
              </div>
              <div className="text-xs text-slate-500 leading-tight">Authority dashboard • live monitoring</div>
            </div>
          </div>

          <div className={cn("flex items-center gap-2", mounted && "fade-in-up-delay-1")}>
            <NavLink href="/dashboard" active={isOverview} icon={LayoutDashboard} label="Overview" />
            <NavLink href="/dashboard/analytics" active={isAnalytics} icon={BarChart3} label="Analytics" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">{children}</div>
    </div>
  )
}

