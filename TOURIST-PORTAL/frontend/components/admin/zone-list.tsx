"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { MapPin, Trash2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { fadeUp, stagger } from "@/components/motion/variants"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface ZoneListProps {
  zones: any[]
  onZoneDeleted: () => void
}

function zoneBadgeClass(zoneType: string) {
  switch (zoneType) {
    case "RESTRICTED":
      return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
    case "DANGER":
      return "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200"
    default:
      return ""
  }
}

export default function ZoneList({ zones, onZoneDeleted }: ZoneListProps) {
  const [deleting, setDeleting] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const handleDelete = async (zoneId: number) => {
    setConfirmDeleteId(null)
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
    <>
      <Card className="dashboard-card rounded-2xl flex flex-col min-h-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Existing Zones</CardTitle>
          <p className="text-xs text-muted-foreground">
            Restricted: <span className="font-medium text-foreground">{restrictedCount}</span>
          </p>
        </CardHeader>
        <CardContent className="pt-0 flex-1 min-h-0 flex flex-col">
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {zones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <MapPin className="size-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">No zones yet</p>
                <p className="text-xs mt-0.5">Draw a polygon on the map and save it from the Controls panel.</p>
              </div>
            ) : (
              <motion.ul
                variants={stagger}
                initial="hidden"
                animate="show"
                className="space-y-1.5"
              >
                {zones.map((zone) => (
                  <motion.li
                    key={zone.id}
                    variants={fadeUp}
                    className="flex justify-between items-center gap-2 py-2 px-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">{zone.name}</span>
                      <Badge
                        variant={zone.zone_type === "TERROR" ? "destructive" : undefined}
                        className={zone.zone_type !== "TERROR" ? zoneBadgeClass(zone.zone_type) : undefined}
                      >
                        {zone.zone_type}
                      </Badge>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 h-8 gap-1"
                      disabled={deleting === zone.id}
                      onClick={() => setConfirmDeleteId(zone.id)}
                    >
                      <Trash2 className="size-3.5" />
                      {deleting === zone.id ? "…" : "Delete"}
                    </Button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete zone?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove zone #{confirmDeleteId} permanently. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
