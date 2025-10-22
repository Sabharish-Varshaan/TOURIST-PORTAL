"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import "leaflet/dist/leaflet.css"
import ZoneControls from "@/components/admin/zone-controls"
import ZoneList from "@/components/admin/zone-list"
import L from "leaflet"

const AdminMap = dynamic(() => import("@/components/admin/map"), { ssr: false })

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function AdminPage() {
  const [zones, setZones] = useState<any[]>([])
  const [drawnPolygon, setDrawnPolygon] = useState<L.Polygon | null>(null)
  const latestPolyRef = useRef<L.Polygon | null>(null) // ✅ Use ref for immediate updates

  useEffect(() => {
    fetchZones()
  }, [])

  const fetchZones = async () => {
    try {
      const res = await fetch(`${API}/api/zones`)
      const data = await res.json()
      setZones(data)
    } catch (err) {
      console.error("Failed to fetch zones:", err)
    }
  }

  const handleZoneSaved = () => {
    latestPolyRef.current = null // ✅ Clear the ref
    setDrawnPolygon(null)
    fetchZones()
  }

  const handlePolygonDrawn = (polygon: L.Polygon) => {
    latestPolyRef.current = polygon // ✅ Store in ref immediately
    setDrawnPolygon(polygon) // Also update state for React rendering
    console.log("Polygon drawn and stored:", polygon) // Debug log
  }

  return (
    <div style={{ backgroundColor: "var(--monitor-surface)" }} className="min-h-screen">
      <div className="w-full h-screen p-4 flex flex-col">
        <div style={{ color: "var(--text)" }} className="font-bold mb-2">
          GuardianID Zone Management
        </div>

        <div className="grid grid-cols-[300px_1fr] gap-4 flex-1">
          <div className="flex flex-col gap-3">
            <ZoneControls 
              onZoneSaved={handleZoneSaved} 
              drawnPolygon={drawnPolygon}
              latestPolyRef={latestPolyRef}
            />
            <ZoneList zones={zones} onZoneDeleted={fetchZones} />
          </div>

          <div className="flex-1">
            <AdminMap zones={zones} onPolygonDrawn={handlePolygonDrawn} />
          </div>
        </div>
      </div>
    </div>
  )
}
