/**
 * Amadeus API helpers — OAuth token + hotel/activity endpoints.
 * Uses test.api.amadeus.com for development; set AMADEUS_ENV=production for live.
 */

const BASE_URL =
  process.env.AMADEUS_ENV === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAmadeusToken(): Promise<string | null> {
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;
  if (!key || !secret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: key,
    client_secret: secret,
  });

  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) return null;

  const expiresIn = (data.expires_in ?? 1799) * 1000;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn,
  };

  return cachedToken.token;
}

async function amadeusFetch(
  path: string,
  params?: Record<string, string | number>
): Promise<unknown | null> {
  const token = await getAmadeusToken();
  if (!token) return null;

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) =>
      url.searchParams.set(k, String(v))
    );
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.amadeus+json",
    },
  });

  if (!res.ok) return null;
  return res.json();
}

/** Tours & Activities by location — for itinerary POIs. */
export async function getActivities(
  lat: number,
  lon: number,
  radiusKm = 5
): Promise<{ name: string }[]> {
  const data = (await amadeusFetch(
    "/v1/shopping/activities",
    {
      latitude: lat,
      longitude: lon,
      radius: Math.min(radiusKm, 20),
    }
  )) as { data?: { name?: string }[] } | null;

  if (!data?.data || !Array.isArray(data.data)) return [];
  return data.data
    .filter((a) => a?.name)
    .map((a) => ({ name: a.name! }));
}

/** Hotel List by geocode — hotels near lat/lon. */
export async function getHotelsByGeocode(
  lat: number,
  lon: number,
  radius = 5
): Promise<{ id: string; name: string }[]> {
  const data = (await amadeusFetch(
    "/v1/reference-data/locations/hotels/by-geocode",
    {
      latitude: lat,
      longitude: lon,
      radius: radius,
      radiusUnit: "KM",
    }
  )) as { data?: { hotelId?: string; name?: string }[] } | null;

  if (!data?.data || !Array.isArray(data.data)) return [];
  return data.data
    .filter((h) => h?.hotelId || h?.name)
    .map((h, i) => ({
      id: h.hotelId ?? `amadeus-${i}`,
      name: h.name ?? `Hotel ${i + 1}`,
    }));
}
