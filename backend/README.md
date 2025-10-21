# GuardianID – eKYC + Geofence + Live GPS + Admin (Draw Zones)

Features:
- Tourist app: Register, QR ID, SOS, **eKYC**, **live GPS**, on-device **geofence** alerts.
- Dashboard: Live map with tourists + zones, alerts, incident logs (hashed).
- Admin: Draw polygons to define **RESTRICTED / DANGER / TERROR** zones and save to backend.
- Backend: FastAPI + SQLite + SQLAlchemy, mock console notifications on dwell exceed.

## Run
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Open:
- Tourist app: http://127.0.0.1:8000/static/tourist.html
- Dashboard:   http://127.0.0.1:8000/static/dashboard.html
- Admin:       http://127.0.0.1:8000/static/admin.html
- API docs:    http://127.0.0.1:8000/docs