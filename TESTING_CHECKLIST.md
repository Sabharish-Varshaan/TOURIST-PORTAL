# Testing Checklist - Responder Chat System

## ✅ System Ready to Test

All components are implemented and syntax-validated. Follow this checklist to test the complete flow:

### Setup
- [ ] Start backend: `cd backend && python main.py`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open browser to `http://localhost:3000`

### Test Flow

#### Step 1: Tourist Registration & SOS
- [ ] Go to `/tourist` page
- [ ] Register as a tourist (name, phone, emergency contact)
- [ ] Get QR code and Digital ID
- [ ] Trigger SOS (should appear in dashboard)

#### Step 2: Authority Dashboard
- [ ] Go to `/dashboard` page
- [ ] See the new SOS incident
- [ ] Status should be "NEW" or "CONFIRMED"
- [ ] Click "Assign" button
- [ ] Select a substation
- [ ] Confirm assignment
- [ ] Incident status changes to "ASSIGNED"

#### Step 3: Responder Console
- [ ] Go to `/responder` page
- [ ] Enter responder name (e.g., "Officer Arjun")
- [ ] Enter responder ID (e.g., "RSP_001")
- [ ] Click "Refresh"
- [ ] Should see the CONFIRMED SOS ticket in "Available SOS tickets"
- [ ] Click "Accept" to claim the ticket
- [ ] Should see "My active ticket" section appear

#### Step 4: Responder Chat with Tourist
- [ ] In "My active ticket" section, should see:
  - [ ] SOS incident number
  - [ ] Tourist ID
  - [ ] **"Chat with Tourist" panel** ← This is the new feature
  - [ ] "Chat with Authority" panel
- [ ] Click in the "Chat with Tourist" text box
- [ ] Type a test message: "Hello, I'm your responder"
- [ ] Send message
- [ ] Message should appear in chat

#### Step 5: Tourist Sees Responder Chat
- [ ] Go back to `/tourist` page
- [ ] Scroll down to "Chat with Responder" section
- [ ] Should see:
  - [ ] Responder's name displayed (from substation assignment)
  - [ ] The responder's message you just sent
- [ ] Send a reply: "Thanks for your help"
- [ ] Message should appear in responder console instantly

#### Step 6: Real-time Bidirectional Chat
- [ ] Exchange several messages between tourist and responder
- [ ] Verify:
  - [ ] All messages appear immediately (WebSocket working)
  - [ ] Sender role shows correctly
  - [ ] Messages are persisted

#### Step 7: Call Features (Optional)
- [ ] In either chat panel, click "Start Call" button
- [ ] Receiver should see "Incoming call" notification
- [ ] Accept the call
- [ ] WebRTC setup should begin
- [ ] End the call

#### Step 8: Resolution
- [ ] Go back to responder console
- [ ] Click "Resolve" button on active ticket
- [ ] Ticket status should change to "RESOLVED"
- [ ] Chat panels should remain visible
- [ ] New incidents should work normally

### Expected Behavior

#### Chat Panel Should Show:
```
┌─────────────────────────────────┐
│ Chat with Tourist               │ ← Title shows tourist focus
├─────────────────────────────────┤
│ Connected: ✅                   │ ← WebSocket status
├─────────────────────────────────┤
│ [Assistant]: Your test message  │ ← Messages load from DB
│ [You]: My response              │
├─────────────────────────────────┤
│ [Type message...]               │ ← Input field
│ [Send] [Call] [End Call]        │ ← Action buttons
└─────────────────────────────────┘
```

### Database State After Assignment

```sql
-- incidents table
incident.id: 1
incident.tourist_id: "TOUR_001"
incident.event_type: "sos"
incident.ticket_status: "ASSIGNED"
incident.ticket_assignee: "Guwahati Central Substation (PS_GUW_01)"

-- messages table
message.thread_type: "responder_tourist"
message.tourist_id: "TOUR_001"
message.incident_id: 1
message.sender_role: "responder" or "tourist"
message.sender_id: "RSP_001" or "TOUR_001"
message.body: "Hello from responder/tourist"
```

### API Endpoints Used

1. **GET** `/api/tourist/{tourist_id}/assigned-incident`
   - Returns incident and responder info when assigned

2. **GET** `/api/messages?thread_type=responder_tourist&tourist_id=TOUR_001&incident_id=1`
   - Loads all messages for this thread

3. **POST** `/api/messages`
   - Sends new message with thread_type="responder_tourist"

4. **WebSocket** `/ws/chat`
   - Subscribes to responder_tourist thread
   - Receives real-time updates

### Troubleshooting

**"Chat with Tourist" not showing:**
- [ ] Check incident status is "ASSIGNED"
- [ ] Check responder ID matches ticket_assignee
- [ ] Refresh page (F5)
- [ ] Check browser console for errors

**Messages not sending:**
- [ ] Verify WebSocket is connected (green indicator)
- [ ] Check incident status is still "ASSIGNED"
- [ ] Check API responses in Network tab
- [ ] Verify backend logs for errors

**Responder not seeing chat:**
- [ ] Verify responder ID is set correctly
- [ ] Click "Refresh" button to reload incidents
- [ ] Check that ticket_assignee contains the responder ID
- [ ] Verify tourist_id in chat matches the SOS tourist

## Status: Ready for Testing ✅
All components implemented, syntax validated, and ready to go!
