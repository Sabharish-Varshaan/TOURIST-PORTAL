import { NextRequest, NextResponse } from "next/server";
import { reportB2B2CTiming } from "@/lib/metrics";

const TOURIST_APP_API = process.env.NEXT_PUBLIC_TOURIST_APP_API || "http://localhost:8000";

/**
 * GET /api/book/transport?from=&to=&date=&mode=bus|train
 * Search bus/train via external API. Placeholder returns mock options; replace with real external API call.
 */
export async function GET(request: NextRequest) {
  const t0 = Date.now();
  const done = (res: NextResponse) => {
    reportB2B2CTiming({
      route: "/api/book/transport",
      method: "GET",
      statusCode: res.status,
      durationMs: Date.now() - t0,
    });
    return res;
  };

  const from = request.nextUrl.searchParams.get("from") || "";
  const to = request.nextUrl.searchParams.get("to") || "";
  const date = request.nextUrl.searchParams.get("date") || "";
  const mode = request.nextUrl.searchParams.get("mode") || "bus";
  if (!from.trim() || !to.trim() || !date) {
    return done(
      NextResponse.json({ error: "from, to and date are required" }, { status: 400 })
    );
  }
  // In production: call external transport API (e.g. IRCTC, redBus) using env EXTERNAL_TRANSPORT_API_URL
  const options = [
    { id: "t1", name: `${mode === "train" ? "Express" : "AC Bus"} ${from} → ${to}`, price: mode === "train" ? 450 : 380, time: "08:00" },
    { id: "t2", name: `${mode === "train" ? "Superfast" : "Sleeper"} ${from} → ${to}`, price: mode === "train" ? 620 : 520, time: "14:30" },
    { id: "t3", name: `${mode === "train" ? "Mail" : "Non-AC"} ${from} → ${to}`, price: mode === "train" ? 280 : 220, time: "20:15" },
  ];
  return done(NextResponse.json({ options }));
}

/**
 * POST /api/book/transport
 * Book transport and link to tourist app. Body: { tourist_id, option_id, from, to, date, mode, safety_add_on? }
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const done = (res: NextResponse) => {
    reportB2B2CTiming({
      route: "/api/book/transport",
      method: "POST",
      statusCode: res.status,
      durationMs: Date.now() - t0,
    });
    return res;
  };
  try {
    const body = await request.json();
    const touristId = body?.tourist_id;
    const optionId = body?.option_id;
    const safetyAddOn = body?.safety_add_on === true;
    if (!touristId || !optionId) {
      return done(
        NextResponse.json({ error: "tourist_id and option_id are required" }, { status: 400 })
      );
    }
    let safetyEnabled = false;
    if (safetyAddOn) {
      const checkinUrl = `${TOURIST_APP_API}/api/checkin`;
      try {
        const res = await fetch(checkinUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tourist_id: touristId,
            location_label: `Transport booking: ${body.from} → ${body.to} on ${body.date}`,
          }),
        });
        safetyEnabled = res.ok;
      } catch {
        // Tourist app optional for demo
      }
    }
    return done(
      NextResponse.json({
        ok: true,
        booking_id: `T-${optionId}-${Date.now()}`,
        message: safetyEnabled ? "Booking confirmed. Safety enabled for this trip." : "Booking linked to your tourist app.",
        safety_enabled: safetyEnabled,
      })
    );
  } catch (err) {
    console.error("Book transport error:", err);
    return done(NextResponse.json({ error: "Booking failed" }, { status: 500 }));
  }
}
