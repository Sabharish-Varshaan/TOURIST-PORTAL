# UI Reference - Responder Chat System

## What You'll See on /responder Page

### When Responder Accepts SOS Ticket

```
╔═══════════════════════════════════════════════════════════════════╗
║                    Responder Console                              ║
╚═══════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────┐
│ [Officer Name ▼] [Responder ID ▼]  [Refresh] Available: 5      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐         ┌───────────────────────────┐
│  Left Panel             │         │  Right Panel              │
│  (Tickets & Chat)       │         │  (Map & Navigation)       │
└─────────────────────────┘         └───────────────────────────┘

┏━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ My active ticket       ┃         ← Shows only when accepted
┣━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                        ┃
┃ SOS #123              ┃
┃ Tourist: TOUR_001     ┃
┃ Timestamp: 2025-01-30 ┃
┃ Location: 26.1445°N   ┃
┃           91.7362°E   ┃
┃                        ┃
┃ [Navigate] [Resolve]  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Chat with Authority    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Connected: ✅          ┃
┃                        ┃
┃ [Authority]: Ticket   ┃
┃ assigned to you       ┃
┃                        ┃
┃ [You]: Heading there  ┃
┃ now, ETA 5 mins      ┃
┃                        ┃
┃ [Type message...    ]  ┃
┃ [Send] [Call]        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━┓ ← NEW!
┃ Chat with Tourist      ┃    This is what we built
┣━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Connected: ✅          ┃
┃                        ┃
┃ [Tourist]: Is anyone ┃
┃ coming? Need help!   ┃
┃                        ┃
┃ [You]: Yes, I'm on my┃
┃ way. Stay calm.      ┃
┃                        ┃
┃ [Tourist]: Thank you ┃
┃                        ┃
┃ [Type message...    ]  ┃
┃ [Send] [Call]        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## What You'll See on /tourist Page

### When Responder is Assigned to Tourist's SOS

```
╔═══════════════════════════════════════════════════════════════════╗
║        Tourist Safety Dashboard                                   ║
╚═══════════════════════════════════════════════════════════════════╝

[QR Card]
[Map View]
[eKYC Form]

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Chat with Authority                                             ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Connected: ✅                                                    ┃
┃                                                                  ┃
┃ [Authority]: Your SOS has been received and assigned            ┃
┃ [You]: Thanks                                                    ┃
┃                                                                  ┃
┃ [Type message...]                    [Send] [Call]              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ← NEW!
┃ Chat with Responder (Guwahati Central Substation)               ┃    Direct chat with
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫    assigned responder
┃ Connected: ✅                                                    ┃
┃                                                                  ┃
┃ [Responder]: Hello, I'm Officer Arjun. I'm heading your way.    ┃
┃ ETA: 5 minutes                                                   ┃
┃                                                                  ┃
┃ [You]: Thank you! I'm at the market main entrance               ┃
┃                                                                  ┃
┃ [Responder]: Perfect. I'm in a white patrol car.                ┃
┃ Look for vehicle license ABC-1234                               ┃
┃                                                                  ┃
┃ [Type message...]                    [Send] [Call]              ┃
┃                                                                  ┃
┃ You can also call: [Start Call] / Status: Idle                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[Travel Assistant Chat]
[Demo Checklist]
```

---

## Message Flow Example

```
TOURIST SENDS SOS
    ↓
SOS Event Created (ticket_status = "NEW")
    ↓
Authority Confirms in Dashboard (ticket_status = "CONFIRMED")
    ↓
Authority Assigns to Responder (ticket_status = "ASSIGNED")
    ↓
┌─────────────────────────────────────────┐
│ responder_tourist THREAD NOW ACTIVE     │
├─────────────────────────────────────────┤
│ Messages can now be exchanged            │
│                                         │
│ RESPONDER sends:                         │
│ "Heading your way"                      │
│   ↓                                     │
│ TOURIST receives instantly (WebSocket)  │
│   ↓                                     │
│ TOURIST sends:                          │
│ "Thanks! I'm at market"                 │
│   ↓                                     │
│ RESPONDER receives instantly (WebSocket)│
│                                         │
│ [Both can also CALL via WebRTC]         │
│                                         │
└─────────────────────────────────────────┘
    ↓
Tourist Resolved in Dashboard
(but chat remains visible)
```

---

## Key UI Elements

### Chat Panel Components

**Title Bar:**
```
┌─────────────────────────┐
│ Chat with Tourist       │ ← Shows who you're chatting with
│ Connected: ✅          │ ← WebSocket status
└─────────────────────────┘
```

**Message Display:**
```
┌─────────────────────────┐
│ [You]: My message       │ ← Right aligned, blue background
│ Timestamp...            │
│                         │
│ [Them]: Their message   │ ← Left aligned, white background
│ Timestamp...            │
└─────────────────────────┘
```

**Input Area:**
```
┌──────────────────────────────────────┐
│ [Type message...                  ]  │ ← Text input
│ [Send]        [Call]  [End Call]     │ ← Action buttons
└──────────────────────────────────────┘
```

**Call Status Indicator:**
```
Idle → User clicks "Start Call"
    ↓
Calling... → Recipient sees "Incoming Call" notification
    ↓
Recipient clicks "Accept" 
    ↓
Connected → WebRTC stream starts
    ↓
Either clicks "End Call"
    ↓
Idle
```

---

## Thread Type Identification

### How System Knows Which Chat Is Active

```
RESPONDER CONSOLE:
- Shows thread_type: "responder_tourist"
- Messages filtered by:
  - thread_type = "responder_tourist"
  - tourist_id = active tourist
  - incident_id = their active ticket

TOURIST PAGE:
- Shows thread_type: "responder_tourist"
- Messages filtered by:
  - thread_type = "responder_tourist"
  - tourist_id = current tourist
  - incident_id = their assigned incident
```

---

## Status Indicators

```
┌─────────────────────────┐
│ Connected: ✅           │ ← Green check = WebSocket active
│ Connected: ⏳           │ ← Clock = Connecting
│ Connected: ❌           │ ← Red X = Disconnected
└─────────────────────────┘

┌─────────────────────────┐
│ [Send] (enabled)        │ ← Blue = Can send
│ [Send] (grayed out)     │ ← Gray = Cannot send (no message)
│ [Call] (enabled)        │ ← Blue = Can initiate call
│ [Call] (grayed out)     │ ← Gray = Call in progress
└─────────────────────────┘
```

---

## Expected Behavior Timeline

```
T+0s:    Responder accepts ticket
         ↓
T+0s:    Chat panels appear on both pages
         ↓
T+2s:    Responder sends: "I'm on my way"
         ↓
T+2s:    Tourist sees message instantly
         ↓
T+5s:    Tourist sends: "Are you close?"
         ↓
T+5s:    Responder sees message instantly
         ↓
T+7s:    Responder calls tourist
         ↓
T+7s:    Tourist sees "Incoming call" + notification sound
         ↓
T+8s:    Tourist accepts call
         ↓
T+8s:    Both see "Call connected" with duration counter
         ↓
T+30s:   Either ends call
         ↓
T+30s:   Both see call ended, back to chat mode
         ↓
T+300s:  Responder arrives, resolves ticket
         ↓
         Chat remains visible for reference/follow-up
```

This is exactly what you'll see when the system is running! ✅
