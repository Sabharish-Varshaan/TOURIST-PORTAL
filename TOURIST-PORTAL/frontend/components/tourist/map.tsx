"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import * as turf from "@turf/turf"
import NavigationPanel, { type NavLatLng, type NavRoute } from "./navigation-panel"
import { offlineFetch } from "@/lib/offline/sync"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

interface TouristMapProps {
  touristId: string
  roomId?: string | null
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function latLngToTileXY(lat: number, lng: number, z: number) {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

export default function TouristMap({ touristId, roomId }: TouristMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const [geoMsg, setGeoMsg] = useState("🔄 Initializing geofence monitoring...")
  const [geoStatus, setGeoStatus] = useState<"safe" | "warning" | "danger" | "loading">("loading")
  const [currentPos, setCurrentPos] = useState<NavLatLng | null>(null)
  const userMarkerRef = useRef<L.CircleMarker | null>(null)
  const roomMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map())
  const roomPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const zonesRef = useRef<any[]>([])
  const currentZoneRef = useRef<any>(null)
  const enterTimeRef = useRef<number | null>(null)
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastKnownRef = useRef<{ lat: number | null; lng: number | null; ts: number | null }>({
    lat: null,
    lng: null,
    ts: null,
  })

  // ---- Navigation state ----
  const navRouteRef = useRef<NavRoute | null>(null)
  const navPolylineRef = useRef<L.Polyline | null>(null)
  const navIdxRef = useRef<number>(0)
  const [navActive, setNavActive] = useState(false)
  const [navBanner, setNavBanner] = useState<string>("")
  const [navIdx, setNavIdx] = useState<number>(0)

  // ---- Offline map download state ----
  const [tileZoomMin, setTileZoomMin] = useState<number>(13)
  const [tileZoomMax, setTileZoomMax] = useState<number>(15)
  const [tileStatus, setTileStatus] = useState<string>("")
  const [tileBusy, setTileBusy] = useState(false)

  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map("tourist-map").setView([26.1725, 91.744], 14)
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map)
      mapRef.current = map

