"use client"

export default function DemoChecklist() {
  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900 mb-3">Hackathon demo checklist</h3>
      <ul className="text-sm text-gray-700 space-y-2">
        <li>
          <span className="font-semibold">1)</span> Register tourist (QR generated)
        </li>
        <li>
          <span className="font-semibold">2)</span> Start navigation (online) and see route polyline + steps
        </li>
        <li>
          <span className="font-semibold">3)</span> Download offline area tiles (small zoom range)
        </li>
        <li>
          <span className="font-semibold">4)</span> Toggle offline: map stays usable + route guidance continues
        </li>
        <li>
          <span className="font-semibold">5)</span> Tap SOS while offline: request queues + SMS fallback appears
        </li>
        <li>
          <span className="font-semibold">6)</span> Back online: queued SOS/GPS sync automatically (check dashboard logs)
        </li>
      </ul>
    </div>
  )
}

