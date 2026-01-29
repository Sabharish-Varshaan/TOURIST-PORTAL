"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

export default function DashboardAnalyticsPage() {
  const [tourists, setTourists] = useState<any[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh((x) => x + 1), 10000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [touristsRes, logsRes] = await Promise.all([fetch(`${API}/api/tourists`), fetch(`${API}/api/logs`)])
        const touristsData = await touristsRes.json()
        const logsData = await logsRes.json()
        setTourists(Array.isArray(touristsData) ? touristsData : [])
        setLogs(Array.isArray(logsData) ? logsData : [])
      } catch {
        // ignore
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

  return (
    <div className="space-y-6">
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
          <Tabs defaultValue="24h" className="gap-0">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">SOS volume</CardTitle>
                <TabsList>
                  <TabsTrigger value="24h">24h</TabsTrigger>
                  <TabsTrigger value="7d">7d</TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <TabsContent value="24h">
                <ChartContainer config={sosOverTimeConfig} className="h-[280px] w-full">
                  <LineChart data={timeseries24h} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              </TabsContent>
              <TabsContent value="7d">
                <ChartContainer config={sosOverTimeConfig} className="h-[280px] w-full">
                  <LineChart data={timeseries7d} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              </TabsContent>
            </CardContent>
          </Tabs>
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
  )
}

