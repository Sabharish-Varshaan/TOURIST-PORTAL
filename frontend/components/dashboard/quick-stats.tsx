interface QuickStatsProps {
  tourists: any[]
  logs: any[]
}

export default function QuickStats({ tourists, logs }: QuickStatsProps) {
  const totalTourists = tourists.length
  const activeSOS = tourists.filter((t) => t.status === "ALERT").length

  return (
    <div className="bg-[var(--card)] rounded-2xl p-3" style={{ color: "#000000" }}>
      <div className="text-xs mb-2" style={{ color: "#01050aff" }}>
        Quick Stats
      </div>
      <div className="space-y-2">
        <div>
          <div className="text-xs" style={{ color: "#2a042dff" }}>
            Total Active Tourists:
          </div>
          <div className="text-2xl font-bold">{totalTourists}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "#65000cff" }}>
            Active SOS:
          </div>
          <div className="text-2xl font-bold text-[var(--danger)]">{activeSOS}</div>
        </div>
      </div>
    </div>
  )
}
