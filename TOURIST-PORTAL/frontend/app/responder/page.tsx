"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useChat } from "@/lib/chat"
import { useCallState } from "@/lib/use-call-state"
import ChatPanel from "@/components/chat/chat-panel"
import ResponderTouristChat from "@/components/chat/responder-tourist-chat"
import ResponderMap, { type ResponderTicket } from "@/components/responder/map-wrapper"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function ResponderPage() {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null)
  const [myName, setMyName] = useState("")
  const [myId, setMyId] = useState("")
  const [available, setAvailable] = useState(true)
  const [showOnlyNearby, setShowOnlyNearby] = useState(true)
  const [nearbyKm, setNearbyKm] = useState(5)
  const [logs, setLogs] = useState<any[]>([])
  const [selected, setSelected] = useState<ResponderTicket | null>(null)
  const [routeLine, setRouteLine] = useState<{ type: "LineString"; coordinates: [number, number][] } | null>(null)
  const [routeMeta, setRouteMeta] = useState<{ distance_m?: number; duration_s?: number } | null>(null)
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    setMounted(true)
    try {
      const storedName = localStorage.getItem("guardianid:responder:name")
      const storedId = localStorage.getItem("guardianid:responder:id")
      const storedAvailable = localStorage.getItem("guardianid:responder:available")
      
      if (storedName) setMyName(storedName)
      if (storedId) setMyId(storedId)
      if (storedAvailable) setAvailable(storedAvailable === "true")
    } catch (err) {
      console.error("Failed to load responder data from localStorage:", err)
    }
  }, [])

  // Save to localStorage whenever values change (but only after mount)
  useEffect(() => {
    if (!mounted) return
    try {
      if (myName) localStorage.setItem("guardianid:responder:name", myName)
      if (myId) localStorage.setItem("guardianid:responder:id", myId)
      localStorage.setItem("guardianid:responder:available", String(available))
    } catch (err) {
      console.error("Failed to save responder data to localStorage:", err)
    }
  }, [myName, myId, available, mounted])

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API}/api/logs`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    fetchLogs()
    const interval = window.setInterval(() => {
      if (available) fetchLogs()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [available])

  const openTickets = useMemo<ResponderTicket[]>(() => {
    return logs
      .filter((l) => (l.event_type || "").toLowerCase() === "sos")
      .filter((l) => (l.ticket_status || "NEW") === "CONFIRMED")
      .filter((l) => l.lat !== "-" && l.lng !== "-")
      .map((l) => ({
        id: Number(l.id),
        tourist_id: String(l.tourist_id || "-"),
        event_type: String(l.event_type || "-"),
        location_label: String(l.location_label || "-"),
        timestamp: String(l.timestamp || "-"),
        lat: Number(l.lat),
        lng: Number(l.lng),
        ticket_status: String(l.ticket_status || "CONFIRMED"),
        ticket_assignee: l.ticket_assignee || null,
      }))
  }, [logs])

  const activeMine = useMemo<ResponderTicket | null>(() => {
    const mineKey = myId ? `(${myId})` : ""
    console.log("🔍 Calculating activeMine:", { myId, mineKey, logsCount: logs.length })
    if (!mineKey) {
      console.log("🔍 No mineKey, returning null")
      return null
    }
    const found = logs.find(
      (l) =>
        (l.event_type || "").toLowerCase() === "sos" &&
        (l.ticket_status || "") === "ASSIGNED" &&
        String(l.ticket_assignee || "").includes(mineKey) &&
        l.lat !== "-" &&
        l.lng !== "-",
    )
    if (!found) {
      console.log("🔍 No matching ASSIGNED ticket found for", mineKey)
      console.log("🔍 All ASSIGNED tickets:", logs.filter(l => l.ticket_status === "ASSIGNED"))
      return null
    }
    console.log("🔍 Found activeMine:", { id: found.id, tourist_id: found.tourist_id, assignee: found.ticket_assignee })
    return {
      id: Number(found.id),
      tourist_id: String(found.tourist_id || "-"),
      event_type: String(found.event_type || "-"),
      location_label: String(found.location_label || "-"),
      timestamp: String(found.timestamp || "-"),
      lat: Number(found.lat),
      lng: Number(found.lng),
      ticket_status: "ASSIGNED",
      ticket_assignee: found.ticket_assignee || null,
    }
  }, [logs, myId])

  const sortedOpen = useMemo(() => {
    if (!me) return openTickets
    const filtered =
      showOnlyNearby && Number.isFinite(nearbyKm)
        ? openTickets.filter((t) => haversineMeters(me.lat, me.lng, t.lat, t.lng) <= nearbyKm * 1000)
        : openTickets
    return [...filtered].sort(
      (a, b) => haversineMeters(me.lat, me.lng, a.lat, a.lng) - haversineMeters(me.lat, me.lng, b.lat, b.lng),
    )
  }, [openTickets, me])

  const ensureResponderIdentity = () => {
    if (!myName.trim() || !myId.trim()) {
      setStatus("Set your Responder name and ID first.")
      return false
    }
    return true
  }

  const acceptTicket = async (t: ResponderTicket) => {
    if (!ensureResponderIdentity()) return
    setLoading(true)
    setStatus("Accepting ticket…")
    try {
      const res = await fetch(`${API}/api/incidents/${t.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: myId.trim(), assignee_name: myName.trim() }),
      })
      if (!res.ok) {
        const txt = await res.text()
        setStatus(`Could not accept (maybe already taken). ${txt}`)
        setLoading(false)
        return
      }
      setStatus("Ticket accepted. Routing…")
      setSelected({ ...t, ticket_status: "ASSIGNED", ticket_assignee: `${myName} (${myId})` })
      await fetchLogs()
      setLoading(false)
    } catch (e) {
      setStatus(`Accept failed: ${String((e as any)?.message || e)}`)
      setLoading(false)
    }
  }

  const resolveTicket = async (t: ResponderTicket) => {
    setLoading(true)
    setStatus("Resolving ticket…")
    try {
      const res = await fetch(`${API}/api/incidents/${t.id}/resolve`, { method: "POST" })
      if (!res.ok) {
        const txt = await res.text()
        setStatus(`Resolve failed. ${txt}`)
        setLoading(false)
        return
      }
      setStatus("Resolved.")
      setRouteLine(null)
      setRouteMeta(null)
      setSelected(null)
      await fetchLogs()
      setLoading(false)
    } catch (e) {
      setStatus(`Resolve failed: ${String((e as any)?.message || e)}`)
      setLoading(false)
    }
  }

  const computeRouteTo = async (t: ResponderTicket) => {
    if (!me) return
    try {
      const from = `${me.lat},${me.lng}`
      const to = `${t.lat},${t.lng}`
      const url = `${API}/api/route?engine=osrm&profile=car&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`route failed: ${res.status}`)
      const data = await res.json()
      setRouteLine(data.line || null)
      setRouteMeta({ distance_m: data.distance_m, duration_s: data.duration_s })
    } catch {
      setRouteLine(null)
      setRouteMeta(null)
    }
  }

  useEffect(() => {
    const t = selected || activeMine
    if (!t) return
    if (!me) return
    computeRouteTo(t)
    const interval = window.setInterval(() => computeRouteTo(t), 12000)
    return () => window.clearInterval(interval)
  }, [selected?.id, activeMine?.id, me?.lat, me?.lng])

  const primary = activeMine || selected
  const chatThread =
    primary?.ticket_status === "ASSIGNED" &&
    primary?.ticket_assignee &&
    myId &&
    String(primary.ticket_assignee).includes(myId)
      ? { thread_type: "authority_responder" as const, incident_id: primary.id }
      : null
  const callMessageRef = useRef<(data: Record<string, unknown>) => void>(() => {})
  const { messages, connected, sendMessage, sendCallAction } = useChat(chatThread, {
    onCallMessage: (data) => callMessageRef.current(data),
  })
  const callState = useCallState(chatThread, sendCallAction, {
    callerRole: "responder",
    callerId: myId,
  })
  useEffect(() => {
    callMessageRef.current = callState.handleMessage
  }, [callState.handleMessage])

  return (
    <div className="min-h-screen py-6" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Responder Console</h1>
            <div className="text-sm text-gray-600">Police / Ground staff ticket pickup + navigation</div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Available</label>
            <button
              type="button"
              onClick={() => setAvailable((v) => !v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                available ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              {available ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Responder name</label>
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="e.g., Officer Arjun"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Responder ID</label>
              <input
                value={myId}
                onChange={(e) => setMyId(e.target.value)}
                placeholder="e.g., RSP_001"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={fetchLogs}
                className="px-4 py-3 rounded-2xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
              >
                Refresh
              </button>
              <div className="text-xs text-gray-600">
                Open tickets: <span className="font-bold text-gray-900">{openTickets.length}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-gray-600">Show only nearby</label>
            <button
              type="button"
              onClick={() => setShowOnlyNearby((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                showOnlyNearby ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              {showOnlyNearby ? "ON" : "OFF"}
            </button>
            <label className="text-xs font-semibold text-gray-600">Radius</label>
            <select
              value={nearbyKm}
              onChange={(e) => setNearbyKm(Number(e.target.value))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs bg-white"
            >
              {[2, 5, 10, 20].map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-600">
              Showing: <span className="font-bold text-gray-900">{sortedOpen.length}</span>
            </div>
          </div>

          {status ? <div className="mt-3 text-sm text-gray-700">{status}</div> : null}
          
          {/* DEBUG INFO - only show after mount to avoid hydration mismatch */}
          {mounted && (
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <div>myId: "{myId}" | activeMine: {activeMine ? `SOS #${activeMine.id}` : "null"} | chatThread: {chatThread ? "yes" : "no"}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <div className="space-y-4">
            {activeMine ? (
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
                <div className="text-sm font-bold text-gray-900 mb-2">My active ticket</div>
                <div className="text-sm text-gray-700">
                  SOS #{activeMine.id} • Tourist {activeMine.tourist_id}
                </div>
                <div className="text-xs text-gray-600 mt-1">{activeMine.timestamp}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {activeMine.lat.toFixed(5)}, {activeMine.lng.toFixed(5)}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setSelected(activeMine)}
                    className="px-4 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    Navigate
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => resolveTicket(activeMine)}
                    className="px-4 py-3 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                  >
                    Resolve
                  </button>
                </div>
                {chatThread && (
                  <div className="mt-4">
                    <ChatPanel
                      title="Chat with Authority"
                      messages={messages}
                      connected={connected}
                      onSend={(body) => sendMessage(body, "responder", myId)}
                      senderRole="responder"
                      senderId={myId}
                      callProps={{
                        callStatus: callState.callStatus,
                        activeCallId: callState.activeCallId,
                        incomingCall: callState.incomingCall,
                        onStartCall: callState.startCall,
                        onAcceptCall: callState.acceptCall,
                        onRejectCall: callState.rejectCall,
                        onEndCall: callState.endCall,
                      }}
                    />
                  </div>
                )}
                
                {/* Tourist Chat - Always show when ticket is assigned */}
                {mounted && activeMine && myId ? (
                  <div className="mt-4">
                    <ResponderTouristChat
                      touristId={activeMine.tourist_id}
                      incidentId={activeMine.id}
                      responderId={myId}
                    />
                  </div>
                ) : mounted && !activeMine ? (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
                    <div className="text-sm font-semibold text-yellow-800 mb-1">
                      💬 Tourist Chat Unavailable
                    </div>
                    <div className="text-xs text-yellow-700">
                      {!myId ? "Please set your Responder ID above to enable chat." : "Accept a ticket to chat with the tourist."}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-gray-900">Available SOS tickets</div>
                <div className="text-xs text-gray-600">{me ? "GPS ready" : "Waiting GPS"}</div>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {sortedOpen.length === 0 ? (
                  <div className="text-sm text-gray-600">No confirmed SOS tickets right now.</div>
                ) : (
                  sortedOpen.map((t) => {
                    const dist = me ? haversineMeters(me.lat, me.lng, t.lat, t.lng) : null
                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-2xl border ${
                          selected?.id === t.id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-gray-900">SOS #{t.id}</div>
                            <div className="text-xs text-gray-600 mt-1">{t.timestamp}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {t.lat.toFixed(5)}, {t.lng.toFixed(5)}
                            </div>
                            {dist != null ? (
                              <div className="text-xs font-semibold text-gray-800 mt-1">
                                ~{Math.round(dist)}m away
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setSelected(t)}
                              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => acceptTicket(t)}
                              className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-60"
                            >
                              Accept
                            </button>
                          </div>
                        </div>
                        {t.location_label && t.location_label !== "-" ? (
                          <div className="text-xs text-gray-700 mt-2">Label: {t.location_label}</div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">Map & navigation</div>
                  <div className="text-xs text-gray-600">
                    {primary ? `Routing to SOS #${primary.id}` : "Select/accept a ticket to route"}
                  </div>
                </div>
                {routeMeta?.distance_m ? (
                  <div className="text-xs text-gray-700 font-semibold">
                    {Math.round((routeMeta.distance_m || 0) / 10) / 100} km •{" "}
                    {Math.round((routeMeta.duration_s || 0) / 60)} min
                  </div>
                ) : null}
              </div>

              <ResponderMap
                tickets={sortedOpen}
                selected={selected}
                me={me}
                routeLine={primary ? routeLine : null}
                onSelect={(t) => setSelected(t)}
                onMeUpdate={(p) => setMe(p)}
              />
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Authority publishes tickets by confirming SOS in the authority dashboard. Responders only see CONFIRMED SOS
          tickets here and can claim them.
        </div>
      </div>
    </div>
  )
}

