# Travel Agency + Smart Safety — Scalable Design & Revenue Model

A single plan for a **scalable, practical** application: a **travel agency** (“everything a trip needs”) with **smart safety** as the differentiator, and a **clean revenue model**.

---

## 1. Product Vision

**One platform, two pillars:**

| Pillar | What it does | Who it serves |
|--------|----------------|----------------|
| **Travel agency** | Rooms, transport, local guides — search, book, pay. One trip, one cart. | Tourists (B2C), suppliers (B2B). |
| **Smart safety** | SOS, geofencing, incident response, live tracking, authority chat. | Tourists, authorities, partners (B2B API). |

**Positioning:** “Book your trip and stay safe in one place.” Safety is not an add-on; it’s built into every trip and can also be sold as an API to other products.

---

## 2. System Architecture (Scalable & Practical)

### 2.1 High-level layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  Tourist App │ Supplier Portal │ Authority Dashboard │ Partner API      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY / BFF                               │
│  Auth │ Rate limit │ API versioning │ Partner API keys                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  TRAVEL       │         │  SAFETY          │         │  COMMERCE        │
│  (Agency)     │         │  (GuardianID)    │         │  (Payments)      │
│  - Inventory  │         │  - Tourists      │         │  - Orders       │
│  - Bookings   │         │  - Trips/check-in│         │  - Commissions   │
│  - Suppliers  │         │  - SOS/incidents │         │  - Payouts       │
│  - Guides     │         │  - Geofence      │         │  - Invoicing     │
└───────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SHARED: Identity │ Notifications │ Events (webhooks, internal)          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DATA: PostgreSQL (core) │ Redis (cache/session) │ Blob (docs, KYC)     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **API Gateway / BFF:** Single entry for web and mobile; auth, API keys for partners, versioning.
- **Travel:** Inventory (rooms, transport, guides), search, availability, bookings. Can start as a single service and split later (e.g. inventory vs bookings).
- **Safety:** Existing GuardianID capabilities (tourists, trips, SOS, geofence, incidents, chat); same data, exposed via app and API.
- **Commerce:** Orders, payments, commission calculation, supplier payouts. Keeps money flow in one place.
- **Shared:** Identity (user/tourist/supplier/authority), notifications, event bus for webhooks and internal events.

### 2.2 Domain boundaries (practical)

| Domain | Owns | Talks to |
|--------|------|----------|
| **Travel** | Suppliers, listings, availability, cart, booking (reservation) | Commerce (create order on confirm), Safety (link booking → trip) |
| **Safety** | Tourists, trips, SOS, incidents, zones, messages, GPS | Travel (trip created from booking), Commerce (optional: safety fee) |
| **Commerce** | Orders, payments, commission rules, payouts, invoices | Travel (order from booking), Safety (optional fee), Suppliers (payout) |

Start with **one backend** (monolith) with clear modules for Travel, Safety, Commerce; split into services when traffic or team size justifies it.

### 2.3 Scalability choices

- **Stateless API:** All app servers stateless; auth via JWT or session store (Redis).
- **Database:** PostgreSQL with read replicas for search/listings; connection pooling (e.g. PgBouncer).
- **Cache:** Redis for sessions, rate limits, and hot data (e.g. availability for popular dates).
- **Async:** Use a queue (e.g. Redis/RabbitMQ/SQS) for: sending emails/push, webhooks, commission calculation, payout runs. Keeps API fast.
- **Multi-region later:** Deploy API + DB per region (e.g. India, SEA); route by user or partner. Safety and travel data can stay region-scoped (e.g. zones, responders per region).
- **Partner / B2B:** Every partner has an API key and optional webhook URL. Isolate by `partner_id` in data and in rate limits.

---

## 3. Core Modules (What to Build)

### 3.1 Travel agency

