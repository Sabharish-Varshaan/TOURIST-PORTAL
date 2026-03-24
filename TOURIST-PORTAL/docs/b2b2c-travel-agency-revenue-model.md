# B2B2C Travel Agency & Revenue Model

## Vision

Extend GuardianID from a **B2C safety app** into a **B2B2C travel platform**: “everything a trip needs” (rooms, travel, local guides) with **safety as the differentiator**, and revenue from commissions across suppliers.

---

## Current Model (B2C)

- **Users:** Tourists (solo + groups)
- **Revenue:** Subscription / one-time (e.g. Premium INR 299/trip)
- **Value:** Safety layer — SOS, geofencing, incident response, live tracking, chat with authorities

---

## New Model: B2B2C + Own Travel Agency

### Idea

- **B2B2C:** Platform (GuardianID) sits between **businesses** (hotels, transport, guides) and **consumers** (tourists). You earn commission from suppliers; tourists get a single place to book trip essentials.
- **“Own travel agency”:** Curate and sell rooms, travel, and local guides yourself (or via partners). Commission from:
  - **Rooms** — hotels, homestays, camps
  - **Travel** — cabs, buses, ferries, flights (where applicable)
  - **Local guides** — experiences, tours, connection fees or % of booking

Safety is **not the main product** in this model; it’s the **trust and compliance layer** that makes the platform credible for tourists and authorities and justifies premium/partnerships.

### Safety as “External Factor”

- **Trust:** “Book with GuardianID — we also keep you safe.”
- **Compliance:** Authorities see verified tourists, geofencing, and incident response; easier approvals and partnerships.
- **Upsell:** Agencies and OTAs can white-label or integrate safety for their users; you charge B2B for the safety layer.

---

## Revenue Streams (Summary)

| Stream        | Who pays           | How                          |
|---------------|--------------------|------------------------------|
| B2C (current) | Tourist            | Subscription / per-trip fee   |
| Rooms         | Hotel / property   | Commission % per booking     |
| Travel        | Transport operator | Commission % per booking     |
| Local guides  | Guide / operator   | Commission or listing fee    |
| B2B safety    | Agencies / OTAs    | API fee or rev-share         |

---

## Product Directions (High Level)

1. **Trip hub (B2B2C)**  
   - One flow: choose destination → add rooms, transport, guides.  
   - Checkout with GuardianID; you record booking and commission.

2. **Supplier onboarding (B2B)**  
   - Hotels, transport, guides register as partners.  
   - You define commission rules and payouts.

3. **Local guides**  
   - Listings, profiles, availability, booking.  
   - Commission or fee per booking / experience.

4. **Safety as differentiator**  
   - Keep SOS, geofencing, incident response, authority chat.  
   - Position as: “Same app that keeps you safe also books your trip.”

5. **B2B safety API**  
   - Let other travel brands use your safety stack (tracking, alerts, incident handling) for a fee.

---

## Next Steps (When You Build)

- **Phase 1:** Document APIs and data model for “trip” (accommodation, transport, guide slots) and commissions.
- **Phase 2:** Add trip-hub UI (search rooms/transport/guides, cart, checkout) and a simple commission engine.
- **Phase 3:** Supplier dashboard (register, inventory, payouts) and guide marketplace.
- **Phase 4:** B2B safety API and partner integrations.

This doc can be updated as you lock in partnerships and commission structures.
