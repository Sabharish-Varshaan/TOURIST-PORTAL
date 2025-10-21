"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface EKYCFormProps {
  touristId: string
}

export default function EKYCForm({ touristId }: EKYCFormProps) {
  const [docType, setDocType] = useState("AADHAAR")
  const [idNumber, setIdNumber] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [kycStatus, setKycStatus] = useState("PENDING")
  const [actionStatus, setActionStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!file || !idNumber.trim()) {
      setActionStatus("Please choose a file and enter ID number")
      return
    }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append("tourist_id", touristId)
      fd.append("doc_type", docType)
      fd.append("id_number", idNumber)
      fd.append("file", file)

      const res = await fetch(`${API}/api/kyc`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      setKycStatus(data.kyc_status || "PENDING")
      setActionStatus(`KYC result: ${data.kyc_status} | ${data.kyc_doc_type || ""} | ${data.kyc_id_masked || ""}`)
    } catch (err) {
      setActionStatus("KYC submission failed")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = () => {
    if (kycStatus === "VERIFIED") return "bg-green-100 text-green-800"
    if (kycStatus === "REJECTED") return "bg-red-100 text-red-800"
    return "bg-yellow-100 text-yellow-800"
  }

  return (
    <div className="bg-white rounded-4xl shadow-lg p-5 mb-4">
      <h1 className="text-2xl font-bold mb-4">eKYC Verification</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block font-semibold mb-2">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-3xl text-base"
          >
            <option value="AADHAAR">Aadhaar (India)</option>
            <option value="PASSPORT">Passport (Other countries)</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-2">ID Number</label>
          <input
            type="text"
            placeholder="Aadhaar (12 digits) or Passport number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-3xl text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block font-semibold mb-2">Upload Document (PDF/JPG/PNG)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-3 border border-gray-300 rounded-3xl text-base"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">Status</label>
          <div className={`inline-block px-3 py-2 rounded-full font-bold text-sm ${getStatusColor()}`}>{kycStatus}</div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ backgroundColor: "var(--primary)" }}
        className="w-full text-white p-3 rounded-3xl font-semibold hover:opacity-90 disabled:opacity-50 mb-3"
      >
        {loading ? "Verifying..." : "Verify eKYC"}
      </button>

      {actionStatus && <p className="text-gray-600 text-sm">{actionStatus}</p>}
    </div>
  )
}
