"use client"

import { useEffect } from "react"
import { startOfflineSyncLoop } from "@/lib/offline/sync"

export default function AppBootstrap() {
  useEffect(() => {
    const stopSync = startOfflineSyncLoop()

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Ensure the latest SW is used (helps during dev/iterating).
          try {
            reg.update()
          } catch {
            // no-op
          }
        })
        .catch(() => {
          // no-op
        })
    }

    return () => {
      stopSync()
    }
  }, [])

  return null
}

