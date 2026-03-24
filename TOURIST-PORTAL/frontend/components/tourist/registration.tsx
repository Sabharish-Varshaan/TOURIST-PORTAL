"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface TouristRegistrationProps {
  onRegister: (id: string, qr: string, name?: string) => void
}

const MIN_PASSWORD_LENGTH = 6

export default function TouristRegistration({ onRegister }: TouristRegistrationProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [emergency, setEmergency] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !emergency.trim()) {
      setStatus("Please fill name, phone and emergency contact")
      return
    }
    if (!password) {
      setStatus("Please enter a password")
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (password !== confirmPassword) {
      setStatus("Password and confirm password do not match")
      return
    }

    setLoading(true)
    setStatus("")
    try {
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          emergency_contact: emergency.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      })

      const data = await res.json().catch(() => ({}))
      const detail = Array.isArray(data.detail) ? data.detail[0]?.msg ?? data.detail : data.detail

      if (!res.ok) {
        if (res.status === 409) {
          setStatus(detail || "This contact number is already registered.")
          return
        }
        setStatus(detail || `Registration failed (${res.status})`)
        return
      }

      const touristId = data.tourist_id
      const qrCode = data.qr_png_base64

      if (!touristId) {
        setStatus("Registration failed: Missing tourist ID")
        return
      }
      if (!qrCode) {
        setStatus("Registration failed: No QR code returned")
        return
      }

      onRegister(touristId, qrCode, (data as { name?: string }).name)
      setStatus("Registered successfully!")
      setName("")
      setPhone("")
      setEmergency("")
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setStatus(
        errorMsg.includes("fetch") ? `Cannot reach backend at ${API}` : `Registration failed: ${errorMsg}`
      )
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
          <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-semibold text-base hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-white"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
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
              status.includes("success")
                ? "bg-green-50 text-green-700 border border-green-200"
                : status.includes("already registered") || status.includes("do not match")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
