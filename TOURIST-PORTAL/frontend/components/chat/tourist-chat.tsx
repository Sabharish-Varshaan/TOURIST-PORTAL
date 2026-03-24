"use client"

import { useRef, useEffect } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "./chat-panel"
import CallDialog from "./call-dialog"
import { useState } from "react"

interface TouristChatProps {
  touristId: string
}

export default function TouristChat({ touristId }: TouristChatProps) {
  const [activeWebRTCCallId, setActiveWebRTCCallId] = useState<string | null>(null)
  const [isCallInitiator, setIsCallInitiator] = useState(false)
  const activeCallIdRef = useRef<string | null>(null)
  const incomingRtcRef = useRef<((payload: unknown) => void) | null>(null)

  const thread = { thread_type: "tourist_authority" as const, tourist_id: touristId }
  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})

  useEffect(() => {
    activeCallIdRef.current = activeWebRTCCallId
  }, [activeWebRTCCallId])

  const { messages, connected, sendMessage, sendCallAction, sendWebRTCSignal } = useChat(thread, {
    onCallMessage: (data) => callMessageRef.current(data),
    onWebRTCSignal: (callId, signal) => {
      if (callId === activeCallIdRef.current) incomingRtcRef.current?.(signal)
    },
  })
  
  const callState = useCallState(thread, sendCallAction, { callerRole: "tourist", callerId: touristId })
  
  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      callState.handleMessage(data)
      
      // Handle WebRTC call lifecycle
      if (data.type === "incoming_call") {
        console.log("📞 TouristChat: Incoming call from authority", data.call_id)
        const cid = data.call_id as string
        activeCallIdRef.current = cid
        setActiveWebRTCCallId(cid)
        setIsCallInitiator(false)
      } else if (data.type === "call_started") {
        console.log("📞 TouristChat: Call started", data.call_id)
        const cid = data.call_id as string
        activeCallIdRef.current = cid
        setActiveWebRTCCallId(cid)
        setIsCallInitiator(true)
      } else if (data.type === "call_accepted") {
        console.log("📞 TouristChat: Call accepted", data.call_id)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        console.log("📞 TouristChat: Call ended/rejected", data.call_id)
        activeCallIdRef.current = null
        setActiveWebRTCCallId(null)
        setIsCallInitiator(false)
      }
    }
    callMessageRef.current = enhancedHandler
  }, [callState.handleMessage])

  return (
    <>
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-900 mb-1">💬 Authority Communication</h3>
          <p className="text-xs text-gray-600">Chat directly with authorities for help and updates</p>
        </div>
        <ChatPanel
          title="Chat with Authority"
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
      </div>
      <CallDialog
        callId={activeWebRTCCallId}
        isInitiator={isCallInitiator}
        incomingSignalRef={incomingRtcRef}
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
