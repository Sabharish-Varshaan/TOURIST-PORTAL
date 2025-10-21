"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"
import ZoneControls from "@/components/admin/zone-controls"
import ZoneList from "@/components/admin/zone-list"

const AdminMap = dynamic(() => import("@/components/admin/map"), { ssr: false })

export default function AdminPage() {
  const [zones, setZones] = useState<any[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    fetchZones()
  }, [refreshTrigger])

  const fetchZones = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/zones`)
      const data = await res.json()
      setZones(data)
    } catch (err) {
      console.error("Failed to fetch zones:", err)
    }
  }

  const handleZoneSaved = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleZoneDeleted = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div style={{ backgroundColor: "var(--monitor-surface)" }} className="min-h-screen">
      <div className="w-full h-screen p-4 flex flex-col">
        <div className="mb-3">
          <h2 style={{ color: "var(--text)" }} className="text-xl font-bold m-0">
            GuardianID – Admin
          </h2>
          <p style={{ color: "var(--muted)" }} className="text-sm m-0 mt-2">
            Draw restricted/danger/terror polygons on the map. Save to publish to dashboard & tourist apps.
          </p>
        </div>

        <div className="grid grid-cols-[260px_1fr] gap-4 flex-1">
          <div className="flex flex-col gap-3 overflow-y-auto">
            <ZoneControls onZoneSaved={handleZoneSaved} />
            <ZoneList zones={zones} onZoneDeleted={handleZoneDeleted} />
          </div>
          <AdminMap zones={zones} />
        </div>
      </div>
    </div>
  )
}
