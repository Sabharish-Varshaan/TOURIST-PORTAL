"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import * as turf from "@turf/turf"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface TouristMapProps {
  touristId: string
}

export default function TouristMap({ touristId }: TouristMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const [geoMsg, setGeoMsg] = useState("🔄 Initializing geofence monitoring...")
  const [geoStatus, setGeoStatus] = useState<"safe" | "warning" | "danger" | "loading">("loading")
  const userMarkerRef = useRef<L.CircleMarker | null>(null)
  const zonesRef = useRef<any[]>([])
  const currentZoneRef = useRef<any>(null)
  const enterTimeRef = useRef<number | null>(null)
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastKnownRef = useRef<{ lat: number | null; lng: number | null; ts: number | null }>({
    lat: null,
    lng: null,
    ts: null,
  })

  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map("tourist-map").setView([26.1725, 91.744], 14)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map)
      mapRef.current = map

      fetchZones()
      startGeolocation()
    }

    return () => {
      if (dwellTimerRef.current) clearInterval(dwellTimerRef.current)
    }
  }, [])

  const fetchZones = async () => {
    try {
      const res = await fetch(`${API}/api/zones`)
      const zones = await res.json()
      zonesRef.current = zones

      zones.forEach((z: any) => {
        const coords = z.geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng])
        const color = z.zone_type === "TERROR" ? "#ef4444" : z.zone_type === "RESTRICTED" ? "#f59e0b" : "#f43f5e"
        const poly = L.polygon(coords, { color, weight: 2, fillOpacity: 0.2 }).addTo(mapRef.current!)
        poly.bindTooltip(`${z.zone_type}: ${z.name} (max ${z.dwell_minutes} min)`, { permanent: false })
      })
    } catch (err) {
      console.error("Failed to fetch zones:", err)
    }
  }

  const startGeolocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        onGeo,
        () => {
          setGeoMsg("❌ Unable to get location (check permissions)")
          setGeoStatus("warning")
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      )
    } else {
      setGeoMsg("❌ Geolocation not supported")
      setGeoStatus("warning")
    }
  }

  const onGeo = (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude

    lastKnownRef.current = { lat, lng, ts: Date.now() }

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: "#3b82f6",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(mapRef.current!)
      mapRef.current!.setView([lat, lng], 15)
    } else {
      userMarkerRef.current.setLatLng([lat, lng])
    }

    sendGPS(lat, lng)

    const pt = turf.point([lng, lat])
    let inside = null

    for (const z of zonesRef.current) {
      const poly = turf.polygon(z.geojson.coordinates)
      if (turf.booleanPointInPolygon(pt, poly)) {
        inside = z
        break
      }
    }

    if (inside && (!currentZoneRef.current || currentZoneRef.current.id !== inside.id)) {
      currentZoneRef.current = inside
      enterTimeRef.current = Date.now()
      setGeoMsg(`⚠️ Entered ${inside.zone_type} zone: ${inside.name}`)
      setGeoStatus("danger")
      beep()

      if (dwellTimerRef.current) clearInterval(dwellTimerRef.current)
      dwellTimerRef.current = setInterval(async () => {
        if (!currentZoneRef.current) return
        const elapsedSec = Math.floor((Date.now() - (enterTimeRef.current || 0)) / 1000)
        const dwellLimitSec = (currentZoneRef.current.dwell_minutes || 5) * 60
        const minutes = Math.floor(elapsedSec / 60)
        const seconds = elapsedSec % 60
        setGeoMsg(
          `⚠️ Inside ${currentZoneRef.current.zone_type} zone (${currentZoneRef.current.name}) — ${minutes}m ${seconds}s`,
        )
        if (elapsedSec >= dwellLimitSec) {
          clearInterval(dwellTimerRef.current!)
          await notifyDwell(elapsedSec)
          beep()
          setGeoMsg(`🚨 Dwell limit exceeded — authorities notified!`)
        }
      }, 5000)
    } else if (!inside && currentZoneRef.current) {
      setGeoMsg(`✅ Exited ${currentZoneRef.current.zone_type} zone: ${currentZoneRef.current.name}`)
      setGeoStatus("safe")
      currentZoneRef.current = null
      if (dwellTimerRef.current) clearInterval(dwellTimerRef.current)
      dwellTimerRef.current = null
      enterTimeRef.current = null
    } else if (!inside) {
      setGeoMsg("✅ You are in a safe zone")
      setGeoStatus("safe")
    }
  }

  const sendGPS = async (lat: number, lng: number) => {
    try {
      await fetch(`${API}/api/gps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourist_id: touristId, lat, lng }),
      })
    } catch (err) {
      console.error("GPS send failed:", err)
    }
  }

  const notifyDwell = async (secondsInside: number) => {
    if (!currentZoneRef.current) return
    try {
      await fetch(`${API}/api/geofence/dwell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourist_id: touristId,
          zone_id: currentZoneRef.current.id,
          seconds_inside: secondsInside,
        }),
      })
    } catch (err) {
      console.error("Dwell notify failed:", err)
    }
  }

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = "sine"
      o.frequency.value = 880
      o.start()
      setTimeout(() => {
        o.stop()
        ctx.close()
      }, 150)
    } catch (e) {}
  }

  const getStatusColor = () => {
    switch (geoStatus) {
      case "safe":
        return "bg-green-100 text-green-700 border-green-200"
      case "warning":
        return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "danger":
        return "bg-red-100 text-red-700 border-red-200"
      default:
        return "bg-blue-100 text-blue-700 border-blue-200"
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Live Map & Geofence</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${geoStatus === "safe" ? "bg-green-500" : geoStatus === "danger" ? "bg-red-500 animate-pulse" : "bg-yellow-500"}`}></div>
          <span className="text-xs font-semibold text-gray-600 uppercase">
            {geoStatus === "safe" ? "Safe" : geoStatus === "danger" ? "Alert" : "Monitoring"}
          </span>
        </div>
      </div>

      <div id="tourist-map" className="w-full h-96 rounded-2xl border-2 border-gray-200 shadow-inner mb-4"></div>

      <div className={`p-4 rounded-2xl text-sm font-medium border ${getStatusColor()}`}>
        <div className="flex items-start space-x-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <p className="flex-1">{geoMsg}</p>
        </div>
      </div>
    </div>
  )
}
