"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface TouristRegistrationProps {
  onRegister: (id: string, qr: string) => void
}

export default function TouristRegistration({ onRegister }: TouristRegistrationProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [emergency, setEmergency] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !emergency.trim()) {
      setStatus("Please fill all fields")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          emergency_contact: emergency.trim(),
        }),
      })
      const data = await res.json()
      onRegister(data.tourist_id, data.qr_png_base64)
      setStatus("Registered! Scroll down for your Digital ID.")
    } catch (err) {
      setStatus("Registration failed. Try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-4xl shadow-lg p-5 mb-4">
      <h1 className="text-2xl font-bold mb-3">Register & Get Digital ID</h1>

      <div className="space-y-4">
        <div>
          <label className="block font-semibold mb-2">Name</label>
          <input
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-3xl text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-2">Phone</label>
            <input
              type="text"
              placeholder="+91-xxxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-3xl text-base"
            />
          </div>
          <div>
            <label className="block font-semibold mb-2">Emergency Contact</label>
            <input
              type="text"
              placeholder="+91-xxxxxxxxxx"
              value={emergency}
              onChange={(e) => setEmergency(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-3xl text-base"
            />
          </div>
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{ backgroundColor: "var(--primary)" }}
          className="w-full text-white p-3 rounded-3xl font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Registering..." : "Register & Generate QR"}
        </button>

        {status && <p className="text-gray-600 text-sm">{status}</p>}
      </div>
    </div>
  )
}
