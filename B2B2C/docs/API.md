# Tourist Booking Portal — Exposed APIs

This document lists the APIs exposed by the booking portal and how they connect to the tourist app (incident management) and external booking services.

## Portal API routes (this app)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/itinerary?from=&to=&destination=` | Rough itinerary and budget. Uses **OpenTripMap** when `OPENTRIPMAP_API_KEY` + `destination` are set; geocoding via **Nominatim** (free). |
| POST | `/api/tourist/login` | Login — proxies to tourist app `POST /api/tourist/login` (phone + password). |
| GET | `/api/tourist/profile/[touristId]` | Full travel profile — proxies to tourist app `GET /api/tourist/{id}/profile`. |
| GET | `/api/book/transport?from=&to=&date=&mode=` | Search bus/train (placeholder; replace with external transport API). |
| POST | `/api/book/transport` | Book transport; links to tourist app via check-in. |
| GET | `/api/book/hotels?location=&check_in=&check_out=` | Search hotels via **OpenTripMap** accommodations when `OPENTRIPMAP_API_KEY` is set; else mock. |
| POST | `/api/book/hotels` | Book hotel; links to tourist app via check-in. |
| GET | `/api/book/restaurants?location=&date=` | Search restaurants via **OpenTripMap** foods when `OPENTRIPMAP_API_KEY` is set; else mock. |
| POST | `/api/book/restaurants` | Book restaurant; links to tourist app via check-in. |

## Tourist app APIs used (incident management backend)

Configure base URL with `NEXT_PUBLIC_TOURIST_APP_API` (e.g. `http://localhost:8000`).

| Tourist app endpoint | Used for |
|----------------------|----------|
| `POST /api/tourist/login` | Login (phone, password) → tourist_id, name, qr_png_base64. |
| `GET /api/tourist/{tourist_id}/profile` | Full travel profile (name; add phone/email when backend exposes them). |
| `POST /api/checkin` | Register trip/stay with tourist app after booking (optional). |
| `POST /api/kyc` | e-KYC (used from tourist app UI; link from dashboard). |

## External APIs (real data)

| Env var | Purpose |
|--------|--------|
| `OPENTRIPMAP_API_KEY` | [OpenTripMap](https://opentripmap.io/product) — free key for real attractions (itinerary), accommodations (hotels), foods (restaurants). |
| Geocoding | **Nominatim** (OpenStreetMap) — no key; used to convert destination/location to lat/lon. |

- **Itinerary:** Add a **destination** (city/place) on Explore or Dashboard; with API key you get real POIs per day.
- **Hotels / Restaurants:** Enter **location** (city/area); with API key you get real accommodations and food places.

## User flows

- **Without login:** Home → Explore → enter from/to date → get rough itinerary and budget (same plan logic as logged-in).
- **With login:** Home → Login (tourist app) → Dashboard (profile + same from/to dates → plan) → Accept plan → e-KYC (tourist app) → Book bus/train, hotels, restaurants via external APIs; bookings linked to tourist app.
