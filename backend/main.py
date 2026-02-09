from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any, Union
from datetime import datetime,timedelta
from uuid import uuid4
from pathlib import Path
import base64, io, hashlib, re, json as pyjson
import os
import time
import requests

from dotenv import load_dotenv

# Load .env from backend directory (works regardless of cwd when starting the server)
load_dotenv(Path(__file__).resolve().parent / ".env")

from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, ForeignKey, Float, Boolean, UniqueConstraint, text as sql_text

from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.exc import IntegrityError

from contextlib import asynccontextmanager
from chatbot_api import chatbot_router



# ---- optional blockchain anchoring helper ----
try:
    from chain_anchor import anchor_incident
except Exception as _e:
    def anchor_incident(*args, **kwargs):
        print("[ANCHOR disabled]", _e)
        return "CHAIN_DISABLED"



def to_ist(dt):
    return (dt + timedelta(hours=5, minutes=30)).isoformat()

# convert a stored last_checkin value (string) to an IST string if possible,
# otherwise return the original string (safe fallback).
def last_checkin_to_ist(val: str):
    if not val or val == "-":
        return val
    # if it's already an ISO timestamp (fast path)
    try:
        # some last_checkin values may already include ' @ ' formatting — handle ISO first
        dt = datetime.fromisoformat(val)
        return to_ist(dt)
    except Exception:
        pass
    # if value contains " @ " like "Location @ 2025-09-05 14:28:34.777895"
    if " @ " in val:
        try:
            label, timestr = val.split(" @ ", 1)
            # try parse timestr (ISO or common format)
            try:
                dt = datetime.fromisoformat(timestr)
            except Exception:
                # try a common format without timezone
                dt = datetime.strptime(timestr, "%Y-%m-%d %H:%M:%S.%f")
            return f"{label} @ {to_ist(dt)}"
        except Exception:
            return val
    # fallback — return as-is
    return val



# ---------------- DB setup ----------------
engine = create_engine("sqlite:///guardianid.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Tourist(Base):
    __tablename__ = "tourists"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    emergency_contact = Column(String, nullable=False)
    status = Column(String, default="SAFE")
    last_checkin = Column(String, default="-")
    qr_png_b64 = Column(Text)

    # eKYC fields
    kyc_status = Column(String, default="PENDING")   # PENDING / VERIFIED / REJECTED
    kyc_doc_type = Column(String, default="-")       # AADHAAR / PASSPORT
    kyc_id_masked = Column(String, default="-")      # ****-****-1234 or ******123
    kyc_hash = Column(String, default="-")           # SHA256 of uploaded doc (mock)

    # live GPS (strings for simple migration)
    last_lat = Column(String, default="-")
    last_lng = Column(String, default="-")

    # auth: hashed password (nullable for existing rows)
    password_hash = Column(String, nullable=True)

    incidents = relationship("Incident", back_populates="tourist")

class Room(Base):
    __tablename__ = "rooms"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("tourists.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    qr_png_b64 = Column(Text)
    is_active = Column(Boolean, default=True)

class RoomMember(Base):
    __tablename__ = "room_members"
    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(String, ForeignKey("rooms.id"))
    tourist_id = Column(String, ForeignKey("tourists.id"))
    role = Column(String, default="member")  # member | admin
    joined_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("room_id", "tourist_id", name="uix_room_member"),)

# In main.py
class Incident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tourist_id = Column(String, ForeignKey("tourists.id"))
    event_type = Column(String)
    location_label = Column(String, default="-")
    timestamp = Column(DateTime, default=datetime.utcnow)
    hash_hex = Column(String)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    
    # ✅ ADD THESE TWO NEW COLUMNS FOR THE TICKETING SYSTEM
    ticket_status = Column(String, default="NEW") # NEW | CONFIRMED | ASSIGNED | RESOLVED
    ticket_assignee = Column(String, nullable=True)
    ticket_confirmed_at = Column(DateTime, nullable=True)
    ticket_assigned_at = Column(DateTime, nullable=True)
    ticket_resolved_at = Column(DateTime, nullable=True)

    tourist = relationship("Tourist", back_populates="incidents")


    tourist = relationship("Tourist", back_populates="incidents")

class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)            # e.g., "Tiger Reserve Edge"
    zone_type = Column(String, nullable=False)       # DANGER | RESTRICTED | TERROR
    dwell_minutes = Column(Integer, default=5)       # minutes before escalation
    geojson = Column(Text, nullable=False)           # Stored as JSON string (GeoJSON Polygon/MultiPolygon)


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_type = Column(String, nullable=False)     # tourist_authority | authority_responder | group_room
    tourist_id = Column(String, ForeignKey("tourists.id"), nullable=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=True)
    sender_role = Column(String, nullable=False)     # tourist | authority | responder
    sender_id = Column(String, nullable=True)       # tourist_id or responder id for display
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(engine)

# --- simple migration (adds columns if missing) ---
with engine.connect() as con:
    cols = [row[1] for row in con.execute(sql_text("PRAGMA table_info('tourists')")).fetchall()]
    for needed in [("last_lat","TEXT"), ("last_lng","TEXT"), ("password_hash","TEXT")]:
        if needed[0] not in cols:
            con.execute(sql_text(f"ALTER TABLE tourists ADD COLUMN {needed[0]} {needed[1]} DEFAULT NULL"))

    # ticket lifecycle timestamps (safe add if missing)
    inc_cols = [row[1] for row in con.execute(sql_text("PRAGMA table_info('incidents')")).fetchall()]
    for needed in [
        ("ticket_confirmed_at", "DATETIME"),
        ("ticket_assigned_at", "DATETIME"),
        ("ticket_resolved_at", "DATETIME"),
    ]:
        if needed[0] not in inc_cols:
            con.execute(sql_text(f"ALTER TABLE incidents ADD COLUMN {needed[0]} {needed[1]}"))

    # messages table for two-way chat
    try:
        # rooms + members for group travel
        con.execute(sql_text(
            "CREATE TABLE IF NOT EXISTS rooms ("
            "id TEXT PRIMARY KEY, "
            "name TEXT NOT NULL, "
            "description TEXT, "
            "created_by TEXT, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "qr_png_b64 TEXT, "
            "is_active INTEGER DEFAULT 1, "
            "FOREIGN KEY (created_by) REFERENCES tourists(id))"
        ))
        con.execute(sql_text(
            "CREATE TABLE IF NOT EXISTS room_members ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "room_id TEXT, "
            "tourist_id TEXT, "
            "role TEXT DEFAULT 'member', "
            "joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "FOREIGN KEY (room_id) REFERENCES rooms(id), "
            "FOREIGN KEY (tourist_id) REFERENCES tourists(id), "
            "UNIQUE (room_id, tourist_id))"
        ))

        con.execute(sql_text(
            "CREATE TABLE IF NOT EXISTS messages ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "thread_type TEXT NOT NULL, "
            "tourist_id TEXT, "
            "incident_id INTEGER, "
            "room_id TEXT, "
            "sender_role TEXT NOT NULL, "
            "sender_id TEXT, "
            "body TEXT NOT NULL, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "FOREIGN KEY (tourist_id) REFERENCES tourists(id), "
            "FOREIGN KEY (incident_id) REFERENCES incidents(id), "
            "FOREIGN KEY (room_id) REFERENCES rooms(id))"
        ))
        msg_cols = [row[1] for row in con.execute(sql_text("PRAGMA table_info('messages')")).fetchall()]
        if "room_id" not in msg_cols:
            con.execute(sql_text("ALTER TABLE messages ADD COLUMN room_id TEXT"))
        con.commit()
    except Exception:
        pass

# ---------------- Seed zones once ----------------
def seed_zones_once():
    db = SessionLocal()
    try:
        if db.query(Zone).count() == 0:
            sample = [
                {
                    "name":"Restricted Forest Patch",
                    "zone_type":"RESTRICTED",
                    "dwell_minutes":5,
                    "geojson":{
                        "type":"Polygon",
                        "coordinates":[[
                          [91.7415,26.1720],[91.7465,26.1720],
                          [91.7465,26.1765],[91.7415,26.1765],[91.7415,26.1720]
                        ]]
                    }
                },
                {
                    "name":"High-Risk Border Ridge",
                    "zone_type":"DANGER",
                    "dwell_minutes":3,
                    "geojson":{
                        "type":"Polygon",
                        "coordinates":[[
                          [91.7500,26.1700],[91.7560,26.1700],
                          [91.7560,26.1750],[91.7500,26.1750],[91.7500,26.1700]
                        ]]
                    }
                }
            ]
            for z in sample:
                db.add(Zone(
                    name=z["name"],
                    zone_type=z["zone_type"],
                    dwell_minutes=z["dwell_minutes"],
                    geojson=pyjson.dumps(z["geojson"])
                ))
            db.commit()
    finally:
        db.close()

seed_zones_once()

