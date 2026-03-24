import { NextRequest, NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { getPlacesInRadius } from "@/lib/opentripmap";

const TOURIST_APP_API = process.env.NEXT_PUBLIC_TOURIST_APP_API || "http://localhost:8000";

/**
 * GET /api/book/restaurants?location=&date=
 * Search restaurants via OpenTripMap foods when OPENTRIPMAP_API_KEY is set; else mock.
 */
export async function GET(request: NextRequest) {
  const t0 = Date.now();
  const done = (res: NextResponse) => {
    reportB2B2CTiming({
      route: "/api/book/restaurants",
      method: "GET",
      statusCode: res.status,
      durationMs: Date.now() - t0,
    });
    return res;
  };

  const location = request.nextUrl.searchParams.get("location") || "";
  const date = request.nextUrl.searchParams.get("date") || "";
  if (!location.trim() || !date) {
    return done(
      NextResponse.json({ error: "location and date are required" }, { status: 400 })
    );
  }

  if (process.env.OPENTRIPMAP_API_KEY) {
    const coords = await geocode(location);
    if (coords) {
      const places = await getPlacesInRadius(coords.lat, coords.lon, {
        radiusMeters: 10000,
        kinds: "foods,restaurants",
        limit: 15,
        rate: 1,
      });
      if (places.length > 0) {
        const options = places.map((p, i) => ({
          id: p.xid || `r-${i}`,
          name: p.name || `Restaurant ${i + 1} in ${location}`,
          price: 600 + (p.rate ?? 2) * 300,
          cuisine: "Local",
        }));
        return done(NextResponse.json({ options }));
      }
    }
  }

  const options = [
    { id: "r1", name: `Spice House ${location}`, price: 1200, cuisine: "Indian" },
    { id: "r2", name: `Riverside Café ${location}`, price: 800, cuisine: "Continental" },
    { id: "r3", name: `Local Kitchen ${location}`, price: 600, cuisine: "Local" },
  ];
  return done(NextResponse.json({ options }));
}

/**
 * POST /api/book/restaurants
 * Book restaurant and link to tourist app. Body: { tourist_id, option_id, location, date, safety_add_on? }
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const done = (res: NextResponse) => {
    reportB2B2CTiming({
      route: "/api/book/restaurants",
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
            location_label: `Restaurant: ${body.location} on ${body.date}`,
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
        booking_id: `R-${optionId}-${Date.now()}`,
        message: safetyEnabled ? "Booking confirmed. Safety enabled for this trip." : "Booking linked to your tourist app.",
        safety_enabled: safetyEnabled,
      })
    );
  } catch (err) {
    console.error("Book restaurant error:", err);
    return done(NextResponse.json({ error: "Booking failed" }, { status: 500 }));
  }
}
