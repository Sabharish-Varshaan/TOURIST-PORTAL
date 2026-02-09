"use client"

import { useEffect, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface BackendScore {
  score: number
  explanation: string[]
}

interface SafetyScoreProps {
  touristId: string
}

function getLabelAndColor(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "LOW RISK", color: "text-green-700 border-green-200 bg-green-50" }
  if (score >= 35) return { label: "MODERATE", color: "text-yellow-700 border-yellow-200 bg-yellow-50" }
  return { label: "HIGH RISK", color: "text-red-700 border-red-200 bg-red-50" }
}

export default function SafetyScoreCard({ touristId }: SafetyScoreProps) {
  const [data, setData] = useState<BackendScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const res = await fetch(`${API}/api/tourist/${encodeURIComponent(touristId)}/safety-score`)
        if (!res.ok) {
          if (alive) setError(res.status === 404 ? "Tourist not found" : `Score unavailable (${res.status})`)
          return
        }
        const json = await res.json()
        if (alive) setData({ score: json.score ?? 0, explanation: Array.isArray(json.explanation) ? json.explanation : [] })
      } catch (e) {
        if (alive) setError("Could not load safety score")
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [touristId])

  const score = data?.score ?? 0
  const detail = data?.explanation?.length ? data.explanation.join(" • ") : "No obvious risks detected."
  const { label, color } = getLabelAndColor(score)

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = circumference * (1 - (score || 0) / 100)

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Safety Score</h2>
        {!loading && !error && (
          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>{label}</div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-24 h-24">
            <circle cx="50" cy="50" r={radius} strokeWidth="10" stroke="#e5e7eb" fill="none" />
            {!error && (
              <circle
                cx="50"
                cy="50"
                r={radius}
                strokeWidth="10"
                stroke="currentColor"
                className={
                  score >= 70
                    ? "text-green-500"
                    : score >= 35
                      ? "text-yellow-500"
                      : "text-red-500"
                }
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={progress}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xl font-extrabold tabular-nums">
              {loading ? "…" : error ? "—" : score}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-sm text-gray-700">
            {loading ? "Loading safety score…" : error ? error : detail}
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            Backend AI score: location, zones, weather, check-in, KYC & recent SOS.
          </p>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-gray-400">
        ID: <span className="font-mono">…{touristId?.slice(-8)}</span>
      </div>
    </div>
  )
}
