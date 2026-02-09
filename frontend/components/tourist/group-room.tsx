"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface GroupRoomProps {
  touristId: string
  roomId: string | null
  roomName: string | null
  roomQr: string | null
  onRoomChange: (room: { roomId: string | null; roomName?: string | null; roomQr?: string | null }) => void
}

export default function GroupRoomPanel({ touristId, roomId, roomName, roomQr, onRoomChange }: GroupRoomProps) {
  const [createName, setCreateName] = useState("")
  const [createDesc, setCreateDesc] = useState("")
  const [joinRoomId, setJoinRoomId] = useState("")
  const [joinQrPayload, setJoinQrPayload] = useState("")
  const [status, setStatus] = useState<string>("")
  const [busy, setBusy] = useState(false)

  const qrDataUrl = useMemo(() => (roomQr ? `data:image/png;base64,${roomQr}` : ""), [roomQr])

  const fetchRoomDetails = async (id: string) => {
    const res = await fetch(`${API}/api/rooms/${id}`)
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  const handleCreateRoom = async () => {
    if (!createName.trim()) {
      setStatus("Please enter a room name.")
      return
    }
    setBusy(true)
    setStatus("")
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || null,
          created_by: touristId,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      onRoomChange({ roomId: data.room_id, roomName: data.name, roomQr: data.qr_png_base64 })
      setStatus("Room created.")
      setCreateName("")
      setCreateDesc("")
    } catch (err) {
      console.error(err)
      setStatus("Failed to create room.")
    } finally {
      setBusy(false)
    }
  }

  const handleJoinRoom = async (id: string) => {
    if (!id.trim()) {
      setStatus("Please enter a room ID.")
      return
    }
    setBusy(true)
    setStatus("")
    try {
      const res = await fetch(`${API}/api/rooms/${id.trim()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: id.trim(),
          tourist_id: touristId,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const room = await fetchRoomDetails(id.trim())
      onRoomChange({ roomId: room.room_id, roomName: room.name, roomQr: room.qr_png_base64 })
      setStatus("Joined room.")
      setJoinRoomId("")
    } catch (err) {
      console.error(err)
      setStatus("Failed to join room.")
    } finally {
      setBusy(false)
    }
  }

  const handleJoinByQr = async () => {
    if (!joinQrPayload.trim()) {
      setStatus("Please paste the QR payload.")
      return
    }
    setBusy(true)
    setStatus("")
    try {
      const res = await fetch(`${API}/api/rooms/join-by-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_payload: joinQrPayload.trim(),
          tourist_id: touristId,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const room = await fetchRoomDetails(data.room_id)
      onRoomChange({ roomId: room.room_id, roomName: room.name, roomQr: room.qr_png_base64 })
      setStatus("Joined room from QR.")
      setJoinQrPayload("")
    } catch (err) {
      console.error(err)
      setStatus("Failed to join via QR.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Group Traveller Room</h2>
          <p className="text-sm text-gray-600">Create or join a room to share location and chat.</p>
        </div>
        {roomId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRoomChange({ roomId: null, roomName: null, roomQr: null })}
            className="border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"
          >
            Leave room
          </Button>
        )}
      </div>

      {roomId ? (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-center">
          <div>
            <div className="text-sm text-gray-700">
              Active room: <span className="font-semibold">{roomName || roomId}</span>
            </div>
            <div className="text-xs text-gray-500">Room ID: {roomId}</div>
          </div>
          {qrDataUrl && (
            <div className="w-28 h-28 rounded-xl border border-gray-200 p-2 bg-white">
              <img src={qrDataUrl} alt="Room QR" className="w-full h-full object-contain" />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Create a room</h3>
            <Input
              placeholder="Room name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              disabled={busy}
            />
            <Input
              placeholder="Description (optional)"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              disabled={busy}
            />
            <Button onClick={handleCreateRoom} disabled={busy}>
              Create room
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Join a room</h3>
            <Input
              placeholder="Room ID"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              disabled={busy}
            />
            <Button variant="outline" onClick={() => handleJoinRoom(joinRoomId)} disabled={busy} className="border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900">
              Join by ID
            </Button>
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Input
                placeholder='Paste QR payload (e.g., "room:abc12345")'
                value={joinQrPayload}
                onChange={(e) => setJoinQrPayload(e.target.value)}
                disabled={busy}
              />
              <Button variant="outline" onClick={handleJoinByQr} disabled={busy} className="border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900">
                Join by QR payload
              </Button>
            </div>
          </div>
        </div>
      )}

      {status && <div className="text-xs text-gray-600 mt-4">{status}</div>}
    </div>
  )
}
