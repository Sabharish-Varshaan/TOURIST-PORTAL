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
  sender_role: string
  sender_id: string | null
  body: string
  created_at: string
}

export type ChatThread =
  | { thread_type: "tourist_authority"; tourist_id: string }
  | { thread_type: "authority_responder"; incident_id: number }

export type ChatOptions = {
  onCallMessage?: (data: Record<string, unknown>) => void
}

export function useChat(thread: ChatThread | null, options?: ChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const onCallMessageRef = useRef(options?.onCallMessage)
  onCallMessageRef.current = options?.onCallMessage

  const apiBase = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") : ""

  const loadMessages = useCallback(async () => {
    if (!thread || !apiBase) return
    try {
      const params = new URLSearchParams({ thread_type: thread.thread_type })
      if (thread.thread_type === "tourist_authority") params.set("tourist_id", thread.tourist_id)
      else params.set("incident_id", String(thread.incident_id))
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
  }, [thread?.thread_type, thread && "tourist_id" in thread ? thread.tourist_id : null, thread && "incident_id" in thread ? thread.incident_id : null])

  useEffect(() => {
    if (!thread) return
    const wsUrl = `${getWsUrl()}/ws/chat`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({
        action: "subscribe",
        thread_type: thread.thread_type,
        tourist_id: thread.thread_type === "tourist_authority" ? thread.tourist_id : undefined,
        incident_id: thread.thread_type === "authority_responder" ? thread.incident_id : undefined,
      }))
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
  }, [thread?.thread_type, thread && "tourist_id" in thread ? thread.tourist_id : null, thread && "incident_id" in thread ? thread.incident_id : null])

  const sendCallAction = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }, [])

  const sendMessage = useCallback(
    async (body: string, senderRole: string, senderId?: string) => {
      if (!thread || !body.trim()) return
      const payload = {
        thread_type: thread.thread_type,
        tourist_id: thread.thread_type === "tourist_authority" ? thread.tourist_id : undefined,
        incident_id: thread.thread_type === "authority_responder" ? thread.incident_id : undefined,
        sender_role: senderRole,
        sender_id: senderId ?? null,
        body: body.trim(),
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

  return { messages, connected, sendMessage, sendCallAction, loadMessages }
}
