# Testing the Calling Feature - Step by Step

## Quick Test Guide

### Setup (5 minutes)

1. **Open TWO browser windows side by side**
   - Window 1: Tourist page (`http://localhost:3000/tourist`)
   - Window 2: Responder page (`http://localhost:3000/responder`)

2. **Register Tourist** (Window 1)
   - If not already registered, fill in tourist registration
   - Or use existing ID: `4772ee0c-3e23-4740-ba74-89462b5a9d2f`
   - Make sure you see "Chat with Responder" panel

3. **Setup Responder** (Window 2)
   - Enter name: `Arjun`
   - Enter ID: `RSP_001`
   - You should see incident #14 in "My active ticket"
   - Look for "Chat with Tourist" panel below "Chat with Authority"

### Testing the Call Feature

#### Test 1: Responder Calls Tourist

1. **In Responder Window:**
   - Scroll down to "Chat with Tourist" panel
   - Click the **"Call"** button (top right of chat panel)
   - ✅ You should see a dialog appear: "Calling..."

2. **In Tourist Window:**
   - After 1-2 seconds, you should see: "Incoming call from Responder"
   - Click **"Accept"**
   - ✅ Browser will ask for microphone permission - click "Allow"

3. **Both Windows:**
   - Connection state should change: "connecting" → "connected"
   - You should see video/audio elements appear
   - **Speak into your microphone** - you should hear yourself in the other window!

4. **End Call:**
   - Click "End Call" in either window
   - Both dialogs should close

#### Test 2: Tourist Calls Responder

1. **In Tourist Window:**
   - Scroll to "Chat with Responder" panel
   - Click the **"Call"** button
   - ✅ Dialog appears: "Calling..."

2. **In Responder Window:**
   - "Incoming call" dialog appears
   - Click **"Accept"**
   - ✅ Allow microphone permission

3. **Test Audio:**
   - Speak in one window, hear in the other
   - Try the "Mute" button - audio should stop
   - Try "Unmute" - audio resumes

### What You Should See

#### Successful Call Flow:
```
1. Click "Call" button
   → Button changes to "Calling…" (disabled)
   → Dialog opens: "Calling..."

2. Other side receives call
   → Dialog opens: "Incoming call from X"
   → Shows "Accept" and "Reject" buttons

3. Click "Accept"
   → Browser asks: "Allow microphone?"
   → Click "Allow"
   → Connection state: "connecting"

4. After 2-5 seconds
   → Connection state: "connected" (green badge)
   → You can hear audio from other side
   → Both video elements show (even if no video)

5. During call
   → "Mute" button works
   → "End Call" disconnects both sides
```

### Troubleshooting

#### Call Button Not Visible?
- **Check:** Is there an assigned incident?
- **Fix:** Make sure incident #14 is ASSIGNED to responder RSP_001
- **Verify:** Run in terminal:
  ```bash
  curl "http://localhost:8000/api/tourist/4772ee0c-3e23-4740-ba74-89462b5a9d2f/assigned-incident"
  ```
  Should return `has_assigned_incident: true`

#### Dialog Doesn't Appear?
- **Open browser console** (F12 or Cmd+Option+I)
- Look for errors in red
- Look for WebRTC logs (search for "WebRTC")

#### No Audio Heard?
- **Check microphone:**
  - System Settings → Privacy → Microphone
  - Browser should be allowed
- **Check browser console:**
  - Look for "Permission denied" errors
- **Try different browser:**
  - Chrome/Edge usually have best WebRTC support
  - Safari works but sometimes needs extra permissions
  - Firefox works well too

#### Connection Stays "connecting"?
- **Firewall issue** - Your network might block WebRTC
- **Try different network:**
  - Mobile hotspot often works better
  - Home network usually works
  - Corporate networks sometimes block it

#### "Permission denied" Error?
- **Click the lock icon** in address bar
- Allow microphone access
- Refresh the page
- Try calling again

### Using Browser Console for Debugging

Open console in both windows and look for:

```javascript
// When call starts:
"ResponderChat: Call started"
"WebRTC: Starting call..."
"WebRTC: Local stream obtained"

// When accepting:
"WebRTC: Accepting call..."
"WebRTC: Setting remote description"

// Connection progress:
"WebRTC connection state: connecting"
"WebRTC connection state: connected" // ← Success!

// If problems:
"WebRTC error: [error message]"
"Permission denied" // ← Microphone blocked
```

### Quick Visual Checklist

Before testing, verify you see:

**Tourist Page:**
- ✅ "Chat with Responder" panel visible
- ✅ "Call" button in chat header
- ✅ Blue debug info showing incident ID

**Responder Page:**
- ✅ "My active ticket" section shows SOS #14
- ✅ "Chat with Tourist" panel visible
- ✅ "Call" button in chat header
- ✅ Debug info shows `myId: "RSP_001"` and `activeMine: SOS #14`

### Expected Network Traffic

When you click "Call", you should see in Network tab (F12 → Network):

1. **WebSocket messages** (filter: WS)
   - `action: "start_call"`
   - `type: "incoming_call"`
   - `type: "call_accepted"`
   - `action: "signaling"` (multiple times for WebRTC negotiation)

2. **No HTTP requests** needed - all via WebSocket

### Testing Different Scenarios

#### Test: Reject a Call
1. Start call from one side
2. Click "Reject" instead of "Accept"
3. ✅ Dialog should close on both sides
4. ✅ No microphone permission needed

#### Test: End Call Early
1. Start call and accept
2. Immediately click "End Call"
3. ✅ Both dialogs close
4. ✅ Audio stops

#### Test: Mute/Unmute
1. Start call and accept
2. Click "Mute" 
3. ✅ Microphone icon changes
4. ✅ Other side stops hearing you
5. Click "Unmute"
6. ✅ Audio resumes

#### Test: Multiple Calls
1. Complete a call and end it
2. Start another call
3. ✅ Should work the same way
4. ✅ No stale state from previous call

### Performance Indicators

Good connection:
- Connection state reaches "connected" in < 5 seconds
- Audio has no crackling or lag
- Mute/unmute is instant

Poor connection:
- Stays on "connecting" for > 10 seconds
- Audio cuts out or robotic voice
- May need TURN server (not included in basic setup)

### Advanced: Check WebRTC Stats

In browser console during active call:

```javascript
// This would show detailed WebRTC statistics
// (requires adding code to expose peer connection)
```

### Next Steps If Working

Once basic calling works:

1. ✅ Test on different networks
2. ✅ Test with mobile browser
3. ✅ Test longer calls (5+ minutes)
4. ✅ Add call recording (requires backend changes)
5. ✅ Add video support (already coded, just enable)

### Next Steps If NOT Working

1. **Check browser console for errors**
2. **Verify WebSocket connection:** Look for "Live" badge in chat panels
3. **Test chat messaging first:** If chat works, calls should work
4. **Try simpler test:** Open same page in two tabs (same computer)
5. **Check backend logs:** Terminal running `uvicorn` should show WebSocket messages

---

## The Simplest Possible Test

If you're confused, try this minimal test:

1. Open `http://localhost:3000/responder` 
2. Enter name "Test" and ID "T1"
3. Open same URL in new tab
4. Look for "Call" button in any chat panel
5. Click it
6. If you see "Calling..." dialog → **It's working!**
7. The dialog won't connect to itself, but if it appears, the UI is correct

Then do the proper test with tourist + responder in separate windows.
