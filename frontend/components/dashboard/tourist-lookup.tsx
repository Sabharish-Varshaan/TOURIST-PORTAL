"use client"

import { useState } from "react"

interface TouristLookupProps {
  tourists: any[]
  logs: any[]
}

export default function TouristLookup({ tourists, logs }: TouristLookupProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTourist, setSelectedTourist] = useState<any>(null)
  const [showIncidents, setShowIncidents] = useState(false)

  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      alert("Enter a Tourist ID to lookup.")
      return
    }

    let found = tourists.find((x) => x.id && x.id.toLowerCase() === q)
    if (!found) {
      found = tourists.find(
        (x) => (x.id && x.id.toLowerCase().includes(q)) || (x.name && x.name.toLowerCase().includes(q)),
      )
    }

    if (!found) {
      alert("No tourist found with that ID / query.")
      setSelectedTourist(null)
      return
    }

    setSelectedTourist(found)
    setShowIncidents(false)
  }

  const touristIncidents = selectedTourist ? logs.filter((l) => l.tourist_id === selectedTourist.id) : []

  return (
    <div style={{ backgroundColor: "var(--card)", color: "#140000ff" }} className="rounded-2xl p-3">
      <div style={{ color: "#ff0000ff"}} className="text-xs mb-2">
        <b>Tourist Lookup</b>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Enter Tourist ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ color: "var(--text)" }}
          className="flex-1 p-2 rounded-2xl border border-gray-700 bg-transparent text-sm"
        />
        <button
          onClick={handleSearch}
          style={{ backgroundColor: "var(--accent)", color: "#207bfbff" }}
          className="px-3 py-2 rounded-2xl font-bold text-sm hover:opacity-90"
        >
          Get Details
        </button>
      </div>

      {selectedTourist && (
        <div className="bg-black bg-opacity-20 p-2 rounded-2xl text-xs space-y-1">
          <div className="font-bold">{selectedTourist.name}</div>
          <div style={{ color: "#ffd7d7ff" }}>ID: {selectedTourist.id}</div>
          <div style={{ color: "#ffccccff" }}>Phone: {selectedTourist.phone}</div>
          <div style={{ color: "#ffccccff" }}>Emergency: {selectedTourist.emergency_contact}</div>
          <div style={{ color: "#ffcfcfff" }}>Status: {selectedTourist.status}</div>
          <div style={{ color: "#ffd4d4ff" }}>Last checkin: {selectedTourist.last_checkin}</div>
          <div style={{ color: "#ffc5c5ff" }}>
            KYC: {selectedTourist.kyc_status} {selectedTourist.kyc_doc_type ? `(${selectedTourist.kyc_doc_type})` : ""}{" "}
            {selectedTourist.kyc_id_masked ? `- ${selectedTourist.kyc_id_masked}` : ""}
          </div>
          <div style={{ color: "#ffdadaff" }}>
            Coords: {selectedTourist.last_lat || "-"} , {selectedTourist.last_lng || "-"}
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => setSelectedTourist({ ...selectedTourist })}
              style={{ backgroundColor: "var(--accent)", color: "#0e61d6ff" }}
              className="px-2 py-1 rounded text-xs font-bold hover:opacity-90"
            >
              Refresh
            </button>
            <span style={{ color: "#ff6200ff" }} className="text-xs">
              Updated: {new Date().toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => setShowIncidents(!showIncidents)}
            className="w-full bg-orange-600 text-white px-2 py-1 rounded text-xs font-bold hover:opacity-90 mt-2"
          >
            {showIncidents ? "Hide incidents" : "Show incidents"}
          </button>

          {showIncidents && (
            <div className="max-h-56 overflow-y-auto mt-2 space-y-1">
              {touristIncidents.length === 0 ? (
                <div style={{ color: "#ffffffff" }}>No incidents found.</div>
              ) : (
                touristIncidents.map((inc) => (
                  <div key={inc.id} className="border-b border-gray-700 pb-1">
                    <div className="font-bold text-xs">
                      {inc.event_type} <span style={{ color: "#ffffffff" }}>#{inc.id}</span>
                    </div>
                    <div style={{ color: "#ffffffff" }} className="text-xs">
                      {inc.location_label} • {inc.timestamp}
                    </div>
                    {inc.ticket_status && (
                      <div style={{ color: "#ffffffff" }} className="text-xs">
                        Ticket: {inc.ticket_status} {inc.ticket_assignee ? ` — ${inc.ticket_assignee}` : ""}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