      fetchZones()
      startGeolocation()
    }

    return () => {
      if (dwellTimerRef.current) clearInterval(dwellTimerRef.current)
      if (roomPollRef.current) clearInterval(roomPollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    const clearRoomMarkers = () => {
      roomMarkersRef.current.forEach((marker) => marker.remove())
      roomMarkersRef.current.clear()
    }

    if (!roomId) {
      clearRoomMarkers()
      return
    }

    const updateMarkers = (members: any[]) => {
      const seen = new Set<string>()
      members.forEach((m) => {
        if (!m?.tourist_id || m.tourist_id === touristId) return
        const lat = Number(m.last_lat)
        const lng = Number(m.last_lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        seen.add(m.tourist_id)
        const existing = roomMarkersRef.current.get(m.tourist_id)
        if (existing) {
          existing.setLatLng([lat, lng])
        } else {
          const marker = L.circleMarker([lat, lng], {
            radius: 6,
            fillColor: "#22c55e",
            color: "#ffffff",
            weight: 2,
            fillOpacity: 0.9,
          }).addTo(mapRef.current!)
          const displayName = (m.name && String(m.name).trim()) ? String(m.name).trim() : `Member ${m.tourist_id?.slice(-6) || ""}`
          marker.bindTooltip(displayName, {
            permanent: true,
            direction: "top",
            className: "room-member-tooltip",
            offset: [0, -8],
          })
          roomMarkersRef.current.set(m.tourist_id, marker)
        }
      })
      Array.from(roomMarkersRef.current.keys()).forEach((id) => {
        if (!seen.has(id)) {
          const marker = roomMarkersRef.current.get(id)
          if (marker) marker.remove()
          roomMarkersRef.current.delete(id)
        }
      })
    }

    const fetchMembers = async () => {
      try {
        const res = await fetch(`${API}/api/rooms/${roomId}/members`)
        if (!res.ok) return
        const data = await res.json()
        updateMarkers(Array.isArray(data.members) ? data.members : [])
      } catch (err) {
        console.error("Failed to fetch room members:", err)
      }
    }

    fetchMembers()
    if (roomPollRef.current) clearInterval(roomPollRef.current)
    roomPollRef.current = setInterval(fetchMembers, 5000)
    return () => {
      if (roomPollRef.current) clearInterval(roomPollRef.current)
      clearRoomMarkers()
    }
  }, [roomId, touristId])

  const fetchZones = async () => {
    try {
      const res = await fetch(`${API}/api/zones`)
      const zones = await res.json()
      zonesRef.current = zones
      try {
        localStorage.setItem(`guardianid:zones_cache`, JSON.stringify(zones))
      } catch {}

      zones.forEach((z: any) => {
        const coords = z.geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng])
        const color = z.zone_type === "TERROR" ? "#ef4444" : z.zone_type === "RESTRICTED" ? "#f59e0b" : "#f43f5e"
        const poly = L.polygon(coords, { color, weight: 2, fillOpacity: 0.2 }).addTo(mapRef.current!)
        poly.bindTooltip(`${z.zone_type}: ${z.name} (max ${z.dwell_minutes} min)`, { permanent: false })
      })
    } catch (err) {
      console.error("Failed to fetch zones:", err)
      // Offline fallback: cached zones
      try {
        const cached = localStorage.getItem(`guardianid:zones_cache`)
        if (cached) {
          const zones = JSON.parse(cached)
          zonesRef.current = zones
          zones.forEach((z: any) => {
            const coords = z.geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng])
            const color =
              z.zone_type === "TERROR" ? "#ef4444" : z.zone_type === "RESTRICTED" ? "#f59e0b" : "#f43f5e"
            const poly = L.polygon(coords, { color, weight: 2, fillOpacity: 0.2 }).addTo(mapRef.current!)
            poly.bindTooltip(`${z.zone_type}: ${z.name} (cached)`, { permanent: false })
          })
          setGeoMsg("📦 Loaded cached zones (offline)")
        }
      } catch {}
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
    setCurrentPos({ lat, lng })
    try {
      localStorage.setItem(`guardianid:tourist:${touristId}:last_lat`, String(lat))
      localStorage.setItem(`guardianid:tourist:${touristId}:last_lng`, String(lng))
      localStorage.setItem(`guardianid:tourist:${touristId}:last_ts`, String(Date.now()))
    } catch {}

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
    updateNavigation(lat, lng)

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
      await offlineFetch(
        `${API}/api/gps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourist_id: touristId, lat, lng }),
        },
        { type: "gps", coalesceKey: `gps:${touristId}` },
      )
    } catch (err) {
      console.error("GPS send failed:", err)
    }
  }

  const notifyDwell = async (secondsInside: number) => {
    if (!currentZoneRef.current) return
    try {
      await offlineFetch(
        `${API}/api/geofence/dwell`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tourist_id: touristId,
            zone_id: currentZoneRef.current.id,
            seconds_inside: secondsInside,
          }),
        },
        { type: "geofence_dwell" },
      )
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

  const drawRoute = (route: NavRoute) => {
    if (!mapRef.current) return
    const coordsLatLng = (route.line?.coordinates || []).map(([lng, lat]) => [lat, lng] as [number, number])

    if (navPolylineRef.current) {
      try {
        navPolylineRef.current.remove()
      } catch {}
      navPolylineRef.current = null
    }

    if (coordsLatLng.length > 1) {
      navPolylineRef.current = L.polyline(coordsLatLng, { color: "#2563eb", weight: 5, opacity: 0.9 }).addTo(
        mapRef.current,
      )
      try {
        mapRef.current.fitBounds(navPolylineRef.current.getBounds(), { padding: [24, 24] })
      } catch {}
    }
  }

  const stopNavigation = () => {
    setNavActive(false)
    setNavBanner("")
    navRouteRef.current = null
    navIdxRef.current = 0
    setNavIdx(0)
    if (navPolylineRef.current) {
      try {
        navPolylineRef.current.remove()
      } catch {}
      navPolylineRef.current = null
    }
  }

  const handleRouteLoaded = (route: NavRoute) => {
    navRouteRef.current = route
    navIdxRef.current = 0
    setNavIdx(0)
    setNavActive(true)
    setNavBanner("Navigation started. Move to get instructions.")
    drawRoute(route)
  }

  const updateNavigation = (lat: number, lng: number) => {
    if (!navActive) return
    const route = navRouteRef.current
    if (!route) return

    const steps = route.steps || []
    const idx = navIdxRef.current
    const next = steps[idx]

    if (next?.maneuverLatLng) {
      const d = haversineMeters(lat, lng, next.maneuverLatLng.lat, next.maneuverLatLng.lng)
      const meters = Math.round(d)
      setNavBanner(`Next: ${next.instruction} in ${meters}m`)
      if (d < 20 && idx < steps.length - 1) {
        navIdxRef.current = idx + 1
        setNavIdx(idx + 1)
        try {
          navigator.vibrate?.(120)
        } catch {}
        beep()
      }
      return
    }

    if (route.to) {
      const d = haversineMeters(lat, lng, route.to.lat, route.to.lng)
      const b = bearingDeg(lat, lng, route.to.lat, route.to.lng)
      setNavBanner(`Go ~${Math.round(d)}m, bearing ${Math.round(b)}° to destination`)
    }
  }

  const downloadOfflineTiles = async () => {
    if (!mapRef.current) return
    if (!("caches" in window)) {
      setTileStatus("Cache API not available in this browser.")
      return
    }
    const bounds = mapRef.current.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    const zMin = Math.min(tileZoomMin, tileZoomMax)
    const zMax = Math.max(tileZoomMin, tileZoomMax)

    const tiles: { z: number; x: number; y: number }[] = []
    for (let z = zMin; z <= zMax; z++) {
      const t1 = latLngToTileXY(ne.lat, sw.lng, z)
      const t2 = latLngToTileXY(sw.lat, ne.lng, z)
      const xMin = Math.min(t1.x, t2.x)
      const xMax = Math.max(t1.x, t2.x)
      const yMin = Math.min(t1.y, t2.y)
      const yMax = Math.max(t1.y, t2.y)
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          tiles.push({ z, x, y })
        }
      }
    }

    const hardLimit = 1200
    if (tiles.length > hardLimit) {
      setTileStatus(`Selected area is too big (${tiles.length} tiles). Zoom in or reduce zoom range.`)
      return
    }

    setTileBusy(true)
    setTileStatus(`Downloading ${tiles.length} tiles…`)
    try {
      const cache = await caches.open("guardianid-tiles-v1")
      let done = 0
      const concurrency = 8

      for (let i = 0; i < tiles.length; i += concurrency) {
        const batch = tiles.slice(i, i + concurrency)
        await Promise.all(
          batch.map(async (t) => {
            const tileUrl = `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`
            const req = new Request(tileUrl, { mode: "no-cors" })
            const existing = await cache.match(req)
            if (existing) return
            const res = await fetch(req)
            if (res && (res.ok || res.type === "opaque")) {
              await cache.put(req, res)
            }
          }),
        )
        done += batch.length
        setTileStatus(`Downloading ${tiles.length} tiles… (${done}/${tiles.length})`)
      }

      setTileStatus(`Offline area cached: ${tiles.length} tiles.`)
    } catch (e) {
      setTileStatus(`Tile download failed: ${String((e as any)?.message || e)}`)
    } finally {
      setTileBusy(false)
    }
  }

  const clearOfflineTiles = async () => {
    try {
      await caches.delete("guardianid-tiles-v1")
      setTileStatus("Cleared offline tiles cache.")
    } catch {
      setTileStatus("Failed to clear offline tiles cache.")
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

      {navActive && navBanner ? (
        <div className="mt-4 p-4 rounded-2xl border bg-blue-50 border-blue-200 text-blue-800 text-sm font-semibold">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">{navBanner}</div>
            <div className="text-xs font-bold opacity-80">
              Step {Math.min(navIdx + 1, (navRouteRef.current?.steps?.length || 1))}/{navRouteRef.current?.steps?.length || 1}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <NavigationPanel touristId={touristId} current={currentPos} onRouteLoaded={handleRouteLoaded} onStop={stopNavigation} />
      </div>

      <div className="mt-6 bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold text-gray-900">Offline maps</h3>
          <div className="text-xs font-semibold text-gray-600">Cache tiles for this view</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-gray-600">Zoom</label>
          <select
            value={tileZoomMin}
            onChange={(e) => setTileZoomMin(Number(e.target.value))}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            {[10, 11, 12, 13, 14, 15, 16].map((z) => (
              <option key={z} value={z}>
                min {z}
              </option>
            ))}
          </select>
          <select
            value={tileZoomMax}
            onChange={(e) => setTileZoomMax(Number(e.target.value))}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            {[12, 13, 14, 15, 16, 17].map((z) => (
              <option key={z} value={z}>
                max {z}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={tileBusy}
            onClick={downloadOfflineTiles}
            className="px-4 py-3 rounded-2xl bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-60"
          >
            {tileBusy ? "Downloading…" : "Download offline area"}
          </button>
          <button
            type="button"
            onClick={clearOfflineTiles}
            className="px-4 py-3 rounded-2xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
          >
            Clear offline tiles
          </button>
        </div>
        {tileStatus ? <div className="mt-3 text-sm text-gray-700">{tileStatus}</div> : null}
      </div>
    </div>
  )
}
