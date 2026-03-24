/**
 * Geocode city/place name to lat/lon using OpenStreetMap Nominatim (free, no key).
 */
export async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(query.trim());
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { "User-Agent": "TouristBookingPortal/1.0" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const lat = parseFloat(data[0].lat);
  const lon = parseFloat(data[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}
