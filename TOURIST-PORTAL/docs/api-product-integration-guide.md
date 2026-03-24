# Selling GuardianID as an API — Use Cases & Integration Guide

This doc describes **how your safety product can be sold as an API** and **how different products can integrate it**.

---

## 1. Who Would Use the API (Partners)

| Partner type | How they use it |
|--------------|------------------|
| **OTAs / travel apps** | Add “GuardianID safety” to bookings (flights, hotels, tours). User gets SOS + tracking without leaving the OTA app. |
| **Tour operators** | Embed safety for group trips: live location, geofence alerts, incident reporting to their ops + your authority backend. |
| **Corporate travel** | Duty-of-care: track employees on trips, get alerts on SOS/geofence, comply with travel risk policies. |
| **Insurance** | Verify trips (check-in), get incident webhooks for claims; offer “safety-covered” travel products. |
| **Hotel / activity apps** | “Book + stay safe”: one tap to register trip with GuardianID, optional SOS and authority chat. |
| **Government / tourism boards** | White-label safety layer for official tourist apps or portals. |
| **Fleet / transport apps** | Driver or passenger safety: SOS, location sharing, incident escalation to your responder network. |

---

## 2. How It Can Be Integrated (Integration Patterns)

### A. REST API (headless)

Partner’s backend calls your API for everything; they build their own UI.

- **Use case:** Full control over UX (e.g. custom dashboard, in-house app).
- **Flow:** Partner server → `Authorization: Bearer <api_key>` → your base URL (e.g. `https://api.guardianid.com/v1/...`).
- **You expose:** Tourist create/update, trip registration, SOS, location, geofence checks, incident status, chat (if applicable).

### B. Webhooks (you push events to them)

You send HTTP POSTs to their URL when something happens (e.g. SOS, geofence breach, incident confirmed).

- **Use case:** Their CRM, ops dashboard, or insurance system reacts in real time.
- **Example:** `POST https://partner.com/webhooks/guardianid` with `{ "event": "sos", "tourist_id": "...", "incident_id": 123 }`.

### C. SDK / client library

You ship SDKs (e.g. JavaScript, React, Android, iOS) that wrap your API and optionally UI components.

- **Use case:** Faster integration; partner drops “Login with GuardianID” or “Report SOS” into their app.
- **Example:** `GuardianIDSDK.registerTrip(tripId, { lat, lng })` or `<GuardianIDSafetyButton />`.

### D. Embeddable widgets / iframe

You host a small UI (e.g. “Register this trip”, “SOS button”, “Live location sharing”) that partners embed via script or iframe.

- **Use case:** No backend work for partner; they add a script tag and show your UI inside their product.
- **Example:** Partner’s booking confirmation page includes “Add to GuardianID for safety” → your widget handles registration and optional SOS.

### E. Deep links + your app

Partner app opens your app via deep link (e.g. `guardianid://register?trip_id=xyz`). User completes flow in your app; you notify partner via API or webhook.

- **Use case:** Partner doesn’t want to build safety UI; they just “send user to GuardianID” at key moments (after booking, before trip).

---

## 3. What the API Product Would Expose (Capabilities)

Based on your current backend, a **GuardianID Safety API** product could offer:

| Capability | Description | Typical endpoints / events |
|------------|-------------|-----------------------------|
| **Tourist identity** | Create/update tourist, link to partner’s user id. | `POST /v1/tourists`, `PATCH /v1/tourists/:id` |
| **Trip registration** | Register a trip (dates, destination, optional zones). | `POST /v1/trips` or `POST /v1/checkin` |
| **Live location** | Send and/or read last position (for tracking, geofence). | `POST /v1/gps`, `GET /v1/tourists/:id/location` |
| **Geofencing** | Get zones; evaluate dwell/breach (or you do it server-side and webhook). | `GET /v1/zones`, webhook `geofence.dwell` or `geofence.breach` |
| **SOS** | Raise SOS; get incident id and status. | `POST /v1/sos`, webhook `incident.confirmed`, `incident.resolved` |
| **Incidents** | List/status for a tourist or trip (for partner ops). | `GET /v1/incidents`, `GET /v1/incidents/:id` |
| **Chat / authority** | Optional: send/receive messages with authority (if you expose it). | `POST /v1/messages`, `GET /v1/messages` (or WebSocket) |
| **Safety score** | Read-only score for display in partner app. | `GET /v1/tourists/:id/safety-score` |

You can package these as **tiers** (e.g. “Basic: register + SOS + webhooks”, “Pro: + live location + geofence”, “Enterprise: + chat + custom responders”).

