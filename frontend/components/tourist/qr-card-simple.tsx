"use client"

import { useState, useEffect } from "react"
import { offlineFetch } from "@/lib/offline/sync"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface QRCardProps {
  touristId: string
  qrCode: string
}

export default function QRCard({ touristId, qrCode }: QRCardProps) {
  const [locationLabel, setLocationLabel] = useState("")
  const [actionStatus, setActionStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [smsHref, setSmsHref] = useState<string>("")

  // ✅ Create data URL only on client side after mount
  useEffect(() => {
    if (qrCode) {
      // Create a proper data URL in memory
      const url = `data:image/png;base64,${qrCode}`;
      setQrDataUrl(url)
      console.log("✅ QR URL created:", url.substring(0, 50) + "...")
    }
  }, [qrCode])

  const handleCheckIn = async () => {
    setLoading(true)
    setActionStatus("")
    try {
      const res = await fetch(`${API}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourist_id: touristId,
          location_label: locationLabel || "-",
        }),
      })
      const data = await res.json()
      setActionStatus(`✅ Check-in recorded • Hash: ${data.hash?.substring(0, 12) || "N/A"}...`)
      setLocationLabel("")
    } catch (err) {
      setActionStatus("❌ Check-in failed")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSOS = async () => {
    setLoading(true)
    setActionStatus("📍 Getting your location...")
    setSmsHref("")

    try {
      const coords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        if (!navigator.geolocation) {
          resolve(null)
          return
        }

        let done = false
        navigator.geolocation.getCurrentPosition(
          (p) => {
            if (!done) {
              done = true
              resolve(p.coords)
            }
          },
          () => {
            navigator.geolocation.getCurrentPosition(
              (p2) => {
                if (!done) {
                  done = true
                  resolve(p2.coords)
                }
              },
              () => {
                if (!done) {
                  done = true
                  resolve(null)
                }
              },
              { maximumAge: 60000, timeout: 3000 },
            )
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
        )

        setTimeout(() => {
          if (!done) {
            done = true
            resolve(null)
          }
        }, 10500)
      })

      const body: any = {
        tourist_id: touristId,
        location_label: locationLabel || "-",
      }

      if (coords) {
        body.lat = coords.latitude
        body.lng = coords.longitude
      } else {
        // fallback: last known from live map (if available)
        try {
          const latStr = localStorage.getItem(`guardianid:tourist:${touristId}:last_lat`)
          const lngStr = localStorage.getItem(`guardianid:tourist:${touristId}:last_lng`)
          const lat = latStr ? Number(latStr) : NaN
          const lng = lngStr ? Number(lngStr) : NaN
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            body.lat = lat
            body.lng = lng
          }
        } catch {}
      }

      const result = await offlineFetch(
        `${API}/api/sos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { type: "sos" },
      )

      if (result.queued) {
        const locText = body.lat ? `${Number(body.lat).toFixed(4)}, ${Number(body.lng).toFixed(4)}` : "unknown"
        const msg = `SOS (offline queued)\nTouristID: ${touristId}\nLoc: ${locText}\nLabel: ${body.location_label}`
        setSmsHref(`sms:112?body=${encodeURIComponent(msg)}`)
        setActionStatus(`📴 Offline: SOS queued for sync. Use SMS fallback now. • Location: ${locText}`)
        return
      }

      const res = result.response
      const data = res ? await res.json() : {}
      setActionStatus(
        `🚨 SOS SENT! ${data.message || ""} ${
          body.lat ? `• Location: ${Number(body.lat).toFixed(4)}, ${Number(body.lng).toFixed(4)}` : "• Location unavailable"
        }`,
      )
    } catch (err) {
      setActionStatus("❌ Failed to send SOS")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Your Digital ID</h2>
        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
          ACTIVE
        </div>
      </div>

      {/* ✅ QR DISPLAY - BULLETPROOF */}
      <div className="flex flex-col items-center mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
        {qrDataUrl ? (
          <>
            {/* Use dangerouslySetInnerHTML to bypass Next.js routing */}
            <div
              dangerouslySetInnerHTML={{
                __html: `<img src="${qrDataUrl}" alt="QR Code" class="w-48 h-48 rounded-2xl border-4 border-white shadow-lg mb-4" style="background-color: white; object-fit: contain; display: block;">`,
              }}
            />
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                Tourist ID
              </p>
              <p className="text-sm font-mono font-bold text-gray-800 bg-white px-4 py-2 rounded-full">
                {touristId}
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <svg
              className="animate-spin h-10 w-10 text-yellow-600 mx-auto mb-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-gray-600 font-medium">Loading QR Code...</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Check-In Section */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Check-In Location</label>
          <input
            type="text"
            placeholder="Hotel / Museum / Market"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
          />
          <button
            onClick={handleCheckIn}
            disabled={loading}
            style={{ backgroundColor: loading ? "#94a3b8" : "var(--success)" }}
            className="w-full text-white py-3 rounded-2xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center"
          >
            <span className="mr-2">✅</span>
            {loading ? "Processing..." : "Check-In Here"}
          </button>
        </div>

        {/* SOS Section */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Emergency Alert</label>
          <div className="h-[52px] flex items-center justify-center bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-xs text-red-600 font-medium">Press button in emergency</p>
          </div>
          <button
            onClick={handleSOS}
            disabled={loading}
            style={{ backgroundColor: loading ? "#94a3b8" : "var(--danger)" }}
            className="w-full text-white py-3 rounded-2xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center"
          >
            <span className="mr-2">🚨</span>
            {loading ? "Sending..." : "Send SOS Alert"}
          </button>
        </div>
      </div>

      {actionStatus && (
        <div
          className={`p-4 rounded-2xl text-sm font-medium border ${
            actionStatus.includes("✅") || actionStatus.includes("🚨")
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : actionStatus.includes("❌")
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-gray-50 text-gray-700 border-gray-200"
          }`}
        >
          {actionStatus}
        </div>
      )}

      {smsHref ? (
        <div className="mt-4 p-4 rounded-2xl border bg-yellow-50 border-yellow-200">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-yellow-800">SMS fallback (no data required)</div>
            <a
              href={smsHref}
              className="px-4 py-2 rounded-xl bg-yellow-600 text-white text-sm font-semibold hover:bg-yellow-700"
            >
              Send SMS to 112
            </a>
          </div>
          <div className="mt-2 text-xs text-yellow-800 opacity-80">
            This sends a prefilled SMS with your tourist ID and last known location.
          </div>
        </div>
      ) : null}
    </div>
  )
}
