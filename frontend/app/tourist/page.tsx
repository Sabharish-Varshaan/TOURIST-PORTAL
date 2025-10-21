"use client"

import { useState, useEffect } from "react"
import "leaflet/dist/leaflet.css"
import TouristRegistration from "@/components/tourist/registration"
<<<<<<< HEAD
import TouristMap from "@/components/tourist/map-wrapper"
import EKYCForm from "@/components/tourist/ekyc-form"
import QRCard from "@/components/tourist/qr-card-simple"  // ← USE THE NEW FILE
import TouristChatbot from "@/components/tourist/chatbot"

=======
import TouristMap from "@/components/tourist/map"
import EKYCForm from "@/components/tourist/ekyc-form"
import QRCard from "@/components/tourist/qr-card"
>>>>>>> bbc8bab (Initial commit)

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
<<<<<<< HEAD
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
            </div>

            <QRCard touristId={touristId!} qrCode={qrCode!} />
            <TouristMap touristId={touristId!} />
            <EKYCForm touristId={touristId!} />
            <TouristChatbot touristId={touristId!} />


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
=======
    <div style={{ backgroundColor: "var(--bg)" }} className="min-h-screen">
      <div className="max-w-3xl mx-auto p-5">
        {!registered ? (
          <TouristRegistration onRegister={handleRegister} />
        ) : (
          <>
            <QRCard touristId={touristId!} qrCode={qrCode!} />
            <TouristMap touristId={touristId!} />
            <EKYCForm touristId={touristId!} />
            <div
              style={{ backgroundColor: "var(--card)", color: "var(--muted)" }}
              className="mt-6 p-5 rounded-2xl text-sm"
            >
              <p>Tip: Keep this tab open for live safety tracking.</p>
              <p className="mt-2">
                <a href="/dashboard" style={{ color: "var(--accent)" }} className="hover:underline">
                  Open Authority Dashboard
                </a>{" "}
                •
                <a href="/admin" style={{ color: "var(--accent)" }} className="hover:underline ml-2">
                  Open Admin
                </a>
              </p>
            </div>
          </>
>>>>>>> bbc8bab (Initial commit)
        )}
      </div>
    </div>
  )
}
