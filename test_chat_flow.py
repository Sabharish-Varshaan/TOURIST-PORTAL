#!/usr/bin/env python3
"""Test the tourist->responder chat flow"""

import requests
import json

API = "http://localhost:8000"
TOURIST_ID = "4772ee0c-3e23-4740-ba74-89462b5a9d2f"

print("=" * 60)
print("TEST 1: Get Assigned Incident")
print("=" * 60)

resp = requests.get(f"{API}/api/tourist/{TOURIST_ID}/assigned-incident")
result = resp.json()
print(json.dumps(result, indent=2))

if not result["has_assigned_incident"]:
    print("\n❌ No assigned incident found")
    exit(1)

incident_id = result["incident_id"]
print(f"\n✅ Incident found: {incident_id}")
print(f"   Responder: {result['responder_info']['responder_name']} ({result['responder_info']['responder_id']})")

print("\n" + "=" * 60)
print("TEST 2: Send Message (Tourist → Responder)")
print("=" * 60)

payload = {
    "thread_type": "responder_tourist",
    "tourist_id": TOURIST_ID,
    "incident_id": incident_id,
    "sender_role": "tourist",
    "sender_id": TOURIST_ID,
    "body": "Hello! I need help. Can you assist me?"
}

msg_resp = requests.post(f"{API}/api/messages", json=payload)
if msg_resp.status_code == 200:
    msg = msg_resp.json()
    print(f"✅ Message sent successfully!")
    print(f"   ID: {msg['id']}")
    print(f"   Body: {msg['body']}")
else:
    print(f"❌ Failed: {msg_resp.status_code}")
    print(msg_resp.text)
    exit(1)

print("\n" + "=" * 60)
print("TEST 3: Send Message (Responder → Tourist)")
print("=" * 60)

payload2 = {
    "thread_type": "responder_tourist",
    "tourist_id": TOURIST_ID,
    "incident_id": incident_id,
    "sender_role": "responder",
    "sender_id": "RSP_001",
    "body": "Hi! I'm Officer Arjun. I'm on my way to help you."
}

msg_resp2 = requests.post(f"{API}/api/messages", json=payload2)
if msg_resp2.status_code == 200:
    msg2 = msg_resp2.json()
    print(f"✅ Message sent successfully!")
    print(f"   Body: {msg2['body']}")
else:
    print(f"❌ Failed: {msg_resp2.status_code}")
    print(msg_resp2.text)
    exit(1)

print("\n" + "=" * 60)
print("TEST 4: List Messages")
print("=" * 60)

list_resp = requests.get(
    f"{API}/api/messages",
    params={
        "thread_type": "responder_tourist",
        "tourist_id": TOURIST_ID,
        "incident_id": incident_id
    }
)

if list_resp.status_code == 200:
    messages = list_resp.json()["messages"]
    print(f"✅ Retrieved {len(messages)} message(s):")
    for msg in messages:
        print(f"   [{msg['sender_role']}] {msg['body']}")
else:
    print(f"❌ Failed: {list_resp.status_code}")
    exit(1)

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED - Chat flow is working!")
print("=" * 60)
