"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/chat"
import type { IncomingCall } from "@/lib/use-call-state"

interface ChatPanelProps {
  messages: ChatMessage[]
  connected: boolean
  onSend: (body: string) => void
  senderRole: string
  senderId?: string
  title?: string
  className?: string
  callProps?: {
    callStatus: "idle" | "calling" | "in_call"
    activeCallId: string | null
    incomingCall: IncomingCall | null
    onStartCall: () => void
    onAcceptCall: (callId: string) => void
    onRejectCall: (callId: string) => void
    onEndCall: (callId: string) => void
  }
}

export default function ChatPanel({
  messages,
  connected,
  onSend,
  senderRole,
  senderId,
  title = "Chat",
  className,
  callProps,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput("")
  }

  return (
    <div className={cn("flex flex-col border rounded-lg bg-card", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b gap-2">
        <span className="font-medium text-sm truncate">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {callProps && (
            <Button
              type="button"
              size="sm"
              variant={callProps.callStatus === "in_call" ? "destructive" : "outline"}
              className={callProps.callStatus !== "in_call" ? "border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900" : undefined}
              disabled={!connected || callProps.callStatus === "calling"}
              onClick={() => {
                console.log("📞 Call button clicked!", { 
                  callStatus: callProps.callStatus, 
                  activeCallId: callProps.activeCallId,
                  connected 
                })
                if (callProps.callStatus === "in_call" && callProps.activeCallId) {
                  console.log("📞 Ending call:", callProps.activeCallId)
                  callProps.onEndCall(callProps.activeCallId)
                } else {
                  console.log("📞 Starting new call...")
                  callProps.onStartCall()
                }
              }}
            >
              {callProps.callStatus === "calling"
                ? "Calling…"
                : callProps.callStatus === "in_call"
                  ? "End call"
                  : "Call"}
            </Button>
          )}
          <span
            className={cn(
              "text-xs rounded-full px-2 py-0.5",
              connected ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
            )}
          >
            {connected ? "Live" : "Offline"}
          </span>
        </div>
      </div>
      <Dialog
        open={!!callProps?.incomingCall}
        onOpenChange={(open) => {
          if (!open && callProps?.incomingCall) {
            callProps.onRejectCall(callProps.incomingCall.call_id)
          }
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Incoming call</DialogTitle>
            <DialogDescription>
              {callProps?.incomingCall
                ? `${callProps.incomingCall.caller_role} ${callProps.incomingCall.caller_id ? `(${callProps.incomingCall.caller_id})` : ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {callProps?.incomingCall && (
              <>
                <Button
                  variant="outline"
                  onClick={() => callProps.onRejectCall(callProps.incomingCall!.call_id)}
                  className="border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"
                >
                  Reject
                </Button>
                <Button
                  onClick={() => callProps.onAcceptCall(callProps.incomingCall!.call_id)}
                  className="bg-slate-800 text-white hover:bg-slate-700 hover:text-white"
                >
                  Accept
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex-1 min-h-[200px] max-h-[320px] overflow-auto p-2" ref={scrollRef}>
        <div className="space-y-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No messages yet. Say hello!</p>
          )}
          {messages.map((m) => {
            const isMe = m.sender_role === senderRole && (senderId ? m.sender_id === senderId : true)
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm",
                    isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {m.body}
                </div>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {m.sender_role} · {m.created_at.slice(11, 16)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          disabled={!connected}
        />
        <Button type="submit" size="sm" disabled={!input.trim() || !connected}>
          Send
        </Button>
      </form>
    </div>
  )
}
