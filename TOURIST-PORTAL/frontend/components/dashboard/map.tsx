"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardMapProps {
  tourists: any[]
  logs: any[]
}

export default function DashboardMap({ tourists, logs }: DashboardMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<{ [key: string]: L.Marker }>({})
  const heatLayerRef = useRef<any>(null)
  const zoneLayersRef = useRef<L.Polygon[]>([])

  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    })

    const loadHeatLayer = async () => {
      if (typeof window !== "undefined" && !(window.L as any)?.heatLayer) {
        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"
        script.async = true
        document.head.appendChild(script)
      }
    }

    loadHeatLayer()

    if (!mapRef.current) {
      const map = L.map("dashboard-map").setView([26.1725, 91.744], 12)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map

      setTimeout(() => {
        updateHeatmap()
        loadZones()
      }, 500)
    }

    // ✅ LOAD ZONES FROM API
    const loadZones = async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res = await fetch(`${api}/api/zones`)
        const zones = await res.json()

        // Clear previous zone layers
        zoneLayersRef.current.forEach((layer) => mapRef.current?.removeLayer(layer))
        zoneLayersRef.current = []

        // Draw zones on map
        zones.forEach((z: any) => {
          try {
            const coords = z.geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng])
            const color =
              z.zone_type === "TERROR" ? "#ef4444" : z.zone_type === "RESTRICTED" ? "#f59e0b" : "#f43f5e"
            const polygon = L.polygon(coords, {
              color,
              weight: 2,
              fillOpacity: 0.08,
            })
              .addTo(mapRef.current!)
              .bindTooltip(`${z.zone_type}: ${z.name}`)
            zoneLayersRef.current.push(polygon)
          } catch (e) {
            console.error("Error drawing zone:", e)
          }
        })
      } catch (err) {
        console.error("Failed to load zones:", err)
      }
    }
    const updateHeatmap = () => {
      const pts = tourists
        .filter((t) => t.last_lat && t.last_lat !== "-" && t.last_lng && t.last_lng !== "-")
        .map((t) => {
          const lat = Number.parseFloat(t.last_lat)
          const lng = Number.parseFloat(t.last_lng)
          const w = t.status === "ALERT" ? 1.8 : 1.0
          return [lat, lng, w]
        })

      if ((window.L as any)?.heatLayer && mapRef.current) {
        if (heatLayerRef.current) {
          heatLayerRef.current.setLatLngs(pts)
        } else if (pts.length > 0) {
          heatLayerRef.current = (window.L as any).heatLayer(pts, {
            radius: 28,
            blur: 18,
            maxZoom: 17,
          }).addTo(mapRef.current)
        }
      }
    }

    // Update markers
    tourists.forEach((t) => {
      if (t.last_lat && t.last_lat !== "-" && t.last_lng && t.last_lng !== "-") {
        const key = t.id
        const latlng: [number, number] = [Number.parseFloat(t.last_lat), Number.parseFloat(t.last_lng)]
        const iconEmoji = t.status === "ALERT" ? "🔴" : "🔵"

        if (!markersRef.current[key]) {
          markersRef.current[key] = L.marker(latlng).addTo(mapRef.current!)
        }
        markersRef.current[key].setLatLng(latlng).setPopupContent(`${iconEmoji} ${t.name} (${t.status})`)
      }
    })

    updateHeatmap()
  }, [tourists])

  return (
    <Card className="py-0 overflow-hidden dashboard-card fade-in-up-delay-3">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-sm font-semibold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
          Live map
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="text-xs text-slate-600 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-500 animate-pulse shadow-sm"></span>
          Tourists heatmap + zones • auto-refresh every 5s
        </div>
        <div id="dashboard-map" className="w-full rounded-xl border border-slate-200 shadow-sm" style={{ minHeight: "420px" }} />
      </CardContent>
    </Card>
  )
}
