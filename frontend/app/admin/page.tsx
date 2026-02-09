"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { motion } from "framer-motion"
import "leaflet/dist/leaflet.css"
import ZoneControls from "@/components/admin/zone-controls"
import ZoneList from "@/components/admin/zone-list"
import L from "leaflet"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, MapPin } from "lucide-react"
import { fadeUp, stagger } from "@/components/motion/variants"

const AdminMap = dynamic(() => import("@/components/admin/map"), { ssr: false })

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function AdminPage() {
  const [zones, setZones] = useState<any[]>([])
  const [drawnPolygon, setDrawnPolygon] = useState<L.Polygon | null>(null)
  const latestPolyRef = useRef<L.Polygon | null>(null)

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
    latestPolyRef.current = null
    setDrawnPolygon(null)
    fetchZones()
  }

  const handlePolygonDrawn = (polygon: L.Polygon) => {
    latestPolyRef.current = polygon
    setDrawnPolygon(polygon)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/90 shadow-sm">
        <div className="mx-auto max-w-[1920px] px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl border border-slate-300/50 bg-gradient-to-br from-slate-200/60 via-slate-100/80 to-slate-200/60 flex items-center justify-center shadow-sm ring-1 ring-slate-200/50">
              <MapPin className="size-5 text-slate-600" />
            </div>
            <div>
              <h1 className="font-bold leading-tight bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
                GuardianID Zone Management
              </h1>
              <p className="text-xs text-slate-500 leading-tight">Draw and manage geofence zones</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2 border-slate-300/60 text-slate-700 hover:bg-slate-100/80">
            <Link href="/dashboard">
              <LayoutDashboard className="size-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <div className="w-full h-[calc(100vh-73px)] p-4 sm:p-6 flex flex-col">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-[300px_1fr] gap-4 flex-1 min-h-0"
        >
          <motion.div variants={fadeUp} className="flex flex-col gap-3 min-h-0">
            <ZoneControls
              onZoneSaved={handleZoneSaved}
              drawnPolygon={drawnPolygon}
              latestPolyRef={latestPolyRef}
            />
            <ZoneList zones={zones} onZoneDeleted={fetchZones} />
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-col gap-2 min-h-0">
            <p className="text-xs text-slate-500">
              Draw a polygon on the map, then set name and type in the panel.
            </p>
            <div className="flex-1 min-h-0 rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm overflow-hidden">
              <AdminMap zones={zones} onPolygonDrawn={handlePolygonDrawn} />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
