"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"
import "leaflet-draw"

interface AdminMapProps {
  zones: any[]
  onPolygonDrawn?: (polygon: L.Polygon) => void
}

export default function AdminMap({ zones, onPolygonDrawn }: AdminMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const callbackRef = useRef(onPolygonDrawn)

  useEffect(() => {
    callbackRef.current = onPolygonDrawn
  }, [onPolygonDrawn])

  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map("admin-map").setView([26.1725, 91.744], 13)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map)

      const drawnItems = new L.FeatureGroup()
      map.addLayer(drawnItems)
      drawnItemsRef.current = drawnItems

      // @ts-ignore
      const drawControl = new L.Control.Draw({
        draw: {
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
          polygon: { allowIntersection: false, showArea: true, metric: true },
        },
        edit: { featureGroup: drawnItems },
      })
      map.addControl(drawControl)
      // Listen for creation and edits and forward polygon via callbackRef
      map.on("draw:created", function (e: any) {
        drawnItems.clearLayers()
        const layer = e.layer
        drawnItems.addLayer(layer)
        if (callbackRef.current) callbackRef.current(layer as L.Polygon)
      })

      map.on("draw:edited", function (e: any) {
        const layers = e.layers
        layers.eachLayer((layer: any) => {
          if (callbackRef.current) callbackRef.current(layer as L.Polygon)
        })
      })
      mapRef.current = map
    }

    // Draw existing zones
    zones.forEach((z) => {
      try {
        const coords = z.geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng])
        const color = z.zone_type === "TERROR" ? "#ef4444" : z.zone_type === "RESTRICTED" ? "#f59e0b" : "#f43f5e"
        L.polygon(coords, { color, weight: 2, fillOpacity: 0.08 })
          .addTo(mapRef.current!)
          .bindTooltip(`${z.zone_type}: ${z.name}`)
      } catch (e) {}
    })
  }, [zones])

  return <div id="admin-map" className="w-full h-full rounded-2xl"></div>
}
