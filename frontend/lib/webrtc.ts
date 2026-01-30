"use client"

/**
 * WebRTC Service for peer-to-peer audio/video calls
 * Uses free STUN servers for NAT traversal
 */

export type WebRTCCallbacks = {
  onLocalStream?: (stream: MediaStream) => void
  onRemoteStream?: (stream: MediaStream) => void
  onCallEnded?: () => void
  onError?: (error: Error) => void
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private callbacks: WebRTCCallbacks
  private sendSignal: (signal: any) => void

  // Free public STUN servers (Google's)
  private iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ]

  constructor(sendSignal: (signal: any) => void, callbacks: WebRTCCallbacks = {}) {
    this.sendSignal = sendSignal
    this.callbacks = callbacks
  }

  /**
   * Initialize WebRTC connection and get local media
   */
  async startCall(audioOnly: boolean = true): Promise<void> {
    try {
      // Get user media (audio/video)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !audioOnly,
      })

      this.callbacks.onLocalStream?.(this.localStream)

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
      })

      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!)
      })

      // Handle incoming remote stream
      this.peerConnection.ontrack = (event) => {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream()
          this.callbacks.onRemoteStream?.(this.remoteStream)
        }
        this.remoteStream.addTrack(event.track)
      }

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({
            type: "ice_candidate",
            candidate: event.candidate.toJSON(),
          })
        }
      }

      // Monitor connection state
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState
        console.log("WebRTC connection state:", state)
        if (state === "failed" || state === "disconnected" || state === "closed") {
          this.callbacks.onCallEnded?.()
        }
      }

      // Create and send offer
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)

      this.sendSignal({
        type: "offer",
        sdp: offer.sdp,
      })
    } catch (error) {
      this.callbacks.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Accept incoming call
   */
  async acceptCall(audioOnly: boolean = true): Promise<void> {
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !audioOnly,
      })

      this.callbacks.onLocalStream?.(this.localStream)

      // Create peer connection (if not already created)
      if (!this.peerConnection) {
        this.peerConnection = new RTCPeerConnection({
          iceServers: this.iceServers,
        })

        // Add local stream tracks
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!)
        })

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream()
            this.callbacks.onRemoteStream?.(this.remoteStream)
          }
          this.remoteStream.addTrack(event.track)
        }

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendSignal({
              type: "ice_candidate",
              candidate: event.candidate.toJSON(),
            })
          }
        }

        this.peerConnection.onconnectionstatechange = () => {
          const state = this.peerConnection?.connectionState
          console.log("WebRTC connection state:", state)
          if (state === "failed" || state === "disconnected" || state === "closed") {
            this.callbacks.onCallEnded?.()
          }
        }
      }
    } catch (error) {
      this.callbacks.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Handle incoming WebRTC signals from remote peer
   */
  async handleSignal(signal: any): Promise<void> {
    try {
      if (!this.peerConnection) {
        this.peerConnection = new RTCPeerConnection({
          iceServers: this.iceServers,
        })
      }

      if (signal.type === "offer") {
        // Received an offer, need to create answer
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: signal.sdp })
        )

        const answer = await this.peerConnection.createAnswer()
        await this.peerConnection.setLocalDescription(answer)

        this.sendSignal({
          type: "answer",
          sdp: answer.sdp,
        })
      } else if (signal.type === "answer") {
        // Received answer to our offer
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: signal.sdp })
        )
      } else if (signal.type === "ice_candidate") {
        // Received ICE candidate
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
      }
    } catch (error) {
      this.callbacks.onError?.(error as Error)
      console.error("Error handling WebRTC signal:", error)
    }
  }

  /**
   * End the call and cleanup
   */
  endCall(): void {
    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    // Stop remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop())
      this.remoteStream = null
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.callbacks.onCallEnded?.()
  }

  /**
   * Mute/unmute local audio
   */
  toggleAudio(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted
      })
    }
  }

  /**
   * Mute/unmute local video
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null
  }
}
