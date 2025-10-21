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
  const [geoMsg, setGeoMsg] = useState("Geofence monitoring: waiting for location...")
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
        poly.bindTooltip(`${z.zone_type}: ${z.name} (dwell ${z.dwell_minutes} min)`)
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
          setGeoMsg("Unable to get location (check permissions).")
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      )
    } else {
      setGeoMsg("Geolocation not supported.")
    }
  }

  const onGeo = (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude

    lastKnownRef.current = { lat, lng, ts: Date.now() }

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker([lat, lng], { radius: 6 }).addTo(mapRef.current!)
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
      setGeoMsg(`Entered ${inside.zone_type} zone: ${inside.name}. Monitoring dwell...`)
      beep()

      if (dwellTimerRef.current) clearInterval(dwellTimerRef.current)
      dwellTimerRef.current = setInterval(async () => {
        if (!currentZoneRef.current) return
        const elapsedSec = Math.floor((Date.now() - (enterTimeRef.current || 0)) / 1000)
        const dwellLimitSec = (currentZoneRef.current.dwell_minutes || 5) * 60
        setGeoMsg(
          `Inside ${currentZoneRef.current.zone_type} (${currentZoneRef.current.name}) — ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`,
        )
        if (elapsedSec >= dwellLimitSec) {
          clearInterval(dwellTimerRef.current!)
          await notifyDwell(elapsedSec)
          beep()
          setGeoMsg(`Dwell threshold exceeded — officers notified.`)
        }
      }, 5000)
    } else if (!inside && currentZoneRef.current) {
      setGeoMsg(`Exited ${currentZoneRef.current.zone_type} zone: ${currentZoneRef.current.name}.`)
      currentZoneRef.current = null
      if (dwellTimerRef.current) clearInterval(dwellTimerRef.current)
      dwellTimerRef.current = null
      enterTimeRef.current = null
    } else if (!inside) {
      setGeoMsg("Outside restricted/danger zones.")
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

  return (
    <div className="bg-white rounded-4xl shadow-lg p-5 mb-4">
      <h1 className="text-2xl font-bold mb-3">Live Map & Geofence</h1>
      <div id="tourist-map" className="w-full h-80 rounded-3xl"></div>
      <p className="text-gray-600 text-sm mt-3">{geoMsg}</p>
    </div>
  )
}
