# Quick Start: Get Chat Working in 5 Minutes

## Prerequisites
- Backend running: `python main.py`
- Frontend running: `npm run dev`
- Open http://localhost:3000

---

## Step 1: Create Tourist & SOS (2 min)

```
URL: http://localhost:3000/tourist

1. Click: "Register" button
2. Fill in:
   - Name: "John Doe"
   - Phone: "9876543210"
   - Emergency Contact: "9876543211"
3. Click: "Register" button in modal
4. ✅ Get QR code + Digital ID
5. Look for: "SOS" button or option
6. Click: SOS button
7. ✅ Should see: "SOS alert raised"
```

---

## Step 2: Authority Confirms SOS (1 min)

```
URL: http://localhost:3000/dashboard

1. Look for: "Incidents" or "Tickets" section
2. Find: Your SOS (status should be "NEW")
3. Click: "Confirm" button (NOT assign yet)
4. Confirm dialog: Click "Yes"
5. ✅ Status changes to "CONFIRMED"
```

---

## Step 3: Responder Accepts SOS (1 min)

```
URL: http://localhost:3000/responder

1. Enter: "Officer Arjun" in Responder Name field
2. Enter: "RSP_001" in Responder ID field
3. Click: "Refresh" button
4. Look for: "Available SOS tickets" section
5. ✅ Should see your SOS ticket
6. Click: "Accept" button
7. ✅ Should see: "Ticket accepted. Routing..."
```

---

## Step 4: Chat Appears (automatic)

```
After accepting, you should see in "My active ticket" section:

┌─────────────────────────────────────┐
│ My active ticket                    │
├─────────────────────────────────────┤
│ SOS #X • Tourist TOUR_001           │
│ [Navigate] [Resolve]                │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Chat with Authority             │ │
│ │ [message input] [Send] [Call]   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │ ✅ THIS IS NEW!
│ │ Chat with Tourist               │ │
│ │ [message input] [Send] [Call]   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Step 5: Test Chat

### On Responder Page:
```
1. Click: In "Chat with Tourist" message box
2. Type: "Hello! I'm your responder"
3. Click: "Send"
4. ✅ Message appears in chat
```

### On Tourist Page:
```
URL: http://localhost:3000/tourist
(same browser tab or new tab)

1. Scroll down to: "Chat with Responder" section
2. ✅ Should see responder's message
3. Type: "Thank you! Where are you?"
4. Click: "Send"
```

### Back on Responder Page:
```
1. Look at: "Chat with Tourist"
2. ✅ Should see tourist's reply
```

---

## If Chat Doesn't Appear

### Check 1: Did you confirm in dashboard?
- Go back to `/dashboard`
- Find your SOS
- Status should be "CONFIRMED" (not "NEW")
- If it's "NEW", click "Confirm" button

### Check 2: Is SOS showing in responder page?
- Go to `/responder`
- Click "Refresh"
- Should see ticket in "Available SOS tickets"
- If empty, go back to Check 1

### Check 3: Did you accept the ticket?
- On `/responder` page
- Click "Accept" button on the SOS ticket
- Should see "Ticket accepted" message
- "My active ticket" section should appear

### Check 4: Browser issues?
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Open DevTools: `F12`
- Check Console tab for errors
- Check Network tab - should see successful API calls

---

## Common Status Messages

| Message | Means |
|---------|-------|
| "No confirmed SOS tickets" | No SOS was confirmed in dashboard yet |
| "Ticket accepted. Routing..." | ✅ Chat should appear now |
| "Connected: ✅" | WebSocket active, messages will work |
| "Connected: ❌" | WebSocket down, backend might be offline |

---

## API Calls Behind the Scenes

```
Step 1: POST /api/sos
  → Creates incident with ticket_status="NEW"

Step 2: POST /api/incidents/{id}/confirm
  → Changes ticket_status to "CONFIRMED"

Step 3: POST /api/incidents/{id}/assign
  → Changes ticket_status to "ASSIGNED"
  → Sets ticket_assignee with responder name/ID
  → Chat now works!

Step 4: POST /api/messages (thread_type="responder_tourist")
  → Saves message to database
  → Broadcasts via WebSocket
  → Both pages see it instantly
```

---

## That's It! ✅

If you followed all steps and the chat is working, the system is fully integrated!

If any step fails, check the corresponding section in `RESPONDER_TESTING.md` for detailed troubleshooting.
