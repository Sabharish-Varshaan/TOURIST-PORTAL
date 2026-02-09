"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "./chat-panel"
import CallDialog from "./call-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Shield, Siren } from "lucide-react"

interface TouristDualChatProps {
  touristId: string
}

export default function TouristDualChat({ touristId }: TouristDualChatProps) {
  const [activeTab, setActiveTab] = useState<"authority" | "responder">("authority")
  const [incidentId, setIncidentId] = useState<number | null>(null)
  const [responderInfo, setResponderInfo] = useState<any>(null)
  const [hasAssignedIncident, setHasAssignedIncident] = useState(false)
  
  // WebRTC call states for both chats
  const [authorityCallId, setAuthorityCallId] = useState<string | null>(null)
  const [responderCallId, setResponderCallId] = useState<string | null>(null)
  const [authorityCallInitiator, setAuthorityCallInitiator] = useState(false)
  const [responderCallInitiator, setResponderCallInitiator] = useState(false)

  // Fetch assigned incident for responder chat
  useEffect(() => {
    const fetchAssignedIncident = async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res = await fetch(`${api}/api/tourist/${touristId}/assigned-incident`)
        if (!res.ok) {
          setIncidentId(null)
          setResponderInfo(null)
          setHasAssignedIncident(false)
          return
        }
        const data = await res.json()
        
        if (data.has_assigned_incident && data.incident_id && data.responder_info) {
          setIncidentId(data.incident_id)
          setResponderInfo(data.responder_info)
          setHasAssignedIncident(true)
        } else {
          setIncidentId(null)
          setResponderInfo(null)
          setHasAssignedIncident(false)
        }
      } catch (err) {
        setIncidentId(null)
        setResponderInfo(null)
        setHasAssignedIncident(false)
      }
    }

    fetchAssignedIncident()
    const interval = window.setInterval(fetchAssignedIncident, 3000)
    return () => window.clearInterval(interval)
  }, [touristId])

  // Authority chat setup
  const authorityThread = { thread_type: "tourist_authority" as const, tourist_id: touristId }
  const authorityCallMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})
  
  const {
    messages: authorityMessages,
    connected: authorityConnected,
    sendMessage: sendAuthorityMessage,
    sendCallAction: sendAuthorityCallAction,
    sendWebRTCSignal: sendAuthorityWebRTCSignal,
  } = useChat(authorityThread, {
    onCallMessage: (data) => authorityCallMessageRef.current(data),
  })
  
  const authorityCallState = useCallState(authorityThread, sendAuthorityCallAction, {
    callerRole: "tourist",
    callerId: touristId,
  })

  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      authorityCallState.handleMessage(data)
      
      if (data.type === "incoming_call") {
        setAuthorityCallId(data.call_id as string)
        setAuthorityCallInitiator(false)
      } else if (data.type === "call_started") {
        setAuthorityCallId(data.call_id as string)
        setAuthorityCallInitiator(true)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        setAuthorityCallId(null)
        setAuthorityCallInitiator(false)
      }
    }
    authorityCallMessageRef.current = enhancedHandler
  }, [authorityCallState.handleMessage])

  // Responder chat setup
  const responderThread = incidentId && responderInfo
    ? { thread_type: "responder_tourist" as const, tourist_id: touristId, incident_id: incidentId }
    : null

  const responderCallMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})

  const {
    messages: responderMessages,
    connected: responderConnected,
    sendMessage: sendResponderMessage,
    sendCallAction: sendResponderCallAction,
    sendWebRTCSignal: sendResponderWebRTCSignal,
  } = useChat(responderThread, {
    onCallMessage: (data) => responderCallMessageRef.current(data),
  })

  const responderCallState = useCallState(responderThread, sendResponderCallAction, {
    callerRole: "tourist",
    callerId: touristId,
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
      <Card className="bg-slate-50 rounded-3xl shadow-xl border border-slate-200">
        <CardContent className="p-6 bg-white/80 rounded-2xl">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Communication Center
            </h3>
            <p className="text-xs text-gray-600">
              Chat with authorities and responders
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "authority" | "responder")}>
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 border border-slate-200">
              <TabsTrigger value="authority" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-700 border-slate-200">
                <Shield className="w-4 h-4" />
                Authority
              </TabsTrigger>
              <TabsTrigger value="responder" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-700 border-slate-200" disabled={!hasAssignedIncident}>
                <Siren className="w-4 h-4" />
                Responder
                {hasAssignedIncident && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                    Active
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="authority" className="mt-0">
              <ChatPanel
                className="bg-white border-slate-200"
                title="Chat with Authority"
                messages={authorityMessages}
                connected={authorityConnected}
                onSend={(body) => sendAuthorityMessage(body, "tourist", touristId)}
                senderRole="tourist"
                senderId={touristId}
                callProps={{
                  callStatus: authorityCallState.callStatus,
                  activeCallId: authorityCallState.activeCallId,
                  incomingCall: authorityCallState.incomingCall,
                  onStartCall: authorityCallState.startCall,
                  onAcceptCall: authorityCallState.acceptCall,
                  onRejectCall: authorityCallState.rejectCall,
                  onEndCall: authorityCallState.endCall,
                }}
              />
            </TabsContent>

            <TabsContent value="responder" className="mt-0">
              {hasAssignedIncident && responderInfo ? (
                <>
                  <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                    <div className="text-xs font-semibold text-blue-900 mb-1">
                      🚨 Emergency Response Active
                    </div>
                    <div className="text-xs text-blue-700">
                      Connected to: <span className="font-semibold">{responderInfo.name || "Responder"}</span>
                    </div>
                    {responderInfo.station && (
                      <div className="text-xs text-blue-600">
                        Station: {responderInfo.station}
                      </div>
                    )}
                  </div>
                  <ChatPanel
                    className="bg-white border-slate-200"
                    title={`Chat with ${responderInfo.name || "Responder"}`}
                    messages={responderMessages}
                    connected={responderConnected}
                    onSend={(body) => sendResponderMessage(body, "tourist", touristId)}
                    senderRole="tourist"
                    senderId={touristId}
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
                </>
              ) : (
                <div className="text-center py-12 text-sm text-gray-500">
                  <Siren className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <div className="font-semibold mb-1">No Active Emergency Response</div>
                  <div className="text-xs">
                    Responder chat will be available when your SOS is assigned
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Call Dialogs */}
      <CallDialog
        callId={authorityCallId}
        isInitiator={authorityCallInitiator}
        onSignal={(signal) => {
          if (authorityCallId) {
            sendAuthorityWebRTCSignal(authorityCallId, signal)
          }
        }}
        onEndCall={() => {
          if (authorityCallId && authorityCallState.activeCallId) {
            authorityCallState.endCall(authorityCallState.activeCallId)
          }
          setAuthorityCallId(null)
          setAuthorityCallInitiator(false)
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
