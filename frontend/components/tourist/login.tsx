"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface TouristLoginProps {
  onLogin: (id: string, qr: string, name: string) => void
}

export default function TouristLogin({ onLogin }: TouristLoginProps) {
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    const contact = phone.trim()
    if (!contact) {
      setStatus("Enter your contact number")
      return
    }
    if (!password) {
      setStatus("Enter your password")
      return
    }

    setLoading(true)
    setStatus("")
    try {
      const res = await fetch(`${API}/api/tourist/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: contact, password }),
      })

      const data = await res.json().catch(() => ({}))
      const detail = Array.isArray(data.detail) ? data.detail[0]?.msg ?? data.detail : data.detail

      if (res.status === 404) {
        setStatus(detail || "No account found with this contact number.")
        return
      }
      if (res.status === 401) {
        setStatus(detail || "Invalid password.")
        return
      }
      if (!res.ok) {
        setStatus(detail || "Login failed")
        return
      }

      if (!data.tourist_id || !data.qr_png_base64) {
        setStatus("Invalid response from server")
        return
      }

      onLogin(data.tourist_id, data.qr_png_base64, data.name || "Tourist")
      setStatus("")
      setPhone("")
      setPassword("")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setStatus(msg.includes("fetch") ? `Cannot reach server at ${API}` : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h2>
        <p className="text-sm text-gray-600">Use your contact number and password</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Contact number
          </label>
          <input
            type="tel"
            placeholder="+91-XXXXXXXXXX or 10-digit number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
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
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-semibold text-base hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
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
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </button>

        {status && (
          <div
            className={`p-3 rounded-2xl text-sm text-center font-medium ${
              status.includes("Invalid") || status.includes("failed") || status.includes("No account")
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
