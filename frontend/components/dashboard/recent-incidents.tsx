interface RecentIncidentsProps {
  logs: any[]
}

export default function RecentIncidents({ logs }: RecentIncidentsProps) {
  const latest = logs.slice(0, 5)

  return (
    <div className="bg-[var(--card)] rounded-2xl p-3" style={{ color: "#000000" }}>
      <div className="text-xs mb-2" style={{ color: "#ff7700ff" }}>
       <b> Recent Incidents</b>
             </div>
      <ul className="ml-4 list-disc space-y-1">
        {latest.length === 0 ? (
          <li className="text-xs" style={{ color: "#fb7304ff" }}>
            No recent incidents
          </li>
        ) : (
          latest.map((l) => (
            <li key={l.id} className="text-xs" style={{ color: "#ff0000ff" }}>
              {l.event_type.toUpperCase()}
              {l.location_label && l.location_label !== "-" ? ` – ${l.location_label}` : ""} • {l.timestamp}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
