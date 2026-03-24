# 🔍 Responder Page Diagnosis & Complete Testing Guide

## Current Issue

**Responder page (`/responder`) shows:**
- ❌ No SOS tickets available
- ❌ No "Chat with Tourist" option

## Root Cause Analysis

The responder page requires a specific workflow to display tickets and chat:

### Prerequisites for Tickets to Appear

```
┌─────────────────────────────────────┐
│ STEP 1: Create SOS                  │
├─────────────────────────────────────┤
│ Tourist triggers SOS                │
│ ↓                                   │
│ Incident created in DB:             │
│ - ticket_status: "NEW" (default)    │
│ - ticket_assignee: null             │
└─────────────────────────────────────┘
         ↓ (required for responder to see)
┌─────────────────────────────────────┐
│ STEP 2: Authority CONFIRMS SOS      │
├─────────────────────────────────────┤
│ Authority goes to /dashboard        │
│ Finds NEW SOS incident              │
│ Clicks "Confirm" button             │
│ ↓                                   │
│ Incident status changes:            │
│ - ticket_status: "NEW" → "CONFIRMED"│
│ - ticket_confirmed_at: timestamp    │
└─────────────────────────────────────┘
         ↓ (now responder can see)
┌─────────────────────────────────────┐
│ STEP 3: Responder ACCEPTS SOS       │
├─────────────────────────────────────┤
│ Responder goes to /responder        │
│ Sees CONFIRMED SOS in ticket list   │
│ Clicks "Accept" button              │
│ ↓                                   │
│ Incident status changes:            │
│ - ticket_status: "CONFIRMED"        │
│   → "ASSIGNED"                      │
│ - ticket_assignee: "Name (ID)"      │
│ - ticket_assigned_at: timestamp     │
└─────────────────────────────────────┘
         ↓ (NOW chat shows)
┌─────────────────────────────────────┐
│ STEP 4: Chat Available              │
├─────────────────────────────────────┤
│ "Chat with Tourist" panel appears   │
│ "Chat with Authority" panel appears │
│ Both can message each other         │
└─────────────────────────────────────┘
```

---

## Complete Testing Checklist

### Phase 1: Setup ✅
- [ ] Backend running: `cd backend && python main.py`
- [ ] Frontend running: `cd frontend && npm run dev`
- [ ] Open: http://localhost:3000

### Phase 2: Create SOS
- [ ] Go to `/tourist`
- [ ] Click "Register" (fill in form)
- [ ] Get QR code and Digital ID
- [ ] **Trigger SOS** (look for SOS button on page)
- [ ] Should see: "SOS raised successfully"

**What happened in backend:**
```python
POST /api/sos
Incident created with:
- ticket_status: "NEW"
- ticket_assignee: null
```

### Phase 3: Authority Dashboard - CONFIRM SOS
- [ ] Go to `/dashboard`
- [ ] Look for "Incidents" section
- [ ] Find your SOS (should show status "NEW")
- [ ] Click "Confirm" button (NOT "Assign" yet)
- [ ] Confirm dialog: "Confirm this SOS and publish it to responders?"
- [ ] Click "Yes"
- [ ] Status should change to "CONFIRMED"

**What happened in backend:**
```python
POST /api/incidents/{id}/confirm
Incident updated with:
- ticket_status: "NEW" → "CONFIRMED"
- ticket_confirmed_at: current timestamp
```

### Phase 4: Responder Console - Accept Ticket
- [ ] Go to `/responder`
- [ ] Enter Responder Name: "Officer Arjun" (or any name)
- [ ] Enter Responder ID: "RSP_001" (or any ID)
- [ ] Click "Refresh"
- [ ] Should see SOS in "Available SOS tickets" list
  - [ ] Shows SOS #
  - [ ] Shows timestamp
  - [ ] Shows coordinates
  - [ ] Shows "~XXXm away" distance
- [ ] Click "Accept" button
- [ ] Should see status message: "Ticket accepted. Routing…"

