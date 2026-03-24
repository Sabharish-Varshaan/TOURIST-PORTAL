import { NextRequest, NextResponse } from "next/server";

const TOURIST_APP_API = process.env.NEXT_PUBLIC_TOURIST_APP_API || "http://localhost:8000";

/**
 * POST /api/tourist/login
 * Proxies login to the tourist app (incident management) backend.
 * Body: { phone: string, password: string }
 * Returns: { tourist_id, qr_png?, name? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = body?.phone;
    const password = body?.password;
    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Dummy login for UI testing — no backend required
    const isDummy = (phone.trim().toLowerCase() === "demo" || phone.trim() === "123") && password === "demo";
    if (isDummy) {
      return NextResponse.json({
        tourist_id: "demo-tourist-001",
        qr_png: "",
        name: "Demo Tourist",
      });
    }

    const base = TOURIST_APP_API;
    const res = await fetch(`${base}/api/tourist/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail ?? data.message ?? "Login failed";
      return NextResponse.json(
        { error: typeof msg === "string" ? msg : "Login failed" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      tourist_id: data.tourist_id,
      qr_png: data.qr_png_base64 ?? data.qr_png_b64 ?? "",
      name: data.name ?? "Tourist",
    });
  } catch (err) {
    console.error("Tourist login proxy error:", err);
    return NextResponse.json(
      { error: "Could not reach tourist app. Ensure backend is running." },
      { status: 502 }
    );
  }
}
