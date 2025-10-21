"use client"

import { useState, useRef } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface ZoneControlsProps {
  onZoneSaved: () => void
}

export default function ZoneControls({ onZoneSaved }: ZoneControlsProps) {
  const [zoneName, setZoneName] = useState("")
  const [zoneType, setZoneType] = useState("RESTRICTED")
  const [dwellMinutes, setDwellMinutes] = useState(5)
  const [status, setStatus] = useState("Draw a polygon on the right and then save it.")
  const latestPolyRef = useRef<any>(null)

  const handleSaveZone = async () => {
    if (!latestPolyRef.current) {
      setStatus("Please draw a polygon first.")
      return
    }
    if (!zoneName.trim()) {
      setStatus("Please enter a name.")
      return
    }

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
        latestPolyRef.current = null
        onZoneSaved()
      } else {
        setStatus("Error: " + JSON.stringify(data))
      }
    } catch (err) {
      setStatus("Failed to save zone")
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