# ---------------- App & CORS ----------------
# In main.py, before the app = FastAPI(...) line

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on server startup
    print("Server starting up...")
    # Create and start the background thread
    monitor_thread = threading.Thread(target=safety_monitor_worker, daemon=True)
    monitor_thread.start()
    yield
    # Code to run on server shutdown (optional)
    print("Server shutting down...")

app = FastAPI(
    title="GuardianID API – eKYC + Geofence + Admin", 
    version="0.5.0",
    lifespan=lifespan  # ✅ Add this
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chatbot_router, prefix="/chatbot", tags=["Chatbot"])

app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------------- Pydantic models ----------------
class RegisterIn(BaseModel):
    name: str
    phone: str
    emergency_contact: str
    password: str
    confirm_password: str

class RegisterOut(BaseModel):
    tourist_id: str
    qr_png_base64: str
    name: Optional[str] = None

class CheckIn(BaseModel):
    tourist_id: str
    location_label: str

class SOSIn(BaseModel):
    tourist_id: str
    location_label: Optional[str] = "-" 
    message: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class DwellAlert(BaseModel):
    tourist_id: str
    zone_id: int
    seconds_inside: int
    lat: Optional[float] = None
    lng: Optional[float] = None


class GPSUpdate(BaseModel):
    tourist_id: str
    lat: float
    lng: float

class ZoneIn(BaseModel):
    name: str
    zone_type: str  # DANGER | RESTRICTED | TERROR
    dwell_minutes: int
    geojson: Dict[str, Any]  # GeoJSON Polygon/MultiPolygon


class MessageSendIn(BaseModel):
    thread_type: str  # tourist_authority | authority_responder | group_room
    tourist_id: Optional[str] = None
    incident_id: Optional[int] = None
    room_id: Optional[str] = None
    sender_role: str  # tourist | authority | responder
    sender_id: Optional[str] = None
    body: str

class RoomCreateIn(BaseModel):
    name: str
    description: Optional[str] = None
    created_by: str

class RoomJoinIn(BaseModel):
    room_id: str
    tourist_id: str

class RoomJoinQRIn(BaseModel):
    qr_payload: str
    tourist_id: str


class LoginIn(BaseModel):
    phone: str
    password: str


# ---------------- Helpers ----------------
def normalize_phone(s: str) -> str:
    """Normalize phone for lookup: strip and remove spaces, dashes, parens."""
    return re.sub(r"[\s\-\(\)]", "", (s or "").strip())


def hash_password(password: str) -> str:
    salt = os.environ.get("GUARDIANID_PASSWORD_SALT", "guardianid-default-salt")
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()


def verify_password(password: str, stored_hash: Optional[str]) -> bool:
    if not stored_hash:
        return False
    return hash_password(password) == stored_hash


def make_qr_base64(payload_text: str) -> str:
    import qrcode
    from PIL import Image
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(payload_text)
    qr.make(fit=True)
    img: Image.Image = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def generate_room_id() -> str:
    return uuid4().hex[:8]

def parse_room_qr_payload(payload: str) -> Optional[str]:
    if not payload:
        return None
    payload = payload.strip()
    if payload.startswith("room:"):
        room_id = payload.split("room:", 1)[1].strip()
        return room_id or None
    return None

def make_incident_hash(*parts: str) -> str:
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def mask_aadhaar(a: str) -> str:
    digits = re.sub(r'[^0-9]', '', a)
    if len(digits) != 12:
        return "INVALID"
    return "****-****-" + digits[-4:]

def mask_passport(p: str) -> str:
    s = re.sub(r'[^A-Za-z0-9]', '', p).upper()
    if len(s) < 7 or len(s) > 9:
        return "INVALID"
    return "*"*(len(s)-3) + s[-3:]

def mock_notify(to: str, message: str):
    # Console logs to simulate SMS/Email
    print(f"[MOCK NOTIFY] To: {to} | {message}")

# helper: only create/log an incident of a given type for a tourist if last one is older than min_seconds
def should_log_incident(db, tourist_id, event_type, now, min_seconds=300):
    """Return True if no incident of event_type exists for tourist in the last min_seconds."""
    last = db.query(Incident).filter(
        Incident.tourist_id == tourist_id,
        Incident.event_type == event_type
    ).order_by(Incident.timestamp.desc()).first()
    if not last:
        return True
    return (now - last.timestamp).total_seconds() >= float(min_seconds)

# In main.py

# You'll need weather data. Since you merged the backends, you can import this!
from chatbot_api import get_openweather_current

# --- Add this new function ---

# In main.py
# REPLACE your existing calculate_safety_score function with this one

# In main.py
# REPLACE your existing calculate_safety_score function with this one

def calculate_safety_score(tourist_id: str, db: SessionLocal) -> dict:
    """Calculates a dynamic safety score and triggers alerts if it's too low."""
    tourist = db.get(Tourist, tourist_id)
    if not tourist:
        return {"score": -1, "explanation": ["Tourist not found."]}

    total_risk = 0
    explanation = []
    now_utc = datetime.utcnow()
    now_ist = now_utc + timedelta(hours=5, minutes=30)
    
    # --- Risk calculation logic remains the same ---
    lat, lng = (float(tourist.last_lat), float(tourist.last_lng)) if tourist.last_lat != "-" else (None, None)
    if lat and lng:
        zones = db.query(Zone).all()
        for z in zones:
            if is_point_in_geojson(lat, lng, pyjson.loads(z.geojson)):
                if z.zone_type == "DANGER":
                    total_risk += 35
                    explanation.append(f"📍 Currently in a DANGER zone: {z.name}")
                elif z.zone_type == "RESTRICTED":
                    total_risk += 15
                    explanation.append(f"📍 Currently in a RESTRICTED zone: {z.name}")
                break
    
    weather_data = get_openweather_current(f"{lat},{lng}") if lat and lng else None
    if weather_data and weather_data.get("cod") == 200:
        conditions = (weather_data.get("weather")[0].get("main") or "").lower()
        if "thunderstorm" in conditions:
            total_risk += 25
            explanation.append("⛈️ Severe weather (thunderstorms) in your area.")
        elif "rain" in conditions or "drizzle" in conditions:
            total_risk += 15
            explanation.append("🌧️ Rainy conditions may affect travel.")
        elif "fog" in conditions or "mist" in conditions:
            total_risk += 10
            explanation.append("🌫️ Poor visibility due to fog/mist.")

    if now_ist.hour < 6 or now_ist.hour >= 22:
        total_risk += 15
        explanation.append("🌙 Traveling late at night increases risk.")

    last_sos = db.query(Incident).filter(Incident.tourist_id == tourist_id, Incident.event_type == "sos").order_by(Incident.timestamp.desc()).first()
    if last_sos and (now_utc - last_sos.timestamp).total_seconds() < 3600:
        total_risk += 50
        explanation.append("🆘 Recent SOS alert has been activated.")

    last_checkin = db.query(Incident).filter(Incident.tourist_id == tourist_id, Incident.event_type == "checkin").order_by(Incident.timestamp.desc()).first()
    if not last_checkin or (now_utc - last_checkin.timestamp).total_seconds() > (12 * 3600):
        total_risk += 10
        explanation.append("🗓️ It's been a while since your last check-in.")

    if tourist.kyc_status != "VERIFIED":
        total_risk += 5
        explanation.append("👤 Identity not yet verified (KYC Pending).")

    final_risk = max(0, min(total_risk, 100))
    score = 100 - int(final_risk)

    if not explanation:
        explanation.append("✅ All clear! No immediate risks detected.")
        
    if score < 30:
        if should_log_incident(db, tourist.id, "low_safety_score", now_utc, min_seconds=900):
            tourist.status = "ALERT"
            explanation.append("⚠️ Safety score is critically low! Authorities notified.")
            
            h = make_incident_hash(tourist.id, "low_safety_score", now_utc.isoformat(), str(score))
            inc = Incident(
                tourist_id=tourist.id,
                event_type="low_safety_score",
                location_label=f"Score dropped to {score}",
                timestamp=now_utc,
                hash_hex=h,
                lat=lat, # ✅ CHANGED LINE
                lng=lng  # ✅ CHANGED LINE
            )
            db.add(inc)
            db.commit()
            mock_notify("authorities@dashboard.gov", f"ALERT: Tourist {tourist.name} ({tourist.id}) has a critically low safety score of {score}.")

    return {"score": score, "explanation": explanation}




# In main.py
import time
import threading

# ✅ ADD THIS NEW FUNCTION
def safety_monitor_worker():
    """A background worker that periodically checks all tourists' safety scores."""
    print("🤖 Background safety monitor started...")
    while True:
        db = SessionLocal()
        try:
            # Get all tourists currently in the system
            tourists = db.query(Tourist).all()
            print(f"[{datetime.now()}] --- Running safety check for {len(tourists)} tourist(s)...")

            for tourist in tourists:
                # The existing function already handles score calculation AND alert creation.
                # We just need to call it.
                calculate_safety_score(tourist.id, db)

        except Exception as e:
            print(f"ERROR in safety_monitor_worker: {e}")
        finally:
            db.close()
        
        # Wait for 5 minutes (300 seconds) before the next check
        time.sleep(60)




