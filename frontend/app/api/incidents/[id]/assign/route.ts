export async function POST(request: Request, { params }: { params: { id: string } }) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"

  try {
    const body = await request.json()
    const response = await fetch(`${backendUrl}/api/incidents/${params.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Backend assign error:", response.status, errorText)
      return Response.json({ error: "Failed to assign ticket" }, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error("[v0] Assign error:", error)
    return Response.json({ error: "Failed to assign ticket" }, { status: 500 })
  }
}
