"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "./chat-panel"
import CallDialog from "./call-dialog"

interface ResponderTouristChatProps {
  touristId: string
  incidentId: number
  responderId: string
}

export default function ResponderTouristChat({ touristId, incidentId, responderId }: ResponderTouristChatProps) {
  const [activeWebRTCCallId, setActiveWebRTCCallId] = useState<string | null>(null)
  const [isCallInitiator, setIsCallInitiator] = useState(false)

  // Validate props first (before hooks)
  const hasValidProps = touristId && incidentId && responderId

  const thread = hasValidProps 
    ? { thread_type: "responder_tourist" as const, tourist_id: touristId, incident_id: incidentId }
    : null
  
  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})
  
  const { messages, connected, sendMessage, sendCallAction, sendWebRTCSignal } = useChat(thread, {
    onCallMessage: (data) => callMessageRef.current(data),
    onWebRTCSignal: (callId, signal) => {
      // WebRTC signal will be handled by CallDialog
    },
  })
  
  const callState = useCallState(thread, sendCallAction, { callerRole: "responder", callerId: responderId || "" })
  
  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      callState.handleMessage(data)
      
      // Handle WebRTC call lifecycle
      if (data.type === "incoming_call") {
        console.log("📞 ResponderTouristChat: Incoming call from tourist", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(false)
      } else if (data.type === "call_started") {
        console.log("📞 ResponderTouristChat: Call started", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(true)
      } else if (data.type === "call_accepted") {
        console.log("📞 ResponderTouristChat: Call accepted", data.call_id)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        console.log("📞 ResponderTouristChat: Call ended/rejected", data.call_id)
        setActiveWebRTCCallId(null)
        setIsCallInitiator(false)
      }
    }
    callMessageRef.current = enhancedHandler
  }, [callState.handleMessage])

  // Show error states after all hooks
  if (!touristId || !incidentId) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="text-gray-600">
          <p className="font-semibold mb-2">Chat with Tourist</p>
          <p className="text-sm text-gray-500">Missing data: tourist={touristId}, incident={incidentId}, responder={responderId}</p>
        </div>
      </div>
    )
  }

  if (!responderId) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="text-gray-600">
          <p className="font-semibold mb-2">Chat with Tourist</p>
          <p className="text-sm text-gray-500">Waiting for responder ID to be set...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ChatPanel
        title="Chat with Tourist"
        messages={messages}
        connected={connected}
        onSend={(body) => sendMessage(body, "responder", responderId)}
        senderRole="responder"
        senderId={responderId}
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
        callerInfo={`Tourist ${touristId.slice(-8)}`}
      />
    </>
  )
}
