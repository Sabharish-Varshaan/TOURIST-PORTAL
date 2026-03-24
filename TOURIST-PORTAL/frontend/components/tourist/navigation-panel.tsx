"use client"

import { useEffect, useMemo, useState } from "react"
import { getLatestRouteForTourist, upsertRoute, type CachedRoute } from "@/lib/offline/db"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export type NavLatLng = { lat: number; lng: number }

type GeocodeResult = { display_name: string; lat: number; lng: number }

export type NavStep = {
  instruction: string
  distance_m: number
  duration_s: number
  maneuverLatLng?: NavLatLng | null
}

export type NavRoute = {
  engine: string
  profile: string
  from: NavLatLng
  to: NavLatLng
  line: { type: "LineString"; coordinates: [number, number][] } // [lng,lat]
  steps: NavStep[]
  distance_m?: number
  duration_s?: number
}

export default function NavigationPanel({
  touristId,
  current,
  onRouteLoaded,
  onStop,
}: {
  touristId: string
  current: NavLatLng | null
  onRouteLoaded: (route: NavRoute) => void
  onStop: () => void
}) {
  const [profile, setProfile] = useState<"foot" | "car" | "bike">("foot")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [selected, setSelected] = useState<GeocodeResult | null>(null)
  const [recent, setRecent] = useState<GeocodeResult[]>([])
  const [status, setStatus] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [searchBusy, setSearchBusy] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("guardianid:nav_recent")
      if (raw) setRecent(JSON.parse(raw))
    } catch {}
  }, [])

  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const refresh = () => setOffline(!navigator.onLine)
    refresh()
    window.addEventListener("online", refresh)
    window.addEventListener("offline", refresh)
    return () => {
      window.removeEventListener("online", refresh)
      window.removeEventListener("offline", refresh)
    }
  }, [])

  const dest = useMemo<NavLatLng | null>(() => {
    if (!selected) return null
    return { lat: selected.lat, lng: selected.lng }
  }, [selected])

  const persistRecent = (items: GeocodeResult[]) => {
    setRecent(items)
    try {
      localStorage.setItem("guardianid:nav_recent", JSON.stringify(items))
    } catch {}
  }

  const addToRecent = (item: GeocodeResult) => {
    const next = [item, ...recent.filter((r) => !(r.lat === item.lat && r.lng === item.lng))].slice(0, 10)
    persistRecent(next)
  }

  const runSearch = async () => {
    const q = query.trim()
    if (!q) {
      setStatus("Type a location name to search.")
      return
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("Search requires internet. You can still use the last cached route.")
      return
    }

    setSearchBusy(true)
    setStatus("Searching location…")
    try {
      const url = `${API}/api/geocode?q=${encodeURIComponent(q)}&limit=5`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`geocode failed: ${res.status}`)
      const data = (await res.json()) as GeocodeResult[]
      setResults(Array.isArray(data) ? data : [])
      setStatus(data?.length ? "Select a result below." : "No results found. Try a different query.")
    } catch (e) {
      setStatus(`Search failed. ${String((e as any)?.message || e)}`)
      setResults([])
    } finally {
      setSearchBusy(false)
    }
  }

  const loadCachedRoute = async () => {
    const cached = await getLatestRouteForTourist(touristId)
    if (!cached) {
      setStatus("No cached route found yet. Compute a route while online first.")
      return
    }

    const route: NavRoute = {
      engine: "cache",
      profile: cached.profile,
      from: cached.from,
      to: cached.to,
      line: cached.line,
      steps: cached.steps as any,
    }
    onRouteLoaded(route)
    setStatus("Loaded last cached route.")
  }

  const startNav = async () => {
    if (!current) {
      setStatus("Waiting for GPS… please allow location access.")
      return
    }
    if (!dest) {
      setStatus("Search and select a destination first.")
      return
    }

    setBusy(true)
    setStatus("Fetching route…")

    try {
      const fromParam = `${current.lat},${current.lng}`
      const toParam = `${dest.lat},${dest.lng}`
      const url = `${API}/api/route?engine=osrm&profile=${profile}&from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`route fetch failed: ${res.status}`)
      const data = (await res.json()) as NavRoute

      onRouteLoaded(data)

      const cacheKey = `${touristId}:${profile}:${toParam}`
      const toCache: CachedRoute = {
        key: cacheKey,
        touristId,
        profile: data.profile || profile,
        from: data.from,
        to: data.to,
        line: data.line,
        steps: data.steps || [],
        createdAt: Date.now(),
      }
      await upsertRoute(toCache)

      setStatus("Route ready. Start moving to see turn-by-turn guidance.")
    } catch (e) {
      if (!navigator.onLine) {
        setStatus("Offline: loading last cached route…")
        await loadCachedRoute()
      } else {
        setStatus(`Failed to fetch route. ${String((e as any)?.message || e)}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xl font-bold text-gray-900">Navigation</h3>
        <button
          type="button"
          onClick={onStop}
          className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
        >
          Stop
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Destination search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: Museum, City, Landmark…"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Mode</label>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value as any)}
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm bg-white"
          >
            <option value="foot">Walk</option>
            <option value="car">Car</option>
            <option value="bike">Bike</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-4">
        <button
          type="button"
          disabled={searchBusy || offline}
          onClick={runSearch}
          className="px-4 py-3 rounded-2xl border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
        >
          {searchBusy ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={startNav}
          className="px-4 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Loading…" : "Start navigation"}
        </button>
        <button
          type="button"
          onClick={loadCachedRoute}
          className="px-4 py-3 rounded-2xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
        >
          Use last cached route
        </button>
      </div>

      {offline ? (
        <div className="mt-3 text-xs text-yellow-700 font-semibold">Search requires internet (offline mode).</div>
      ) : null}

      {selected ? (
        <div className="mt-4 p-4 rounded-2xl border border-blue-200 bg-blue-50">
          <div className="text-sm font-semibold text-blue-900">Selected destination</div>
          <div className="mt-1 text-sm text-blue-900">{selected.display_name}</div>
          <div className="mt-1 text-xs text-blue-900 opacity-80">
            {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="px-3 py-2 rounded-xl border border-blue-200 bg-white text-xs font-semibold hover:bg-blue-50"
            >
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      {results.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-600 mb-2">Search results</div>
          <div className="space-y-2">
            {results.map((r, idx) => (
              <button
                key={`${r.lat},${r.lng},${idx}`}
                type="button"
                onClick={() => {
                  setSelected(r)
                  addToRecent(r)
                  setResults([])
                  setStatus("Destination selected. You can start navigation.")
                }}
                className="w-full text-left p-3 rounded-2xl border border-gray-200 hover:bg-gray-50"
              >
                <div className="text-sm font-semibold text-gray-900 line-clamp-2">{r.display_name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!results.length && !selected && recent.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-600 mb-2">Recent destinations</div>
          <div className="space-y-2">
            {recent.slice(0, 5).map((r, idx) => (
              <button
                key={`${r.lat},${r.lng},${idx}`}
                type="button"
                onClick={() => {
                  setSelected(r)
                  setStatus("Selected a recent destination. You can start navigation.")
                }}
                className="w-full text-left p-3 rounded-2xl border border-gray-200 hover:bg-gray-50"
              >
                <div className="text-sm font-semibold text-gray-900 line-clamp-2">{r.display_name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {status ? <div className="mt-4 text-sm text-gray-700">{status}</div> : null}
    </div>
  )
}

