"use client"

import { useEffect, useMemo, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export type ResponderTicket = {
  id: number
  tourist_id: string
  event_type: string
  location_label: string
  timestamp: string
  lat: number
  lng: number
  ticket_status: string
  ticket_assignee?: string | null
}

export default function ResponderMap({
  tickets,
  selected,
  me,
  routeLine,
  onSelect,
  onMeUpdate,
}: {
  tickets: ResponderTicket[]
  selected: ResponderTicket | null
  me: { lat: number; lng: number } | null
  routeLine: { type: "LineString"; coordinates: [number, number][] } | null
  onSelect: (t: ResponderTicket) => void
  onMeUpdate: (pos: { lat: number; lng: number }) => void
}) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<number, L.Marker>>({})
  const meMarkerRef = useRef<L.CircleMarker | null>(null)
  const routeRef = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map("responder-map").setView([26.1725, 91.744], 12)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map)
      mapRef.current = map

      if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            onMeUpdate({ lat, lng })

            if (!meMarkerRef.current) {
              meMarkerRef.current = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: "#10b981",
                color: "#ffffff",
                weight: 2,
                fillOpacity: 0.95,
              }).addTo(map)
              map.setView([lat, lng], 14)
            } else {
              meMarkerRef.current.setLatLng([lat, lng])
            }
          },
          () => {
            // ignore
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
        )
      }
    }
  }, [onMeUpdate])

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    // Remove markers that no longer exist
    const ids = new Set(tickets.map((t) => t.id))
    for (const key of Object.keys(markersRef.current)) {
      const id = Number(key)
      if (!ids.has(id)) {
        try {
          markersRef.current[id].remove()
        } catch {}
        delete markersRef.current[id]
      }
    }

    // Add/update markers
    tickets.forEach((t) => {
      const isSelected = selected?.id === t.id
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width: ${isSelected ? 16 : 14}px;
          height: ${isSelected ? 16 : 14}px;
          border-radius: 999px;
          background: ${t.ticket_status === "CONFIRMED" ? "#ef4444" : "#f59e0b"};
          border: 2px solid #fff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      if (!markersRef.current[t.id]) {
        const m = L.marker([t.lat, t.lng], { icon }).addTo(map)
        m.on("click", () => onSelect(t))
        m.bindTooltip(`SOS #${t.id}`, { permanent: false })
        markersRef.current[t.id] = m
      } else {
        markersRef.current[t.id].setIcon(icon)
        markersRef.current[t.id].setLatLng([t.lat, t.lng])
      }
    })
  }, [tickets, selected, onSelect])

  // Route polyline
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    if (routeRef.current) {
      try {
        routeRef.current.remove()
      } catch {}
      routeRef.current = null
    }
    if (routeLine?.coordinates?.length) {
      const coords = routeLine.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      routeRef.current = L.polyline(coords, { color: "#2563eb", weight: 5, opacity: 0.9 }).addTo(map)
      try {
        map.fitBounds(routeRef.current.getBounds(), { padding: [24, 24] })
      } catch {}
    }
  }, [routeLine])

  return <div id="responder-map" className="w-full h-[520px] rounded-2xl border border-gray-200 shadow-inner" />
}

