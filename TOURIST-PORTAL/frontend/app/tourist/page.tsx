"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import "leaflet/dist/leaflet.css"
import TouristMap from "@/components/tourist/map-wrapper"
import EKYCForm from "@/components/tourist/ekyc-form"
import QRCard from "@/components/tourist/qr-card-simple"
import TouristChatbot from "@/components/tourist/chatbot"
import TouristDualChat from "@/components/chat/tourist-dual-chat"
import GroupRoomChat from "@/components/chat/group-room-chat"
import OfflineIndicator from "@/components/offline-indicator"
import { Button } from "@/components/ui/button"
import GroupRoomPanel from "@/components/tourist/group-room"
import TripModeChoice, { type TripMode } from "@/components/tourist/trip-mode-choice"
import SafetyScoreCard from "@/components/tourist/safety-score"

const STORAGE_KEYS = {
  touristId: "tourist_id",
  qrPng: "qr_png",
  touristName: "tourist_name",
  tripMode: "trip_mode",
  roomId: "room_id",
  roomName: "room_name",
  roomQr: "room_qr",
  returnUrl: "b2b2c_return_url",
}

export default function TouristPage() {
  const [touristId, setTouristId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [touristName, setTouristName] = useState<string | null>(null)
  const [tripMode, setTripMode] = useState<TripMode | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [roomQr, setRoomQr] = useState<string | null>(null)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.touristId) : null
    const qr = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.qrPng) : null
    const name = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.touristName) : null
    const savedMode = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.tripMode) : null
    const savedRoomId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.roomId) : null
    const savedRoomName = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.roomName) : null
    const savedRoomQr = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.roomQr) : null
    const savedReturnUrl = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.returnUrl) : null
    if (id && qr) {
      setTouristId(id)
      setQrCode(qr)
      setTouristName(name || "Tourist")
    }
    if (savedReturnUrl) setReturnUrl(savedReturnUrl)
    if (savedMode === "solo" || savedMode === "group") {
      setTripMode(savedMode)
    }
    if (savedRoomId) {
      setRoomId(savedRoomId)
      setRoomName(savedRoomName)
      setRoomQr(savedRoomQr)
    }
    if (!id || !qr) {
      router.replace("/auth")
    }
  }, [])

  const saveSession = (id: string, qr: string, name?: string) => {
    setTouristId(id)
    setQrCode(qr)
    setTouristName(name || "Tourist")
    localStorage.setItem(STORAGE_KEYS.touristId, id)
    localStorage.setItem(STORAGE_KEYS.qrPng, qr)
    localStorage.setItem(STORAGE_KEYS.touristName, name || "Tourist")
  }

  const handleRegister = (id: string, qr: string, name?: string) => {
    saveSession(id, qr, name)
  }

  const handleLogin = (id: string, qr: string, name: string) => {
    saveSession(id, qr, name)
  }

  const handleLogout = () => {
    setTouristId(null)
    setQrCode(null)
    setTouristName(null)
    setTripMode(null)
    setRoomId(null)
    setRoomName(null)
    setRoomQr(null)
    localStorage.removeItem(STORAGE_KEYS.touristId)
    localStorage.removeItem(STORAGE_KEYS.qrPng)
    localStorage.removeItem(STORAGE_KEYS.touristName)
    localStorage.removeItem(STORAGE_KEYS.tripMode)
    localStorage.removeItem(STORAGE_KEYS.roomId)
    localStorage.removeItem(STORAGE_KEYS.roomName)
    localStorage.removeItem(STORAGE_KEYS.roomQr)
    router.replace("/auth")
  }

  const handleTripModeChoose = (mode: TripMode) => {
    setTripMode(mode)
    localStorage.setItem(STORAGE_KEYS.tripMode, mode)
    if (mode === "solo") {
      setRoomId(null)
      setRoomName(null)
      setRoomQr(null)
      localStorage.removeItem(STORAGE_KEYS.roomId)
      localStorage.removeItem(STORAGE_KEYS.roomName)
      localStorage.removeItem(STORAGE_KEYS.roomQr)
    }
  }

  const handleRoomChange = (room: { roomId: string | null; roomName?: string | null; roomQr?: string | null }) => {
    setRoomId(room.roomId)
    setRoomName(room.roomName ?? null)
    setRoomQr(room.roomQr ?? null)
    if (room.roomId) {
      localStorage.setItem(STORAGE_KEYS.roomId, room.roomId)
      if (room.roomName) {
        localStorage.setItem(STORAGE_KEYS.roomName, room.roomName)
      } else {
        localStorage.removeItem(STORAGE_KEYS.roomName)
      }
      if (room.roomQr) {
        localStorage.setItem(STORAGE_KEYS.roomQr, room.roomQr)
      } else {
        localStorage.removeItem(STORAGE_KEYS.roomQr)
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.roomId)
      localStorage.removeItem(STORAGE_KEYS.roomName)
      localStorage.removeItem(STORAGE_KEYS.roomQr)
    }
  }

  const isLoggedIn = Boolean(touristId && qrCode)
  const showTripModeChoice = tripMode === null

  if (!isLoggedIn) return null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">GuardianID</span>
            <span className="text-slate-400 text-sm hidden sm:inline">· Tourist</span>
          </div>
          <div className="flex items-center gap-3">
            {returnUrl && (
              <a
                href={returnUrl}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Return to booking
              </a>
            )}
            <span className="text-sm text-slate-600 truncate max-w-[140px] sm:max-w-[200px]">
              {touristName ?? "Tourist"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-2 border-slate-500 bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 hover:text-slate-900 hover:border-slate-600"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Solo or Group choice — first step after login */}
        {showTripModeChoice ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Hello, {touristName ?? "Tourist"}
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  Choose how you&apos;re travelling to continue.
                </p>
              </div>
              <OfflineIndicator />
            </div>
            <TripModeChoice onChoose={handleTripModeChoose} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Hello, {touristName ?? "Tourist"}
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  ID: …{touristId?.slice(-8)}
                  {tripMode === "solo" && " · Solo"}
                  {tripMode === "group" && (roomId ? ` · ${roomName ?? "Group"}` : " · Group — create or join a room")}
                </p>
              </div>
              <OfflineIndicator />
            </div>

            <div className="space-y-6">
              {/* Option to switch trip mode */}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Travelling {tripMode === "solo" ? "solo" : "with a group"}.</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-slate-600"
                  onClick={() => {
                    setTripMode(null)
                    localStorage.removeItem(STORAGE_KEYS.tripMode)
                  }}
                >
                  Change
                </Button>
              </div>

              <SafetyScoreCard touristId={touristId!} />
              <QRCard touristId={touristId!} qrCode={qrCode!} />
              {tripMode === "group" && (
                <GroupRoomPanel
                  touristId={touristId!}
                  roomId={roomId}
                  roomName={roomName}
                  roomQr={roomQr}
                  onRoomChange={handleRoomChange}
                />
              )}
              <TouristMap touristId={touristId!} roomId={tripMode === "group" ? roomId : null} />
              <EKYCForm touristId={touristId!} />
              {touristId && <TouristDualChat touristId={touristId} />}
              {tripMode === "group" && roomId && (
                <GroupRoomChat touristId={touristId!} roomId={roomId} roomName={roomName} />
              )}
              <TouristChatbot touristId={touristId!} />
            </div>
          </>
        )}

        <footer className="mt-10 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-2">
            Keep this tab open for live safety tracking.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="/dashboard"
              className="text-slate-600 hover:text-slate-900 font-medium underline-offset-2 hover:underline"
            >
              Authority Dashboard →
            </a>
            <a
              href="/admin"
              className="text-slate-600 hover:text-slate-900 font-medium underline-offset-2 hover:underline"
            >
              Admin Panel →
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
