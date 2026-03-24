import { NextRequest, NextResponse } from "next/server";
import { parseISO, differenceInDays, format, addDays } from "date-fns";
import { geocode } from "@/lib/geocode";
import { getPlacesInRadius, type Place } from "@/lib/opentripmap";
import { getActivities } from "@/lib/amadeus";
import { reportB2B2CTiming } from "@/lib/metrics";

/**
 * GET /api/itinerary?from=YYYY-MM-DD&to=YYYY-MM-DD&destination=CityName
 * Returns rough itinerary and budget. Uses Amadeus or OpenTripMap when keys + destination are set.
 */
export async function GET(request: NextRequest) {
  const t0 = Date.now();
  const done = (res: NextResponse) => {
    reportB2B2CTiming({
      route: "/api/itinerary",
      method: "GET",
      statusCode: res.status,
      durationMs: Date.now() - t0,
    });
    return res;
  };

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const destination = request.nextUrl.searchParams.get("destination")?.trim();
  if (!from || !to) {
    return done(
      NextResponse.json({ error: "Missing from or to date" }, { status: 400 })
    );
  }
  let fromDate: Date;
  let toDate: Date;
  try {
    fromDate = parseISO(from);
    toDate = parseISO(to);
  } catch {
    return done(NextResponse.json({ error: "Invalid date format" }, { status: 400 }));
  }
  if (toDate < fromDate) {
    return done(
      NextResponse.json({ error: "To date must be after from date" }, { status: 400 })
    );
  }

  const days = differenceInDays(toDate, fromDate) + 1;
  const itinerary: { day: string; summary: string }[] = [];
  const opentripmapKey = process.env.OPENTRIPMAP_API_KEY;
  const hasAmadeus = !!(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET);

  const buildItinerary = (items: { name: string }[]) => {
    const perDay = Math.max(1, Math.floor(items.length / days));
    let idx = 0;
    for (let i = 0; i < Math.min(days, 14); i++) {
      const d = addDays(fromDate, i);
      const dayItems = items.slice(idx, idx + perDay);
      idx += perDay;
      const names = dayItems.map((a) => a.name).filter(Boolean);
      const summary =
        names.length > 0
          ? names.join(", ")
          : `Day ${i + 1}: Explore ${destination} (suggested activities).`;
      itinerary.push({ day: format(d, "EEE, MMM d"), summary });
    }
    if (days > 14) {
      itinerary.push({
        day: "...",
        summary: `${days - 14} more days — full plan when you login and accept.`,
      });
    }
  };

  if (destination) {
    const coords = await geocode(destination);
    if (coords) {
      // Try Amadeus activities first when key is set
      if (hasAmadeus) {
        const activities = await getActivities(coords.lat, coords.lon, 15);
        if (activities.length > 0) {
          buildItinerary(activities);
        }
      }
      // Try OpenTripMap if Amadeus didn't return enough or not set
      if (itinerary.length === 0 && opentripmapKey) {
        const places = await getPlacesInRadius(coords.lat, coords.lon, {
          radiusMeters: 15000,
          kinds: "cultural,natural,historic,interesting_places,architecture",
          limit: Math.min(days * 3, 30),
          rate: 1,
        });
        const items = places.map((p: Place) => ({ name: p.name || "Attraction" })).filter((a) => a.name);
        if (items.length > 0) {
          buildItinerary(items);
        }
      }
    }
  }

  if (itinerary.length === 0) {
    for (let i = 0; i < Math.min(days, 14); i++) {
      const d = addDays(fromDate, i);
      itinerary.push({
        day: format(d, "EEE, MMM d"),
        summary: destination
          ? `Day ${i + 1}: Suggested activities in ${destination} — city tour, local attractions, dining.`
          : `Day ${i + 1}: Suggested activities and local transport — explore and relax.`,
      });
    }
    if (days > 14) {
      itinerary.push({
        day: "...",
        summary: `${days - 14} more days — full plan when you login and accept.`,
      });
    }
  }

  const estimatedPerDay = 3500;
  const budget = {
    category: "Estimated total (accommodation + transport + food)",
    amount: days * estimatedPerDay,
    currency: "INR",
  };

  return done(NextResponse.json({ itinerary, budget }));
}
