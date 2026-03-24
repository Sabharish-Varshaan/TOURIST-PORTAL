"use client"

import { useState, RefObject } from "react"
import { motion, AnimatePresence } from "framer-motion"
import L from "leaflet"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { fadeIn } from "@/components/motion/variants"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface ZoneControlsProps {
  onZoneSaved: () => void
  drawnPolygon: L.Polygon | null
  latestPolyRef: RefObject<L.Polygon | null>
}

type StatusType = "idle" | "success" | "error"

export default function ZoneControls({ onZoneSaved, drawnPolygon, latestPolyRef }: ZoneControlsProps) {
  const [zoneName, setZoneName] = useState("")
  const [zoneType, setZoneType] = useState<"RESTRICTED" | "DANGER" | "TERROR">("RESTRICTED")
  const [dwellMinutes, setDwellMinutes] = useState(5)
  const [status, setStatus] = useState("Draw a polygon on the map, then set name and type here.")
  const [statusType, setStatusType] = useState<StatusType>("idle")

  const handleSaveZone = async () => {
    const polygon = latestPolyRef.current || drawnPolygon

    if (!polygon) {
      setStatus("Please draw a polygon first.")
      setStatusType("error")
      return
    }

    if (!zoneName.trim()) {
      setStatus("Please enter a name.")
      setStatusType("error")
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
        setStatusType("error")
        return
      }

      const firstPoint = latlngs[0]
      const lastPoint = latlngs[latlngs.length - 1]
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        latlngs.push(firstPoint)
      }

      const geojson = { type: "Polygon", coordinates: [latlngs] }

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
        setStatus("Zone saved. It will appear on dashboard and tourist app.")
        setStatusType("success")
        setZoneName("")
        onZoneSaved()
      } else {
        setStatus("Error: " + JSON.stringify(data))
        setStatusType("error")
      }
    } catch (err) {
      setStatus("Failed to save zone: " + String(err))
      setStatusType("error")
      console.error(err)
    }
  }

  return (
    <Card className="dashboard-card rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2">
          <Label htmlFor="zone-name">Zone Name</Label>
          <Input
            id="zone-name"
            type="text"
            placeholder="e.g., Kaziranga Buffer Strip"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            className="rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label>Zone Type</Label>
          <Select
            value={zoneType}
            onValueChange={(v) => setZoneType(v as "RESTRICTED" | "DANGER" | "TERROR")}
          >
            <SelectTrigger className="w-full rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RESTRICTED">RESTRICTED</SelectItem>
              <SelectItem value="DANGER">DANGER</SelectItem>
              <SelectItem value="TERROR">TERROR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dwell-minutes">Dwell Minutes</Label>
          <Input
            id="dwell-minutes"
            type="number"
            min={1}
            value={dwellMinutes}
            onChange={(e) => setDwellMinutes(Number.parseInt(e.target.value) || 5)}
            className="rounded-lg"
          />
        </div>

        <Button
          onClick={handleSaveZone}
          className="w-full rounded-lg font-semibold"
        >
          Save Zone
        </Button>

        <AnimatePresence mode="wait">
          <motion.div
            key={status + statusType}
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="hidden"
            className="min-h-[2.5rem]"
          >
            {statusType === "error" ? (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            ) : statusType === "success" ? (
              <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">{status}</p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="space-y-2 pt-1 border-t border-border">
          <span className="text-xs font-semibold text-muted-foreground">Legend</span>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">TERROR</Badge>
            <Badge className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">RESTRICTED</Badge>
            <Badge className="border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200">DANGER</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
