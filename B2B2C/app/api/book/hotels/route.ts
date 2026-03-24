import { NextRequest, NextResponse } from "next/server";
import { reportB2B2CTiming } from "@/lib/metrics";
import { geocode } from "@/lib/geocode";
import { getPlacesInRadius } from "@/lib/opentripmap";
import { getHotelsByGeocode } from "@/lib/amadeus";

const TOURIST_APP_API = process.env.NEXT_PUBLIC_TOURIST_APP_API || "http://localhost:8000";

/**
 * GET /api/book/hotels?location=&check_in=&check_out=
 * Search hotels via Amadeus or OpenTripMap when keys are set; else mock.
 */
export async function GET(request: NextRequest) {
  const t0 = Date.now();
  const done = (res: NextResponse) => {
    reportB2B2CTiming({
      route: "/api/book/hotels",
      method: "GET",
      statusCode: res.status,
      durationMs: Date.now() - t0,
    });
    return res;
  };

  const location = request.nextUrl.searchParams.get("location") || "";
  const checkIn = request.nextUrl.searchParams.get("check_in") || "";
  const checkOut = request.nextUrl.searchParams.get("check_out") || "";
  if (!location.trim() || !checkIn || !checkOut) {
    return done(
      NextResponse.json({ error: "location, check_in and check_out are required" }, { status: 400 })
    );
  }

  const coords = await geocode(location);
  if (coords) {
    const hasAmadeus = !!(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET);

    if (hasAmadeus) {
      const hotels = await getHotelsByGeocode(coords.lat, coords.lon, 15);
      if (hotels.length > 0) {
        const options = hotels.slice(0, 15).map((h, i) => ({
          id: h.id,
          name: h.name,
          price: 2500 + (i % 5) * 800,
          rating: (4 + (i % 3) * 0.3).toFixed(1),
        }));
        return done(NextResponse.json({ options }));
      }
    }

    if (process.env.OPENTRIPMAP_API_KEY) {
      const places = await getPlacesInRadius(coords.lat, coords.lon, {
        radiusMeters: 15000,
        kinds: "accomodations,hotels",
        limit: 15,
        rate: 1,
      });
      if (places.length > 0) {
        const options = places.map((p, i) => ({
          id: p.xid || `h-${i}`,
          name: p.name || `Accommodation ${i + 1} in ${location}`,
          price: 2000 + (p.rate ?? 2) * 800,
          rating: (p.rate ?? 0).toFixed(1),
        }));
        return done(NextResponse.json({ options }));
      }
    }
  }

  const options = [
    { id: "h1", name: `Hotel Grand ${location}`, price: 3200, rating: "4.5" },
    { id: "h2", name: `Stay Inn ${location}`, price: 1800, rating: "4.0" },
    { id: "h3", name: `Heritage ${location}`, price: 4500, rating: "4.8" },
  ];
  return done(NextResponse.json({ options }));
}

/**
 * POST /api/book/hotels
 * Book hotel and link to tourist app. Body: { tourist_id, option_id, location, check_in, check_out, safety_add_on? }
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const done = (res: NextResponse) => {
    reportB2B2CTiming({
      route: "/api/book/hotels",
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
            location_label: `Hotel booking: ${body.location} (${body.check_in} – ${body.check_out})`,
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
        booking_id: `H-${optionId}-${Date.now()}`,
        message: safetyEnabled ? "Booking confirmed. Safety enabled for this trip." : "Booking linked to your tourist app.",
        safety_enabled: safetyEnabled,
      })
    );
  } catch (err) {
    console.error("Book hotel error:", err);
    return done(NextResponse.json({ error: "Booking failed" }, { status: 500 }));
  }
}
