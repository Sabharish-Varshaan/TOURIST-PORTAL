# WebRTC Internet-Based Calling

This project now includes real-time audio/video calling over the internet using WebRTC technology.

## Features

✅ **Peer-to-peer audio calls** - Direct connection between tourist and responder  
✅ **Free infrastructure** - Uses Google's public STUN servers (no cost)  
✅ **Works over internet** - No need for same network, works across cities/countries  
✅ **Mute/unmute controls** - Control your microphone  
✅ **Video toggle** - Enable camera if needed (audio-only by default)  
✅ **Connection status** - See real-time connection state  

## How It Works

### Architecture

```
Tourist Browser <--WebRTC P2P--> Responder Browser
       |                                |
       |                                |
       +--WebSocket (signaling)--> Backend Server
```

1. **WebSocket Signaling**: Your backend server relays connection setup messages
2. **STUN Servers**: Google's free servers help browsers find each other's public IPs
3. **P2P Connection**: Once connected, audio/video flows directly between browsers (not through server)

### Technology Stack

- **WebRTC**: Browser-native real-time communication API
- **STUN**: Session Traversal Utilities for NAT (helps with network address translation)
- **SDP**: Session Description Protocol (describes media capabilities)
- **ICE**: Interactive Connectivity Establishment (finds best connection path)

## Usage

### Starting a Call

1. Open tourist page and responder page
2. Ensure an incident is assigned (responder assigned to tourist)
3. Click the **"Call"** button in the chat panel
4. Other party receives incoming call notification
5. Click **"Accept"** to connect
6. Audio starts flowing automatically

### During Call

- **Mute/Unmute**: Click microphone button to toggle
- **Enable Video**: Click video button (both parties can toggle independently)
- **End Call**: Click "End Call" to disconnect

### Call States

- **Idle**: No active call
- **Calling**: Waiting for other party to answer
- **Connecting**: WebRTC connection being established
- **Connected**: Call in progress
- **Failed**: Connection failed (usually network/firewall issues)

## Integration Example

### In Your Chat Component

```tsx
import { useChat } from "@/lib/chat"
import { useWebRTCCall } from "@/lib/use-webrtc-call"
import CallDialog from "@/components/chat/call-dialog"

export default function YourChat() {
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [isInitiator, setIsInitiator] = useState(false)

  const thread = { 
    thread_type: "responder_tourist", 
    tourist_id: "...", 
    incident_id: 14 
  }

  const { messages, connected, sendMessage, sendWebRTCSignal } = useChat(thread, {
    onCallMessage: (data) => {
      if (data.type === "incoming_call") {
        setActiveCallId(data.call_id as string)
        setIsInitiator(false)
      } else if (data.type === "call_accepted") {
        setActiveCallId(data.call_id as string)
      } else if (data.type === "call_ended" || data.type === "call_rejected") {
        setActiveCallId(null)
      }
    },
    onWebRTCSignal: (callId, signal) => {
      // Signals are automatically handled by WebRTC hook
    }
  })

  const startCall = () => {
    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setActiveCallId(callId)
    setIsInitiator(true)
    // Send call start action via WebSocket
    sendCallAction({ action: "start_call", call_id: callId })
  }

  return (
    <>
      <button onClick={startCall}>Call</button>
      
      <CallDialog
        callId={activeCallId}
        isInitiator={isInitiator}
        onSignal={(signal) => sendWebRTCSignal(activeCallId!, signal)}
        onEndCall={() => setActiveCallId(null)}
      />
    </>
  )
}
```

## Network Requirements

### What You Need

✅ **Internet connection** - Any speed works (3G+)  
✅ **Browser support** - Chrome, Firefox, Safari, Edge (modern versions)  
✅ **Microphone permission** - Browser will ask when starting call  
❌ **No special ports** - Works through standard firewalls  
❌ **No server costs** - Uses free STUN servers  

### Bandwidth Usage

- **Audio-only**: ~50 kbps (very light)
- **With video**: ~500 kbps - 2 Mbps (depends on quality)

### Firewall Compatibility

The implementation uses STUN servers which work through most corporate firewalls and home routers. If you're behind a very restrictive firewall, you may need:

- **TURN server** (relay server) - Required for ~8% of connections
- Can use free TURN servers like Twilio's or set up your own

## Files Created

1. **`lib/webrtc.ts`** - Core WebRTC service class
2. **`lib/use-webrtc-call.ts`** - React hook for WebRTC state management
3. **`components/chat/call-dialog.tsx`** - Call UI component
4. **Updated `lib/chat.ts`** - Added WebRTC signaling support

## Backend Support

Your backend already has WebRTC signaling support! The following actions are handled:

- `start_call` - Initiates call and notifies other party
- `accept_call` - Accepts incoming call
- `reject_call` - Rejects incoming call
- `signaling` - Forwards WebRTC connection setup messages
- `end_call` - Terminates call

## Limitations

1. **No recording** - Calls are not recorded (can be added if needed)
2. **No call history** - Only shows active call (can be added to database)
3. **One-to-one only** - No group calls (WebRTC supports it, needs implementation)
4. **STUN only** - Very restrictive networks (~8%) may fail (add TURN server to fix)

## Advanced: Adding TURN Server

If you need better firewall compatibility, add a TURN server:

```typescript
// In lib/webrtc.ts
private iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { 
    urls: "turn:your-turn-server.com:3478",
    username: "your-username",
    credential: "your-password"
  }
]
```

Free TURN options:
- **Twilio STUN/TURN** - Free tier available
- **Metered.ca** - 50GB free monthly
- **Self-hosted** - Use `coturn` on your server

## Troubleshooting

### "Call failed to connect"

- Check browser console for errors
- Verify microphone permissions granted
- Try refreshing both pages
- Check if HTTPS (some browsers require it)

### "No audio heard"

- Check computer audio settings
- Verify remote stream is playing (check browser console)
- Try mute/unmute toggle
- Check if other tab is using microphone

### "Permission denied"

- Browser blocked microphone access
- Click lock icon in address bar → allow microphone
- Refresh page and try again

### "Connection state stuck on 'connecting'"

- Firewall may be blocking WebRTC
- Try from different network
- May need TURN server for relay

## Testing

1. Open two browser windows (or different computers)
2. Register as tourist in one, accept incident as responder in other
3. Click "Call" button in chat
4. Accept call in other window
5. You should hear audio from both sides

## Future Enhancements

- [ ] Call recording to database
- [ ] Call duration tracking
- [ ] Call quality metrics
- [ ] Screen sharing
- [ ] Group calls
- [ ] Call transfer
- [ ] Call waiting
- [ ] Conference rooms

## Credits

- **WebRTC**: W3C standard for real-time communication
- **STUN Servers**: Provided free by Google
- **React Integration**: Custom hooks for state management
