"use client"

import { useEffect, useMemo, useRef, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface TouristChatbotProps {
  touristId: string
}

interface ChatMsg {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  ts: number
}

export default function TouristChatbot({ touristId }: TouristChatbotProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [shareLocation, setShareLocation] = useState(true)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const storeKey = useMemo(() => `chat:${touristId}`, [touristId])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey)
      if (saved) {
        setMessages(JSON.parse(saved))
      } else {
        greet()
      }
    } catch {
      greet()
    }
  }, [storeKey])

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(messages))
    } catch {}
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [messages, storeKey])

  const greet = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        ts: Date.now(),
        content:
          "Hi! I'm your travel assistant. Ask me about nearby help centres, routes, basic translations, safety tips, or your eKYC/QR details."
      }
    ])
  }

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    setInput("")
    const user: ChatMsg = { id: crypto.randomUUID(), role: "user", content: msg, ts: Date.now() }
    setMessages((m) => [...m, user])
    setLoading(true)

    try {
      const body: Record<string, any> = {
        message: msg,
        session_id: touristId,
        location: null
      }

      // optionally attach location once per turn
      if (shareLocation && typeof window !== "undefined" && navigator.geolocation) {
        try {
          const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (p) => resolve(p.coords),
              () => resolve(null),
              { enableHighAccuracy: true, maximumAge: 10_000, timeout: 6_000 }
            )
          })
          if (coords) {
            body.location = `${coords.latitude},${coords.longitude}`
          }
        } catch {}
      }

      const res = await fetch(`${API}/chatbot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const replyText = (data.response || data.message || "Sorry, I couldn't process that.") as string

      const assistant: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: replyText,
        ts: Date.now()
      }
      setMessages((m) => [...m, assistant])
    } catch (e) {
      console.error("Chat error:", e)
      const assistant: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ Chat request failed. Please try again.",
        ts: Date.now()
      }
      setMessages((m) => [...m, assistant])
    } finally {
      setLoading(false)
    }
  }

  const quickAsk = (q: string) => sendMessage(q)

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Travel Assistant Chat</h2>
        <div className="flex items-center space-x-3">
          <label className="inline-flex items-center space-x-2 text-xs text-gray-600">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={shareLocation}
              onChange={(e) => setShareLocation(e.target.checked)}
            />
            <span>Share location with replies</span>
          </label>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
        {messages.map((m) => (
          <div key={m.id} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                m.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-3 flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-white text-gray-500 border border-gray-200">
              Typing…
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 mt-4">
        {[
          "Show nearest help center",
          "Share safety tips for this area",
          "Translate: Where is the bus station?",
          "Best route to the city museum"
        ].map((t) => (
          <button
            key={t}
            onClick={() => quickAsk(t)}
            className="px-3 py-1.5 rounded-full text-xs border border-gray-300 bg-white hover:bg-gray-100"
          >
            {t}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-4 flex items-center space-x-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="Ask anything about routes, safety, eKYC, or your QR…"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || input.trim().length === 0}
          style={{ backgroundColor: loading ? "#94a3b8" : "var(--primary)" }}
          className="text-white px-5 py-3 rounded-2xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
        >
          Send
        </button>
      </div>

      <p className="text-[10px] text-gray-500 mt-2">
        This chat may use your approximate location to improve answers when enabled.
      </p>
    </div>
  )
}
