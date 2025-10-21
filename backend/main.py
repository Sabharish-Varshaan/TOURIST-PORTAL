from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime,timedelta
from uuid import uuid4
import base64, io, hashlib, re, json as pyjson

from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, ForeignKey, Float, text as sql_text

from sqlalchemy.orm import sessionmaker, declarative_base, relationship

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

    incidents = relationship("Incident", back_populates="tourist")

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
    ticket_status = Column(String, default="NEW") # NEW | ASSIGNED | RESOLVED
    ticket_assignee = Column(String, nullable=True)

    tourist = relationship("Tourist", back_populates="incidents")


    tourist = relationship("Tourist", back_populates="incidents")

class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)            # e.g., "Tiger Reserve Edge"
    zone_type = Column(String, nullable=False)       # DANGER | RESTRICTED | TERROR
    dwell_minutes = Column(Integer, default=5)       # minutes before escalation
    geojson = Column(Text, nullable=False)           # Stored as JSON string (GeoJSON Polygon/MultiPolygon)

Base.metadata.create_all(engine)

# --- simple migration (adds columns if missing) ---
with engine.connect() as con:
    cols = [row[1] for row in con.execute(sql_text("PRAGMA table_info('tourists')")).fetchall()]
    for needed in [("last_lat","TEXT"), ("last_lng","TEXT")]:
        if needed[0] not in cols:
            con.execute(sql_text(f"ALTER TABLE tourists ADD COLUMN {needed[0]} {needed[1]} DEFAULT '-'"))

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

class RegisterOut(BaseModel):
    tourist_id: str
    qr_png_base64: str

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

# ---------------- Helpers ----------------
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
    db = SessionLocal()
    try:
        tid = str(uuid4())
        qr_b64 = make_qr_base64(tid)
        t = Tourist(
            id=tid, name=payload.name.strip(), phone=payload.phone.strip(),
            emergency_contact=payload.emergency_contact.strip(), qr_png_b64=qr_b64,
        )
        db.add(t); db.commit()
        return RegisterOut(tourist_id=tid, qr_png_base64=qr_b64)
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

@app.get("/api/substations")
def get_substations():
    """Returns the list of available substations to assign tickets to."""
    return POLICE_SUBSTATIONS

@app.post("/api/incidents/{incident_id}/assign")
def assign_ticket(incident_id: int, payload: AssignTicketIn):
    """Assigns an incident ticket to a specific unit."""
    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        incident.ticket_status = "ASSIGNED"
        incident.ticket_assignee = f"{payload.assignee_name} ({payload.assignee_id})"
        db.commit()
        return {"ok": True, "incident_id": incident.id, "status": incident.ticket_status}
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

# In main.py, add this new endpoint

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
            })
        return out
    finally:
        db.close()



@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs", "tourist_app": "/static/tourist.html", "dashboard": "/static/dashboard.html", "admin": "/static/admin.html"}