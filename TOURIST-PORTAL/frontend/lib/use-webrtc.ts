"use client"

import { useRef, useEffect, useCallback } from "react"

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
}

export function useWebRTC(
  activeCallId: string | null,
  isCaller: boolean,
  sendCallAction: (payload: Record<string, unknown>) => void
) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const callerDoneRef = useRef(false)

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    callerDoneRef.current = false
  }, [])

  // Caller: when we have activeCallId and we're the caller, create offer and send
  useEffect(() => {
    if (!activeCallId || !isCaller || callerDoneRef.current) return

    let cancelled = false
    const pc = new RTCPeerConnection(rtcConfig)
    pcRef.current = pc

    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        pc.ontrack = (e) => {
          const el = remoteAudioRef.current
          if (el && e.streams[0]) {
            el.srcObject = e.streams[0]
            el.play().catch(() => {})
          }
        }

        pc.onicecandidate = (e) => {
          if (e.candidate)
            sendCallAction({
              action: "signaling",
              call_id: activeCallId,
              payload: { type: "ice", candidate: e.candidate.toJSON() },
            })
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendCallAction({
          action: "signaling",
          call_id: activeCallId,
          payload: { type: "offer", sdp: offer.sdp },
        })
        callerDoneRef.current = true
      } catch (err) {
        console.error("WebRTC caller error:", err)
        cleanup()
      }
    }

    run()
    return () => {
      cancelled = true
      cleanup()
    }
  }, [activeCallId, isCaller, sendCallAction, cleanup])

  const handleSignaling = useCallback(
    (callId: string, payload: { type?: string; sdp?: string; candidate?: RTCIceCandidateInit }) => {
      if (callId !== activeCallId || !payload?.type) return

      const handleOffer = async (sdp: string) => {
        cleanup()
        const pc = new RTCPeerConnection(rtcConfig)
        pcRef.current = pc

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          localStreamRef.current = stream
          stream.getTracks().forEach((track) => pc.addTrack(track, stream))

          pc.ontrack = (e) => {
            const el = remoteAudioRef.current
            if (el && e.streams[0]) {
              el.srcObject = e.streams[0]
              el.play().catch(() => {})
            }
          }

          pc.onicecandidate = (e) => {
            if (e.candidate)
              sendCallAction({
                action: "signaling",
                call_id: callId,
                payload: { type: "ice", candidate: e.candidate.toJSON() },
              })
          }

          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendCallAction({
            action: "signaling",
            call_id: callId,
            payload: { type: "answer", sdp: answer.sdp },
          })
        } catch (err) {
          console.error("WebRTC callee error:", err)
          cleanup()
        }
      }

      const handleAnswer = async (sdp: string) => {
        const pc = pcRef.current
        if (!pc) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }))
        } catch (err) {
          console.error("WebRTC set remote answer error:", err)
        }
      }

      const handleIce = async (candidate: RTCIceCandidateInit) => {
        const pc = pcRef.current
        if (!pc) return
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error("WebRTC addIceCandidate error:", err)
        }
      }

      if (payload.type === "offer" && payload.sdp) handleOffer(payload.sdp)
      else if (payload.type === "answer" && payload.sdp) handleAnswer(payload.sdp)
      else if (payload.type === "ice" && payload.candidate) handleIce(payload.candidate)
    },
    [activeCallId, sendCallAction, cleanup]
  )

  // Cleanup when call ends (activeCallId becomes null)
  useEffect(() => {
    if (!activeCallId) cleanup()
  }, [activeCallId, cleanup])

  return { handleSignaling, remoteAudioRef, cleanup }
}