# ---------------- Rule-based anomaly helpers & endpoints ----------------

# Tunable thresholds
SUDDEN_SPEED_THRESHOLD_M_S = 50.0   # ~180 km/h; lower for pedestrian tours
DEFAULT_INACTIVITY_MINUTES = 30     # minutes before marking missing

from math import radians, sin, cos, sqrt, atan2

def haversine_m(lat1, lon1, lat2, lon2):
    """Return distance in meters between two (lat,lon) points using Haversine."""
    R = 6371000.0  # Earth radius meters
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi/2.0)**2 + cos(phi1)*cos(phi2)*sin(dlambda/2.0)**2
    return 2*R*atan2(sqrt(a), sqrt(1-a))

def point_in_polygon(x, y, poly):
    """
    Ray-casting algorithm for point-in-polygon.
    poly is a list of (x,y) points (x=lon, y=lat).
    Returns True if point is inside polygon.
    """
    inside = False
    n = len(poly)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside

def is_point_in_geojson(lat, lng, geojson_obj):
    """
    geojson_obj expected to follow GeoJSON structure.
    Note: GeoJSON coordinates are [lon, lat]. We'll test all polygons / multipolygons.
    """
    t = geojson_obj.get("type")
    coords = geojson_obj.get("coordinates")
    if not coords:
        return False
    # (lng, lat) for comparison
    x, y = float(lng), float(lat)
    if t == "Polygon":
        outer = coords[0]
        ring = [(float(p[0]), float(p[1])) for p in outer]
        return point_in_polygon(x, y, ring)
    elif t == "MultiPolygon":
        for poly in coords:
            outer = poly[0]
            ring = [(float(p[0]), float(p[1])) for p in outer]
            if point_in_polygon(x, y, ring):
                return True
    return False

def evaluate_gps_anomalies(db, tourist, lat, lng, now_utc, min_seconds_between_same_incident=300):
    """
    Evaluate rule-based anomalies for a new GPS update.
    - sudden jump by implied speed threshold
    - geofence violation (point-in-polygon against Zones)
    Only creates Incident rows & notifications if the same event_type hasn't been logged for this tourist
    in the last `min_seconds_between_same_incident` seconds.
    Returns a list of anomaly keys detected (and actually logged).
    """
    anomalies = []

    # 1) sudden jump (implied speed)
    try:
        prev_lat = float(tourist.last_lat) if (tourist.last_lat and tourist.last_lat != "-") else None
        prev_lng = float(tourist.last_lng) if (tourist.last_lng and tourist.last_lng != "-") else None
    except Exception:
        prev_lat = prev_lng = None

    if prev_lat is not None and prev_lng is not None:
        dist_m = haversine_m(prev_lat, prev_lng, lat, lng)
        last_inc = db.query(Incident).filter(Incident.tourist_id == tourist.id).order_by(Incident.timestamp.desc()).first()
        if last_inc:
            seconds = max(1.0, (now_utc - last_inc.timestamp).total_seconds())
        else:
            seconds = 1.0
        implied_speed = dist_m / seconds
        if implied_speed > SUDDEN_SPEED_THRESHOLD_M_S:
            # check rate limit before logging/notify
            if should_log_incident(db, tourist.id, "anomaly_speed", now_utc, min_seconds_between_same_incident):
                h = make_incident_hash(tourist.id, "anomaly_speed", now_utc.isoformat(), f"{dist_m:.1f}m", f"{implied_speed:.2f}m_s")
                inc = Incident(
                    tourist_id=tourist.id,
                    event_type="anomaly_speed",
                    location_label=f"jump:{dist_m:.1f}m",
                    timestamp=now_utc,
                    hash_hex=h,
                    lat=lat,
                    lng=lng
                )
                db.add(inc)
                tourist.status = "ALERT"
                anomalies.append("sudden_jump")
                mock_notify(tourist.emergency_contact, f"Anomaly: sudden location jump for {tourist.name}. Speed ~ {implied_speed:.1f} m/s.")
            else:
                anomalies.append("sudden_jump_suppressed")

    # 2) geofence check
    zones = db.query(Zone).all()
    for z in zones:
        try:
            gj = pyjson.loads(z.geojson)
            if is_point_in_geojson(lat, lng, gj):
                if z.zone_type in ("DANGER", "RESTRICTED", "TERROR"):
                    evt_type = "anomaly_geofence"
                    # rate limit by event_type (if you want per-zone limits change the key to include z.id)
                    if should_log_incident(db, tourist.id, evt_type, now_utc, min_seconds_between_same_incident):
                        h = make_incident_hash(tourist.id, evt_type, now_utc.isoformat(), f"zone:{z.id}", z.zone_type)
                        inc = Incident(
                            tourist_id=tourist.id,
                            event_type=evt_type,
                            location_label=f"{z.zone_type}:{z.name}",
                            timestamp=now_utc,
                            hash_hex=h,
                            lat=lat,
                            lng=lng
                        )
                        db.add(inc)
                        tourist.status = "ALERT"
                        anomalies.append(f"geofence_{z.zone_type.lower()}")
                        mock_notify(tourist.phone, f"Geofence Alert: {tourist.name} is inside {z.zone_type} zone '{z.name}'.")
                    else:
                        anomalies.append(f"geofence_{z.zone_type.lower()}_suppressed")
        except Exception:
            continue

    if anomalies:
        # commit here (safe even if caller commits again)
        db.commit()
    return anomalies


@app.post("/api/gps")
def gps_update(payload: GPSUpdate):
    db = SessionLocal()
    try:
        t = db.get(Tourist, payload.tourist_id)
        if not t:
            raise HTTPException(404, "Tourist not found")

        now = datetime.utcnow()

        # compute anomalies using previous last_lat/last_lng (important: do this BEFORE we overwrite last_lat)
        # pass floats for detection; evaluate_gps_anomalies will create incidents (and include lat/lng for anomalies)
        anomalies = evaluate_gps_anomalies(db, t, float(payload.lat), float(payload.lng), now, min_seconds_between_same_incident=300)

        # Always update live position on the Tourist record for immediate UX (no rate-limit here).
        # Keep these as strings so migration stays simple.
        t.last_lat = f"{float(payload.lat):.6f}"
        t.last_lng = f"{float(payload.lng):.6f}"

        # Decide whether to write a 'gps' incident row (rate-limited to once every 5 minutes by default).
        # We intentionally DO NOT persist coords for plain 'gps' incidents so the dashboard won't show coordinates for them.
        if should_log_incident(db, t.id, "gps", now, min_seconds=300):
            h = make_incident_hash(t.id, "gps", now.isoformat(), f"{payload.lat},{payload.lng}")
            inc = Incident(
                tourist_id=t.id,
                event_type="gps",
                location_label="-",
                timestamp=now,
                hash_hex=h,
                lat=None,
                lng=None
            )
            db.add(inc)

        # commit both Tourist updates and any incidents created by evaluate_gps_anomalies or above
        db.commit()

        return {"ok": True, "anomalies": anomalies}
    finally:
        db.close()




# On-demand inactivity / missing tourist scan endpoint
@app.get("/api/anomalies/scan")
def anomalies_scan(inactivity_minutes: int = DEFAULT_INACTIVITY_MINUTES):
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=int(inactivity_minutes))
        out = {"checked": 0, "missing_detected": 0, "missing": []}
        tourists = db.query(Tourist).all()
        for t in tourists:
            out["checked"] += 1
            last_inc = db.query(Incident).filter(Incident.tourist_id == t.id).order_by(Incident.timestamp.desc()).first()
            if not last_inc or last_inc.timestamp < cutoff:
                now = datetime.utcnow()
                h = make_incident_hash(t.id, "missing", now.isoformat(), f"last_inc:{last_inc.id if last_inc else 'none'}")
                inc = Incident(tourist_id=t.id, event_type="missing", location_label="-", timestamp=now, hash_hex=h)
                db.add(inc)
                t.status = "ALERT"
                db.commit()
                out["missing_detected"] += 1
                out["missing"].append({"id": t.id, "name": t.name})
                mock_notify(t.emergency_contact, f"Missing alert: Last contact for {t.name} older than {inactivity_minutes} minutes.")
        return out
    finally:
        db.close()


