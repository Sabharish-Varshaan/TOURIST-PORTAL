import { NextRequest, NextResponse } from "next/server"

/**
 * FastAPI base URL for server-side proxy only.
 * Uses origin only so values like http://localhost:8000/api do not become .../api/api/metrics/...
 */
function fastApiOrigin(): string {
  const raw = (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
  ).trim()
  try {
    return new URL(raw).origin
  } catch {
    return "http://127.0.0.1:8000"
  }
}

/**
 * Proxy HTTP metrics from FastAPI so the browser never needs METRICS_API_KEY.
 * Backend still enforces METRICS_API_KEY when set; this route adds it from server env.
 */
export async function GET(request: NextRequest) {
  const hours = request.nextUrl.searchParams.get("hours") || "24"
  const key = process.env.METRICS_API_KEY || ""
  const target = new URL("/api/metrics/http", fastApiOrigin())
  target.searchParams.set("hours", hours)
  if (key) target.searchParams.set("key", key)
  try {
    const res = await fetch(target.toString(), { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 502 })
  }
}
