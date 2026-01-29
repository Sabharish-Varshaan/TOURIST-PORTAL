"use client"

import { useState, useCallback, useRef } from "react"
import type { ChatThread } from "./chat"

export type IncomingCall = {
  call_id: string
  caller_role: string
  caller_id: string
}

export function useCallState(
  thread: ChatThread | null,
  sendCallAction: (payload: Record<string, unknown>) => void,
  opts?: { callerRole: string; callerId?: string }
) {
  const callerRole = opts?.callerRole ?? "tourist"
  const callerId = opts?.callerId ?? ""
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "in_call">("idle")

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string
    if (type === "incoming_call") {
      setIncomingCall({
        call_id: data.call_id as string,
        caller_role: (data.caller_role as string) || "",
        caller_id: (data.caller_id as string) || "",
      })
    } else if (type === "call_started") {
      setActiveCallId((data.call_id as string) || null)
    } else if (type === "call_accepted") {
      setActiveCallId((data.call_id as string) || null)
      setCallStatus("in_call")
    } else if (type === "call_rejected" || type === "call_ended") {
      setIncomingCall(null)
      setActiveCallId(null)
      setCallStatus("idle")
    }
  }, [])

  const startCall = useCallback(() => {
    if (!thread) return
    const call_id = `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setCallStatus("calling")
    sendCallAction({
      action: "start_call",
      call_id,
      thread_type: thread.thread_type,
      tourist_id: thread.thread_type === "tourist_authority" ? thread.tourist_id : undefined,
      incident_id: thread.thread_type === "authority_responder" ? thread.incident_id : undefined,
      caller_role: callerRole,
      caller_id: callerId,
    })
  }, [thread, sendCallAction, callerRole, callerId])

  const acceptCall = useCallback(
    (call_id: string) => {
      sendCallAction({ action: "accept_call", call_id })
      setIncomingCall(null)
      setActiveCallId(call_id)
      setCallStatus("in_call")
    },
    [sendCallAction]
  )

  const rejectCall = useCallback(
    (call_id: string) => {
      sendCallAction({ action: "reject_call", call_id })
      setIncomingCall(null)
    },
    [sendCallAction]
  )

  const endCall = useCallback(
    (call_id: string) => {
      sendCallAction({ action: "end_call", call_id })
      setActiveCallId(null)
      setCallStatus("idle")
    },
    [sendCallAction]
  )

  return {
    incomingCall,
    activeCallId,
    callStatus,
    handleMessage,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  }
}