**What happened in backend:**
```python
POST /api/incidents/{id}/assign
Incident updated with:
- ticket_status: "CONFIRMED" → "ASSIGNED"
- ticket_assignee: "Officer Arjun (RSP_001)"
- ticket_assigned_at: current timestamp
```

### Phase 5: Chat Appears 🎯
After accepting, you should NOW see:

```
┌─────────────────────────────────────┐
│ My active ticket                    │
│                                     │
│ SOS #XX • Tourist TOUR_001         │
│ Timestamp...                        │
│ Location: 26.1445°N, 91.7362°E    │
│                                     │
│ [Navigate] [Resolve]                │
│                                     │
│ ┌──────────────────────────────┐   │
│ │ Chat with Authority          │   │
│ │ Connected: ✅                │   │
│ │ [text input...] [Send] [Call]│   │
│ └──────────────────────────────┘   │
│                                     │
│ ┌──────────────────────────────┐   │ ← THIS IS NEW!
│ │ Chat with Tourist            │   │   Should appear
│ │ Connected: ✅                │   │   after ACCEPT
│ │ [text input...] [Send] [Call]│   │
│ └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Phase 6: Test Chat
- [ ] In "Chat with Tourist" panel
- [ ] Type message: "Hello, I'm your responder. I'm on my way."
- [ ] Click Send
- [ ] Message appears in chat

- [ ] Go back to `/tourist` page
- [ ] Scroll down to "Chat with Responder"  
- [ ] Should see your message
- [ ] Type reply: "Thank you! Where are you?"
- [ ] Click Send

- [ ] Go back to `/responder`
- [ ] Check "Chat with Tourist" - should see tourist's reply

---

## Troubleshooting

### ❌ "No SOS tickets" on responder page

**Check 1: Did you create an SOS?**
```bash
# Check backend logs
# Should see POST /api/sos request
# Database: SELECT * FROM incidents WHERE event_type='sos'
# Should have: ticket_status='NEW'
```

**Check 2: Did you CONFIRM the SOS in dashboard?**
```bash
# Go to /dashboard
# Look for the SOS ticket
# If status is "NEW", click CONFIRM button
# Should change to "CONFIRMED"
```

**Check 3: Are CONFIRMED SOS tickets showing in responder page?**
```bash
# Refresh /responder page
# Clear browser cache (Ctrl+Shift+Del)
# Check browser Network tab
# Verify /api/logs returns ticket_status="CONFIRMED"
```

### ❌ No "Chat with Tourist" after accepting ticket

**Check 1: Did you set responder name and ID?**
```
- Responder Name field must not be empty
- Responder ID field must not be empty
- These are stored in localStorage
```

**Check 2: Did you click ACCEPT?**
```
- Look for status message: "Ticket accepted. Routing…"
- Check if "My active ticket" section appeared
- Should show "Chat with Authority" panel
```

**Check 3: Verify assignment in database**
```bash
# Database: SELECT * FROM incidents WHERE id={incident_id}
# Should show:
# - ticket_status: "ASSIGNED"
# - ticket_assignee: "Officer Arjun (RSP_001)"
# - ticket_assigned_at: not null
```

**Check 4: Browser console errors**
```bash
# Open Developer Tools: F12
# Go to Console tab
# Should see no errors
# Look for "[ws] connected" message
```

### ❌ Chat shows but messages don't send

**Check 1: WebSocket connected?**
```
Look for: "Connected: ✅"
If shows: "Connected: ❌" or "⏳"
- Backend might not be running
- Port 3000/8000 might be blocked
```

**Check 2: Incident still ASSIGNED?**
```bash
# Messages only work if ticket_status="ASSIGNED"
# Don't click "Resolve" yet
# Check database status
```

**Check 3: Network issues**
```bash
# Developer Tools → Network tab
# Try sending a message
# Should see POST /api/messages request
# Response should be 200 OK
```

---

## Database State at Each Step

### After Creating SOS:
```sql
SELECT * FROM incidents WHERE id=1;
┌────┬────────────┬───────────────┬────────────────┬─────────────┐
│id  │tourist_id  │event_type     │ticket_status   │ticket_assignee│
├────┼────────────┼───────────────┼────────────────┼─────────────┤
│1   │TOUR_001    │sos            │NEW             │NULL         │
└────┴────────────┴───────────────┴────────────────┴─────────────┘
```

### After Authority Confirms:
```sql
┌────┬────────────┬───────────────┬────────────────┬─────────────┐
│id  │tourist_id  │event_type     │ticket_status   │ticket_assignee│
├────┼────────────┼───────────────┼────────────────┼─────────────┤
│1   │TOUR_001    │sos            │CONFIRMED       │NULL         │
└────┴────────────┴───────────────┴────────────────┴─────────────┘
```

### After Responder Accepts:
```sql
┌────┬────────────┬───────────────┬────────────────┬──────────────────────────┐
│id  │tourist_id  │event_type     │ticket_status   │ticket_assignee           │
├────┼────────────┼───────────────┼────────────────┼──────────────────────────┤
│1   │TOUR_001    │sos            │ASSIGNED        │Officer Arjun (RSP_001)   │
└────┴────────────┴───────────────┴────────────────┴──────────────────────────┘
```

### Messages in Chat:
```sql
SELECT * FROM messages WHERE thread_type='responder_tourist' AND incident_id=1;
┌────┬──────────────────┬────────────┬────────────┬──────────────┬────────────┐
│id  │thread_type       │tourist_id  │incident_id │sender_role   │body        │
├────┼──────────────────┼────────────┼────────────┼──────────────┼────────────┤
│1   │responder_tourist │TOUR_001    │1           │responder     │Hello...    │
│2   │responder_tourist │TOUR_001    │1           │tourist       │Thank you...|
└────┴──────────────────┴────────────┴────────────┴──────────────┴────────────┘
```

---

## API Endpoints to Check

### 1. Create SOS
```bash
POST /api/sos
{
  "tourist_id": "TOUR_001",
  "location_label": "Market entrance",
  "lat": 26.1445,
  "lng": 91.7362
}
```

### 2. Get Logs (what responder page uses)
```bash
GET /api/logs