| Module | Purpose | Key entities |
|--------|---------|----------------|
| **Suppliers** | Hotels, transport ops, guides register; bank details for payouts; commission % per category. | `Supplier`, `SupplierUser`, `BankAccount` |
| **Inventory** | Rooms (rate plans, dates), transport (routes, seats), guide slots (experiences, calendar). | `Listing`, `Room`, `TransportLeg`, `GuideExperience`, `Availability` |
| **Search & discovery** | Filter by destination, dates, type (room/transport/guide); sort by price, rating. | Search API, faceted filters |
| **Cart & booking** | Add to cart → reserve (short TTL) → confirm → create order. | `Cart`, `Reservation`, `Booking` |
| **Orders** | One order per “trip” or per checkout; line items = room nights, transport segments, guide bookings. | `Order`, `OrderItem`, status lifecycle |

### 3.2 Smart safety (existing + hooks)

| Module | Purpose | Integration with travel |
|--------|---------|---------------------------|
| **Tourists** | Register, profile, KYC (optional). | Same identity can be used for bookings; link `user_id` ↔ `tourist_id`. |
| **Trips** | Check-in with destination, dates; optional link to `Order` or `Booking`. | When user confirms a booking, optionally auto-create or suggest “Start safety for this trip”. |
| **SOS & incidents** | Raise SOS, assign to responder, confirm, resolve; chat. | No change; travel just drives “trip” creation. |
| **Geofence** | Zones, dwell detection. | Optional: create zones per destination or property (e.g. hotel boundary). |
| **Live location** | GPS updates, sharing with authority/group. | Same as today. |
| **Group** | Room, RoomMember, group_room chat, live member positions (existing). | Link trip to `room_id` when group; optional `room_id` on Order for group bookings. |

**Design rule:** Safety does not depend on travel for core flows (SOS works even without a booking). Travel only enriches trip context and can attach a “safety product” (e.g. included or paid) to an order.

### 3.3 Commerce & revenue

| Module | Purpose | Key entities |
|--------|---------|----------------|
| **Orders** | Created when a booking is confirmed; total = sum of line items; optional safety fee. | `Order`, `OrderItem`, `Payment` |
| **Payments** | Accept card/UPI/wallet via a payment provider; record success/failure; idempotency. | `Payment`, `Refund` |
| **Commissions** | Per supplier (or category): e.g. rooms 15%, transport 10%, guides 20%. Stored per order. | `CommissionRule`, `Commission` (per order item) |
| **Payouts** | Periodic (e.g. weekly): sum (order amount − commission) per supplier; pay to bank; record. | `Payout`, `PayoutLine` |
| **Invoicing** | Optional: invoice to supplier for platform fee or to B2B partner for API usage. | `Invoice` |

---

## 4. User Personas & Main Flows

| Persona | Goal | Main flows |
|----------|------|------------|
| **Tourist** | Book trip + stay safe. | Solo or group → search → add to cart → pay → get booking + optional “Start safety for this trip”. Use app for SOS, location, chat (and group chat + live member map when in a group). |
| **Supplier** | Sell inventory and get paid. | Register → add listings/availability → receive bookings → get payouts; view dashboard. |
| **Authority / responder** | Handle incidents and monitor. | Same as today: dashboard, assign/resolve incidents, chat with tourist. |
| **Partner (B2B)** | Use safety (and optionally travel) via API. | API key → call register trip, SOS, etc.; receive webhooks. |

### 4.1 Solo vs Group Traveller

**When we ask:** Right after login (or at “Start a trip”), before destination/days.

- **Solo traveller**
  - Single tourist, single cart, single order, single payment.
  - Safety: individual SOS, geofence, authority chat; no room.
- **Group traveller**
  - Create room or join via room ID / QR (existing Safety APIs: `POST /api/rooms`, `POST /api/rooms/{id}/join`, `POST /api/rooms/join-by-qr`; UI: create/join room panel).
  - Trip/cart can be linked to `room_id` (optional): shared itinerary view or “trip leader” drives booking; payment: per-person (each has own cart, same trip) or one payer (group cart). MVP: one payer per room.
  - Safety: same SOS/geofence/authority chat **plus** group chat and live member locations on map (existing group_room chat and member markers).
