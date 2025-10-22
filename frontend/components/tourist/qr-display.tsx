"use client"

import { useEffect, useState } from "react"

interface QRDisplayProps {
  qrCode: string
  touristId: string
}

export default function QRDisplay({ qrCode, touristId }: QRDisplayProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex flex-col items-center mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
        <div className="text-center py-8">
          <div className="inline-block p-4 bg-yellow-100 rounded-full mb-3 animate-pulse">
            <svg
              className="h-8 w-8 text-yellow-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            </svg>
          </div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // ✅ FIX: Add "" prefix
  const dataUri = `data:image/png;base64,${qrCode}`;


  return (
    <div className="flex flex-col items-center mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
      <div className="relative w-48 h-48 mb-4">
        <img
          src={dataUri}
          alt="Tourist QR Code"
          className="w-48 h-48 rounded-2xl border-4 border-white shadow-lg object-contain bg-white"
          onError={(e) => {
            console.error("❌ QR failed to load")
            e.currentTarget.style.display = "none"
          }}
          onLoad={() => {
            console.log("✅ QR loaded")
          }}
        />
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Tourist ID</p>
        <p className="text-sm font-mono font-bold text-gray-800 bg-white px-4 py-2 rounded-full">
          {touristId}
        </p>
      </div>
    </div>
  )
}
