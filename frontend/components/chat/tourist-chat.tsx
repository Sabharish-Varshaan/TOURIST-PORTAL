"use client"

import { useRef, useEffect } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "./chat-panel"

interface TouristChatProps {
  touristId: string
}

export default function TouristChat({ touristId }: TouristChatProps) {
  const thread = { thread_type: "tourist_authority" as const, tourist_id: touristId }
  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})
  const { messages, connected, sendMessage, sendCallAction } = useChat(thread, {
    onCallMessage: (data) => callMessageRef.current(data),
  })
  const callState = useCallState(thread, sendCallAction, { callerRole: "tourist", callerId: touristId })
  useEffect(() => {
    callMessageRef.current = callState.handleMessage
  }, [callState.handleMessage])

  return (
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
  )
}
