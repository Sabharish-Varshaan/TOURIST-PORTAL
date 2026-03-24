"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type LogRow = {
  id: number
  tourist_id: string
  event_type: string
  location_label: string
  timestamp: string
  lat: number | "-"
  lng: number | "-"
  ticket_status?: string | null
  ticket_assignee?: string | null
  ticket_confirmed_at?: string | null
  ticket_assigned_at?: string | null
  ticket_resolved_at?: string | null
}

function safeDate(v: unknown): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function median(nums: number[]) {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

type HttpMetricsPayload = {
  window_hours: number
  by_minute: { t: string; count: number; p50_ms: number; p95_ms: number; errors: number }[]
  by_route: { route: string; count: number; p50_ms: number; p95_ms: number; error_rate: number }[]
  totals: { requests: number; errors_4xx: number; errors_5xx: number }
}

const tabBtn =
  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-ring/50"
const tabBtnActive =
  "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"

export default function DashboardAnalyticsPage() {
  const [tourists, setTourists] = useState<any[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [refresh, setRefresh] = useState(0)
  const [httpMetrics, setHttpMetrics] = useState<HttpMetricsPayload | null>(null)
  const [httpMetricsError, setHttpMetricsError] = useState<string | null>(null)
  /** Avoid nested Radix Tabs here — they hydrate inconsistently with Next.js SSR. */
  const [mainSection, setMainSection] = useState<"operations" | "api">("operations")
  const [sosWindow, setSosWindow] = useState<"24h" | "7d">("24h")

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh((x) => x + 1), 10000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [touristsRes, logsRes, metricsRes] = await Promise.all([
          fetch(`${API}/api/tourists`),
          fetch(`${API}/api/logs`),
          fetch(`/api/metrics/http?hours=24`, { cache: "no-store" }),
        ])
        const touristsData = await touristsRes.json()
        const logsData = await logsRes.json()
        setTourists(Array.isArray(touristsData) ? touristsData : [])
        setLogs(Array.isArray(logsData) ? logsData : [])
        if (metricsRes.ok) {
          const m = await metricsRes.json()
          if (m && typeof m.totals === "object") {
            setHttpMetrics(m as HttpMetricsPayload)
            setHttpMetricsError(null)
          } else {
            setHttpMetrics(null)
            setHttpMetricsError("Invalid metrics response")
          }
        } else {
          setHttpMetrics(null)
          if (metricsRes.status === 401) {
            setHttpMetricsError("Metrics require METRICS_API_KEY on the Next.js server (same value as the backend).")
          } else if (metricsRes.status === 404) {
            setHttpMetricsError(
              "Metrics API returned 404. Start the GuardianID backend from TOURIST-PORTAL/backend (e.g. uvicorn main:app --reload --port 8000). " +
                "Set NEXT_PUBLIC_API_URL to the API root only (http://127.0.0.1:8000), not …/api. Optional: BACKEND_API_URL for this proxy only.",
            )
          } else if (metricsRes.status === 502) {
            setHttpMetricsError(
              "Could not reach FastAPI for metrics (bad gateway). Is the backend running on the port in NEXT_PUBLIC_API_URL?",
            )
          } else {
            setHttpMetricsError(`HTTP ${metricsRes.status}`)
          }
        }
      } catch {
        setHttpMetrics(null)
        setHttpMetricsError("Could not load API metrics")
      }
    })()
  }, [refresh])

  const sos = useMemo(() => logs.filter((l) => (l.event_type || "").toLowerCase() === "sos"), [logs])

  const kpis = useMemo(() => {
    const totalTourists = tourists.length
    const activeAlerts = tourists.filter((t) => t.status === "ALERT").length
    const confirmed = sos.filter((l) => (l.ticket_status || "NEW") === "CONFIRMED").length
    const assigned = sos.filter((l) => (l.ticket_status || "") === "ASSIGNED").length
    const resolved = sos.filter((l) => (l.ticket_status || "") === "RESOLVED").length
    return { totalTourists, activeAlerts, confirmed, assigned, resolved }
  }, [tourists, sos])

  const incidentsByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of logs) {
      const k = String(l.event_type || "unknown")
      m.set(k, (m.get(k) || 0) + 1)
    }
    return [...m.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [logs])

  const pipelineData = useMemo(() => {
    const statuses = ["NEW", "CONFIRMED", "ASSIGNED", "RESOLVED"] as const
    const counts: Record<(typeof statuses)[number], number> = { NEW: 0, CONFIRMED: 0, ASSIGNED: 0, RESOLVED: 0 }
    for (const l of sos) {
      const s = String(l.ticket_status || "NEW").toUpperCase() as keyof typeof counts
      if (s in counts) counts[s] += 1
    }
    return [{ name: "Tickets", ...counts }]
  }, [sos])

  const topSosLocations = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of sos) {
      const label = String(l.location_label || "-")
      if (!label || label === "-") continue
      m.set(label, (m.get(label) || 0) + 1)
    }
    return [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [sos])

  const latestConfirmed = useMemo(() => {
    return sos
      .filter((l) => (l.ticket_status || "") === "CONFIRMED")
      .slice(0, 8)
      .map((l) => ({
        id: l.id,
        tourist_id: l.tourist_id,
        location_label: l.location_label,
        timestamp: l.timestamp,
      }))
  }, [sos])

  const responseTimes = useMemo(() => {
    const toConfirm: number[] = []
    const toAssign: number[] = []
    const toResolve: number[] = []

    for (const l of sos) {
      const created = safeDate(l.timestamp)
      const confirmed = safeDate(l.ticket_confirmed_at)
      const assigned = safeDate(l.ticket_assigned_at)
      const resolved = safeDate(l.ticket_resolved_at)

      if (created && confirmed) toConfirm.push((confirmed.getTime() - created.getTime()) / 60000)
      if (confirmed && assigned) toAssign.push((assigned.getTime() - confirmed.getTime()) / 60000)
      if (assigned && resolved) toResolve.push((resolved.getTime() - assigned.getTime()) / 60000)
    }

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    return {
      toConfirm: { avg: avg(toConfirm), median: median(toConfirm), n: toConfirm.length },
      toAssign: { avg: avg(toAssign), median: median(toAssign), n: toAssign.length },
      toResolve: { avg: avg(toResolve), median: median(toResolve), n: toResolve.length },
    }
  }, [sos])

  const timeseries24h = useMemo(() => {
    const now = Date.now()
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now - (23 - i) * 3600_000)
      const label = `${String(d.getHours()).padStart(2, "0")}:00`
      return { t: label, count: 0 }
    })
    for (const l of sos) {
      const d = safeDate(l.timestamp)
      if (!d) continue
      const diffH = Math.floor((now - d.getTime()) / 3600_000)
      if (diffH < 0 || diffH > 23) continue
      const idx = 23 - diffH
      if (buckets[idx]) buckets[idx].count += 1
    }
    return buckets
  }, [sos])

  const timeseries7d = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 3600_000
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * dayMs)
      const label = d.toLocaleDateString(undefined, { weekday: "short" })
      return { t: label, count: 0 }
    })
    for (const l of sos) {
      const d = safeDate(l.timestamp)
      if (!d) continue
      const diffD = Math.floor((now - d.getTime()) / dayMs)
      if (diffD < 0 || diffD > 6) continue
      const idx = 6 - diffD
      if (buckets[idx]) buckets[idx].count += 1
    }
    return buckets
  }, [sos])

  const incidentsByTypeConfig: ChartConfig = { count: { label: "Incidents", color: "var(--chart-1)" } }
  const sosOverTimeConfig: ChartConfig = { count: { label: "SOS", color: "var(--chart-2)" } }
  const pipelineConfig: ChartConfig = {
    NEW: { label: "NEW", color: "var(--chart-3)" },
    CONFIRMED: { label: "CONFIRMED", color: "var(--chart-4)" },
    ASSIGNED: { label: "ASSIGNED", color: "var(--chart-2)" },
    RESOLVED: { label: "RESOLVED", color: "var(--chart-5)" },
  }

  const apiLatencyConfig: ChartConfig = {
    p50_ms: { label: "p50 latency (ms)", color: "hsl(var(--chart-1))" },
    p95_ms: { label: "p95 latency (ms)", color: "hsl(var(--chart-2))" },
    count: { label: "Requests / min", color: "hsl(var(--chart-3))" },
  }

  const apiRouteLatencyConfig: ChartConfig = {
    p95_ms: { label: "p95 (ms)", color: "hsl(var(--chart-1))" },
  }

  const apiTrafficConfig: ChartConfig = {
    count: { label: "Requests", color: "hsl(var(--chart-3))" },
    errors: { label: "Errors", color: "hsl(var(--destructive))" },
  }

  const httpTotals = httpMetrics?.totals
  const errorRate =
    httpTotals && httpTotals.requests > 0
      ? Math.round(((httpTotals.errors_4xx + httpTotals.errors_5xx) / httpTotals.requests) * 10000) / 100
      : null

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Analytics sections"
        className="bg-muted text-muted-foreground grid h-9 w-full max-w-md grid-cols-2 items-center justify-center rounded-lg p-[3px]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mainSection === "operations"}
          onClick={() => setMainSection("operations")}
          className={cn(tabBtn, mainSection === "operations" && tabBtnActive)}
        >
          Safety operations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainSection === "api"}
          onClick={() => setMainSection("api")}
          className={cn(tabBtn, mainSection === "api" && tabBtnActive)}
        >
          API performance
        </button>
      </div>

      {mainSection === "operations" && (
      <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Active tourists", value: kpis.totalTourists },
          { label: "Active alerts", value: kpis.activeAlerts },
          { label: "Confirmed (unpicked)", value: kpis.confirmed },
          { label: "Assigned", value: kpis.assigned },
          { label: "Resolved", value: kpis.resolved },
        ].map((k) => (
          <Card key={k.label} className="py-0">
            <CardHeader className="border-b">
              <CardTitle className="text-xs text-muted-foreground font-medium">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Incidents by type</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={incidentsByTypeConfig} className="h-[280px] w-full">
              <BarChart data={incidentsByType}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="type" tickLine={false} axisLine={false} interval={0} angle={-20} height={60} />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">SOS volume</CardTitle>
              <div
                role="tablist"
                aria-label="SOS time window"
                className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={sosWindow === "24h"}
                  onClick={() => setSosWindow("24h")}
                  className={cn(tabBtn, "h-[calc(100%-1px)]", sosWindow === "24h" && tabBtnActive)}
                >
                  24h
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sosWindow === "7d"}
                  onClick={() => setSosWindow("7d")}
                  className={cn(tabBtn, "h-[calc(100%-1px)]", sosWindow === "7d" && tabBtnActive)}
                >
                  7d
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {sosWindow === "24h" ? (
              <ChartContainer config={sosOverTimeConfig} className="h-[280px] w-full">
                <LineChart data={timeseries24h} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="t" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <ChartContainer config={sosOverTimeConfig} className="h-[280px] w-full">
                <LineChart data={timeseries7d} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="t" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Ticket pipeline snapshot</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={pipelineConfig} className="h-[220px] w-full">
              <BarChart data={pipelineData} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={70} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="NEW" stackId="a" fill="var(--color-NEW)" radius={[6, 0, 0, 6]} />
                <Bar dataKey="CONFIRMED" stackId="a" fill="var(--color-CONFIRMED)" />
                <Bar dataKey="ASSIGNED" stackId="a" fill="var(--color-ASSIGNED)" />
                <Bar dataKey="RESOLVED" stackId="a" fill="var(--color-RESOLVED)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Response-time metrics (minutes)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: "Time to confirm", v: responseTimes.toConfirm },
                { label: "Time to assign", v: responseTimes.toAssign },
                { label: "Time to resolve", v: responseTimes.toResolve },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border bg-card/40 p-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    <Badge variant="outline" className="font-mono">
                      n={row.v.n}
                    </Badge>{" "}
                    avg{" "}
                    <span className="font-mono text-foreground">
                      {row.v.avg == null ? "—" : Math.round(row.v.avg * 10) / 10}
                    </span>{" "}
                    • median{" "}
                    <span className="font-mono text-foreground">
                      {row.v.median == null ? "—" : Math.round(row.v.median * 10) / 10}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              These populate once the backend stores confirm/assign/resolve timestamps.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Top SOS locations</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {topSosLocations.length === 0 ? (
              <div className="text-sm text-muted-foreground">No SOS location labels yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSosLocations.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell className="max-w-[420px] truncate">{r.label}</TableCell>
                      <TableCell className="font-mono">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Latest confirmed (awaiting pickup)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {latestConfirmed.length === 0 ? (
              <div className="text-sm text-muted-foreground">No confirmed SOS tickets right now.</div>
            ) : (
              <ScrollArea className="h-64 pr-3">
                <div className="space-y-2">
                  {latestConfirmed.map((t) => (
                    <div key={t.id} className="rounded-lg border bg-card/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">SOS #{t.id}</div>
                        <Badge variant="secondary" className="font-mono">
                          CONFIRMED
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground font-mono">tourist: {t.tourist_id}</div>
                      <div className="mt-1 text-sm truncate">{t.location_label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{t.timestamp}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
      )}

      {mainSection === "api" && (
      <div className="mt-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          FastAPI request timing (normalized routes) and optional B2B2C ingest. Data retained 7 days. Set{" "}
          <code className="rounded bg-muted px-1">METRICS_API_KEY</code> in the Next.js env to match the backend when securing
          metrics.
        </p>

        {httpMetricsError && (
          <Card className="border-destructive/50 bg-destructive/5 py-0">
            <CardContent className="pt-4 text-sm text-destructive">{httpMetricsError}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="py-0">
            <CardHeader className="border-b">
              <CardTitle className="text-xs text-muted-foreground font-medium">Requests ({httpMetrics?.window_hours ?? 24}h)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{httpTotals?.requests ?? "—"}</div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardHeader className="border-b">
              <CardTitle className="text-xs text-muted-foreground font-medium">4xx errors</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{httpTotals?.errors_4xx ?? "—"}</div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardHeader className="border-b">
              <CardTitle className="text-xs text-muted-foreground font-medium">5xx errors</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{httpTotals?.errors_5xx ?? "—"}</div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardHeader className="border-b">
              <CardTitle className="text-xs text-muted-foreground font-medium">Error rate</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-semibold tabular-nums">{errorRate != null ? `${errorRate}%` : "—"}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="py-0">
            <CardHeader className="border-b">
              <CardTitle className="text-sm">Latency by minute (p50 / p95)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!httpMetrics?.by_minute?.length ? (
                <div className="text-sm text-muted-foreground">No HTTP samples yet. Hit the API to populate metrics.</div>
              ) : (
                <ChartContainer config={apiLatencyConfig} className="h-[300px] w-full">
                  <LineChart data={httpMetrics.by_minute} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} width={44} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="p50_ms" stroke="var(--color-p50_ms)" strokeWidth={2} dot={false} name="p50 ms" />
                    <Line type="monotone" dataKey="p95_ms" stroke="var(--color-p95_ms)" strokeWidth={2} dot={false} name="p95 ms" />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardHeader className="border-b">
              <CardTitle className="text-sm">Requests and errors per minute</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!httpMetrics?.by_minute?.length ? (
                <div className="text-sm text-muted-foreground">No data yet.</div>
              ) : (
                <ChartContainer config={apiTrafficConfig} className="h-[300px] w-full">
                  <BarChart data={httpMetrics.by_minute} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} width={44} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} name="Requests" />
                    <Bar dataKey="errors" fill="var(--color-errors)" radius={[4, 4, 0, 0]} name="Errors" />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="py-0">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Slowest routes by p95 (top 20)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!httpMetrics?.by_route?.length ? (
              <div className="text-sm text-muted-foreground">No route aggregates yet.</div>
            ) : (
              <ChartContainer config={apiRouteLatencyConfig} className="h-[min(480px,60vh)] w-full">
                <BarChart
                  data={[...httpMetrics.by_route].sort((a, b) => b.p95_ms - a.p95_ms).slice(0, 20)}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="route"
                    tickLine={false}
                    axisLine={false}
                    width={200}
                    tick={{ fontSize: 10 }}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="p95_ms" fill="var(--color-p95_ms)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  )
}

