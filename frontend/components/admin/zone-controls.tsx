"use client"

<<<<<<< HEAD
import { useState, RefObject } from "react"
import L from "leaflet"
=======
import { useState, useRef } from "react"
>>>>>>> bbc8bab (Initial commit)

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface ZoneControlsProps {
  onZoneSaved: () => void
<<<<<<< HEAD
  drawnPolygon: L.Polygon | null
  latestPolyRef: RefObject<L.Polygon | null>
}

export default function ZoneControls({ onZoneSaved, drawnPolygon, latestPolyRef }: ZoneControlsProps) {
=======
}

export default function ZoneControls({ onZoneSaved }: ZoneControlsProps) {
>>>>>>> bbc8bab (Initial commit)
  const [zoneName, setZoneName] = useState("")
  const [zoneType, setZoneType] = useState("RESTRICTED")
  const [dwellMinutes, setDwellMinutes] = useState(5)
  const [status, setStatus] = useState("Draw a polygon on the right and then save it.")
<<<<<<< HEAD

  const handleSaveZone = async () => {
    // ✅ USE THE REF FIRST, FALLBACK TO STATE
    const polygon = latestPolyRef.current || drawnPolygon
    
    console.log("Save zone clicked. Polygon:", polygon) // Debug log
    
    if (!polygon) {
      setStatus("Please draw a polygon first.")
      return
    }

=======
  const latestPolyRef = useRef<any>(null)

  const handleSaveZone = async () => {
    if (!latestPolyRef.current) {
      setStatus("Please draw a polygon first.")
      return
    }
>>>>>>> bbc8bab (Initial commit)
    if (!zoneName.trim()) {
      setStatus("Please enter a name.")
      return
    }

<<<<<<< HEAD
    try {
      // ✅ PROPER TYPE HANDLING FOR getLatLngs()
      const rawLatLngs = polygon.getLatLngs()
      let latlngs: [number, number][]

      // Check if it's a nested array (polygon with holes)
      if (rawLatLngs.length > 0 && Array.isArray(rawLatLngs[0])) {
        latlngs = (rawLatLngs[0] as L.LatLng[]).map((ll) => [ll.lng, ll.lat])
      } else {
        latlngs = (rawLatLngs as L.LatLng[]).map((ll) => [ll.lng, ll.lat])
      }

      if (latlngs.length < 3) {
        setStatus("Polygon needs at least 3 points.")
        return
      }

      // Close the polygon if not already closed
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
      }) // Debug log

=======
    const latlngs = latestPolyRef.current.getLatLngs()[0].map((ll: any) => [ll.lng, ll.lat])
    if (latlngs.length < 3) {
      setStatus("Polygon needs at least 3 points.")
      return
    }

    if (latlngs[0][0] !== latlngs[latlngs.length - 1][0] || latlngs[0][1] !== latlngs[latlngs.length - 1][1]) {
      latlngs.push(latlngs[0])
    }

    const geojson = { type: "Polygon", coordinates: [latlngs] }

    try {
>>>>>>> bbc8bab (Initial commit)
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
<<<<<<< HEAD
=======
        latestPolyRef.current = null
>>>>>>> bbc8bab (Initial commit)
        onZoneSaved()
      } else {
        setStatus("Error: " + JSON.stringify(data))
      }
    } catch (err) {
<<<<<<< HEAD
      setStatus("Failed to save zone: " + String(err))
=======
      setStatus("Failed to save zone")
>>>>>>> bbc8bab (Initial commit)
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
