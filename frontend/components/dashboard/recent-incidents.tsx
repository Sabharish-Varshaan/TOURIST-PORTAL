import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RecentIncidentsProps {
  logs: any[]
}

function variantForEvent(eventType: string): "default" | "secondary" | "destructive" | "outline" {
  const t = (eventType || "").toLowerCase()
  if (t === "sos") return "destructive"
  if (t.includes("anomaly") || t.includes("geofence")) return "secondary"
  return "outline"
}

export default function RecentIncidents({ logs }: RecentIncidentsProps) {
  const latest = logs.slice(0, 12)

  return (
    <Card className="py-0 dashboard-card fade-in-up-delay-2">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-sm font-semibold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
          Recent incidents
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {latest.length === 0 ? (
          <div className="text-sm text-muted-foreground">No incidents yet.</div>
        ) : (
          <ScrollArea className="h-56 pr-3">
            <div className="space-y-2">
              {latest.map((l, idx) => {
                const isSOS = (l.event_type || "").toLowerCase() === "sos"
                return (
                  <div
                    key={l.id}
                    className={`flex items-start justify-between gap-3 rounded-lg border p-3 transition-all hover:shadow-sm hover:scale-[1.01] ${
                      isSOS
                        ? "border-red-200/60 bg-gradient-to-r from-red-50/60 via-orange-50/30 to-transparent hover:border-red-300/60 hover:from-red-50/80"
                        : "border-slate-200 bg-gradient-to-r from-slate-50/60 to-white/80 hover:border-slate-300/60 hover:bg-slate-50/80"
                    }`}
                    style={{ animationDelay: `${idx * 0.03}s` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={variantForEvent(l.event_type)}
                          className={`font-semibold ${
                            isSOS ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm shadow-red-500/20" : "border-slate-300 text-slate-700"
                          }`}
                        >
                          {String(l.event_type || "-").toUpperCase()}
                        </Badge>
                        <span className="text-xs text-slate-600 font-mono">#{l.id}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-800 truncate font-medium">
                        {l.location_label && l.location_label !== "-" ? l.location_label : "—"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 whitespace-nowrap">{l.timestamp}</div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
