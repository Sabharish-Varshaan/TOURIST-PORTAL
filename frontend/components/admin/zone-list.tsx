"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface ZoneListProps {
  zones: any[]
  onZoneDeleted: () => void
}

export default function ZoneList({ zones, onZoneDeleted }: ZoneListProps) {
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleDelete = async (zoneId: number) => {
    if (!confirm(`Are you sure you want to delete zone #${zoneId}? This action cannot be undone.`)) {
      return
    }

    setDeleting(zoneId)
    try {
      const res = await fetch(`${API}/api/zones/${zoneId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.ok) {
        onZoneDeleted()
      }
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(null)
    }
  }

  const restrictedCount = zones.filter((z) => z.zone_type === "RESTRICTED").length

  return (
    <div style={{ backgroundColor: "var(--card)", color: "#000000" }} className="rounded-3xl p-3">
      <div className="font-bold mb-2">Manage Existing Zones</div>
      <p style={{ color: "#94a3b8" }} className="text-xs mb-2">
        Total Restricted Zones: <b>{restrictedCount}</b>
      </p>

      <div className="max-h-48 overflow-y-auto">
        {zones.length === 0 ? (
          <p style={{ color: "#94a3b8" }} className="text-xs">
            No zones have been created yet.
          </p>
        ) : (
          zones.map((zone) => (
            <div key={zone.id} className="flex justify-between items-center p-1 text-xs border-b border-gray-700">
              <span>
                {zone.name} ({zone.zone_type})
              </span>
              <button
                onClick={() => handleDelete(zone.id)}
                disabled={deleting === zone.id}
                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:opacity-90 disabled:opacity-50"
              >
                {deleting === zone.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
