"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "@/components/chat/chat-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface IncidentFeedProps {
  logs: any[]
  onRefresh: () => void
}

type Filter = "all" | "sos" | "new" | "confirmed" | "assigned" | "resolved"

function ticketBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = (status || "NEW").toUpperCase()
  if (s === "CONFIRMED") return "secondary"
  if (s === "ASSIGNED") return "default"
  if (s === "RESOLVED") return "outline"
  return "outline"
}

export default function IncidentFeed({ logs, onRefresh }: IncidentFeedProps) {
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [substations, setSubstations] = useState<any[]>([])
  const [selectedSubstation, setSelectedSubstation] = useState<string>("")
  const [context, setContext] = useState("")
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [chatIncidentId, setChatIncidentId] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const chatThread =
    chatIncidentId !== null
      ? { thread_type: "authority_responder" as const, incident_id: chatIncidentId }
      : null
  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})
  const { messages, connected, sendMessage, sendCallAction } = useChat(chatThread, {
    onCallMessage: (data) => callMessageRef.current(data),
  })
  const callState = useCallState(chatThread, sendCallAction, {
    callerRole: "authority",
    callerId: "dashboard",
  })
  useEffect(() => {
    callMessageRef.current = callState.handleMessage
  }, [callState.handleMessage])
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleAssignClick = async (incidentId: number) => {
    setLoading(true)
    if (!substations.length) {
      try {
        const res = await fetch(`/api/substations`)
        if (!res.ok) throw new Error("Failed to fetch substations")
        const data = await res.json()
        setSubstations(data || [])
        setSelectedSubstation(data?.[0]?.id || "")
      } catch (err) {
        console.error("[v0] Failed to fetch substations:", err)
        alert("Failed to load substations. Check console.")
        setLoading(false)
        return
      }
    } else {
      setSelectedSubstation(substations[0]?.id || "")
    }
    setAssigningId(incidentId)
    setLoading(false)
  }

  const handleAssignSubmit = async () => {
    if (!assigningId || !selectedSubstation) {
      alert("Please select a substation")
      return
    }

    const substation = substations.find((s) => s.id === selectedSubstation)
    if (!substation) {
      alert("Selected substation not found")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${assigningId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_id: substation.id,
          assignee_name: substation.name,
          notes: context,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("[v0] Assign failed:", res.status, errorText)
        alert("Failed to assign ticket. Check console.")
        setLoading(false)
        return
      }

      setAssigningId(null)
      setContext("")
      setLoading(false)
      onRefresh()
    } catch (err) {
      console.error("[v0] Assign error:", err)
      alert("Assign failed (network error)")
      setLoading(false)
    }
  }

  const handleResolve = async (incidentId: number) => {
    if (!confirm("Mark this ticket as RESOLVED?")) return

    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/resolve`, {
        method: "POST",
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("[v0] Resolve failed:", res.status, errorText)
        alert("Failed to resolve ticket. Check console.")
        setLoading(false)
        return
      }

      setLoading(false)
      onRefresh()
    } catch (err) {
      console.error("[v0] Resolve error:", err)
      alert("Resolve failed (network error)")
      setLoading(false)
    }
  }

  const handleConfirm = async (incidentId: number) => {
    if (!confirm("Confirm this SOS and publish it to responders?")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/confirm`, { method: "POST" })
      if (!res.ok) {
        const errorText = await res.text()
        console.error("[v0] Confirm failed:", res.status, errorText)
        alert("Failed to confirm SOS. Check console.")
        setLoading(false)
        return
      }
      setLoading(false)
      onRefresh()
    } catch (err) {
      console.error("[v0] Confirm error:", err)
      alert("Confirm failed (network error)")
      setLoading(false)
    }
  }

  const filteredLogs = useMemo(() => {
    const isSOS = (l: any) => (l.event_type || "").toLowerCase() === "sos"
    const status = (l: any) => String(l.ticket_status || "NEW").toUpperCase()

    switch (filter) {
      case "sos":
        return logs.filter(isSOS)
      case "new":
        return logs.filter((l) => isSOS(l) && status(l) === "NEW")
      case "confirmed":
        return logs.filter((l) => isSOS(l) && status(l) === "CONFIRMED")
      case "assigned":
        return logs.filter((l) => isSOS(l) && status(l) === "ASSIGNED")
      case "resolved":
        return logs.filter((l) => isSOS(l) && status(l) === "RESOLVED")
      default:
        return logs
    }
  }, [logs, filter])

  return (
    <>
      <Card className="py-0 dashboard-card fade-in-up-delay-4">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
                Live incident feed
              </CardTitle>
              <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse shadow-sm" suppressHydrationWarning></span>
                Latest first • confirm SOS before dispatch
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", "All"],
                  ["sos", "SOS"],
                  ["new", "New"],
                  ["confirmed", "Confirmed"],
                  ["assigned", "Assigned"],
                  ["resolved", "Resolved"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "secondary" : "outline"}
                  onClick={() => setFilter(key)}
                  className={`transition-all ${
                    filter === key
                      ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm ring-1 ring-slate-300/50 scale-105 font-semibold"
                      : "hover:bg-slate-100/80 hover:border-slate-300/60 hover:text-slate-700 hover:scale-102"
                  }`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead className="font-semibold text-slate-700">ID</TableHead>
                <TableHead className="font-semibold text-slate-700">Tourist</TableHead>
                <TableHead className="font-semibold text-slate-700">Type</TableHead>
                <TableHead className="font-semibold text-slate-700">Location</TableHead>
                <TableHead className="font-semibold text-slate-700">Time</TableHead>
                <TableHead className="font-semibold text-slate-700">Hash</TableHead>
                <TableHead className="font-semibold text-slate-700">Coords</TableHead>
                <TableHead className="font-semibold text-slate-700">Ticket</TableHead>
                <TableHead className="font-semibold text-slate-700">Assignee</TableHead>
                <TableHead className="font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredLogs.map((l) => {
                const coords =
                  l.lat !== "-" && l.lng !== "-"
                    ? `${Number.parseFloat(l.lat).toFixed(4)},${Number.parseFloat(l.lng).toFixed(4)}`
                    : "-"
                const isSOS = (l.event_type || "").toLowerCase() === "sos"
                const ticketStatus = String(l.ticket_status || "NEW").toUpperCase()

                return (
                  <TableRow
                    key={l.id}
                    className={`transition-all hover:bg-slate-50/60 ${
                      isSOS ? "bg-gradient-to-r from-red-50/50 via-orange-50/20 to-transparent border-l-4 border-l-red-400/60" : ""
                    }`}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-slate-800">{l.id}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">{l.tourist_id}</TableCell>
                    <TableCell>
                      <Badge
                        variant={isSOS ? "destructive" : "outline"}
                        className={`font-semibold ${
                          isSOS ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm shadow-red-500/20" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        {String(l.event_type || "-")}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium text-slate-800">{l.location_label}</TableCell>
                    <TableCell className="text-xs text-slate-600">{l.timestamp}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{String(l.hash_hex || "").slice(0, 14)}…</TableCell>
                    <TableCell className="text-xs font-mono text-slate-700">{coords}</TableCell>

                    {isSOS ? (
                      <>
                        <TableCell>
                          <Badge
                            variant={ticketBadgeVariant(ticketStatus)}
                            className={`font-mono ${
                              ticketStatus === "CONFIRMED"
                                ? "bg-gradient-to-r from-yellow-600 to-yellow-500 text-white shadow-lg shadow-yellow-500/30"
                                : ticketStatus === "ASSIGNED"
                                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                                  : ticketStatus === "RESOLVED"
                                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/30"
                                    : ""
                            }`}
                          >
                            {ticketStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-slate-600">
                          {l.ticket_assignee || "—"}
                        </TableCell>
                        <TableCell>
                          {!l.ticket_status || ticketStatus === "NEW" ? (
                            <Button
                              size="sm"
                              disabled={loading}
                              onClick={() => handleConfirm(l.id)}
                              className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold shadow-sm transition-all hover:scale-105"
                            >
                              Confirm
                            </Button>
                          ) : ticketStatus === "CONFIRMED" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={loading}
                              onClick={() => handleAssignClick(l.id)}
                              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold shadow-sm transition-all hover:scale-105"
                            >
                              Dispatch
                            </Button>
                          ) : ticketStatus === "ASSIGNED" ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setChatIncidentId(l.id)}
                                className="border-slate-300"
                              >
                                Chat
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={loading}
                                onClick={() => handleResolve(l.id)}
                                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-sm transition-all hover:scale-105"
                              >
                                Resolve
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600 font-medium">Closed</span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-xs text-slate-400">—</TableCell>
                        <TableCell className="text-xs text-slate-400">—</TableCell>
                        <TableCell className="text-xs text-slate-400">—</TableCell>
                      </>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={assigningId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssigningId(null)
            setContext("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatch ticket to unit</DialogTitle>
            <DialogDescription>Select a substation/unit and optionally add instructions.</DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-semibold">Unit</div>
            <ScrollArea className="h-48 rounded-md border p-3">
              <RadioGroup value={selectedSubstation} onValueChange={setSelectedSubstation}>
                {substations.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/40">
                    <RadioGroupItem value={s.id} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.id}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </ScrollArea>

            <div className="text-sm font-semibold">Context (optional)</div>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="E.g., suspected injury, last knownP, vehicle access route…"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssigningId(null)
                setContext("")
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignSubmit} disabled={loading}>
              {loading ? "Dispatching…" : "Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chatIncidentId !== null} onOpenChange={(open) => !open && setChatIncidentId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chat with responder</DialogTitle>
            <DialogDescription>Incident #{chatIncidentId}. Messages are real-time.</DialogDescription>
          </DialogHeader>
          {chatIncidentId !== null && (
            <ChatPanel
              title={`Incident #${chatIncidentId}`}
              messages={messages}
              connected={connected}
              onSend={(body) => sendMessage(body, "authority", "dashboard")}
              senderRole="authority"
              senderId="dashboard"
              callProps={{
                callStatus: callState.callStatus,
                activeCallId: callState.activeCallId,
                incomingCall: callState.incomingCall,
                onStartCall: callState.startCall,
                onAcceptCall: callState.acceptCall,
                onRejectCall: callState.rejectCall,
                onEndCall: callState.endCall,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}