"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "@/components/chat/chat-panel"
import CallDialog from "@/components/chat/call-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Siren } from "lucide-react"

interface DashboardDualChatProps {
  tourists: any[]
}

export default function DashboardDualChat({ tourists }: DashboardDualChatProps) {
  const [activeTab, setActiveTab] = useState<"tourist" | "responder">("tourist")
  
  // Tourist chat state
  const [touristSearchQuery, setTouristSearchQuery] = useState("")
  const [selectedTourist, setSelectedTourist] = useState<any>(null)
  const [touristCallId, setTouristCallId] = useState<string | null>(null)
  const [touristCallInitiator, setTouristCallInitiator] = useState(false)

  // Responder chat state (via incident)
  const [incidentSearchQuery, setIncidentSearchQuery] = useState("")
  const [selectedIncident, setSelectedIncident] = useState<any>(null)
  const [incidents, setIncidents] = useState<any[]>([])
  const [responderCallId, setResponderCallId] = useState<string | null>(null)
  const [responderCallInitiator, setResponderCallInitiator] = useState(false)

  // Fetch incidents for responder chat
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res = await fetch(`${api}/api/logs`)
        if (!res.ok) throw new Error("Failed to fetch incidents")
        const data = await res.json()
        // Filter for SOS incidents that are assigned
        const sosIncidents = data.filter(
          (log: any) =>
            log.event_type?.toLowerCase() === "sos" &&
            log.ticket_status?.toUpperCase() === "ASSIGNED"
        )
        setIncidents(sosIncidents)
      } catch (err) {
        console.error("Failed to fetch incidents:", err)
      }
    }

    fetchIncidents()
    const interval = setInterval(fetchIncidents, 5000)
    return () => clearInterval(interval)
  }, [])

  // Tourist chat handlers
  const handleTouristSearch = () => {
    const q = touristSearchQuery.trim().toLowerCase()
    if (!q) {
      alert("Enter a Tourist ID or name to chat.")
      return
    }

    let found = tourists.find((x) => x.id && x.id.toLowerCase() === q)
    if (!found) {
      found = tourists.find(
        (x) => (x.id && x.id.toLowerCase().includes(q)) || (x.name && x.name.toLowerCase().includes(q))
      )
    }

    if (!found) {
      alert("No tourist found with that ID / query.")
      setSelectedTourist(null)
      return
    }

    setSelectedTourist(found)
  }

  // Responder chat handlers
  const handleIncidentSearch = () => {
    const q = incidentSearchQuery.trim()
    if (!q) {
      alert("Enter an incident ID to chat with responder.")
      return
    }

    const incidentId = parseInt(q, 10)
    const found = incidents.find((inc) => inc.id === incidentId)

    if (!found) {
      alert("No assigned incident found with that ID.")
      setSelectedIncident(null)
      return
    }

    setSelectedIncident(found)
  }

  // Tourist chat setup
  const touristChatThread = selectedTourist
    ? { thread_type: "tourist_authority" as const, tourist_id: selectedTourist.id }
    : null

  const touristCallMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})

  const {
    messages: touristMessages,
    connected: touristConnected,
    sendMessage: sendTouristMessage,
    sendCallAction: sendTouristCallAction,
    sendWebRTCSignal: sendTouristWebRTCSignal,
  } = useChat(touristChatThread, {
    onCallMessage: (data) => touristCallMessageRef.current(data),
  })

  const touristCallState = useCallState(touristChatThread, sendTouristCallAction, {
    callerRole: "authority",
    callerId: "dashboard",
  })

  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      touristCallState.handleMessage(data)

      if (data.type === "incoming_call") {
        setTouristCallId(data.call_id as string)
        setTouristCallInitiator(false)
      } else if (data.type === "call_started") {
        setTouristCallId(data.call_id as string)
        setTouristCallInitiator(true)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        setTouristCallId(null)
        setTouristCallInitiator(false)
      }
    }
    touristCallMessageRef.current = enhancedHandler
  }, [touristCallState.handleMessage])

  // Responder chat setup
  const responderChatThread = selectedIncident
    ? { thread_type: "authority_responder" as const, incident_id: selectedIncident.id }
    : null

  const responderCallMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})

  const {
    messages: responderMessages,
    connected: responderConnected,
    sendMessage: sendResponderMessage,
    sendCallAction: sendResponderCallAction,
    sendWebRTCSignal: sendResponderWebRTCSignal,
  } = useChat(responderChatThread, {
    onCallMessage: (data) => responderCallMessageRef.current(data),
  })

  const responderCallState = useCallState(responderChatThread, sendResponderCallAction, {
    callerRole: "authority",
    callerId: "dashboard",
  })

  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      responderCallState.handleMessage(data)

      if (data.type === "incoming_call") {
        setResponderCallId(data.call_id as string)
        setResponderCallInitiator(false)
      } else if (data.type === "call_started") {
        setResponderCallId(data.call_id as string)
        setResponderCallInitiator(true)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        setResponderCallId(null)
        setResponderCallInitiator(false)
      }
    }
    responderCallMessageRef.current = enhancedHandler
  }, [responderCallState.handleMessage])

  return (
    <>
      <Card className="dashboard-card fade-in-up">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-sm font-semibold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
            Authority Communication Hub
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="dashboard-hub-tabs [&_[data-slot=tabs-list]]:grid [&_[data-slot=tabs-list]]:w-full [&_[data-slot=tabs-list]]:grid-cols-2 [&_[data-slot=tabs-list]]:mb-4 [&_[data-slot=tabs-list]]:bg-slate-100 [&_[data-slot=tabs-list]]:border [&_[data-slot=tabs-list]]:border-slate-200 [&_[data-slot=tabs-trigger]]:flex [&_[data-slot=tabs-trigger]]:items-center [&_[data-slot=tabs-trigger]]:gap-2 [&_[data-slot=tabs-trigger][data-state=active]]:!bg-white [&_[data-slot=tabs-trigger][data-state=active]]:!text-slate-900 [&_[data-slot=tabs-trigger][data-state=active]]:shadow-sm [&_[data-slot=tabs-trigger]]:!text-slate-700">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tourist" | "responder")}>
              <TabsList>
                <TabsTrigger value="tourist">
                  <Users className="w-4 h-4" />
                  Tourist Chat
                </TabsTrigger>
                <TabsTrigger value="responder">
                  <Siren className="w-4 h-4" />
                  Responder Chat
                {incidents.length > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                    {incidents.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tourist" className="mt-0">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Enter tourist ID or name..."
                  value={touristSearchQuery}
                  onChange={(e) => setTouristSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTouristSearch()
                  }}
                  className="border-slate-300/60 focus:border-slate-400/60 focus:ring-2 focus:ring-slate-200/50 transition-all bg-white/80"
                />
                <Button
                  onClick={handleTouristSearch}
                  className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold shadow-sm transition-all hover:scale-105"
                >
                  Search
                </Button>
              </div>

              {selectedTourist && (
                <div className="mb-3 flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div>
                    <div className="text-sm font-semibold">{selectedTourist.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      ID: {selectedTourist.id.slice(-12)}
                    </div>
                  </div>
                  <Badge variant={selectedTourist.status === "ALERT" ? "destructive" : "secondary"}>
                    {selectedTourist.status}
                  </Badge>
                </div>
              )}

              {selectedTourist ? (
                <ChatPanel
                  title={`Chat with ${selectedTourist.name}`}
                  messages={touristMessages}
                  connected={touristConnected}
                  onSend={(body) => sendTouristMessage(body, "authority", "dashboard")}
                  senderRole="authority"
                  senderId="dashboard"
                  callProps={{
                    callStatus: touristCallState.callStatus,
                    activeCallId: touristCallState.activeCallId,
                    incomingCall: touristCallState.incomingCall,
                    onStartCall: touristCallState.startCall,
                    onAcceptCall: touristCallState.acceptCall,
                    onRejectCall: touristCallState.rejectCall,
                    onEndCall: touristCallState.endCall,
                  }}
                />
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <div>Search for a tourist above to start chatting</div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="responder" className="mt-0">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Enter incident ID..."
                  value={incidentSearchQuery}
                  onChange={(e) => setIncidentSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleIncidentSearch()
                  }}
                  className="border-slate-300/60 focus:border-slate-400/60 focus:ring-2 focus:ring-slate-200/50 transition-all bg-white/80"
                />
                <Button
                  onClick={handleIncidentSearch}
                  className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold shadow-sm transition-all hover:scale-105"
                >
                  Connect
                </Button>
              </div>

              {incidents.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-xs font-semibold text-blue-900 mb-2">
                    Active Incidents ({incidents.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {incidents.slice(0, 5).map((inc) => (
                      <Button
                        key={inc.id}
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIncidentSearchQuery(String(inc.id))
                          setSelectedIncident(inc)
                        }}
                        className="text-xs border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"
                      >
                        #{inc.id} - {inc.tourist_id?.slice(-8)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedIncident && (
                <div className="mb-3 flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50">
                  <div>
                    <div className="text-sm font-semibold">Incident #{selectedIncident.id}</div>
                    <div className="text-xs text-muted-foreground">
                      Tourist: {selectedIncident.tourist_id?.slice(-12)}
                    </div>
                    {selectedIncident.ticket_assignee && (
                      <div className="text-xs text-blue-700 font-semibold">
                        Responder: {selectedIncident.ticket_assignee}
                      </div>
                    )}
                  </div>
                  <Badge variant="destructive">SOS</Badge>
                </div>
              )}

              {selectedIncident ? (
                <ChatPanel
                  title={`Incident #${selectedIncident.id} - Responder Chat`}
                  messages={responderMessages}
                  connected={responderConnected}
                  onSend={(body) => sendResponderMessage(body, "authority", "dashboard")}
                  senderRole="authority"
                  senderId="dashboard"
                  callProps={{
                    callStatus: responderCallState.callStatus,
                    activeCallId: responderCallState.activeCallId,
                    incomingCall: responderCallState.incomingCall,
                    onStartCall: responderCallState.startCall,
                    onAcceptCall: responderCallState.acceptCall,
                    onRejectCall: responderCallState.rejectCall,
                    onEndCall: responderCallState.endCall,
                  }}
                />
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Siren className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <div>Enter an incident ID to chat with responder</div>
                  {incidents.length === 0 && (
                    <div className="text-xs mt-2 text-gray-400">No active incidents at the moment</div>
                  )}
                </div>
              )}
            </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Call Dialogs */}
      <CallDialog
        callId={touristCallId}
        isInitiator={touristCallInitiator}
        onSignal={(signal) => {
          if (touristCallId) {
            sendTouristWebRTCSignal(touristCallId, signal)
          }
        }}
        onEndCall={() => {
          if (touristCallId && touristCallState.activeCallId) {
            touristCallState.endCall(touristCallState.activeCallId)
          }
          setTouristCallId(null)
          setTouristCallInitiator(false)
        }}
      />
      <CallDialog
        callId={responderCallId}
        isInitiator={responderCallInitiator}
        onSignal={(signal) => {
          if (responderCallId) {
            sendResponderWebRTCSignal(responderCallId, signal)
          }
        }}
        onEndCall={() => {
          if (responderCallId && responderCallState.activeCallId) {
            responderCallState.endCall(responderCallState.activeCallId)
          }
          setResponderCallId(null)
          setResponderCallInitiator(false)
        }}
      />
    </>
  )
}
