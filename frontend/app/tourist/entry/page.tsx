"use client"

import { useEffect, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const STORAGE_KEYS = {
  touristId: "tourist_id",
  qrPng: "qr_png",
  touristName: "tourist_name",
  returnUrl: "b2b2c_return_url",
}

/**
 * Entry page for users coming from B2B2C (travel agency).
 * Accepts tourist_id and return_url in query. Fetches profile from backend,
 * sets localStorage so /tourist works, then redirects to /tourist for e-KYC and full safety features.
 */
export default function TouristEntryPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading")

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const touristId = params.get("tourist_id")
    const returnUrl = params.get("return_url")

    if (!touristId) {
      window.location.replace("/auth")
      return
    }

    const run = async () => {
      try {
        const res = await fetch(`${API}/api/tourist/${encodeURIComponent(touristId)}/profile`)
        if (!res.ok) {
          setStatus("error")
          return
        }
        const data = await res.json()
        const qr = data.qr_png_base64 ?? ""
        const name = data.name ?? "Tourist"

        localStorage.setItem(STORAGE_KEYS.touristId, touristId)
        localStorage.setItem(STORAGE_KEYS.qrPng, qr)
        localStorage.setItem(STORAGE_KEYS.touristName, name)
        if (returnUrl) {
          sessionStorage.setItem(STORAGE_KEYS.returnUrl, decodeURIComponent(returnUrl))
        }
        window.location.replace("/tourist")
      } catch {
        setStatus("error")
      }
    }

    run()
  }, [])

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
        <p className="text-slate-700 font-medium">Could not load your profile.</p>
        <p className="text-slate-500 text-sm mt-1">You may need to log in again from the booking portal.</p>
        <a
          href="/auth"
          className="mt-6 px-5 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700"
        >
          Go to login
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
      <p className="text-slate-700 font-medium">Signing you in to GuardianID…</p>
      <p className="text-slate-500 text-sm mt-1">You’ll be able to complete e-KYC and use SOS, map, and chat.</p>
      <div className="mt-6 h-8 w-8 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
    </div>
  )
}
