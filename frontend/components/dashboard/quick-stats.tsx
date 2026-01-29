"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface QuickStatsProps {
  tourists: any[]
  logs: any[]
}

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function QuickStats({ tourists, logs }: QuickStatsProps) {
  const totalTourists = tourists.length
  const activeAlerts = tourists.filter((t) => t.status === "ALERT").length

  const sos = logs.filter((l) => (l.event_type || "").toLowerCase() === "sos")
  const confirmed = sos.filter((l) => (l.ticket_status || "NEW") === "CONFIRMED").length
  const assigned = sos.filter((l) => (l.ticket_status || "") === "ASSIGNED").length

  // Avoid SSR/CSR timezone drift by computing this only after mount.
  const [resolvedToday, setResolvedToday] = useState<number | null>(null)
  useEffect(() => {
    try {
      const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) // YYYY-MM-DD
      const count = sos.filter((l) => {
        if ((l.ticket_status || "") !== "RESOLVED") return false
        const ts = String(l.ticket_resolved_at || "")
        return ts && ts.slice(0, 10) === todayIst
      }).length
      setResolvedToday(count)
    } catch {
      // fallback: show total resolved if timezone formatting fails
      const count = sos.filter((l) => (l.ticket_status || "") === "RESOLVED").length
      setResolvedToday(count)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs])

  const items = useMemo(
    () => [
      { label: "Active tourists", value: totalTourists, variant: "default" as const },
      { label: "Active alerts", value: activeAlerts, variant: activeAlerts > 0 ? ("alert" as const) : ("default" as const) },
      { label: "Confirmed (unpicked)", value: confirmed, variant: confirmed > 0 ? ("warning" as const) : ("default" as const) },
      { label: "Assigned", value: assigned, variant: "default" as const },
      { label: "Resolved today", value: resolvedToday == null ? "—" : resolvedToday, variant: (resolvedToday ?? 0) > 0 ? ("success" as const) : ("default" as const) },
    ],
    [totalTourists, activeAlerts, confirmed, assigned, resolvedToday],
  )

  return (
    <Card className="py-0 dashboard-card fade-in-up-delay-1">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-sm font-semibold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
          Quick stats
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-3">
          {items.map((it, idx) => {
            const colorClasses = {
              alert: "from-red-700 via-red-600 to-red-800",
              success: "from-emerald-700 via-emerald-600 to-emerald-800",
              warning: "from-amber-700 via-amber-600 to-amber-800",
              default: "from-slate-700 via-slate-600 to-slate-800",
            }
            return (
              <div
                key={it.label}
                className={`stat-card rounded-lg border p-3 ${
                  it.variant === "alert" ? "stat-card-alert" : it.variant === "success" ? "stat-card-success" : it.variant === "warning" ? "stat-card-warning" : ""
                }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="text-xs text-muted-foreground font-medium">{it.label}</div>
                <div className={`mt-1 text-2xl font-bold tabular-nums bg-gradient-to-br ${colorClasses[it.variant]} bg-clip-text text-transparent`}>
                  {it.value}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
