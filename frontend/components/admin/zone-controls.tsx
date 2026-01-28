"use client"

import { useState, useRef, type RefObject } from "react"
import L from "leaflet"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface ZoneControlsProps {
  onZoneSaved: () => void
  drawnPolygon?: L.Polygon | null
  latestPolyRef?: RefObject<L.Polygon | null>
}

export default function ZoneControls({ onZoneSaved, drawnPolygon, latestPolyRef }: ZoneControlsProps) {
  const [zoneName, setZoneName] = useState("")
  const [zoneType, setZoneType] = useState("RESTRICTED")
  const [dwellMinutes, setDwellMinutes] = useState(5)
  const [status, setStatus] = useState("Draw a polygon on the right and then save it.")

  const internalLatestRef = useRef<any>(null)

  const handleSaveZone = async () => {
    const polygon = (latestPolyRef && latestPolyRef.current) || internalLatestRef.current || drawnPolygon

    if (!polygon) {
      setStatus("Please draw a polygon first.")
      return
    }

    if (!zoneName.trim()) {
      setStatus("Please enter a name.")
      return
    }

    try {
      const rawLatLngs = polygon.getLatLngs()
      let latlngs: [number, number][]

      if (rawLatLngs.length > 0 && Array.isArray(rawLatLngs[0])) {
        latlngs = (rawLatLngs[0] as L.LatLng[]).map((ll) => [ll.lng, ll.lat])
      } else {
        latlngs = (rawLatLngs as L.LatLng[]).map((ll) => [ll.lng, ll.lat])
      }

      if (latlngs.length < 3) {
        setStatus("Polygon needs at least 3 points.")
        return
      }

      const firstPoint = latlngs[0]
      const lastPoint = latlngs[latlngs.length - 1]
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        latlngs.push(firstPoint)
      }

      const geojson = { type: "Polygon", coordinates: [latlngs] }

      console.log("Sending to API:", {
        name: zoneName.trim(),
        zone_type: zoneType,
        dwell_minutes: dwellMinutes,
        geojson,
      })

      const res = await fetch(`${API}/api/zones/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: zoneName.trim(),
          zone_type: zoneType,
          dwell_minutes: dwellMinutes,
          geojson,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus("Zone saved ✔. It will appear on dashboard & tourist app.")
        setZoneName("")
        if (latestPolyRef && latestPolyRef.current) latestPolyRef.current = null
        internalLatestRef.current = null
        onZoneSaved()
      } else {
        setStatus("Error: " + JSON.stringify(data))
      }
    } catch (err) {
      setStatus("Failed to save zone: " + String(err))
      console.error(err)
    }
  }

  return (
    <div style={{ backgroundColor: "var(--card)", color: "#000000" }} className="rounded-3xl p-3">
      <div className="font-bold mb-2">Controls</div>

      <label style={{ color: "#000712ff" }} className="block font-semibold text-sm mt-2 mb-1">
        Zone Name
      </label>
      <input
        type="text"
        placeholder="e.g., Kaziranga Buffer Strip"
        value={zoneName}
        onChange={(e) => setZoneName(e.target.value)}
        style={{ color: "#000000" }}
        className="w-full p-2 rounded-2xl border border-gray-700 bg-transparent text-sm"
      />

      <label style={{ color: "#000f25ff" }} className="block font-semibold text-sm mt-2 mb-1">
        Zone Type
      </label>
      <select
        value={zoneType}
        onChange={(e) => setZoneType(e.target.value)}
        style={{ color: "#000000" }}
        className="w-full p-2 rounded-2xl border border-gray-700 bg-transparent text-sm"
      >
        <option value="RESTRICTED">RESTRICTED</option>
        <option value="DANGER">DANGER</option>
        <option value="TERROR">TERROR</option>
      </select>

      <label style={{ color: "#000c1cff" }} className="block font-semibold text-sm mt-2 mb-1">
        Dwell Minutes
      </label>
      <input
        type="number"
        min="1"
        value={dwellMinutes}
        onChange={(e) => setDwellMinutes(Number.parseInt(e.target.value) || 5)}
        style={{ color: "#000000" }}
        className="w-full p-2 rounded-2xl border border-gray-700 bg-transparent text-sm"
      />

      <button
        onClick={handleSaveZone}
        style={{ backgroundColor: "var(--accent)", color: "#071426" }}
        className="w-full font-bold p-2 rounded-2xl mt-2 hover:opacity-90"
      >
        Save Zone
      </button>

      <p style={{ color: "#94a3b8" }} className="text-xs mt-2">
        {status}
      </p>

      <div style={{ color: "#94a3b8" }} className="mt-3 text-xs">
        <div className="font-bold mb-1">Legend</div>
        <ul className="ml-4">
          <li>🔴 TERROR</li>
          <li>🟠 RESTRICTED</li>
          <li>🔶 DANGER</li>
        </ul>
      </div>
    </div>
  )
}
