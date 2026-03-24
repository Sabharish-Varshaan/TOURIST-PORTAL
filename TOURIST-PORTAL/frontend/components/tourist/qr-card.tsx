"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface QRCardProps {
  touristId: string
  qrCode: string
}

export default function QRCard({ touristId, qrCode }: QRCardProps) {
  const [locationLabel, setLocationLabel] = useState("")
  const [actionStatus, setActionStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCheckIn = async () => {
    setLoading(true)
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
      setActionStatus(`Check-in recorded. Hash: ${data.hash || ""}`)
    } catch (err) {
      setActionStatus("Check-in failed")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSOS = async () => {
    setLoading(true)
    try {
      setActionStatus("Attempting to get location...")

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
      }

      const res = await fetch(`${API}/api/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setActionStatus(
        `SOS sent! ${data.message || ""} ${data.hash ? `Hash: ${data.hash}` : ""} ${
          body.lat ? `| coords: ${body.lat.toFixed(5)},${body.lng.toFixed(5)}` : "| coords: unknown"
        }`,
      )
    } catch (err) {
      setActionStatus("Failed to send SOS")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-4xl shadow-lg p-5 mb-4">
      <h1 className="text-2xl font-bold mb-4">Your Digital ID</h1>

      <div className="flex justify-center mb-4">
        <img
          src={`data:image/png;base64,${qrCode}`}
          alt="QR Code"
          className="w-44 h-44 rounded-3xl border border-gray-300"
        />
      </div>

      <p className="text-gray-600 text-sm mb-4">
        Tourist ID: <span className="font-mono">{touristId}</span>
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block font-semibold mb-2">Where are you? (Hotel / Museum / Market)</label>
          <input
            type="text"
            placeholder="Location label"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-3xl text-base mb-2"
          />
          <button
            onClick={handleCheckIn}
            disabled={loading}
            style={{ backgroundColor: "var(--success)" }}
            className="w-full text-white p-3 rounded-3xl font-semibold hover:opacity-90 disabled:opacity-50"
          >
            ✅ Check-In
          </button>
        </div>

        <div>
          <label className="block font-semibold mb-2">Emergency</label>
          <button
            onClick={handleSOS}
            disabled={loading}
            style={{ backgroundColor: "var(--danger)" }}
            className="w-full text-white p-3 rounded-3xl font-semibold hover:opacity-90 disabled:opacity-50"
          >
            🚨 SOS
          </button>
        </div>
      </div>

      {actionStatus && <p className="text-gray-600 text-sm">{actionStatus}</p>}
    </div>
  )
}