- **Data:** Existing `Room`, `RoomMember`; optional `room_id` on Trip/Order for group trips.
- **SOS add-on on payment page**
  - Solo: one safety fee per trip.
  - Group: one fee per trip (flat) or per person (e.g. INR 199 × N); document choice in pricing levers (e.g. MVP: flat per trip).

**Critical flow (tourist):**

- **Solo path:** Login → (solo) → destination, days → suggested itinerary, transport, hotels, budget → approve → payment page (trip total + optional “Add GuardianID safety”) → pay → order confirmed → optional trip created in Safety → use app for SOS/geofence/chat.
- **Group path:** Login → (group) → create/join room → destination, days → suggested itinerary, transport, hotels, budget → approve → payment page (trip total + optional “Add GuardianID safety”; per-person or group cart) → pay → order confirmed, optional `room_id` on order/trip → trip created in Safety, linked to room → use app for SOS/geofence/chat + group chat + live member map.

---

## 5. Clean Revenue Model

### 5.1 Revenue streams (single view)

| # | Stream | Who pays | What you charge | When |
|---|--------|----------|------------------|------|
| 1 | **Commission (rooms)** | Hotel / property | % of booking value (e.g. 10–18%) | On each confirmed booking |
| 2 | **Commission (transport)** | Transport operator | % of booking value (e.g. 8–12%) | On each confirmed booking |
| 3 | **Commission (guides)** | Guide / experience operator | % of booking value (e.g. 15–22%) or fixed fee per booking | On each confirmed booking |
| 4 | **B2C safety (in-app)** | Tourist | Subscription (e.g. monthly) or per-trip fee (e.g. INR 99–299) | At checkout (optional add-on) or separate purchase |
| 5 | **B2B safety API** | Partner (OTA, insurer, corporate) | Per API key: fixed monthly fee + usage (e.g. per trip or per SOS), or rev-share | Monthly invoice or usage-based |
| 6 | **Listing / visibility** (optional) | Supplier | Featured listing or boost in search (fixed monthly or per impression) | Monthly or CPC/CPM |

**Primary revenue:** Commission from travel (1–3) + B2C safety (4) + B2B API (5). Listing (6) is optional later.

### 5.2 Pricing levers (practical)

- **Commission %:** By category (rooms vs transport vs guides) and/or by supplier tier (e.g. preferred partner = lower %). Stored in `CommissionRule` per supplier or category.
- **B2C safety:**  
  - **Included:** “Safety included” for every booking (cost absorbed or small margin).  
  - **Add-on:** Fixed per-trip fee (e.g. INR 199) or subscription (e.g. INR 99/month for frequent travelers).  
- **B2B API:**  
  - **Tier 1:** Free or low fixed fee, limited calls (e.g. 1K trips/month).  
  - **Tier 2:** Higher fee + higher limit + webhooks.  
  - **Enterprise:** Custom SLA, volume pricing, dedicated support.

### 5.3 Who pays what (no double charge)

| Actor | Pays | Does not pay |
|-------|------|----------------------|
| **Tourist** | Trip price (rooms, transport, guides) + optional safety fee/subscription | No direct commission |
| **Supplier** | Commission (deducted from payout) and optional listing fee | No pay-per-click unless you add it |
| **Partner** | B2B API fee (monthly or usage) | No commission on their users’ bookings unless you white-label travel |

Rule: **Tourist pays trip + optional safety.** **Supplier pays commission.** **Partner pays API fee.** Clean separation.

### 5.4 Example revenue math (illustrative)

- **Travel:** 1,000 bookings/month, avg order INR 5,000, blended commission 12% → INR 6,00,000/month.  
- **B2C safety:** 30% of bookers add safety at INR 199/trip → 300 × 199 = INR 59,700/month.  
- **B2B API:** 5 partners × INR 25,000/month = INR 1,25,000/month.  
- **Total:** ~INR 7,84,700/month (travel-led, safety differentiator + API).

---

## 6. Data Model (Minimal, Practical)

### 6.1 Cross-domain links