# ---------------- Routes ----------------
@app.post("/api/register", response_model=RegisterOut)
def register_user(payload: RegisterIn):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Password and confirm password do not match")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    phone_norm = normalize_phone(payload.phone)
    if not phone_norm:
        raise HTTPException(status_code=400, detail="Phone number is required")
    db = SessionLocal()
    try:
        existing = db.query(Tourist).filter(Tourist.phone == phone_norm).first()
        if existing:
            raise HTTPException(status_code=409, detail="This contact number is already registered")
        tid = str(uuid4())
        qr_b64 = make_qr_base64(tid)
        pw_hash = hash_password(payload.password)
        t = Tourist(
            id=tid,
            name=payload.name.strip(),
            phone=phone_norm,
            emergency_contact=payload.emergency_contact.strip(),
            qr_png_b64=qr_b64,
            password_hash=pw_hash,
        )
        db.add(t)
        db.commit()
        return RegisterOut(tourist_id=tid, qr_png_base64=qr_b64, name=t.name)
    finally:
        db.close()

@app.post("/api/rooms")
def create_room(payload: RoomCreateIn):
    db = SessionLocal()
    try:
        creator = db.get(Tourist, payload.created_by)
        if not creator:
            raise HTTPException(404, "Tourist not found")
        room_id = generate_room_id()
        for _ in range(3):
            if not db.get(Room, room_id):
                break
            room_id = generate_room_id()
        if db.get(Room, room_id):
            raise HTTPException(500, "Room ID generation failed")
        qr_b64 = make_qr_base64(f"room:{room_id}")
        room = Room(
            id=room_id,
            name=payload.name.strip(),
            description=(payload.description or "").strip() or None,
            created_by=payload.created_by,
            qr_png_b64=qr_b64,
            is_active=True,
        )
        db.add(room)
        db.add(RoomMember(room_id=room_id, tourist_id=payload.created_by, role="admin"))
        db.commit()
        return {
            "room_id": room.id,
            "name": room.name,
            "description": room.description,
            "created_by": room.created_by,
            "qr_png_base64": room.qr_png_b64,
            "is_active": room.is_active,
        }
    finally:
        db.close()

@app.get("/api/rooms/{room_id}")
def get_room(room_id: str):
    db = SessionLocal()
    try:
        room = db.get(Room, room_id)
        if not room:
            raise HTTPException(404, "Room not found")
        return {
            "room_id": room.id,
            "name": room.name,
            "description": room.description,
            "created_by": room.created_by,
            "qr_png_base64": room.qr_png_b64,
            "is_active": room.is_active,
        }
    finally:
        db.close()

@app.post("/api/rooms/{room_id}/join")
def join_room(room_id: str, payload: RoomJoinIn):
    db = SessionLocal()
    try:
        if room_id != payload.room_id:
            raise HTTPException(400, "room_id mismatch")
        room = db.get(Room, room_id)
        if not room or not room.is_active:
            raise HTTPException(404, "Room not found")
        tourist = db.get(Tourist, payload.tourist_id)
        if not tourist:
            raise HTTPException(404, "Tourist not found")
        member = db.query(RoomMember).filter(
            RoomMember.room_id == room_id,
            RoomMember.tourist_id == payload.tourist_id,
        ).first()
        if member:
            return {"ok": True, "room_id": room_id, "already_member": True}
        db.add(RoomMember(room_id=room_id, tourist_id=payload.tourist_id, role="member"))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"ok": True, "room_id": room_id, "already_member": True}
        return {"ok": True, "room_id": room_id, "already_member": False}
    finally:
        db.close()

@app.post("/api/rooms/join-by-qr")
def join_room_by_qr(payload: RoomJoinQRIn):
    room_id = parse_room_qr_payload(payload.qr_payload)
    if not room_id:
        raise HTTPException(400, "Invalid QR payload")
    return join_room(room_id, RoomJoinIn(room_id=room_id, tourist_id=payload.tourist_id))

@app.get("/api/rooms/{room_id}/members")
def list_room_members(room_id: str):
    db = SessionLocal()
    try:
        room = db.get(Room, room_id)
        if not room:
            raise HTTPException(404, "Room not found")
        members = db.query(RoomMember, Tourist).join(
            Tourist, Tourist.id == RoomMember.tourist_id
        ).filter(RoomMember.room_id == room_id).all()
        out = []
        for m, t in members:
            out.append({
                "tourist_id": t.id,
                "name": t.name,
                "role": m.role,
                "joined_at": to_ist(m.joined_at),
                "last_lat": t.last_lat,
                "last_lng": t.last_lng,
            })
        return {"room_id": room_id, "members": out}
    finally:
        db.close()

@app.post("/api/kyc")
async def kyc_verify(
    tourist_id: str = Form(...),
    doc_type: str = Form(...),   # 'AADHAAR' or 'PASSPORT'
    id_number: str = Form(...),
    file: UploadFile = File(...)
):
    db = SessionLocal()
    try:
        t = db.get(Tourist, tourist_id)
        if not t: raise HTTPException(404, "Tourist not found")
        blob = await file.read()
        doc_hash = hashlib.sha256(blob).hexdigest()

        if doc_type.upper() == "AADHAAR":
            masked = mask_aadhaar(id_number); valid = masked != "INVALID"
        elif doc_type.upper() == "PASSPORT":
            masked = mask_passport(id_number); valid = masked != "INVALID"
        else:
            raise HTTPException(400, "Unsupported doc_type")

        t.kyc_status = "VERIFIED" if valid else "REJECTED"
        t.kyc_doc_type = doc_type.upper()
        t.kyc_id_masked = masked if valid else "INVALID"
        t.kyc_hash = doc_hash

        now = datetime.utcnow().isoformat()
        h = make_incident_hash(t.id, "kyc", now, t.kyc_doc_type, t.kyc_id_masked, doc_hash)
        inc = Incident(tourist_id=t.id, event_type="kyc", timestamp=datetime.utcnow(), hash_hex=h)
        db.add(inc); db.commit()
        return {"ok": True, "kyc_status": t.kyc_status, "kyc_doc_type": t.kyc_doc_type,
                "kyc_id_masked": t.kyc_id_masked, "kyc_hash": t.kyc_hash, "incident_hash": h}
    finally:
        db.close()


@app.post("/api/checkin")
def checkin(payload: CheckIn):
    db = SessionLocal()
    try:
        t = db.get(Tourist, payload.tourist_id)
        if not t: raise HTTPException(404, "Tourist not found")
        now = datetime.utcnow()
        t.last_checkin = f"{payload.location_label} @ {now.strftime('%Y-%m-%d %H:%M IST')}"
        h = make_incident_hash(t.id, "checkin", now.isoformat(), payload.location_label)
        inc = Incident(tourist_id=t.id, event_type="checkin", location_label=payload.location_label, timestamp=now, hash_hex=h)
        db.add(inc); db.commit()

        try:
            _tx = anchor_incident("CHECKIN", h, t.id)
            print("[ANCHOR] CHECKIN:", _tx)
        except Exception as e:
            print("[ANCHOR] CHECKIN failed:", e)
    
        return {"ok": True, "message": "Check-in recorded", "hash": h}
    finally:
        db.close()

@app.post("/api/sos")
def sos(payload: SOSIn):
    db = SessionLocal()
    try:
        t = db.get(Tourist, payload.tourist_id)
        if not t: raise HTTPException(404, "Tourist not found")
        now = datetime.utcnow()
        t.status = "ALERT"
        coord_part = f"{payload.lat},{payload.lng}" if (payload.lat is not None and payload.lng is not None) else "-,-"
        h = make_incident_hash(t.id, "sos", now.isoformat(), payload.location_label or "-", coord_part)
        inc = Incident(
            tourist_id=t.id,
            event_type="sos",
            location_label=payload.location_label or "-",
            lat=payload.lat,
            lng=payload.lng,
            timestamp=now,
            hash_hex=h
        )
        db.add(inc); db.commit()

        try:
            _tx = anchor_incident("SOS", h, t.id)
            print("[ANCHOR] SOS:", _tx)
        except Exception as e:
            print("[ANCHOR] SOS failed:", e)
    
        return {"ok": True, "message": "SOS alert raised", "hash": h}
    finally:
        db.close()



@app.get("/api/alerts")
def alerts():
    db = SessionLocal()
    try:
        rows = db.query(Tourist).filter(Tourist.status == "ALERT").all()
        return [{"id": t.id, "name": t.name, "last_checkin": last_checkin_to_ist(t.last_checkin)} for t in rows]

    finally:
        db.close()


