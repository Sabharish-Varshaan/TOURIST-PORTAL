export type OfflineQueuedRequestType = "gps" | "sos" | "geofence_dwell" | "generic"

export type OfflineQueuedRequest = {
  id?: number
  type: OfflineQueuedRequestType
  method: string
  url: string
  headers?: Record<string, string>
  bodyText?: string
  createdAt: number
  // Optional: used to coalesce noisy events like GPS while offline.
  coalesceKey?: string
}

export type CachedRoute = {
  key: string
  touristId: string
  profile: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  line: any // GeoJSON LineString
  steps: any[] // normalized steps for UI
  createdAt: number
}

const DB_NAME = "guardianid_offline_v1"
const DB_VERSION = 1

type StoreName = "queue" | "routes"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains("queue")) {
        const store = db.createObjectStore("queue", { keyPath: "id", autoIncrement: true })
        store.createIndex("createdAt", "createdAt", { unique: false })
        store.createIndex("type", "type", { unique: false })
        store.createIndex("coalesceKey", "coalesceKey", { unique: false })
      }

      if (!db.objectStoreNames.contains("routes")) {
        const store = db.createObjectStore("routes", { keyPath: "key" })
        store.createIndex("touristId", "touristId", { unique: false })
        store.createIndex("createdAt", "createdAt", { unique: false })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function wrapReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueRequest(req: OfflineQueuedRequest): Promise<number> {
  const db = await openDb()
  const tx = db.transaction("queue", "readwrite")
  const store = tx.objectStore("queue")

  // Coalesce noisy requests like GPS: if a coalesceKey is provided, update existing latest row.
  if (req.coalesceKey) {
    const idx = store.index("coalesceKey")
    const all = await wrapReq(idx.getAll(req.coalesceKey))
    if (all && all.length > 0) {
      // Pick the newest existing record and overwrite it.
      const newest = all.reduce((a: any, b: any) => (a.createdAt > b.createdAt ? a : b))
      const updated: OfflineQueuedRequest = { ...newest, ...req, id: newest.id }
      await wrapReq(store.put(updated as any))
      await txDone(tx)
      return Number(newest.id)
    }
  }

  const id = await wrapReq(store.add(req as any))
  await txDone(tx)
  return Number(id)
}

export async function listQueuedRequests(limit = 100): Promise<OfflineQueuedRequest[]> {
  const db = await openDb()
  const tx = db.transaction("queue", "readonly")
  const store = tx.objectStore("queue")
  const idx = store.index("createdAt")

  const out: OfflineQueuedRequest[] = []
  // Use a cursor to take the oldest first.
  await new Promise<void>((resolve, reject) => {
    const cursorReq = idx.openCursor()
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (!cursor || out.length >= limit) {
        resolve()
        return
      }
      out.push(cursor.value as OfflineQueuedRequest)
      cursor.continue()
    }
    cursorReq.onerror = () => reject(cursorReq.error)
  })

  await txDone(tx)
  return out
}

export async function deleteQueuedRequest(id: number): Promise<void> {
  const db = await openDb()
  const tx = db.transaction("queue", "readwrite")
  tx.objectStore("queue").delete(id)
  await txDone(tx)
}

export async function clearQueue(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction("queue", "readwrite")
  tx.objectStore("queue").clear()
  await txDone(tx)
}

export async function getQueueCount(): Promise<number> {
  const db = await openDb()
  const tx = db.transaction("queue", "readonly")
  const count = await wrapReq(tx.objectStore("queue").count())
  await txDone(tx)
  return Number(count || 0)
}

export async function upsertRoute(route: CachedRoute): Promise<void> {
  const db = await openDb()
  const tx = db.transaction("routes", "readwrite")
  tx.objectStore("routes").put(route as any)
  await txDone(tx)
}

export async function getLatestRouteForTourist(touristId: string): Promise<CachedRoute | null> {
  const db = await openDb()
  const tx = db.transaction("routes", "readonly")
  const store = tx.objectStore("routes")
  const idx = store.index("touristId")
  const all = await wrapReq(idx.getAll(touristId))
  await txDone(tx)
  if (!all || all.length === 0) return null
  return (all as CachedRoute[]).reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
}

