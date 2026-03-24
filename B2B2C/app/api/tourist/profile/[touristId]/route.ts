import { NextRequest, NextResponse } from "next/server";

const TOURIST_APP_API = process.env.NEXT_PUBLIC_TOURIST_APP_API || "http://localhost:8000";

/**
 * GET /api/tourist/profile/[touristId]
 * Proxies to tourist app: GET /api/tourist/{tourist_id}/profile
 * Returns full travel profile (name, contact, etc.) for the booking portal.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ touristId: string }> }
) {
  const { touristId } = await params;
  if (!touristId) {
    return NextResponse.json({ error: "Tourist ID required" }, { status: 400 });
  }
  // Dummy profile for UI testing
  if (touristId === "demo-tourist-001") {
    return NextResponse.json({
      id: touristId,
      name: "Demo Tourist",
      phone: "+91 98765 43210",
      email: "demo@example.com",
    });
  }
  try {
    const res = await fetch(`${TOURIST_APP_API}/api/tourist/${touristId}/profile`, {
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Profile not found" },
        { status: res.status }
      );
    }
    return NextResponse.json({
      id: data.id,
      name: data.name,
      qr_png_base64: data.qr_png_base64,
      phone: data.phone,
      email: data.email,
    });
  } catch (err) {
    console.error("Tourist profile proxy error:", err);
    return NextResponse.json(
      { error: "Could not reach tourist app." },
      { status: 502 }
    );
  }
}
