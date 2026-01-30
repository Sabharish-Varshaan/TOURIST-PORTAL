"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "./chat-panel"
import CallDialog from "./call-dialog"

interface AuthorityTouristChatProps {
  touristId: string
}

export default function AuthorityTouristChat({ touristId }: AuthorityTouristChatProps) {
  const [activeWebRTCCallId, setActiveWebRTCCallId] = useState<string | null>(null)
  const [isCallInitiator, setIsCallInitiator] = useState(false)
  
  const thread = touristId 
    ? { thread_type: "tourist_authority" as const, tourist_id: touristId }
    : null
  
  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})
  
  const { messages, connected, sendMessage, sendCallAction, sendWebRTCSignal } = useChat(thread, {
    onCallMessage: (data) => callMessageRef.current(data),
    onWebRTCSignal: (callId, signal) => {
      // WebRTC signal will be handled by CallDialog
    },
  })
  
  const callState = useCallState(thread, sendCallAction, { callerRole: "authority", callerId: "authority" })
  
  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      callState.handleMessage(data)
      
      // Handle WebRTC call lifecycle
      if (data.type === "incoming_call") {
        console.log("📞 AuthorityTouristChat: Incoming call from tourist", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(false)
      } else if (data.type === "call_started") {
        console.log("📞 AuthorityTouristChat: Call started", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(true)
      } else if (data.type === "call_accepted") {
        console.log("📞 AuthorityTouristChat: Call accepted", data.call_id)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        console.log("📞 AuthorityTouristChat: Call ended/rejected", data.call_id)
        setActiveWebRTCCallId(null)
        setIsCallInitiator(false)
      }
    }
    callMessageRef.current = enhancedHandler
  }, [callState.handleMessage])

  if (!touristId) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="text-gray-600">
          <p className="font-semibold mb-2">Chat with Tourist</p>
          <p className="text-sm text-gray-500">Select a tourist to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ChatPanel
        title={`Chat with Tourist ${touristId.slice(-8)}`}
        messages={messages}
        connected={connected}
        onSend={(body) => sendMessage(body, "authority", "authority")}
        senderRole="authority"
        senderId="authority"
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
      />
    </>
  )
}
