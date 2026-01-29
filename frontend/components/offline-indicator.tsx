"use client"

import { useEffect, useState } from "react"
import { getQueueCount } from "@/lib/offline/db"
import { OFFLINE_QUEUE_CHANGED_EVENT } from "@/lib/offline/sync"

export default function OfflineIndicator() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState<number>(0)

  useEffect(() => {
    setOnline(navigator.onLine)

    const refresh = async () => {
      try {
        setPending(await getQueueCount())
      } catch {
        setPending(0)
      }
    }

    void refresh()

    const onOnline = () => {
      setOnline(true)
      void refresh()
    }
    const onOffline = () => {
      setOnline(false)
      void refresh()
    }
    const onQueue = () => void refresh()

    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onQueue)

    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onQueue)
    }
  }, [])

  const tone = online ? "bg-green-50 border-green-200 text-green-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${tone}`}>
      <span className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-yellow-500"} ${online ? "" : "animate-pulse"}`} />
      <span>{online ? "Online" : "Offline"}</span>
      {pending > 0 ? <span className="opacity-80">• Pending sync: {pending}</span> : null}
    </div>
  )
}

