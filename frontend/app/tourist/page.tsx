"use client"

import { useState, useEffect } from "react"
import "leaflet/dist/leaflet.css"
import TouristRegistration from "@/components/tourist/registration"
import TouristMap from "@/components/tourist/map"
import EKYCForm from "@/components/tourist/ekyc-form"
import QRCard from "@/components/tourist/qr-card"

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
        )}
      </div>
    </div>
  )
}
