"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface TouristRegistrationProps {
  onRegister: (id: string, qr: string) => void
}

export default function TouristRegistration({ onRegister }: TouristRegistrationProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [emergency, setEmergency] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !emergency.trim()) {
      setStatus("⚠️ Please fill all fields")
      return
    }

    setLoading(true)
    setStatus("")
    try {
      console.log("📤 Sending registration request to:", `${API}/api/register`)
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          emergency_contact: emergency.trim(),
        }),
      })

      console.log("📨 Response status:", res.status)

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      console.log("📦 Full API Response:", data)
      console.log("🆔 Tourist ID:", data.tourist_id)
      console.log("🖼️  QR Code exists:", !!data.qr_png_base64)
      console.log("📏 QR Code length:", data.qr_png_base64?.length || 0)
      console.log("🔤 QR Code first 50 chars:", data.qr_png_base64?.substring(0, 50) || "EMPTY")

      const touristId = data.tourist_id
      const qrCode = data.qr_png_base64

      if (!touristId) {
        console.error("❌ Missing tourist_id in response")
        setStatus("❌ Registration failed: Missing tourist ID")
        return
      }

      if (!qrCode) {
        console.error("❌ Missing qr_png_base64 in response. Full response keys:", Object.keys(data))
        console.error("❌ Response ", JSON.stringify(data, null, 2))
        setStatus("❌ Registration failed: Backend didn't return QR code. Check server logs.")
        return
      }

      console.log("✅ Registration successful! Calling onRegister...")
      onRegister(touristId, qrCode)
      setStatus("✅ Registered successfully!")
      
      // Clear form
      setName("")
      setPhone("")
      setEmergency("")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error("❌ Registration error:", err)
      setStatus(`❌ Registration failed: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Register & Get Digital ID</h2>
        <p className="text-sm text-gray-600">Create your tourist profile for safe travel</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
          <input
            type="tel"
            placeholder="+91-XXXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Emergency Contact</label>
          <input
            type="tel"
            placeholder="+91-XXXXXXXXXX"
            value={emergency}
            onChange={(e) => setEmergency(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{ backgroundColor: loading ? "#94a3b8" : "var(--primary)" }}
          className="w-full text-white py-3.5 rounded-2xl font-semibold text-base hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Registering...
            </span>
          ) : (
            "Register & Generate QR Code"
          )}
        </button>

        {status && (
          <div
            className={`p-3 rounded-2xl text-sm text-center font-medium ${
              status.includes("✅")
                ? "bg-green-50 text-green-700 border border-green-200"
                : status.includes("❌")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-yellow-50 text-yellow-700 border border-yellow-200"
            }`}
          >
            {status}
          </div>
        )}

        {/* Debug Info Box - Remove in production */}
        <div className="p-3 bg-gray-100 rounded-2xl text-xs text-gray-700 font-mono max-h-24 overflow-y-auto">
          <p className="font-bold mb-1">🔧 Debug Info (Remove in Production):</p>
          <p>API: {API}</p>
          <p>Status: {loading ? "Loading..." : "Ready"}</p>
          <p>Check browser console (F12) for detailed logs</p>
        </div>
      </div>
    </div>
  )
}
