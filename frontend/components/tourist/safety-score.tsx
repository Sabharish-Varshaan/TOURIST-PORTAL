"use client"

import { useEffect, useMemo, useState } from "react"
import * as turf from "@turf/turf"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type ZoneType = "TERROR" | "RESTRICTED" | "HOTSPOT" | string

interface Zone {
  id: string | number
  name: string
  zone_type: ZoneType
  dwell_minutes?: number
  geojson: {
    type: "Polygon"
    coordinates: number[][][] // [ [ [lng,lat], ... ] ]
  }
}

interface SafetyScoreProps {
  touristId: string
}

export default function SafetyScoreCard({ touristId }: SafetyScoreProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [permDenied, setPermDenied] = useState(false)
  const [loading, setLoading] = useState(true)

  // fetch zones (same endpoint used in map)
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const res = await fetch(`${API}/api/zones`)
        const data = await res.json()
        if (alive) setZones(data || [])
      } catch {
        if (alive) setZones([])
      }
    }
    run()
    return () => { alive = false }
  }, [])

  // get user position (lightweight, one-shot; map does continuous watch)
  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false)
      return
    }
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLoading(false)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermDenied(true)
        setLoading(false)
      },
      opts
    )
  }, [])

  const { score, label, color, detail } = useMemo(() => {
    let s = 100
    let reasons: string[] = []

    // 1) No/denied location → big penalty
    if (!coords) {
      if (permDenied) {
        s -= 35
        reasons.push("Location permission denied")
      } else {
        s -= 20
        reasons.push("Location unavailable")
      }
    }

    // 2) Time-of-day context
    const hour = new Date().getHours()
    const isNight = hour >= 19 || hour < 6
    if (isNight) {
      s -= 10
      reasons.push("Night-time")
    }

    // 3) Zone penalties (inside + proximity)
    if (coords && zones.length) {
      const pt = turf.point([coords.lng, coords.lat])
      let nearestMeters = Infinity
      let inside: Zone | null = null

      for (const z of zones) {
        const poly = turf.polygon(z.geojson.coordinates)
        const isInside = turf.booleanPointInPolygon(pt, poly)
        if (isInside) inside = z

        // distance to polygon boundary (approx: point to polygon centroid edge)
        const centroid = turf.centroid(poly)
        const distKm = turf.distance(pt, centroid, { units: "kilometers" })
        const meters = distKm * 1000
        if (meters < nearestMeters) nearestMeters = meters
      }

      // Inside penalties by zone type
      if (inside) {
        const type = inside.zone_type
        if (type === "TERROR") { s -= 70; reasons.push(`Inside TERROR zone: ${inside.name}`) }
        else if (type === "RESTRICTED") { s -= 40; reasons.push(`Inside RESTRICTED zone: ${inside.name}`) }
        else { s -= 25; reasons.push(`Inside ${type} zone: ${inside.name}`) }
      }

      // Proximity penalties (only if not already inside)
      if (!inside && Number.isFinite(nearestMeters)) {
        if (nearestMeters < 100) { s -= 25; reasons.push("Near high-risk zone (<100m)") }
        else if (nearestMeters < 250) { s -= 15; reasons.push("Near high-risk zone (<250m)") }
        else if (nearestMeters < 500) { s -= 8; reasons.push("Near high-risk zone (<500m)") }
      }
    }

    // Clamp and map to label/color
    s = Math.max(0, Math.min(100, Math.round(s)))
    let label = "LOW RISK"
    let color = "text-green-700 border-green-200 bg-green-50"
    if (s < 35) { label = "HIGH RISK"; color = "text-red-700 border-red-200 bg-red-50" }
    else if (s < 70) { label = "MODERATE"; color = "text-yellow-700 border-yellow-200 bg-yellow-50" }

    return {
      score: s,
      label,
      color,
      detail: reasons.length ? reasons.join(" • ") : "No obvious risks detected",
    }
  }, [coords, zones, permDenied])

  // Circular gauge (SVG)
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = circumference * (1 - (score || 0) / 100)

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Safety Score</h2>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>{label}</div>
      </div>

      <div className="flex items-center gap-6">
        {/* Gauge */}
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-24 h-24">
            <circle cx="50" cy="50" r={radius} strokeWidth="10" stroke="#e5e7eb" fill="none" />
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
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xl font-extrabold tabular-nums">{loading ? "…" : score}</div>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            {loading ? "Calculating safety…" : detail}
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            Based on your current location, proximity to risk zones, and time-of-day.
          </p>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-gray-400">
        Session: <span className="font-mono">{touristId}</span>
      </div>
    </div>
  )
}