Response includes:
- ticket_status: "NEW" | "CONFIRMED" | "ASSIGNED" | "RESOLVED"
- ticket_assignee: null | "Name (ID)"
```

### 3. Confirm SOS (authority dashboard)
```bash
POST /api/incidents/{id}/confirm
```

### 4. Accept Ticket (responder page)
```bash
POST /api/incidents/{id}/assign
{
  "assignee_id": "RSP_001",
  "assignee_name": "Officer Arjun"
}
```

### 5. Send Chat Message
```bash
POST /api/messages
{
  "thread_type": "responder_tourist",
  "tourist_id": "TOUR_001",
  "incident_id": 1,
  "sender_role": "responder",
  "sender_id": "RSP_001",
  "body": "Hello, I'm your responder"
}
```

---

## Quick Debug Commands

### Check if backend is running:
```bash
curl http://localhost:8000/api/logs
# Should return JSON array
```

### Check if SOS exists:
```bash
curl "http://localhost:8000/api/logs" | grep -i sos
```

### Check ticket status:
```bash
# In browser Console on /responder page:
fetch('http://localhost:8000/api/logs')
  .then(r => r.json())
  .then(data => console.log(data.filter(x => x.event_type === 'sos')))
```

---

## Expected Timeline

```
T+0s:    Tourist goes to /tourist
T+5s:    Tourist registers
T+10s:   Tourist clicks SOS
T+11s:   Authority sees SOS in dashboard
T+15s:   Authority clicks CONFIRM
T+16s:   Responder refreshes /responder
T+17s:   Responder sees CONFIRMED SOS
T+20s:   Responder clicks ACCEPT
T+21s:   "Chat with Tourist" panel appears ✅
T+22s:   Responder sends first message
T+22s:   Tourist page updates (WebSocket)
T+23s:   Tourist sees responder message ✅
```

---

**Status: Follow this guide step-by-step to test the complete flow!**
