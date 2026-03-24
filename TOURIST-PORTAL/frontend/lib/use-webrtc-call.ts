"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { WebRTCService } from "./webrtc"

interface UseWebRTCCallProps {
  callId: string | null
  isInitiator: boolean
  onSignal: (signal: any) => void
  onCallEnded?: () => void
}

export function useWebRTCCall({ callId, isInitiator, onSignal, onCallEnded }: UseWebRTCCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const webrtcRef = useRef<WebRTCService | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localAudioRef = useRef<HTMLAudioElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  // Initialize WebRTC service
  useEffect(() => {
    if (!callId) {
      // Cleanup if call ends
      webrtcRef.current?.endCall()
      webrtcRef.current = null
      setLocalStream(null)
      setRemoteStream(null)
      setConnectionState(null)
      return
    }

    if (!webrtcRef.current) {
      webrtcRef.current = new WebRTCService(onSignal, {
        onLocalStream: setLocalStream,
        onRemoteStream: setRemoteStream,
        onCallEnded: () => {
          onCallEnded?.()
          setLocalStream(null)
          setRemoteStream(null)
        },
        onError: (err) => {
          setError(err.message)
          console.error("WebRTC error:", err)
        },
      })

      // Start call if we're the initiator
      if (isInitiator) {
        webrtcRef.current.startCall(true).catch((err) => {
          setError(`Failed to start call: ${err.message}`)
        })
      }
    }

    // Monitor connection state
    const interval = setInterval(() => {
      const state = webrtcRef.current?.getConnectionState()
      setConnectionState(state || null)
    }, 1000)

    return () => clearInterval(interval)
  }, [callId, isInitiator, onSignal, onCallEnded])

  // Attach local stream to video/audio element
  useEffect(() => {
    if (localStream) {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
      }
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream
        localAudioRef.current.muted = true // Mute local audio to avoid echo
      }
    }
  }, [localStream])

  // Attach remote stream to video/audio element
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream
      }
    }
  }, [remoteStream])

  const handleSignal = useCallback(
    (signal: any) => {
      webrtcRef.current?.handleSignal(signal)
    },
    []
  )

  const acceptCall = useCallback(() => {
    webrtcRef.current?.acceptCall(true).catch((err) => {
      setError(`Failed to accept call: ${err.message}`)
    })
  }, [])

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    webrtcRef.current?.toggleAudio(newMuted)
  }, [isMuted])

  const toggleVideo = useCallback(() => {
    const newEnabled = !isVideoEnabled
    setIsVideoEnabled(newEnabled)
    webrtcRef.current?.toggleVideo(newEnabled)
  }, [isVideoEnabled])

  const endCall = useCallback(() => {
    webrtcRef.current?.endCall()
    webrtcRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setConnectionState(null)
    onCallEnded?.()
  }, [onCallEnded])

  return {
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
  }
}
