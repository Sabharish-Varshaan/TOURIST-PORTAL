"use client"

import type { MutableRefObject } from "react"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useWebRTCCall } from "@/lib/use-webrtc-call"

interface CallDialogProps {
  callId: string | null
  isInitiator: boolean
  onSignal: (signal: any) => void
  onEndCall: () => void
  callerInfo?: string
  /** Parent registers this ref so useChat onWebRTCSignal can forward WS payloads into WebRTC */
  incomingSignalRef?: MutableRefObject<((payload: unknown) => void) | null>
}

export default function CallDialog({
  callId,
  isInitiator,
  onSignal,
  onEndCall,
  callerInfo,
  incomingSignalRef,
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

  // Bridge WebSocket signaling (useChat onWebRTCSignal) → WebRTC handleSignal
  useEffect(() => {
    if (!incomingSignalRef) return
    incomingSignalRef.current = (payload: unknown) => {
      void handleSignal(payload)
    }
    return () => {
      incomingSignalRef.current = null
    }
  }, [incomingSignalRef, handleSignal])

  if (!callId) return null

  const connected = connectionState === "connected"
  const dialogTitle = (() => {
    if (connected && remoteStream) return "Connected"
    if (isInitiator) return localStream ? "Calling…" : "Starting call…"
    if (!localStream) return `Incoming call${callerInfo ? ` from ${callerInfo}` : ""}`
    return remoteStream ? "In call" : "Connecting…"
  })()

  const dialogDescription = (() => {
    if (isInitiator) {
      return localStream
        ? "Waiting for the other person to accept. Audio will flow when the connection is established."
        : "Requesting microphone access."
    }
    if (!localStream) {
      return `Voice call${callerInfo ? ` from ${callerInfo}` : ""}. Tap Accept and allow the microphone to connect.`
    }
    if (!remoteStream) {
      return "Microphone is on. Negotiating a direct audio link with the other party."
    }
    return "You are connected. Use mute or end call as needed."
  })()

  const remotePlaceholder = (() => {
    if (remoteStream) return null
    if (isInitiator) {
      return localStream
        ? "Waiting for the other person to answer…"
        : "Preparing your microphone…"
    }
    if (!localStream) return "Tap Accept below, then allow the microphone"
    if (connectionState === "failed") return "Connection failed — try ending and calling again"
    return "Connecting to peer…"
  })()

  const footerPrimary = (() => {
    if (isInitiator) {
      return localStream
        ? "Waiting for the other party to accept your call."
        : "Allow the microphone when prompted to place the call."
    }
    if (!localStream) {
      return "Tap Accept and allow the microphone. The Accept button is below."
    }
    if (!remoteStream) {
      return "If this stays here a long time, hard-refresh both browsers, confirm the backend is running, and try again. Strict networks may need TURN (not included in dev)."
    }
    return "Audio is connected. Mute or end the call using the buttons above."
  })()

  return (
    <Dialog open={!!callId} onOpenChange={() => endCall()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
              {!remoteStream && remotePlaceholder && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm text-center px-4">
                  {remotePlaceholder}
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
            <p>{footerPrimary}</p>
            <p>Audio-only by default (video toggle is optional for testing).</p>
            <p className="text-gray-400">Peer-to-peer via WebRTC; public STUN only in this build.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