- **User:** One account can be `tourist`, `supplier_user`, `authority_user`, or `partner`. Same identity table; roles/permissions per product.
- **Trip (safety) ↔ Order (commerce):** Optional `order_id` on `Trip`; optional `trip_id` on `Order`. Enables “safety for this booking” and reporting.
- **Trip/Order (group):** Optional `room_id` on `Trip` and on `Order` for group trips; links booking to existing Safety `Room`. Solo = no room; group = room + members (existing `Room`, `RoomMember`).
- **Booking (travel) → Order:** Each confirmed booking creates one or more `OrderItem` in an `Order`; payment and commission are on the order.

### 6.2 Key entities (summary)

- **Travel:** `Supplier`, `Listing`, `Availability`, `Cart`, `Reservation`, `Booking`, `Order`, `OrderItem`.  
- **Safety:** `Tourist`, `Trip`, `SOS`/`Incident`, `Zone`, `Message`, `GpsLog`, `Room`, `RoomMember` (existing concepts). Trip/Order optionally have `room_id` for group trips.  
- **Commerce:** `Order`, `Payment`, `CommissionRule`, `Commission`, `Payout`, `PayoutLine`.  
- **Partner:** `Partner`, `ApiKey`, `WebhookConfig`, `UsageLog`.

Start with these; add fields (e.g. `partner_id` on `Tourist`, `order_id` on `Trip`) as you build.

---

## 7. Phased Rollout

### Phase 1 — MVP (travel + safety in one app)

- **Travel:** One category first (e.g. rooms OR guides). Suppliers onboard manually; simple listing + availability + cart + “request to book” or simple payment (e.g. one gateway).  
- **Safety:** Existing flows (tourist app, authority dashboard, SOS, geofence).  
- **Commerce:** Order on confirm; one commission %; manual payouts (export CSV, pay via bank).  
- **Revenue:** Commission from that category + optional B2C safety per-trip fee.

### Phase 2 — Full agency + commission engine

- **Travel:** All three (rooms, transport, guides); search, filters, multiple suppliers; reserve-and-pay flow.  
- **Commerce:** Commission rules per category/supplier; automated commission calculation; payout runs with status (scheduled, paid, failed).  
- **Safety:** “Start safety for this trip” from booking confirmation; link trip ↔ order in UI and analytics.

### Phase 3 — B2B API + partners

- **API:** Versioned partner API (tourists, trips, SOS, webhooks); API keys and usage dashboard.  
- **Revenue:** B2B API pricing (tiers + usage); invoicing for partners.  
- **Optional:** Widget or SDK for “Add safety” on partner sites.

### Phase 4 — Scale & optional extensions

- **Scale:** Read replicas, cache, queue, multi-region if needed.  
- **Optional:** Listing/visibility fees, insurance upsell, corporate travel (duty-of-care), white-label.

---

## 8. Success Metrics (Practical)

- **Travel:** GMV (gross booking value), number of bookings, take rate (commission revenue / GMV), supplier retention.  
- **Safety:** Active trips with safety on, SOS count, incident resolution time, NPS for “felt safe”.  
- **Revenue:** Commission revenue, B2C safety revenue, B2B API revenue; blended margin.  
- **Product:** Conversion (search → book), cart abandonment, repeat bookers, partner API adoption.

---

## 9. Summary

| Dimension | Choice |
|-----------|--------|
| **Product** | Travel agency (rooms, transport, guides) + smart safety (SOS, geofence, incidents, chat). |
| **Architecture** | API Gateway → Travel, Safety, Commerce modules; shared identity and events; DB + cache + queue. |
| **Revenue** | Commission (suppliers) + B2C safety (tourist) + B2B API (partners); optional listing fees later. |
| **Scalability** | Stateless API, DB replicas, Redis, async jobs; multi-tenant by partner; region-ready later. |
| **Rollout** | Phase 1: one travel category + safety + manual payouts. Phase 2: full agency + commission + payouts. Phase 3: B2B API. Phase 4: scale and extensions. |

This gives you a **scalable, practical** design and a **clean revenue model** for a travel agency app with smart safety at its core.
