import {
  deleteQueuedRequest,
  getQueueCount,
  listQueuedRequests,
  queueRequest,
  type OfflineQueuedRequestType,
} from "./db"

export const OFFLINE_QUEUE_CHANGED_EVENT = "guardianid:offline-queue-changed"

export function notifyOfflineQueueChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT))
}

type OfflineFetchMeta = {
  type: OfflineQueuedRequestType
  coalesceKey?: string
}

export type OfflineFetchResult = {
  ok: boolean
  queued: boolean
  response?: Response
  queueId?: number
  error?: unknown
}

export async function offlineFetch(input: RequestInfo | URL, init: RequestInit = {}, meta?: OfflineFetchMeta): Promise<OfflineFetchResult> {
  // Server-side render should never attempt to use IndexedDB.
  if (typeof window === "undefined") {
    const res = await fetch(input, init)
    return { ok: res.ok, queued: false, response: res }
  }

  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase()

  // Only queue non-GET requests by default.
  const shouldQueue = Boolean(meta) && method !== "GET"

  // If we already know we're offline, avoid a slow failing request.
  if (shouldQueue && !navigator.onLine) {
    const bodyText = typeof init.body === "string" ? init.body : init.body ? JSON.stringify(init.body) : undefined
    const headers: Record<string, string> = {}
    const h = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    h.forEach((v, k) => (headers[k] = v))

    const queueId = await queueRequest({
      type: meta!.type,
      method,
      url,
      headers,
      bodyText,
      createdAt: Date.now(),
      coalesceKey: meta?.coalesceKey,
    })
    notifyOfflineQueueChanged()
    return { ok: false, queued: true, queueId }
  }

  try {
    const res = await fetch(input, init)
    return { ok: res.ok, queued: false, response: res }
  } catch (error) {
    if (!shouldQueue) return { ok: false, queued: false, error }

    const bodyText = typeof init.body === "string" ? init.body : init.body ? JSON.stringify(init.body) : undefined
    const headers: Record<string, string> = {}
    const h = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    h.forEach((v, k) => (headers[k] = v))

    const queueId = await queueRequest({
      type: meta!.type,
      method,
      url,
      headers,
      bodyText,
      createdAt: Date.now(),
      coalesceKey: meta?.coalesceKey,
    })
    notifyOfflineQueueChanged()
    return { ok: false, queued: true, queueId, error }
  }
}

let syncing = false

export async function syncOfflineQueueOnce(max = 50): Promise<{ synced: number; remaining: number }> {
  if (typeof window === "undefined") return { synced: 0, remaining: 0 }
  if (syncing) return { synced: 0, remaining: await getQueueCount() }
  syncing = true

  try {
    let synced = 0
    const items = await listQueuedRequests(max)

    for (const item of items) {
      if (!item.id) continue
      try {
        const headers = new Headers(item.headers || {})
        // If we stored JSON, keep it JSON.
        if (item.bodyText && !headers.has("content-type")) {
          headers.set("content-type", "application/json")
        }

        const res = await fetch(item.url, {
          method: item.method,
          headers,
          body: item.bodyText,
        })

        if (res.ok) {
          await deleteQueuedRequest(item.id)
          synced += 1
          notifyOfflineQueueChanged()
          continue
        }

        // Stop early on server errors to avoid hammering.
        if (res.status >= 500) break
      } catch {
        // If network is flaky, stop early and wait for next online event.
        break
      }
    }

    const remaining = await getQueueCount()
    return { synced, remaining }
  } finally {
    syncing = false
  }
}

export function startOfflineSyncLoop() {
  if (typeof window === "undefined") return () => {}

  // Attempt once on boot.
  void syncOfflineQueueOnce()

  const onOnline = () => void syncOfflineQueueOnce(200)
  window.addEventListener("online", onOnline)

  // Light polling as a safety net (hackathon-friendly).
  const interval = window.setInterval(() => {
    if (navigator.onLine) void syncOfflineQueueOnce(200)
  }, 20_000)

  return () => {
    window.removeEventListener("online", onOnline)
    window.clearInterval(interval)
  }
}

