"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const getWsUrl = () => {
  if (typeof window === "undefined") return ""
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  return api.replace(/^http/, "ws")
}

export type ChatMessage = {
  id: number
  thread_type: string
  tourist_id: string | null
  incident_id: number | null
  room_id: string | null
  sender_role: string
  sender_id: string | null
  body: string
  created_at: string
}

export type ChatThread =
  | { thread_type: "tourist_authority"; tourist_id: string }
  | { thread_type: "authority_responder"; incident_id: number }
  | { thread_type: "responder_tourist"; tourist_id: string; incident_id: number }
  | { thread_type: "group_room"; room_id: string; tourist_id: string }

export type ChatOptions = {
  onCallMessage?: (data: Record<string, unknown>) => void
  onWebRTCSignal?: (callId: string, signal: any) => void
}

export function useChat(thread: ChatThread | null, options?: ChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const onCallMessageRef = useRef(options?.onCallMessage)
  const onWebRTCSignalRef = useRef(options?.onWebRTCSignal)
  onCallMessageRef.current = options?.onCallMessage
  onWebRTCSignalRef.current = options?.onWebRTCSignal

  const apiBase = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") : ""

  const loadMessages = useCallback(async () => {
    if (!thread || !apiBase) return
    try {
      const params = new URLSearchParams({ thread_type: thread.thread_type })
      
      // Explicitly handle each thread type
      if (thread.thread_type === "tourist_authority" && "tourist_id" in thread) {
        params.set("tourist_id", thread.tourist_id)
      } else if (thread.thread_type === "authority_responder" && "incident_id" in thread) {
        params.set("incident_id", String(thread.incident_id))
      } else if (thread.thread_type === "responder_tourist" && "tourist_id" in thread && "incident_id" in thread) {
        params.set("tourist_id", thread.tourist_id)
        params.set("incident_id", String(thread.incident_id))
      } else if (thread.thread_type === "group_room" && "room_id" in thread) {
        params.set("room_id", thread.room_id)
      }
      
      const res = await fetch(`${apiBase}/api/messages?${params}`)
      const data = await res.json()
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch {
      setMessages([])
    }
  }, [thread, apiBase])

  useEffect(() => {
    if (!thread) {
      setMessages([])
      return
    }
    loadMessages()
  }, [
    thread?.thread_type,
    thread && "tourist_id" in thread ? thread.tourist_id : null,
    thread && "incident_id" in thread ? thread.incident_id : null,
    thread && "room_id" in thread ? thread.room_id : null,
  ])

  useEffect(() => {
    if (!thread) return
    const wsUrl = `${getWsUrl()}/ws/chat`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      const subscribePayload: any = {
        action: "subscribe",
        thread_type: thread.thread_type,
      }
      
      // Explicitly handle each thread type
      if (thread.thread_type === "tourist_authority" && "tourist_id" in thread) {
        subscribePayload.tourist_id = thread.tourist_id
      } else if (thread.thread_type === "authority_responder" && "incident_id" in thread) {
        subscribePayload.incident_id = thread.incident_id
      } else if (thread.thread_type === "responder_tourist" && "tourist_id" in thread && "incident_id" in thread) {
        subscribePayload.tourist_id = thread.tourist_id
        subscribePayload.incident_id = thread.incident_id
      } else if (thread.thread_type === "group_room" && "room_id" in thread) {
        subscribePayload.room_id = thread.room_id
      }
      ws.send(JSON.stringify(subscribePayload))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>
        if (data.type === "new_message" && data.message) {
          setMessages((prev) => {
            const msg = data.message as ChatMessage
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        } else if (data.type === "signaling" && data.call_id && data.payload) {
          // Forward WebRTC signaling to handler
          onWebRTCSignalRef.current?.(data.call_id as string, data.payload)
        } else {
          onCallMessageRef.current?.(data as Record<string, unknown>)
        }
      } catch {
        // ignore
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [
    thread?.thread_type,
    thread && "tourist_id" in thread ? thread.tourist_id : null,
    thread && "incident_id" in thread ? thread.incident_id : null,
    thread && "room_id" in thread ? thread.room_id : null,
  ])

  const sendCallAction = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }, [])

  const sendWebRTCSignal = useCallback((callId: string, signal: any) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: "signaling",
        call_id: callId,
        payload: signal,
      }))
    }
  }, [])

  const sendMessage = useCallback(
    async (body: string, senderRole: string, senderId?: string) => {
      if (!thread || !body.trim()) return
      const payload: any = {
        thread_type: thread.thread_type,
        sender_role: senderRole,
        sender_id: senderId ?? null,
        body: body.trim(),
      }
      
      // Explicitly handle each thread type
      if (thread.thread_type === "tourist_authority" && "tourist_id" in thread) {
        payload.tourist_id = thread.tourist_id
      } else if (thread.thread_type === "authority_responder" && "incident_id" in thread) {
        payload.incident_id = thread.incident_id
      } else if (thread.thread_type === "responder_tourist" && "tourist_id" in thread && "incident_id" in thread) {
        payload.tourist_id = thread.tourist_id
        payload.incident_id = thread.incident_id
      } else if (thread.thread_type === "group_room" && "room_id" in thread) {
        payload.room_id = thread.room_id
        payload.tourist_id = thread.tourist_id
      }
      
      try {
        const res = await fetch(`${apiBase}/api/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(await res.text())
        const msg = await res.json()
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      } catch (e) {
        console.error("Send message failed", e)
      }
    },
    [thread, apiBase]
  )

  return { messages, connected, sendMessage, sendCallAction, sendWebRTCSignal, loadMessages }
}