@app.post("/api/kyc/admin")
def kyc_admin(
    tourist_id: str = Form(...),
    action: str = Form(...),           # VERIFY | REJECT | PENDING
    doc_type: Optional[str] = Form(None),
    id_masked: Optional[str] = Form(None),
):
    db = SessionLocal()
    try:
        t = db.get(Tourist, tourist_id)
        if not t:
            raise HTTPException(404, "Tourist not found")

        act = action.strip().upper()
        if act not in ("VERIFY", "REJECT", "PENDING"):
            raise HTTPException(400, "action must be VERIFY|REJECT|PENDING")

        if act == "VERIFY":
            t.kyc_status = "VERIFIED"
            if doc_type:
                t.kyc_doc_type = doc_type.strip().upper()
            if id_masked:
                t.kyc_id_masked = id_masked
        elif act == "REJECT":
            t.kyc_status = "REJECTED"
        else:
            t.kyc_status = "PENDING"

        now = datetime.utcnow()
        h = make_incident_hash(t.id, "kyc_admin", now.isoformat(), t.kyc_status, t.kyc_doc_type or "-", t.kyc_id_masked or "-")
        inc = Incident(tourist_id=t.id, event_type="kyc", timestamp=now, hash_hex=h)
        db.add(inc)
        db.commit()

        try:
            _tx = anchor_incident("KYC_ADMIN", h, t.id)
            print("[ANCHOR] KYC_ADMIN:", _tx)
        except Exception as e:
            print("[ANCHOR] KYC_ADMIN failed:", e)

        return {"ok": True, "tourist_id": t.id, "kyc_status": t.kyc_status, "incident_hash": h}
    finally:
        db.close()



@app.get("/api/zones")
def list_zones():
    db = SessionLocal()
    try:
        rows = db.query(Zone).all()
        return [{
            "id": z.id,
            "name": z.name,
            "zone_type": z.zone_type,
            "dwell_minutes": z.dwell_minutes,
            "geojson": pyjson.loads(z.geojson)
        } for z in rows]
    finally:
        db.close()

@app.post("/api/zones/add")
def add_zone(payload: ZoneIn):
    db = SessionLocal()
    try:
        zt = payload.zone_type.strip().upper()
        if zt not in ("DANGER","RESTRICTED","TERROR"):
            raise HTTPException(400, "zone_type must be DANGER|RESTRICTED|TERROR")
        z = Zone(
            name=payload.name.strip(),
            zone_type=zt,
            dwell_minutes=int(payload.dwell_minutes),
            geojson=pyjson.dumps(payload.geojson)
        )
        db.add(z); db.commit()
        return {"ok": True, "id": z.id}
    finally:
        db.close()
@app.post("/api/geofence/dwell")
def geofence_dwell(alert: DwellAlert):
    db = SessionLocal()
    try:
        t = db.get(Tourist, alert.tourist_id)
        if not t: raise HTTPException(404, "Tourist not found")
        z = db.get(Zone, alert.zone_id)
        if not z: raise HTTPException(404, "Zone not found")

        t.status = "ALERT"
        now = datetime.utcnow()
        label = f"{z.zone_type}:{z.name}"

        # prefer lat/lng from payload; if not provided, try to use the Tourist's last_lat/last_lng (if valid)
        lat_val = alert.lat
        lng_val = alert.lng
        try:
            if lat_val is None and t.last_lat and t.last_lat != "-":
                lat_val = float(t.last_lat)
            if lng_val is None and t.last_lng and t.last_lng != "-":
                lng_val = float(t.last_lng)
        except Exception:
            lat_val = lng_val = None

        h = make_incident_hash(t.id, "geofence_dwell", now.isoformat(), f"zone:{z.id}", str(alert.seconds_inside))
        inc = Incident(
            tourist_id=t.id,
            event_type="geofence_dwell",
            location_label=label,
            timestamp=now,
            hash_hex=h,
            lat=lat_val,
            lng=lng_val
        )
        db.add(inc); db.commit()

        try:
            _tx = anchor_incident("DWELL", h, t.id)
            print("[ANCHOR] DWELL:", _tx)
        except Exception as e:
            print("[ANCHOR] DWELL failed:", e)

        # mock notifications (console)
        mock_notify(t.phone, f"Warning: You are in {z.zone_type} zone '{z.name}' for too long.")
        mock_notify("police@agency.gov", f"ALERT: Tourist {t.name} stayed in {z.zone_type} '{z.name}' > {z.dwell_minutes}min.")
        return {"ok": True, "message": "Dwell alert recorded", "hash": h}
    finally:
        db.close()

# In main.py, add this new section

# A mock list of substations for the control room to assign tickets to.
POLICE_SUBSTATIONS = [
    {"id": "PS_GUW_01", "name": "Guwahati Central Substation"},
    {"id": "PS_GUW_02", "name": "Dispur Regional Unit"},
    {"id": "PS_SHL_01", "name": "Shillong Metro Division"},
    {"id": "PS_KAZ_01", "name": "Kaziranga Park Ranger HQ"},
]

class AssignTicketIn(BaseModel):
    assignee_id: str
    assignee_name: str

@app.post("/api/incidents/{incident_id}/confirm")
def confirm_ticket(incident_id: int):
    """
    Control-room confirmation step.
    Moves an SOS ticket from NEW -> CONFIRMED so responders can see/pick it.
    """
    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")

        if (incident.event_type or "").lower() != "sos":
            raise HTTPException(status_code=400, detail="Only SOS incidents can be confirmed")

        current = (incident.ticket_status or "NEW").upper()
        if current != "NEW":
            raise HTTPException(status_code=409, detail=f"Cannot confirm incident in state {current}")

        incident.ticket_status = "CONFIRMED"
        incident.ticket_confirmed_at = datetime.utcnow()
        db.commit()
        return {"ok": True, "incident_id": incident.id, "status": incident.ticket_status}
    finally:
        db.close()

@app.get("/api/substations")
def get_substations():
    """Returns the list of available substations to assign tickets to."""
    return POLICE_SUBSTATIONS

@app.post("/api/incidents/{incident_id}/assign")
def assign_ticket(incident_id: int, payload: AssignTicketIn):
    """
    Responder pickup (Uber-style): claim a CONFIRMED SOS ticket.
    Uses an atomic conditional update to avoid double-pick.
    """
    db = SessionLocal()
    try:
        assignee = f"{payload.assignee_name} ({payload.assignee_id})"
        now = datetime.utcnow()

        updated = (
            db.query(Incident)
            .filter(Incident.id == incident_id, Incident.ticket_status == "CONFIRMED")
            .update({"ticket_status": "ASSIGNED", "ticket_assignee": assignee, "ticket_assigned_at": now})
        )
        if updated != 1:
            current = db.get(Incident, incident_id)
            if not current:
                raise HTTPException(status_code=404, detail="Incident not found")
            raise HTTPException(status_code=409, detail=f"Ticket not available (status={current.ticket_status})")

        db.commit()
        return {"ok": True, "incident_id": incident_id, "status": "ASSIGNED"}
    finally:
        db.close()

@app.post("/api/zones/add")
def add_zone(payload: ZoneIn):
    db = SessionLocal()
    try:
        zt = payload.zone_type.strip().upper()
        if zt not in ("DANGER","RESTRICTED","TERROR"):
            raise HTTPException(400, "zone_type must be DANGER|RESTRICTED|TERROR")
        z = Zone(
            name=payload.name.strip(),
            zone_type=zt,
            dwell_minutes=int(payload.dwell_minutes),
            geojson=pyjson.dumps(payload.geojson)
        )
        db.add(z); db.commit()
        return {"ok": True, "id": z.id}
    finally:
        db.close()

# ✅ ADD THIS NEW ENDPOINT FOR DELETION
@app.delete("/api/zones/{zone_id}")
def delete_zone(zone_id: int):
    """Deletes a zone by its ID."""
    db = SessionLocal()
    try:
        zone_to_delete = db.get(Zone, zone_id)
        if not zone_to_delete:
            raise HTTPException(status_code=404, detail="Zone not found")
        
        db.delete(zone_to_delete)
        db.commit()
        return {"ok": True, "message": f"Zone {zone_id} has been deleted."}
    finally:
        db.close()

@app.post("/api/incidents/{incident_id}/resolve")
def resolve_ticket(incident_id: int):
    """Marks an incident ticket as resolved."""
    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        incident.ticket_status = "RESOLVED"
        incident.ticket_resolved_at = datetime.utcnow()
        db.commit()
        return {"ok": True, "incident_id": incident.id, "status": incident.ticket_status}
    finally:
        db.close()

@app.get("/api/tourists")
def tourists():
    db = SessionLocal()
    try:
        rows = db.query(Tourist).all()
        return [{
            "id": t.id,
            "name": t.name,
            "phone": t.phone,
            "emergency_contact": t.emergency_contact,
            "status": t.status,
            "last_checkin": last_checkin_to_ist(t.last_checkin),
            "qr_png_base64": t.qr_png_b64,
            "kyc_status": t.kyc_status,
            "kyc_doc_type": t.kyc_doc_type,
            "kyc_id_masked": t.kyc_id_masked,
            "last_lat": t.last_lat,
            "last_lng": t.last_lng,
        } for t in rows]

    finally:
        db.close()


