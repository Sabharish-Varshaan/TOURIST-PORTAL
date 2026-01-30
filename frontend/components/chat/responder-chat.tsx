"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "./chat-panel"
import CallDialog from "./call-dialog"

interface ResponderChatProps {
  touristId: string
}

export default function ResponderChat({ touristId }: ResponderChatProps) {
  console.log("ResponderChat: Component mounted with touristId:", touristId)
  
  const [incidentId, setIncidentId] = useState<number | null>(null)
  const [responderInfo, setResponderInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeWebRTCCallId, setActiveWebRTCCallId] = useState<string | null>(null)
  const [isCallInitiator, setIsCallInitiator] = useState(false)
  const [webrtcSignalHandler, setWebrtcSignalHandler] = useState<((callId: string, signal: any) => void) | null>(null)

  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})

  // Fetch assigned incident
  useEffect(() => {
    const fetchAssignedIncident = async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res = await fetch(`${api}/api/tourist/${touristId}/assigned-incident`)
        if (!res.ok) throw new Error("Failed to fetch assigned incident")
        const data = await res.json()
        
        console.log("ResponderChat: Fetched assigned incident data:", data)
        
        if (data.has_assigned_incident && data.incident_id && data.responder_info) {
          console.log("ResponderChat: Setting up responder_tourist thread with incident:", data.incident_id)
          setIncidentId(data.incident_id)
          setResponderInfo(data.responder_info)
        } else {
          console.log("ResponderChat: No assigned incident found", { has_assigned_incident: data.has_assigned_incident, incident_id: data.incident_id, has_responder_info: !!data.responder_info })
          setError("No assigned responder yet")
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to load responder info"
        console.error("ResponderChat: Error fetching incident:", errMsg)
        setError(errMsg)
      } finally {
        setLoading(false)
      }
    }

    fetchAssignedIncident()
    
    // Also poll every 3 seconds in case incident gets assigned after page load
    const interval = window.setInterval(fetchAssignedIncident, 3000)
    return () => window.clearInterval(interval)
  }, [touristId])

  // Setup chat thread with responder if incident_id is available
  const thread = incidentId && responderInfo
    ? { thread_type: "responder_tourist" as const, tourist_id: touristId, incident_id: incidentId }
    : null

  console.log("ResponderChat: Current thread state:", { thread, incidentId, touristId, hasResponderInfo: !!responderInfo })

  const { messages, connected, sendMessage, sendCallAction, sendWebRTCSignal } = useChat(thread, {
    onCallMessage: (data) => callMessageRef.current(data),
    onWebRTCSignal: (callId, signal) => {
      webrtcSignalHandler?.(callId, signal)
    },
  })

  const callState = useCallState(thread, sendCallAction, { callerRole: "tourist", callerId: touristId })

  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      callState.handleMessage(data)
      
      // Handle WebRTC call lifecycle
      if (data.type === "incoming_call") {
        console.log("📞 ResponderChat: Incoming call from responder", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(false)
      } else if (data.type === "call_started") {
        console.log("📞 ResponderChat: Call started", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(true)
      } else if (data.type === "call_accepted") {
        console.log("📞 ResponderChat: Call accepted", data.call_id)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        console.log("📞 ResponderChat: Call ended/rejected", data.call_id)
        setActiveWebRTCCallId(null)
        setIsCallInitiator(false)
      }
    }
    callMessageRef.current = enhancedHandler
  }, [callState.handleMessage])

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="text-gray-500 text-center py-8">Loading responder information...</div>
      </div>
    )
  }

  // Always show chat if incident is assigned, even during error
  if (!incidentId || !responderInfo) {
    return null // Don't show anything if no incident assigned
  }

  return (
    <>
      <div className="text-xs text-gray-400 mb-2 space-y-0.5 bg-blue-50 p-2 rounded">
        <div>Thread: responder_tourist | Tourist: {touristId.slice(-8)} | Incident: {incidentId} | Connected: {connected ? "✅" : "❌"}</div>
        <div>Messages: {messages.length} | Responder: {responderInfo?.responder_name}</div>
      </div>
      <ChatPanel
        title={`Chat with Responder${responderInfo ? ` (${responderInfo.substation_name})` : ""}`}
        messages={messages}
        connected={connected}
        onSend={(body) => sendMessage(body, "tourist", touristId)}
        senderRole="tourist"
        senderId={touristId}
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
      <CallDialog
        callId={activeWebRTCCallId}
        isInitiator={isCallInitiator}
        onSignal={(signal) => {
          if (activeWebRTCCallId) {
            sendWebRTCSignal(activeWebRTCCallId, signal)
          }
        }}
        onEndCall={() => {
          if (activeWebRTCCallId && callState.activeCallId) {
            callState.endCall(callState.activeCallId)
          }
          setActiveWebRTCCallId(null)
          setIsCallInitiator(false)
        }}
        callerInfo={responderInfo?.assignee_label}
      />
    </>
  )
}
