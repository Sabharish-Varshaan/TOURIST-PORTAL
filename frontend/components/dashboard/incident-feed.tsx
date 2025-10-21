"use client"

import { useState } from "react"
import { createPortal } from "react-dom"

const API = ""

interface IncidentFeedProps {
  logs: any[]
  onRefresh: () => void
}

export default function IncidentFeed({ logs, onRefresh }: IncidentFeedProps) {
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [substations, setSubstations] = useState<any[]>([])
  const [selectedSubstation, setSelectedSubstation] = useState<string>("")
  const [context, setContext] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAssignClick = async (incidentId: number) => {
    setLoading(true)
    if (!substations.length) {
      try {
        const res = await fetch(`/api/substations`)
        if (!res.ok) throw new Error("Failed to fetch substations")
        const data = await res.json()
        setSubstations(data || [])
        setSelectedSubstation(data?.[0]?.id || "")
      } catch (err) {
        console.error("[v0] Failed to fetch substations:", err)
        alert("Failed to load substations. Check console.")
        setLoading(false)
        return
      }
    } else {
      setSelectedSubstation(substations[0]?.id || "")
    }
    setAssigningId(incidentId)
    setLoading(false)
  }

  const handleAssignSubmit = async () => {
    if (!assigningId || !selectedSubstation) {
      alert("Please select a substation")
      return
    }

    const substation = substations.find((s) => s.id === selectedSubstation)
    if (!substation) {
      alert("Selected substation not found")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${assigningId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_id: substation.id,
          assignee_name: substation.name,
          notes: context,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("[v0] Assign failed:", res.status, errorText)
        alert("Failed to assign ticket. Check console.")
        setLoading(false)
        return
      }

      setAssigningId(null)
      setContext("")
      setLoading(false)
      onRefresh()
    } catch (err) {
      console.error("[v0] Assign error:", err)
      alert("Assign failed (network error)")
      setLoading(false)
    }
  }

  const handleResolve = async (incidentId: number) => {
    if (!confirm("Mark this ticket as RESOLVED?")) return

    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/resolve`, {
        method: "POST",
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("[v0] Resolve failed:", res.status, errorText)
        alert("Failed to resolve ticket. Check console.")
        setLoading(false)
        return
      }

      setLoading(false)
      onRefresh()
    } catch (err) {
      console.error("[v0] Resolve error:", err)
      alert("Resolve failed (network error)")
      setLoading(false)
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-55 flex items-center justify-center backdrop-blur-sm"
      style={{ zIndex: 200000 }}
    >
      <div
        style={{
          backgroundColor: "#071426",
          color: "#e6eef8",
          border: "1px solid rgba(255,255,255,0.04)",
          zIndex: 200001,
        }}
        className="rounded-2xl p-4 w-96 max-h-96 overflow-auto shadow-2xl"
      >
        <div className="mb-4">
          <label className="text-sm font-bold mb-3 block" style={{ color: "#e6eef8" }}>
            Select Substation
          </label>
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            {substations.map((s, i) => (
              <label key={s.id} className="flex items-center mb-2 cursor-pointer" style={{ color: "#e6eef8" }}>
                <input
                  type="radio"
                  name="substationChoice"
                  value={s.id}
                  checked={selectedSubstation === s.id}
                  onChange={(e) => setSelectedSubstation(e.target.value)}
                  className="mr-2"
                />
                <span style={{ color: "#e6eef8" }} className="font-semibold">
                  {s.name}
                </span>
                <span style={{ color: "#94a3b8" }} className="text-xs ml-2">
                  ({s.id})
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-bold mb-2 block" style={{ color: "#e6eef8" }}>
            Add context or instructions (optional)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            style={{
              color: "#e6eef8",
              backgroundColor: "#0b1220",
              borderColor: "rgba(255,255,255,0.1)",
            }}
            className="w-full p-2 rounded border text-sm min-h-20"
            placeholder="Enter any additional context..."
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => {
              setAssigningId(null)
              setContext("")
            }}
            disabled={loading}
            style={{ backgroundColor: "#1f2937", color: "#e6eef8" }}
            className="px-3 py-2 rounded font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssignSubmit}
            disabled={loading}
            style={{ backgroundColor: "#06b6d4", color: "#071426" }}
            className="px-3 py-2 rounded font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ backgroundColor: "#0f172a", color: "#e6eef8" }} className="rounded-2xl p-2 flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="font-bold" style={{ color: "#e6eef8" }}>Live Incident Feed</div>
        <div style={{ color: "#94a3b8" }} className="text-xs">
          latest first
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                ID
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Tourist
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Type
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Location
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Timestamp
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Hash
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Coords
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Ticket
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Assignee
              </th>
              <th style={{ color: "#e6eef8" }} className="text-left p-1">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const coords =
                l.lat !== "-" && l.lng !== "-"
                  ? `${Number.parseFloat(l.lat).toFixed(4)},${Number.parseFloat(l.lng).toFixed(4)}`
                  : "-"

              const isSOS = l.event_type && l.event_type.toLowerCase().includes("sos")

              return (
                <tr key={l.id} className={`border-b border-gray-700 ${isSOS ? "bg-yellow-900 bg-opacity-10" : ""}`}>
                  <td style={{ color: "#e6eef8" }} className="p-1">
                    {l.id}
                  </td>
                  <td style={{ color: "#e6eef8" }} className="p-1 font-mono text-xs">
                    {l.tourist_id}
                  </td>
                  <td style={{ color: "#e6eef8" }} className="p-1">
                    {l.event_type}
                  </td>
                  <td style={{ color: "#e6eef8" }} className="p-1">
                    {l.location_label}
                  </td>
                  <td style={{ color: "#e6eef8" }} className="p-1">
                    {l.timestamp}
                  </td>
                  <td style={{ color: "#e6eef8" }} className="p-1 font-mono text-xs">
                    {(l.hash_hex || "").slice(0, 16)}...
                  </td>
                  <td style={{ color: "#e6eef8" }} className="p-1">
                    {coords}
                  </td>
                  {isSOS ? (
                    <>
                      <td style={{ color: "#e6eef8" }} className="p-1">
                        {l.ticket_status || "NEW"}
                      </td>
                      <td style={{ color: "#e6eef8" }} className="p-1">
                        {l.ticket_assignee || "-"}
                      </td>
                      <td className="p-1">
                        {l.ticket_status === "NEW" || !l.ticket_status ? (
                          <button
                            onClick={() => handleAssignClick(l.id)}
                            disabled={loading}
                            className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:opacity-90 disabled:opacity-50"
                          >
                            Assign
                          </button>
                        ) : l.ticket_status === "ASSIGNED" ? (
                          <>
                            <button
                              onClick={() => handleResolve(l.id)}
                              disabled={loading}
                              className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:opacity-90 disabled:opacity-50 mr-1"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleAssignClick(l.id)}
                              disabled={loading}
                              className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:opacity-90 disabled:opacity-50"
                            >
                              Reassign
                            </button>
                          </>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>Resolved</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ color: "#94a3b8" }} className="p-1">
                        -
                      </td>
                      <td style={{ color: "#94a3b8" }} className="p-1">
                        -
                      </td>
                      <td style={{ color: "#94a3b8" }} className="p-1">
                        -
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {assigningId && typeof document !== "undefined" && createPortal(modalContent, document.body)}
    </div>
  )
}