# Tourist Safety System - Responder Chat Integration

## Overview
This document describes the complete integration of the responder system with SOS ticket assignment and real-time chat features.

## System Architecture

### Thread Types
The system now supports three types of communication threads:

1. **tourist_authority**: Communication between a tourist and authority
   - One thread per tourist
   - Direct support channel

2. **authority_responder**: Communication between authority and assigned responder
   - One thread per incident
   - For coordination and updates

3. **responder_tourist**: NEW - Direct communication between responder and tourist
   - One thread per incident
   - Enables responder to communicate directly with the affected tourist

## Components Created/Modified

### Backend (main.py)
1. **Updated ConnectionManager._thread_key()**: Added support for `responder_tourist` thread type
2. **Updated send_message()**: Added validation for `responder_tourist` threads
3. **Updated list_messages()**: Added query support for `responder_tourist` threads
4. **Added endpoint**: `/api/tourist/{tourist_id}/assigned-incident` - Returns assigned responder info
5. **WebSocket support**: Existing infrastructure automatically supports new thread type

### Frontend Components

#### New Components
1. **responder-tourist-chat.tsx**: Component for responders to chat with tourists
2. **responder-chat.tsx** (updated): Uses new `responder_tourist` thread type

#### Updated Components
1. **lib/chat.ts**: 
   - Added `responder_tourist` thread type definition
   - Updated message loading logic
   - Updated WebSocket subscription logic
   - Updated message sending logic

2. **app/tourist/page.tsx**:
   - Added import for ResponderChat component
   - Component displays when responder is assigned

3. **app/responder/page.tsx**:
   - Added ResponderTouristChat component
   - Shows chat with currently assigned tourist

## Flow

### Responder Accepts SOS Ticket
1. Responder views available SOS tickets in their console
2. Clicks "Accept" to claim a CONFIRMED SOS ticket
3. Backend atomically updates `ticket_status` to "ASSIGNED"
4. Backend stores responder ID as `ticket_assignee`
5. Responder sees "My active ticket" section

### Responder-Tourist Communication
1. Once ticket is ASSIGNED:
   - Responder sees new "Chat with Tourist" panel
   - Tourist sees new "Chat with Responder" panel
   - Both can send messages in real-time via WebSocket

2. Thread ID is `responder_tourist` with:
   - `tourist_id`: The affected tourist
   - `incident_id`: The SOS incident ID
   - Messages are validated against ASSIGNED status

### Voice/Video Calls
- Call signaling works over the same WebSocket
- Both responder and tourist can initiate calls
- WebRTC negotiation happens through call signaling

## Security/Validation

### Responder-Tourist Thread Validation
When sending a message to `responder_tourist` thread:
1. Tourist and incident exist
2. Incident is ASSIGNED status
3. Incident belongs to the tourist
4. Sender role is either "tourist" or "responder"

## Testing the Integration

1. **Start Backend**: `python main.py`
2. **Start Frontend**: `npm run dev`
3. **Test Flow**:
   - Register as Tourist (go to /tourist)
   - Trigger SOS (creates incident)
   - Authority confirms SOS in dashboard
   - Navigate to /responder
   - Set responder name and ID
   - Click "Accept" on the SOS ticket
   - See "My active ticket" with chat panels
   - Tourist sees responder chat panel
   - Send messages in real-time

## API Reference

### GET /api/tourist/{tourist_id}/assigned-incident
Returns assigned SOS incident for a tourist if available.

**Response:**
```json
{
  "has_assigned_incident": true,
  "incident_id": 123,
  "responder_info": {
    "substation_id": "PS_GUW_01",
    "substation_name": "Guwahati Central Substation",
    "assignee_label": "Officer Arjun (PS_GUW_01)"
  }
}
```

### POST/GET /api/messages (responder_tourist)
Thread-based message storage and retrieval.

**Required parameters for responder_tourist:**
- `tourist_id`: Tourist ID
- `incident_id`: SOS incident ID
- `thread_type`: "responder_tourist"

## Status: COMPLETE ✅
All components integrated and tested for syntax.
