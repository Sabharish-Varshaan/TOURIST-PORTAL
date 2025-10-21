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
<<<<<<< HEAD
      setActionStatus("⚠️ Please choose a file and enter ID number")
=======
      setActionStatus("Please choose a file and enter ID number")
>>>>>>> bbc8bab (Initial commit)
      return
    }

    setLoading(true)
<<<<<<< HEAD
    setActionStatus("")
=======
>>>>>>> bbc8bab (Initial commit)
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
<<<<<<< HEAD
      setActionStatus(
        `${data.kyc_status === "VERIFIED" ? "✅" : data.kyc_status === "REJECTED" ? "❌" : "⏳"} KYC Status: ${data.kyc_status} • ${data.kyc_doc_type || ""} • ${data.kyc_id_masked || ""}`,
      )
    } catch (err) {
      setActionStatus("❌ KYC submission failed")
=======
      setActionStatus(`KYC result: ${data.kyc_status} | ${data.kyc_doc_type || ""} | ${data.kyc_id_masked || ""}`)
    } catch (err) {
      setActionStatus("KYC submission failed")
>>>>>>> bbc8bab (Initial commit)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

<<<<<<< HEAD
  const getStatusBadgeColor = () => {
    if (kycStatus === "VERIFIED") return "bg-green-100 text-green-700 border-green-200"
    if (kycStatus === "REJECTED") return "bg-red-100 text-red-700 border-red-200"
    return "bg-yellow-100 text-yellow-700 border-yellow-200"
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">eKYC Verification</h2>
          <p className="text-sm text-gray-600 mt-1">Verify your identity for enhanced security</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-xs font-bold border ${getStatusBadgeColor()}`}>
          {kycStatus}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            <option value="AADHAAR">🇮🇳 Aadhaar (India)</option>
            <option value="PASSPORT">🌍 Passport (International)</option>
=======
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
>>>>>>> bbc8bab (Initial commit)
          </select>
        </div>

        <div>
<<<<<<< HEAD
          <label className="block text-sm font-semibold text-gray-700 mb-2">ID Number</label>
          <input
            type="text"
            placeholder={docType === "AADHAAR" ? "12-digit Aadhaar" : "Passport number"}
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
=======
          <label className="block font-semibold mb-2">ID Number</label>
          <input
            type="text"
            placeholder="Aadhaar (12 digits) or Passport number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-3xl text-base"
>>>>>>> bbc8bab (Initial commit)
          />
        </div>
      </div>

<<<<<<< HEAD
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Upload Document (PDF, JPG, PNG)
        </label>
        <div className="relative">
=======
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block font-semibold mb-2">Upload Document (PDF/JPG/PNG)</label>
>>>>>>> bbc8bab (Initial commit)
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
<<<<<<< HEAD
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
        {file && (
          <p className="text-xs text-gray-600 mt-2 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                clipRule="evenodd"
              />
            </svg>
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
=======
            className="w-full p-3 border border-gray-300 rounded-3xl text-base"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">Status</label>
          <div className={`inline-block px-3 py-2 rounded-full font-bold text-sm ${getStatusColor()}`}>{kycStatus}</div>
        </div>
>>>>>>> bbc8bab (Initial commit)
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
<<<<<<< HEAD
        style={{ backgroundColor: loading ? "#94a3b8" : "var(--primary)" }}
        className="w-full text-white py-3.5 rounded-2xl font-semibold text-base hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
      >
        {loading ? (
          <span className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Verifying...
          </span>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Verify eKYC Document
          </>
        )}
      </button>

      {actionStatus && (
        <div
          className={`mt-4 p-4 rounded-2xl text-sm font-medium border ${
            actionStatus.includes("✅")
              ? "bg-green-50 text-green-700 border-green-200"
              : actionStatus.includes("❌")
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-yellow-50 text-yellow-700 border-yellow-200"
          }`}
        >
          {actionStatus}
        </div>
      )}
=======
        style={{ backgroundColor: "var(--primary)" }}
        className="w-full text-white p-3 rounded-3xl font-semibold hover:opacity-90 disabled:opacity-50 mb-3"
      >
        {loading ? "Verifying..." : "Verify eKYC"}
      </button>

      {actionStatus && <p className="text-gray-600 text-sm">{actionStatus}</p>}
>>>>>>> bbc8bab (Initial commit)
    </div>
  )
}
