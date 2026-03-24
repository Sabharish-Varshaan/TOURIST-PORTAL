export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
  const { id } = await params

  try {
    const response = await fetch(`${backendUrl}/api/incidents/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Backend resolve error:", response.status, errorText)
      return Response.json({ error: "Failed to resolve ticket" }, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error("[v0] Resolve error:", error)
    return Response.json({ error: "Failed to resolve ticket" }, { status: 500 })
  }
}
