/**
 * OpenTripMap API — attractions, accommodations, foods.
 * Docs: https://dev.opentripmap.org/docs | OpenAPI: https://dev.opentripmap.org/openapi.en.json
 * Base: https://api.opentripmap.com/0.1 (paths: /{lang}/places/radius, /{lang}/places/xid/{xid})
 * API key: not in the API docs — get it by registering at https://dev.opentripmap.org/ (Sign in / Register), then copy from your account.
 */

const BASE = "https://api.opentripmap.com/0.1/en";

export interface Place {
  xid: string;
  name: string;
  rate?: number;
  kinds?: string;
  dist?: number;
}

export async function getPlacesInRadius(
  lat: number,
  lon: number,
  options: {
    radiusMeters?: number;
    kinds?: string;
    limit?: number;
    rate?: number;
  }
): Promise<Place[]> {
  const key = process.env.OPENTRIPMAP_API_KEY;
  if (!key) return [];

  const radius = options.radiusMeters ?? 10000;
  const limit = options.limit ?? 20;
  const kinds = options.kinds ?? "interesting_places,cultural,natural,historic";
  const rate = options.rate ?? 1;

  const params = new URLSearchParams({
    radius: String(radius),
    lon: String(lon),
    lat: String(lat),
    limit: String(limit),
    kinds,
    rate: String(rate),
    format: "json",
    apikey: key,
  });

  const res = await fetch(`${BASE}/places/radius?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getPlaceDetails(xid: string): Promise<{ name?: string; wikipedia_extract?: string } | null> {
  const key = process.env.OPENTRIPMAP_API_KEY;
  if (!key) return null;
  const res = await fetch(`${BASE}/places/xid/${xid}?apikey=${key}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && typeof data === "object" ? data : null;
}
