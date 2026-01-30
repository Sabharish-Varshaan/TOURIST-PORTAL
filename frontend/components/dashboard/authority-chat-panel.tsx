"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "@/components/chat/chat-panel"
import CallDialog from "@/components/chat/call-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface AuthorityChatPanelProps {
  tourists: any[]
}

export default function AuthorityChatPanel({ tourists }: AuthorityChatPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTourist, setSelectedTourist] = useState<any>(null)
  const [activeWebRTCCallId, setActiveWebRTCCallId] = useState<string | null>(null)
  const [isCallInitiator, setIsCallInitiator] = useState(false)

  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      alert("Enter a Tourist ID or name to chat.")
      return
    }

    let found = tourists.find((x) => x.id && x.id.toLowerCase() === q)
    if (!found) {
      found = tourists.find(
        (x) => (x.id && x.id.toLowerCase().includes(q)) || (x.name && x.name.toLowerCase().includes(q)),
      )
    }

    if (!found) {
      alert("No tourist found with that ID / query.")
      setSelectedTourist(null)
      return
    }

    setSelectedTourist(found)
  }

  const chatThread = selectedTourist
    ? { thread_type: "tourist_authority" as const, tourist_id: selectedTourist.id }
    : null
    
  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})
  
  const { messages, connected, sendMessage, sendCallAction, sendWebRTCSignal } = useChat(chatThread, {
    onCallMessage: (data) => callMessageRef.current(data),
    onWebRTCSignal: (callId, signal) => {
      // WebRTC signal will be handled by CallDialog
    },
  })
  
  const callState = useCallState(chatThread, sendCallAction, {
    callerRole: "authority",
    callerId: "dashboard",
  })
  
  useEffect(() => {
    const enhancedHandler = (data: Record<string, unknown>) => {
      callState.handleMessage(data)
      
      // Handle WebRTC call lifecycle
      if (data.type === "incoming_call") {
        console.log("📞 AuthorityChatPanel: Incoming call from tourist", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(false)
      } else if (data.type === "call_started") {
        console.log("📞 AuthorityChatPanel: Call started", data.call_id)
        setActiveWebRTCCallId(data.call_id as string)
        setIsCallInitiator(true)
      } else if (data.type === "call_accepted") {
        console.log("📞 AuthorityChatPanel: Call accepted", data.call_id)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        console.log("📞 AuthorityChatPanel: Call ended/rejected", data.call_id)
        setActiveWebRTCCallId(null)
        setIsCallInitiator(false)
      }
    }
    callMessageRef.current = enhancedHandler
  }, [callState.handleMessage])

  return (
    <>
      <Card className="dashboard-card fade-in-up">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-sm font-semibold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
            Authority Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter tourist ID or name to chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch()
              }}
              className="border-slate-300/60 focus:border-slate-400/60 focus:ring-2 focus:ring-slate-200/50 transition-all bg-white/80"
            />
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold shadow-sm transition-all hover:scale-105"
            >
              Chat
            </Button>
          </div>

          {selectedTourist && (
            <div className="mb-3 flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div>
                <div className="text-sm font-semibold">{selectedTourist.name}</div>
                <div className="text-xs text-muted-foreground font-mono">ID: {selectedTourist.id.slice(-12)}</div>
              </div>
              <Badge variant={selectedTourist.status === "ALERT" ? "destructive" : "secondary"}>
                {selectedTourist.status}
              </Badge>
            </div>
          )}

          {selectedTourist ? (
            <ChatPanel
              title={`Chat with ${selectedTourist.name}`}
              messages={messages}
              connected={connected}
              onSend={(body) => sendMessage(body, "authority", "dashboard")}
              senderRole="authority"
              senderId="dashboard"
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
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <div className="mb-2">💬</div>
              <div>Search for a tourist above to start chatting</div>
            </div>
          )}
        </CardContent>
      </Card>
      
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