@app.post("/api/tourist/login")
def tourist_login(payload: LoginIn):
    """Login with contact number and password. Returns profile with qr_png_base64 for session restore."""
    phone_norm = normalize_phone(payload.phone or "")
    if not phone_norm:
        raise HTTPException(status_code=400, detail="Contact number is required")
    if not (payload.password or "").strip():
        raise HTTPException(status_code=400, detail="Password is required")
    db = SessionLocal()
    try:
        t = db.query(Tourist).filter(Tourist.phone == phone_norm).first()
        if not t:
            t = next((x for x in db.query(Tourist).all() if normalize_phone(x.phone) == phone_norm), None)
        if not t:
            raise HTTPException(status_code=404, detail="No account found with this contact number")
        if not t.password_hash:
            raise HTTPException(
                status_code=401,
                detail="This account has no password. Please register again with this contact number to set a password.",
            )
        if not verify_password(payload.password, t.password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")
        return {
            "ok": True,
            "tourist_id": t.id,
            "name": t.name,
            "qr_png_base64": t.qr_png_b64 or "",
        }
    finally:
        db.close()


@app.get("/api/tourist/{tourist_id}/profile")
def tourist_profile(tourist_id: str):
    """Get tourist profile by ID (for session restore / validation)."""
    db = SessionLocal()
    try:
        t = db.get(Tourist, tourist_id)
        if not t:
            raise HTTPException(status_code=404, detail="Tourist not found")
        return {
            "id": t.id,
            "name": t.name,
            "qr_png_base64": t.qr_png_b64 or "",
        }
    finally:
        db.close()


@app.post("/api/tourist/logout")
def tourist_logout():
    """Acknowledge logout (session is client-side; backend has no session store)."""
    return {"ok": True}


@app.get("/api/tourist/{tourist_id}/safety-score")
def get_safety_score(tourist_id: str):
    db = SessionLocal()
    try:
        score_data = calculate_safety_score(tourist_id, db)
        if score_data["score"] == -1:
            raise HTTPException(status_code=404, detail="Tourist not found")
        return score_data
    finally:
        db.close()

@app.get("/api/tourist/{tourist_id}/assigned-incident")
def get_assigned_incident(tourist_id: str):
    """Get the assigned SOS incident for a tourist (responder info if available)."""
    db = SessionLocal()
    try:
        t = db.get(Tourist, tourist_id)
        if not t:
            raise HTTPException(status_code=404, detail="Tourist not found")
        
        # Find the most recent SOS incident that is ASSIGNED
        incident = db.query(Incident).filter(
            Incident.tourist_id == tourist_id,
            Incident.event_type == "sos",
            Incident.ticket_status == "ASSIGNED"
        ).order_by(Incident.timestamp.desc()).first()
        
        if not incident:
            return {"has_assigned_incident": False, "incident_id": None, "responder_info": None}
        
        # Parse the responder info from ticket_assignee (format: "Name (ID)")
        responder_info = None
        if incident.ticket_assignee:
            # Extract responder_id from "Name (ID)"
            match = re.search(r'\(([^)]+)\)$', incident.ticket_assignee)
            if match:
                responder_id = match.group(1)
                # Try to find in police substations first
                substation = next((s for s in POLICE_SUBSTATIONS if s["id"] == responder_id), None)
                if substation:
                    # It's a police substation
                    responder_info = {
                        "responder_id": responder_id,
                        "responder_name": incident.ticket_assignee.split(" (")[0],  # Extract name part
                        "substation_id": responder_id,
                        "substation_name": substation["name"],
                        "assignee_label": incident.ticket_assignee
                    }
                else:
                    # It's a responder ID (not a substation), just return the assignee label
                    responder_info = {
                        "responder_id": responder_id,
                        "responder_name": incident.ticket_assignee.split(" (")[0],  # Extract name part
                        "substation_id": None,
                        "substation_name": "Responder",
                        "assignee_label": incident.ticket_assignee
                    }
        
        return {
            "has_assigned_incident": True,
            "incident_id": incident.id,
            "responder_info": responder_info
        }
    finally:
        db.close()

# In main.py
# REPLACE your existing logs() function with this one

# In main.py
# REPLACE your existing logs() function with this one

@app.get("/api/logs")
def logs():
    db = SessionLocal()
    try:
        rows = db.query(Incident).order_by(Incident.timestamp.desc()).all()
        out = []
        
        coords_visible_for = ("sos", "anomaly_speed", "anomaly_geofence", "geofence_dwell", "low_safety_score")

        for inc in rows:
            if inc.event_type in coords_visible_for and inc.lat is not None and inc.lng is not None:
                lat_field = float(inc.lat)
                lng_field = float(inc.lng)
            else:
                lat_field = "-"
                lng_field = "-"

            out.append({
                "id": inc.id,
                "tourist_id": inc.tourist_id,
                "event_type": inc.event_type,
                "location_label": inc.location_label,
                "timestamp": to_ist(inc.timestamp),
                "hash_hex": inc.hash_hex,
                "lat": lat_field,
                "lng": lng_field,
                "ticket_status": inc.ticket_status, # ✅ ADDED
                "ticket_assignee": inc.ticket_assignee, # ✅ ADDED
                "ticket_confirmed_at": to_ist(inc.ticket_confirmed_at) if inc.ticket_confirmed_at else None,
                "ticket_assigned_at": to_ist(inc.ticket_assigned_at) if inc.ticket_assigned_at else None,
                "ticket_resolved_at": to_ist(inc.ticket_resolved_at) if inc.ticket_resolved_at else None,
            })
        return out
    finally:
        db.close()


# ---------------- Two-way chat: messages + WebSocket ----------------

class ConnectionManager:
    """In-memory WebSocket subscriber registry for chat broadcast."""
    def __init__(self):
        self.connections: list = []  # list of (WebSocket, set of (thread_type, tourist_id/incident_id/room_id))

    def _thread_key(self, thread_type: str, tourist_id: Optional[str], incident_id: Optional[int], room_id: Optional[str] = None) -> tuple:
        if thread_type == "tourist_authority" and tourist_id:
            return ("tourist_authority", tourist_id)
        if thread_type == "authority_responder" and incident_id is not None:
            return ("authority_responder", incident_id)
        if thread_type == "responder_tourist" and tourist_id and incident_id is not None:
            return ("responder_tourist", tourist_id, incident_id)
        if thread_type == "group_room" and room_id:
            return ("group_room", room_id)
        raise ValueError("invalid thread")

    async def subscribe(self, websocket: WebSocket, thread_type: str, tourist_id: Optional[str] = None, incident_id: Optional[int] = None, room_id: Optional[str] = None):
        key = self._thread_key(thread_type, tourist_id, incident_id, room_id)
        for ws, threads in self.connections:
            if ws == websocket:
                threads.add(key)
                return
        self.connections.append((websocket, {key}))

    async def broadcast_to_thread(self, thread_type: str, tourist_id: Optional[str], incident_id: Optional[int], room_id: Optional[str], payload: dict, exclude_ws: Optional[WebSocket] = None):
        try:
            key = self._thread_key(thread_type, tourist_id, incident_id, room_id)
        except ValueError:
            return
        to_remove = []
        for i, (ws, threads) in enumerate(self.connections):
            if key not in threads or ws == exclude_ws:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                to_remove.append(i)
        for i in reversed(to_remove):
            self.connections.pop(i)

    def disconnect(self, websocket: WebSocket):
        self.connections = [(ws, t) for ws, t in self.connections if ws != websocket]


chat_manager = ConnectionManager()
# call_id -> { "caller_ws": WebSocket, "callee_ws": WebSocket|None, "thread_type", "tourist_id", "incident_id", "caller_role", "caller_id" }
active_calls = {}


@app.post("/api/messages")
async def send_message(payload: MessageSendIn):
    db = SessionLocal()
    try:
        if payload.thread_type == "tourist_authority":
            if not payload.tourist_id:
                raise HTTPException(status_code=400, detail="tourist_id required for tourist_authority")
            t = db.get(Tourist, payload.tourist_id)
            if not t:
                raise HTTPException(status_code=404, detail="Tourist not found")
            incident_id = None
            tourist_id = payload.tourist_id
            room_id = None
        elif payload.thread_type == "authority_responder":
            if payload.incident_id is None:
                raise HTTPException(status_code=400, detail="incident_id required for authority_responder")
            inc = db.get(Incident, payload.incident_id)
            if not inc or (inc.ticket_status or "").upper() != "ASSIGNED":
                raise HTTPException(status_code=400, detail="Incident not found or not ASSIGNED")
            tourist_id = None
            incident_id = payload.incident_id
            room_id = None
        elif payload.thread_type == "responder_tourist":
            if not payload.tourist_id or payload.incident_id is None:
                raise HTTPException(status_code=400, detail="tourist_id and incident_id required for responder_tourist")
            t = db.get(Tourist, payload.tourist_id)
            if not t:
                raise HTTPException(status_code=404, detail="Tourist not found")
            inc = db.get(Incident, payload.incident_id)
            if not inc or (inc.ticket_status or "").upper() != "ASSIGNED" or inc.tourist_id != payload.tourist_id:
                raise HTTPException(status_code=400, detail="Incident not found, not ASSIGNED, or wrong tourist")
            tourist_id = payload.tourist_id
            incident_id = payload.incident_id
            room_id = None
        elif payload.thread_type == "group_room":
            if not payload.room_id or not payload.tourist_id:
                raise HTTPException(status_code=400, detail="room_id and tourist_id required for group_room")
            room = db.get(Room, payload.room_id)
            if not room or not room.is_active:
                raise HTTPException(status_code=404, detail="Room not found")
            member = db.query(RoomMember).filter(
                RoomMember.room_id == payload.room_id,
                RoomMember.tourist_id == payload.tourist_id,
            ).first()
            if not member:
                raise HTTPException(status_code=403, detail="Tourist is not a room member")
            tourist_id = payload.tourist_id
            incident_id = None
            room_id = payload.room_id
        else:
            raise HTTPException(status_code=400, detail="thread_type must be tourist_authority, authority_responder, responder_tourist, or group_room")

        msg = Message(
            thread_type=payload.thread_type,
            tourist_id=tourist_id,
            incident_id=incident_id,
            room_id=room_id,
            sender_role=payload.sender_role,
            sender_id=payload.sender_id,
            body=payload.body.strip() or "(empty)",
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        out = {
            "id": msg.id,
            "thread_type": msg.thread_type,
            "tourist_id": msg.tourist_id,
            "incident_id": msg.incident_id,
            "room_id": msg.room_id,
            "sender_role": msg.sender_role,
            "sender_id": msg.sender_id,
            "body": msg.body,
            "created_at": to_ist(msg.created_at),
        }
        await chat_manager.broadcast_to_thread(
            payload.thread_type, tourist_id, incident_id, room_id,
            {"type": "new_message", "message": out},
        )
        return out
    finally:
        db.close()


@app.get("/api/messages")
def list_messages(
    thread_type: str = Query(...),
    tourist_id: Optional[str] = Query(None),
    incident_id: Optional[int] = Query(None),
    room_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
):
    if thread_type == "tourist_authority" and tourist_id:
        tid, iid, rid = tourist_id, None, None
    elif thread_type == "authority_responder" and incident_id is not None:
        tid, iid, rid = None, incident_id, None
    elif thread_type == "responder_tourist" and tourist_id and incident_id is not None:
        tid, iid, rid = tourist_id, incident_id, None
    elif thread_type == "group_room" and room_id:
        tid, iid, rid = None, None, room_id
    else:
        raise HTTPException(status_code=400, detail="Provide tourist_id for tourist_authority, incident_id for authority_responder, both for responder_tourist, or room_id for group_room")
    db = SessionLocal()
    try:
        q = db.query(Message).filter(Message.thread_type == thread_type)
        if tid is not None:
            q = q.filter(Message.tourist_id == tid)
        if iid is not None:
            q = q.filter(Message.incident_id == iid)
        if rid is not None:
            q = q.filter(Message.room_id == rid)
        rows = q.order_by(Message.created_at.desc()).limit(limit).all()
        out = []
        for m in reversed(rows):
            out.append({
                "id": m.id,
                "thread_type": m.thread_type,
                "tourist_id": m.tourist_id,
                "incident_id": m.incident_id,
                "room_id": m.room_id,
                "sender_role": m.sender_role,
                "sender_id": m.sender_id,
                "body": m.body,
                "created_at": to_ist(m.created_at),
            })
        return {"messages": out}
    finally:
        db.close()


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            if action == "subscribe":
                thread_type = data.get("thread_type")
                tourist_id = data.get("tourist_id")
                incident_id = data.get("incident_id")
                room_id = data.get("room_id")
                if thread_type and (room_id or tourist_id or incident_id is not None):
                    await chat_manager.subscribe(websocket, thread_type, tourist_id, incident_id, room_id)
                await websocket.send_json({"type": "subscribed", "thread_type": thread_type, "tourist_id": tourist_id, "incident_id": incident_id, "room_id": room_id})
            elif action == "start_call":
                call_id = data.get("call_id") or str(uuid4())
                thread_type = data.get("thread_type")
                tourist_id = data.get("tourist_id")
                incident_id = data.get("incident_id")
                room_id = data.get("room_id")
                caller_role = data.get("caller_role", "")
                caller_id = data.get("caller_id", "")
                if thread_type == "group_room":
                    await websocket.send_json({"type": "error", "detail": "Group room calls are not supported"})
                    continue
                try:
                    key = chat_manager._thread_key(thread_type, tourist_id, incident_id, room_id)
                except ValueError:
                    await websocket.send_json({"type": "error", "detail": "Invalid thread for call"})
                    continue
                active_calls[call_id] = {
                    "caller_ws": websocket,
                    "callee_ws": None,
                    "thread_type": thread_type,
                    "tourist_id": tourist_id,
                    "incident_id": incident_id,
                    "room_id": room_id,
                    "caller_role": caller_role,
                    "caller_id": caller_id,
                }
                await chat_manager.broadcast_to_thread(
                    thread_type, tourist_id, incident_id, room_id,
                    {"type": "incoming_call", "call_id": call_id, "caller_role": caller_role, "caller_id": caller_id},
                    exclude_ws=websocket,
                )
                await websocket.send_json({"type": "call_started", "call_id": call_id})
            elif action == "accept_call":
                call_id = data.get("call_id")
                if not call_id or call_id not in active_calls:
                    await websocket.send_json({"type": "error", "detail": "Call not found"})
                    continue
                call = active_calls[call_id]
                call["callee_ws"] = websocket
                try:
                    await call["caller_ws"].send_json({"type": "call_accepted", "call_id": call_id})
                except Exception:
                    pass
                await websocket.send_json({"type": "call_accepted", "call_id": call_id})
            elif action == "reject_call":
                call_id = data.get("call_id")
                if call_id and call_id in active_calls:
                    call = active_calls.pop(call_id)
                    try:
                        await call["caller_ws"].send_json({"type": "call_rejected", "call_id": call_id})
                    except Exception:
                        pass
                await websocket.send_json({"type": "call_rejected", "call_id": call_id})
            elif action == "signaling":
                call_id = data.get("call_id")
                payload_s = data.get("payload")
                if not call_id or call_id not in active_calls or not payload_s:
                    await websocket.send_json({"type": "error", "detail": "Invalid signaling"})
                    continue
                call = active_calls[call_id]
                other = call["callee_ws"] if call["caller_ws"] == websocket else call["caller_ws"]
                if other:
                    try:
                        await other.send_json({"type": "signaling", "call_id": call_id, "payload": payload_s})
                    except Exception:
                        pass
            elif action == "end_call":
                call_id = data.get("call_id")
                if call_id and call_id in active_calls:
                    call = active_calls.pop(call_id)
                    for w in (call["caller_ws"], call.get("callee_ws")):
                        if w and w != websocket:
                            try:
                                await w.send_json({"type": "call_ended", "call_id": call_id})
                            except Exception:
                                pass
            elif action == "send":
                # Allow sending via WebSocket too; same validation as POST
                payload = data.get("payload") or {}
                msg_in = MessageSendIn(
                    thread_type=payload.get("thread_type", ""),
                    tourist_id=payload.get("tourist_id"),
                    incident_id=payload.get("incident_id"),
                    room_id=payload.get("room_id"),
                    sender_role=payload.get("sender_role", ""),
                    sender_id=payload.get("sender_id"),
                    body=payload.get("body", ""),
                )
                # Reuse POST logic via a sync call (we're in async context)
                from fastapi.responses import JSONResponse
                db = SessionLocal()
                try:
                    if msg_in.thread_type == "tourist_authority" and msg_in.tourist_id:
                        t = db.get(Tourist, msg_in.tourist_id)
                        if not t:
                            await websocket.send_json({"type": "error", "detail": "Tourist not found"})
                            continue
                        incident_id, tourist_id, room_id = None, msg_in.tourist_id, None
                    elif msg_in.thread_type == "authority_responder" and msg_in.incident_id is not None:
                        inc = db.get(Incident, msg_in.incident_id)
                        if not inc or (inc.ticket_status or "").upper() != "ASSIGNED":
                            await websocket.send_json({"type": "error", "detail": "Incident not found or not ASSIGNED"})
                            continue
                        tourist_id, incident_id, room_id = None, msg_in.incident_id, None
                    elif msg_in.thread_type == "responder_tourist" and msg_in.tourist_id and msg_in.incident_id is not None:
                        t = db.get(Tourist, msg_in.tourist_id)
                        inc = db.get(Incident, msg_in.incident_id)
                        if not t or not inc or (inc.ticket_status or "").upper() != "ASSIGNED" or inc.tourist_id != msg_in.tourist_id:
                            await websocket.send_json({"type": "error", "detail": "Invalid responder_tourist thread"})
                            continue
                        tourist_id, incident_id, room_id = msg_in.tourist_id, msg_in.incident_id, None
                    elif msg_in.thread_type == "group_room" and msg_in.room_id and msg_in.tourist_id:
                        room = db.get(Room, msg_in.room_id)
                        if not room or not room.is_active:
                            await websocket.send_json({"type": "error", "detail": "Room not found"})
                            continue
                        member = db.query(RoomMember).filter(
                            RoomMember.room_id == msg_in.room_id,
                            RoomMember.tourist_id == msg_in.tourist_id,
                        ).first()
                        if not member:
                            await websocket.send_json({"type": "error", "detail": "Tourist is not a room member"})
                            continue
                        tourist_id, incident_id, room_id = msg_in.tourist_id, None, msg_in.room_id
                    else:
                        await websocket.send_json({"type": "error", "detail": "Invalid thread"})
                        continue
                    msg = Message(
                        thread_type=msg_in.thread_type,
                        tourist_id=tourist_id,
                        incident_id=incident_id,
                        room_id=room_id,
                        sender_role=msg_in.sender_role,
                        sender_id=msg_in.sender_id,
                        body=msg_in.body.strip() or "(empty)",
                    )
                    db.add(msg)
                    db.commit()
                    db.refresh(msg)
                    out = {
                        "id": msg.id,
                        "thread_type": msg.thread_type,
                        "tourist_id": msg.tourist_id,
                        "incident_id": msg.incident_id,
                        "room_id": msg.room_id,
                        "sender_role": msg.sender_role,
                        "sender_id": msg.sender_id,
                        "body": msg.body,
                        "created_at": to_ist(msg.created_at),
                    }
                    await chat_manager.broadcast_to_thread(msg_in.thread_type, tourist_id, incident_id, room_id, {"type": "new_message", "message": out})
                    await websocket.send_json({"type": "sent", "message": out})
                finally:
                    db.close()
    except WebSocketDisconnect:
        pass
    finally:
        chat_manager.disconnect(websocket)
        for call_id, call in list(active_calls.items()):
            if call.get("caller_ws") == websocket or call.get("callee_ws") == websocket:
                active_calls.pop(call_id, None)
                other = call.get("callee_ws") if call.get("caller_ws") == websocket else call.get("caller_ws")
                if other:
                    try:
                        await other.send_json({"type": "call_ended", "call_id": call_id})
                    except Exception:
                        pass


# ---------------- Navigation routing proxy (OSRM/Valhalla) ----------------

def _parse_latlng_pair(s: str):
    """Parse a 'lat,lng' string into floats."""
    try:
        parts = [p.strip() for p in str(s).split(",")]
        if len(parts) != 2:
            raise ValueError("expected lat,lng")
        lat = float(parts[0])
        lng = float(parts[1])
        return lat, lng
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coordinate format. Use 'lat,lng'.")


def _osrm_profile(profile: str) -> str:
    p = (profile or "").strip().lower()
    if p in ("car", "drive", "driving"):
        return "driving"
    if p in ("foot", "walk", "walking"):
        return "walking"
    if p in ("bike", "bicycle", "cycling"):
        return "cycling"
    raise HTTPException(status_code=400, detail="profile must be one of: car|foot|bike")


def _osrm_instruction(step: dict) -> str:
    """Minimal instruction generator from an OSRM step."""
    man = step.get("maneuver") or {}
    typ = (man.get("type") or "").replace("_", " ").strip()
    mod = (man.get("modifier") or "").replace("_", " ").strip()
    name = (step.get("name") or "").strip()

    parts = []
    if typ:
        parts.append(typ)
    if mod:
        parts.append(mod)
    if name:
        parts.append(f"onto {name}")
    return " ".join(parts).strip() or "Continue"


# ---------------- Geocoding proxy (Nominatim) ----------------

_GEOCODE_CACHE: Dict[str, Dict[str, Any]] = {}
_GEOCODE_TTL_SECONDS = 600


@app.get("/api/geocode")
def geocode(q: str, limit: int = 5):
    """
    Hackathon-friendly geocoding endpoint.

    - Proxies to OpenStreetMap Nominatim with an explicit User-Agent.
    - Returns a compact response: [{ display_name, lat, lng }]
    """
    query = (q or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="q is required")

    limit_n = max(1, min(int(limit or 5), 10))
    key = f"{query.lower()}|{limit_n}"

    now = time.time()
    cached = _GEOCODE_CACHE.get(key)
    if cached and (now - float(cached.get("ts", 0))) <= _GEOCODE_TTL_SECONDS:
        return cached.get("value", [])

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "json",
        "addressdetails": 0,
        "limit": str(limit_n),
    }
    headers = {
        # Nominatim requires a valid User-Agent per usage policy.
        "User-Agent": "GuardianID/0.1 (hackathon geocoder; contact: demo@localhost)",
        "Accept": "application/json",
    }

    try:
        r = requests.get(url, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Geocoding failed: {e}")

    out = []
    for item in (data or []):
        try:
            out.append(
                {
                    "display_name": item.get("display_name") or "-",
                    "lat": float(item.get("lat")),
                    "lng": float(item.get("lon")),
                }
            )
        except Exception:
            continue

    _GEOCODE_CACHE[key] = {"ts": now, "value": out}
    return out


@app.get("/api/route")
def route(profile: str = "foot", from_: str = Query("-", alias="from"), to: str = "-", engine: str = "osrm"):
    """
    Routing proxy for the frontend.

    Query params:
    - profile: car|foot|bike
    - from: 'lat,lng'
    - to: 'lat,lng'
    - engine: osrm|valhalla (default: osrm)
    """
    eng = (engine or os.getenv("ROUTING_ENGINE", "osrm")).strip().lower()
    lat1, lng1 = _parse_latlng_pair(from_)
    lat2, lng2 = _parse_latlng_pair(to)

    if eng == "valhalla":
        base = os.getenv("VALHALLA_BASE_URL", "").rstrip("/")
        if not base:
            raise HTTPException(status_code=500, detail="VALHALLA_BASE_URL is not configured")
        costing = "pedestrian" if profile.lower() in ("foot", "walk", "walking") else "auto"
        payload = {
            "locations": [{"lat": lat1, "lon": lng1}, {"lat": lat2, "lon": lng2}],
            "costing": costing,
            "directions_options": {"units": "kilometers"},
        }
        try:
            r = requests.post(f"{base}/route", json=payload, timeout=10)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Valhalla routing failed: {e}")
        return {"engine": "valhalla", "raw": data, "from": {"lat": lat1, "lng": lng1}, "to": {"lat": lat2, "lng": lng2}}

    if eng != "osrm":
        raise HTTPException(status_code=400, detail="engine must be one of: osrm|valhalla")

    base = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")
    prof = _osrm_profile(profile)
    path = (
        f"/route/v1/{prof}/"
        f"{lng1:.6f},{lat1:.6f};{lng2:.6f},{lat2:.6f}"
        f"?overview=full&geometries=geojson&steps=true"
    )
    url = f"{base}{path}"
    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": "GuardianID/0.1 (hackathon)"})
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.SSLError as e:
        # Hackathon-friendly fallback: if HTTPS handshake fails, retry via HTTP.
        # This commonly happens on some networks / older system SSL stacks.
        if base.startswith("https://"):
            http_base = "http://" + base[len("https://") :]
            try:
                r = requests.get(f"{http_base}{path}", timeout=10, headers={"User-Agent": "GuardianID/0.1 (hackathon)"})
                r.raise_for_status()
                data = r.json()
            except Exception as e2:
                raise HTTPException(status_code=502, detail=f"OSRM routing failed: {e2}")
        else:
            raise HTTPException(status_code=502, detail=f"OSRM routing failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OSRM routing failed: {e}")

    if data.get("code") != "Ok":
        raise HTTPException(status_code=502, detail=f"OSRM error: {data.get('message') or data.get('code')}")

    route0 = (data.get("routes") or [None])[0] or {}
    leg0 = ((route0.get("legs") or [None])[0]) or {}
    geom = route0.get("geometry") or {}

    coords = geom.get("coordinates") or []
    line = {"type": "LineString", "coordinates": coords}

    steps_out = []
    for st in (leg0.get("steps") or []):
        man = st.get("maneuver") or {}
        loc = man.get("location")
        steps_out.append(
            {
                "instruction": _osrm_instruction(st),
                "distance_m": float(st.get("distance") or 0.0),
                "duration_s": float(st.get("duration") or 0.0),
                "maneuverLatLng": {"lat": float(loc[1]), "lng": float(loc[0])} if loc else None,
            }
        )

    return {
        "engine": "osrm",
        "profile": prof,
        "from": {"lat": lat1, "lng": lng1},
        "to": {"lat": lat2, "lng": lng2},
        "line": line,
        "steps": steps_out,
        "distance_m": float(route0.get("distance") or 0.0),
        "duration_s": float(route0.get("duration") or 0.0),
    }


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs", "tourist_app": "/static/tourist.html", "dashboard": "/static/dashboard.html", "admin": "/static/admin.html"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)