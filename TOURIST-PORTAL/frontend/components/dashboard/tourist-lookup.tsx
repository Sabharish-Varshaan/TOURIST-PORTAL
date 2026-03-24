"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "@/components/chat/chat-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface TouristLookupProps {
  tourists: any[]
  logs: any[]
}

export default function TouristLookup({ tourists, logs }: TouristLookupProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTourist, setSelectedTourist] = useState<any>(null)
  const [showIncidents, setShowIncidents] = useState(false)

  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      alert("Enter a Tourist ID to lookup.")
      return
    }

    let found = tourists.find((x) => x.id && x.id.toLowerCase() === q)
    if (!found) {
      found = tourists.find(
        (x) => (x.id && x.id.toLowerCase().includes(q)) || (x.name && x.name.toLowerCase().includes(q)),
      )
    }

    if (!found) {
      alert("No tourist found with that ID / query.")
      setSelectedTourist(null)
      return
    }

    setSelectedTourist(found)
    setShowIncidents(false)
  }

  const touristIncidents = selectedTourist ? logs.filter((l) => l.tourist_id === selectedTourist.id) : []
  const chatThread = selectedTourist
    ? { thread_type: "tourist_authority" as const, tourist_id: selectedTourist.id }
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

  return (
    <Card className="py-0 dashboard-card fade-in-up">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-sm font-semibold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
          Tourist lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter tourist ID (or name)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch()
            }}
            className="border-slate-300/60 focus:border-slate-400/60 focus:ring-2 focus:ring-slate-200/50 transition-all bg-white/80"
          />
          <Button
            onClick={handleSearch}
            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold shadow-sm transition-all hover:scale-105"
          >
            Search
          </Button>
        </div>

        {selectedTourist ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold truncate">{selectedTourist.name}</div>
                <div className="text-xs text-muted-foreground font-mono">ID: {selectedTourist.id}</div>
              </div>
              <Badge variant={selectedTourist.status === "ALERT" ? "destructive" : "secondary"}>
                {selectedTourist.status}
              </Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-slate-100/60 transition-colors">
                <div className="text-xs text-slate-600">Phone</div>
                <div className="mt-1 font-medium text-slate-800">{selectedTourist.phone}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-slate-100/60 transition-colors">
                <div className="text-xs text-slate-600">Emergency</div>
                <div className="mt-1 font-medium text-slate-800">{selectedTourist.emergency_contact}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-slate-100/60 transition-colors">
                <div className="text-xs text-slate-600">Last check-in</div>
                <div className="mt-1 font-medium text-slate-800 truncate">{selectedTourist.last_checkin}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-slate-100/60 transition-colors">
                <div className="text-xs text-slate-600">Last coords</div>
                <div className="mt-1 font-medium text-slate-800">
                  {selectedTourist.last_lat || "-"}, {selectedTourist.last_lng || "-"}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm hover:bg-slate-100/60 transition-colors">
              <div className="text-xs text-slate-600">eKYC</div>
              <div className="mt-1 font-medium text-slate-800">
                {selectedTourist.kyc_status}{" "}
                {selectedTourist.kyc_doc_type ? `(${selectedTourist.kyc_doc_type})` : ""}
                {selectedTourist.kyc_id_masked ? ` — ${selectedTourist.kyc_id_masked}` : ""}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={handleSearch} className="border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900">
                Refresh
              </Button>
              <Button
                variant={showIncidents ? "secondary" : "outline"}
                onClick={() => setShowIncidents((v) => !v)}
                className={!showIncidents ? "border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900" : undefined}
              >
                {showIncidents ? "Hide history" : "Show history"}
              </Button>
            </div>

            <div className="mt-3">
              <ChatPanel
                title={`Chat with ${selectedTourist.name}`}
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
            </div>

            {showIncidents ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="text-xs font-semibold mb-2 text-slate-800">Incident history</div>
                {touristIncidents.length === 0 ? (
                  <div className="text-sm text-slate-600">No incidents found.</div>
                ) : (
                  <ScrollArea className="h-56 pr-3">
                    <div className="space-y-2">
                      {touristIncidents.map((inc) => (
                        <div key={inc.id} className="rounded-lg border border-slate-200 bg-white/60 p-2 hover:bg-slate-50/80 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-slate-800">
                              {(inc.event_type || "-").toUpperCase()} <span className="text-slate-600">#{inc.id}</span>
                            </div>
                            {inc.ticket_status ? (
                              <Badge variant="outline" className="font-mono border-slate-300 text-slate-700">
                                {inc.ticket_status}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {inc.location_label} • {inc.timestamp}
                          </div>
                          {inc.ticket_assignee ? (
                            <div className="mt-1 text-xs text-slate-600 truncate">Assignee: {inc.ticket_assignee}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">Search by tourist ID to view details.</div>
        )}
      </CardContent>
    </Card>
  )
}
