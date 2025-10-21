"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import "leaflet/dist/leaflet.css"
import TouristLookup from "@/components/dashboard/tourist-lookup"
import IncidentFeed from "@/components/dashboard/incident-feed"
import QuickStats from "@/components/dashboard/quick-stats"
import RecentIncidents from "@/components/dashboard/recent-incidents"

const DashboardMap = dynamic(() => import("@/components/dashboard/map"), { ssr: false })

export default function DashboardPage() {
  const [tourists, setTourists] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchData()
  }, [refreshTrigger])

  const fetchData = async () => {
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const [touristsRes, logsRes] = await Promise.all([fetch(`${api}/api/tourists`), fetch(`${api}/api/logs`)])
      const touristsData = await touristsRes.json()
      const logsData = await logsRes.json()
      setTourists(touristsData)
      setLogs(logsData)
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
    }
  }

  return (
    <div style={{ backgroundColor: "var(--monitor-surface)" }} className="min-h-screen">
      <div className="w-full h-screen p-4 flex flex-col">
        <div style={{ color: "var(--muted)" }} className="flex justify-between items-center gap-4 mb-2">
          <div style={{ color: "var(--text)" }} className="font-bold">
            GuardianID Authority Dashboard
          </div>
          <div className="text-sm">Live  Heatmap  eKYC  Incidents Ticketing</div>
        </div>

        <div className="grid grid-cols-[300px_1fr] gap-4 flex-1">
          <div className="flex flex-col gap-3 overflow-y-auto">
            <TouristLookup tourists={tourists} logs={logs} />
            <QuickStats tourists={tourists} logs={logs} />
            <RecentIncidents logs={logs} />
          </div>

          <div className="flex flex-col gap-3">
            <DashboardMap tourists={tourists} logs={logs} />
            <IncidentFeed logs={logs} onRefresh={() => setRefreshTrigger((prev) => prev + 1)} />
          </div>
        </div>
      </div>
    </div>
  )
}