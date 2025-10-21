export async function GET() {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"

  try {
    const response = await fetch(`${backendUrl}/api/substations`)
    if (!response.ok) {
      console.error("[v0] Backend substations error:", response.status)
      return Response.json({ error: "Failed to fetch substations" }, { status: response.status })
    }
    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error("[v0] Substations fetch error:", error)
    return Response.json({ error: "Failed to fetch substations" }, { status: 500 })
  }
}