---

## 4. How Different Products Integrate (Examples)

### Product 1: OTA (e.g. flight + hotel booking app)

- **Flow:** After user books a trip, OTA shows “Add GuardianID safety (optional)”. User taps → OTA backend calls your `POST /v1/tourists` (if new) and `POST /v1/trips` or check-in with trip details.
- **In their app:** They show “SOS” button that calls your `POST /v1/sos` (with API key and tourist id). They can show “Share live location” that sends GPS to you via `POST /v1/gps`.
- **Integration style:** REST API + optional SDK or widget for SOS/registration. Webhooks for incident updates so OTA can show “Incident reported – authorities notified”.

### Product 2: Tour operator dashboard

- **Flow:** Operator creates a “tour” in their system; their backend creates tourists and registers a “trip” with you. During the tour, their dashboard shows live map: they call your `GET /v1/tourists/:id/location` (or you push via WebSocket).
- **Integration style:** REST API + webhooks (`sos`, `geofence.dwell`) so their ops team gets alerts and can coordinate with your responder network.

### Product 3: Insurance app

- **Flow:** Customer buys travel insurance; insurer backend registers the trip with GuardianID. When you send webhook `incident.confirmed` or `incident.resolved`, insurer’s system creates a claim or updates status.
- **Integration style:** REST for trip registration + webhooks only (no UI needed from you).

### Product 4: Government tourism portal

- **Flow:** Portal embeds your widget: “Register your visit for safety”. Widget uses your API (via your backend) to register tourist and trip. Citizens use your app or a white-label app for SOS; you still run the authority/responder side.
- **Integration style:** Embeddable widget + REST API for portal backend; optionally white-label app.

### Product 5: Hotel app (“Book room + stay safe”)

- **Flow:** After booking, app shows “Enable safety for this stay”. One tap → deep link to your app or your widget; you register trip with check-in dates and property location. Hotel gets webhook if guest triggers SOS so they can assist.
- **Integration style:** Deep link or widget + webhooks to hotel’s backend.

---

## 5. Technical Integration Basics

### Authentication (how partners call you)

- **API key:** Partner gets an API key (e.g. per environment). Send as header: `Authorization: Bearer <key>` or `X-API-Key: <key>`.
- **OAuth2:** For deeper integration, partner app gets tokens on behalf of “their” users; you map partner user id to your tourist id. Useful when partner has a large app and many users.

### Webhooks (you call them)

- Partner registers a URL (e.g. in a partner dashboard you build).
- You sign payloads (e.g. HMAC) so they can verify it’s from you.
- Events: `sos.raised`, `incident.confirmed`, `incident.resolved`, `geofence.dwell`, `trip.registered`, etc.

### Idempotency and id mapping

- **Partner user id:** Many partners will send `partner_user_id` or `external_id` when creating a tourist so they can map your `tourist_id` back to their system.
- **Idempotency keys:** For `POST /v1/sos` or trip registration, accept `Idempotency-Key` so duplicate requests don’t create duplicate incidents/trips.

### Rate limits and SLAs

- Publish rate limits (e.g. 100 req/min per API key) and, for paid tiers, SLAs (e.g. 99.9% uptime, webhook retries).

---

## 6. Summary: One API, Many Products

| Integration style | Best for | Partner effort |
|------------------|----------|----------------|
| **REST only** | OTAs, insurers, corporate backends | Build all UI themselves; you provide data + actions. |
| **REST + webhooks** | Ops dashboards, insurance, hotels | Backend only; no need to build safety UI. |
| **SDK + REST** | Mobile/web apps that want safety in-app | Drop-in components + API for custom logic. |
| **Widget / iframe** | Portals, simple booking sites | Add script; you own registration + SOS UI. |
| **Deep link** | “Send user to GuardianID” flows | Minimal; just open your app at the right moment. |

You can offer **one API product** with clear docs, API keys, and webhook config, and let each partner choose the pattern that fits their product (headless API, widget, SDK, or deep link).

---

## Next Steps (When You Build the API Product)

1. **Versioned base URL** — e.g. `https://api.guardianid.com/v1`, keep existing app on current paths.
2. **Partner dashboard** — Sign up, API keys, webhook URL + secret, usage/billing.
3. **API docs** — OpenAPI spec + examples for tourists, trips, SOS, webhooks.
4. **Webhook delivery** — Retries, signing, idempotency; event catalog.
5. **Optional SDK / widget** — Start with one platform (e.g. web React or JS) and expand.

This doc can be updated as you add endpoints or new integration patterns.
