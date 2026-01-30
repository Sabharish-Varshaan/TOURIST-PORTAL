"use client"

import { useState, useEffect } from "react"
import "leaflet/dist/leaflet.css"
import TouristRegistration from "@/components/tourist/registration"
import TouristMap from "@/components/tourist/map-wrapper"
import EKYCForm from "@/components/tourist/ekyc-form"
import QRCard from "@/components/tourist/qr-card-simple"  // ← USE THE NEW FILE
import TouristChatbot from "@/components/tourist/chatbot"
import TouristDualChat from "@/components/chat/tourist-dual-chat"
import OfflineIndicator from "@/components/offline-indicator"
import DemoChecklist from "@/components/demo-checklist"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function TouristPage() {
  const [touristId, setTouristId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("tourist_id")
    const storedQr = localStorage.getItem("qr_png")
    if (stored && storedQr) {
      setTouristId(stored)
      setQrCode(storedQr)
      setRegistered(true)
    }
  }, [])

  const handleRegister = (id: string, qr: string) => {
    setTouristId(id)
    setQrCode(qr)
    setRegistered(true)
    localStorage.setItem("tourist_id", id)
    localStorage.setItem("qr_png", qr)
  }

  return (
    <div style={{ backgroundColor: "var(--bg)" }} className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {!registered ? (
          <div className="flex items-center justify-center min-h-[80vh]">
            <TouristRegistration onRegister={handleRegister} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, Tourist!</h1>
              <p className="text-gray-600">Your digital companion for safe travel</p>
              <div className="mt-4 flex justify-center">
                <OfflineIndicator />
              </div>
              <div className="mt-2 text-xs text-gray-400">ID: {touristId?.slice(-8)} (full: {touristId})</div>
            </div>

            <QRCard touristId={touristId!} qrCode={qrCode!} />
            <TouristMap touristId={touristId!} />
            <EKYCForm touristId={touristId!} />
            
            {/* Dual Chat: Authority + Responder with tab switcher */}
            {touristId && <TouristDualChat touristId={touristId} />}
            
            {/* AI Chatbot */}
            <TouristChatbot touristId={touristId!} />
            <DemoChecklist />


            <div
              style={{ backgroundColor: "var(--card)" }}
              className="p-6 rounded-3xl shadow-md border border-gray-100"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    💡 Keep this tab open for live safety tracking
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <a
                      href="/dashboard"
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition"
                    >
                      Authority Dashboard →
                    </a>
                    <a
                      href="/admin"
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition"
                    >
                      Admin Panel →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
