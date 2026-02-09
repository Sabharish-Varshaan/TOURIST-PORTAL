"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useWebRTCCall } from "@/lib/use-webrtc-call"

interface CallDialogProps {
  callId: string | null
  isInitiator: boolean
  onSignal: (signal: any) => void
  onEndCall: () => void
  callerInfo?: string
}

export default function CallDialog({
  callId,
  isInitiator,
  onSignal,
  onEndCall,
  callerInfo,
}: CallDialogProps) {
  const {
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    connectionState,
    error,
    localVideoRef,
    remoteVideoRef,
    localAudioRef,
    remoteAudioRef,
    handleSignal,
    acceptCall,
    toggleMute,
    toggleVideo,
    endCall,
  } = useWebRTCCall({
    callId,
    isInitiator,
    onSignal,
    onCallEnded: onEndCall,
  })

  const signalHandlerRef = useRef(handleSignal)
  signalHandlerRef.current = handleSignal

  // Listen for incoming WebRTC signals
  useEffect(() => {
    const handleIncomingSignal = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "signaling" && data.call_id === callId && data.payload) {
          signalHandlerRef.current(data.payload)
        }
      } catch {
        // ignore
      }
    }

    // Note: This would need to be connected to your WebSocket
    // For now, expose the handler globally
    ;(window as any).__webrtcSignalHandler = handleIncomingSignal

    return () => {
      delete (window as any).__webrtcSignalHandler
    }
  }, [callId])

  if (!callId) return null

  return (
    <Dialog open={!!callId} onOpenChange={() => endCall()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isInitiator ? "Calling..." : `Incoming call${callerInfo ? ` from ${callerInfo}` : ""}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection State */}
          {connectionState && (
            <div className="text-center text-sm">
              <span
                className={`inline-block px-3 py-1 rounded-full ${
                  connectionState === "connected"
                    ? "bg-green-100 text-green-800"
                    : connectionState === "connecting"
                      ? "bg-yellow-100 text-yellow-800"
                      : connectionState === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                }`}
              >
                {connectionState}
              </span>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Video/Audio Elements */}
          <div className="grid grid-cols-2 gap-4">
            {/* Remote Video (larger) */}
            <div className="col-span-2 bg-gray-900 rounded-lg overflow-hidden aspect-video relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <audio ref={remoteAudioRef} autoPlay />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  Waiting for other party...
                </div>
              )}
            </div>

            {/* Local Video (smaller) */}
            <div className="col-span-2 bg-gray-800 rounded-lg overflow-hidden aspect-video max-h-32 relative">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              <audio ref={localAudioRef} autoPlay muted />
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                  Initializing...
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3">
            {!isInitiator && !localStream && (
              <Button onClick={acceptCall} className="bg-green-600 text-white hover:bg-green-700">
                Accept Call
              </Button>
            )}

            {localStream && (
              <>
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  onClick={toggleMute}
                  size="sm"
                >
                  {isMuted ? "🔇 Unmute" : "🔊 Mute"}
                </Button>

                <Button
                  variant={isVideoEnabled ? "outline" : "secondary"}
                  onClick={toggleVideo}
                  size="sm"
                >
                  {isVideoEnabled ? "📹 Video On" : "📷 Video Off"}
                </Button>
              </>
            )}

            <Button variant="destructive" onClick={endCall} size="sm">
              End Call
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>
              {isInitiator
                ? "Waiting for the other party to accept..."
                : "Click Accept to start the call"}
            </p>
            <p>Audio-only call (video toggle available for testing)</p>
            <p className="text-gray-400">Uses Google STUN servers for peer-to-peer connection</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
