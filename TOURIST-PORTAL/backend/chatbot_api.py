# Enhanced Tourist Chatbot with Conversation Memory and Context Awareness
import os
import re
import uuid
import asyncio
import json
import requests
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from urllib.parse import urlencode, quote_plus
from dotenv import load_dotenv, dotenv_values
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

# Load .env from backend directory - use dotenv_values for direct file read (avoids cwd issues)
_env_path = Path(__file__).resolve().parent / ".env"
_env_vars = dotenv_values(_env_path) if _env_path.exists() else {}
if _env_vars:
    for k, v in _env_vars.items():
        if v is not None:
            os.environ[k] = v
else:
    load_dotenv(_env_path, override=True)

# ------------------ Configuration ------------------
GROQ_API_KEY = (_env_vars.get("GROQ_API_KEY") or os.getenv("GROQ_API_KEY") or "").strip()
OPENWEATHER_API_KEY = (_env_vars.get("OPENWEATHER_API_KEY") or os.getenv("OPENWEATHER_API_KEY") or "").strip()

chatbot_router = APIRouter()

# ------------------ Session Management ------------------
class ChatSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.messages: List[Dict[str, str]] = []
        self.user_context: Dict[str, Any] = {}
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
    
    def add_message(self, role: str, content: str, metadata: Dict = None):
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        })
        self.last_activity = datetime.now()
    
    def get_recent_messages(self, limit: int = 10) -> List[Dict[str, str]]:
        """Get recent messages for context"""
        return self.messages[-limit:]
    
    def update_context(self, key: str, value: Any):
        """Update user context (preferences, current trip details, etc.)"""
        self.user_context[key] = value

# In-memory session storage (use Redis in production)
sessions: Dict[str, ChatSession] = {}

def cleanup_old_sessions():
    """Remove sessions older than 24 hours"""
    cutoff = datetime.now() - timedelta(hours=24)
    to_remove = [
        sid for sid, session in sessions.items() 
        if session.last_activity < cutoff
    ]
    for sid in to_remove:
        del sessions[sid]

def get_or_create_session(session_id: str = None) -> ChatSession:
    """Get existing session or create new one"""
    cleanup_old_sessions()
    
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if session_id not in sessions:
        sessions[session_id] = ChatSession(session_id)
    
    return sessions[session_id]

# ------------------ Data Models ------------------
class Stop(BaseModel):
    name: str
    lat: Optional[float] = None
    lon: Optional[float] = None

class ItineraryReq(BaseModel):
    itinerary_text: Optional[str] = None
    stops: Optional[List[Stop]] = None
    travel_mode: Optional[str] = "driving"  # driving | walking | transit
    city_hint: Optional[str] = None  # used for weather/history bias
    date_iso: Optional[str] = None
    language: Optional[str] = "en"

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    location: Optional[str] = None
    user_preferences: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    suggestions: List[str] = []
    context_data: Optional[Dict[str, Any]] = None

# (in app.py)
# Add this new function to detect the user's intent.

# (in app.py)
# REPLACE your old detect_intent function with this one.

def detect_intent(message: str) -> str:
    """
    Analyzes the user's message to determine their intent.
    Now smarter at detecting multi-day plans.
    """
    msg_lower = message.lower().strip()
    
    # Intent 1: Simple Greeting
    if msg_lower in ["hi", "hello", "hey", "hola"]:
        return "greeting"
        
    # Intent 2: Itinerary Planning
    # Check for keywords, separators, multiple lines, or "Day X" format.
    itinerary_keywords = ["plan for", "trip to", "itinerary for", "visit"]
    itinerary_separators = ["->", ";", "\n"]
    
    # ✨ NEW: Check for "day 1", "day 2", etc. This is a strong signal.
    if re.search(r'day\s*\d+', msg_lower):
        return "itinerary_plan"
        
    if any(sep in msg_lower for sep in itinerary_separators):
        return "itinerary_plan"
    
    if any(keyword in msg_lower for keyword in itinerary_keywords):
        return "itinerary_plan"
        
    # Default Intent: General Conversation
    return "general_query"
# ------------------ Itinerary helpers ------------------
# (in app.py)
# REPLACE your old parse_itinerary_text function with this one.

def parse_itinerary_text(txt: str) -> List[str]:
    """
    An advanced parser to extract place names from complex, multi-day itineraries.
    """
    if not txt:
        return []
    
    # 1. Standardize text to lowercase for easier processing.
    text = txt.lower()
    
    # 2. Remove clutter and introductory phrases.
    text = re.sub(r'itinerary for day \d+', '', text)
    text = re.sub(r'day \d+:?', '', text) # Removes "day 1", "day 2:", etc.
    text = re.sub(r'\b(jeep safari|orchid & biodiversity park|river cruise|boating)\b', '', text) # Remove common activity names
    
    # 3. Standardize all possible separators (->, ;, newline, hyphen) to a single one: '|'
    text = re.sub(r'\s*[-–—;]\s*|\s*->\s*|\n', '|', text)
    
    # 4. Split the text into a list of places.
    parts = text.split('|')
    
    # 5. Clean up each place name and remove duplicates.
    cleaned_places = []
    seen = set()
    for p in parts:
        # Capitalize each word for a nice, clean output
        place_name = p.strip().title()
        if place_name and place_name.lower() not in seen:
            cleaned_places.append(place_name)
            seen.add(place_name.lower())
            
    return cleaned_places


def make_share_directions_link(stops: List[str], mode: str = "driving") -> Optional[str]:
    """
    Keyless share URL (not an API call). Delete usage if you want zero Google links.
    """
    if len(stops) < 2:
        return None
    origin, destination, waypoints = stops[0], stops[-1], stops[1:-1]
    params = {"api": 1, "origin": origin, "destination": destination, "travelmode": mode}
    if waypoints:
        params["waypoints"] = "|".join(waypoints)
    return "https://www.google.com/maps/dir/?" + urlencode(params)

# ------------------ Weather (OpenWeather: current + short forecast) ------------------
def get_openweather_current(city_or_latlon: str) -> Optional[Dict[str, Any]]:
    if not OPENWEATHER_API_KEY:
        return None
    base = "https://api.openweathermap.org/data/2.5/weather"
    params = {"appid": OPENWEATHER_API_KEY, "units": "metric"}
    if "," in city_or_latlon:
        lat, lon = [x.strip() for x in city_or_latlon.split(",", 1)]
        params["lat"] = lat; params["lon"] = lon
    else:
        params["q"] = city_or_latlon
    try:
        return requests.get(base, params=params, timeout=12).json()
    except Exception:
        return None

def get_openweather_forecast3h(city_or_latlon: str) -> Optional[Dict[str, Any]]:
    if not OPENWEATHER_API_KEY:
        return None
    base = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"appid": OPENWEATHER_API_KEY, "units": "metric", "cnt": 8}  # next ~24h
    if "," in city_or_latlon:
        lat, lon = [x.strip() for x in city_or_latlon.split(",", 1)]
        params["lat"] = lat; params["lon"] = lon
    else:
        params["q"] = city_or_latlon
    try:
        return requests.get(base, params=params, timeout=12).json()
    except Exception:
        return None

def gather_weather(stops: List[str], city_hint: Optional[str]) -> Dict[str, Any]:
    candidates = [city_hint] if city_hint else []
    candidates += stops
    current = None; forecast_list = []
    for c in candidates:
        if not c: continue
        cur = get_openweather_current(c)
        if cur and cur.get("cod") == 200:
            current = {
                "place": cur.get("name"),
                "temp_C": cur.get("main",{}).get("temp"),
                "conditions": (cur.get("weather") or [{}])[0].get("description")
            }
            fc = get_openweather_forecast3h(c)
            if fc and str(fc.get("cod")) == "200":
                for item in (fc.get("list") or [])[:4]:  # next ~12h
                    ts = item.get("dt", 0)
                    temp = item.get("main",{}).get("temp")
                    cond = (item.get("weather") or [{}])[0].get("description")
                    forecast_list.append({
                        "time": datetime.utcfromtimestamp(ts).isoformat() + "Z",
                        "temp_C": temp,
                        "summary": cond
                    })
            break
    return {"current": current, "forecast": forecast_list}

# (in app.py)
# Replace your existing gather_weather_for_stops function with this one.

def gather_weather_for_stops(stops: list[str]) -> dict:
    """
    Fetches weather by first geocoding landmarks to coordinates, 
    then getting weather for those coordinates.
    """
    weather_by_place = {}
    coords_by_place = {}
    unique_stops = list(dict.fromkeys(s.strip() for s in stops if s.strip()))

    # Step 1: Geocode all stops in parallel to get their latitude and longitude.
    print("Geocoding stops to find coordinates...")
    with ThreadPoolExecutor(max_workers=len(unique_stops)) as executor:
        future_to_stop = {executor.submit(nominatim_geocode, stop): stop for stop in unique_stops}
        for future in as_completed(future_to_stop):
            stop = future_to_stop[future]
            try:
                geo_info = future.result()
                if geo_info and 'lat' in geo_info and 'lon' in geo_info:
                    coords_by_place[stop] = f"{geo_info['lat']},{geo_info['lon']}"
                    print(f"Found coordinates for {stop}: {coords_by_place[stop]}")
            except Exception as e:
                print(f"Error geocoding {stop}: {e}")

    # Step 2: Fetch weather for the found coordinates in parallel.
    print("Fetching weather for coordinates...")
    if coords_by_place:
        with ThreadPoolExecutor(max_workers=len(coords_by_place)) as executor:
            future_to_stop = {executor.submit(get_openweather_current, latlon): stop for stop, latlon in coords_by_place.items()}
            for future in as_completed(future_to_stop):
                stop = future_to_stop[future]
                try:
                    current_weather = future.result()
                    if current_weather and current_weather.get("cod") == 200:
                        weather_by_place[stop] = {
                            "place": current_weather.get("name"),
                            "temp_C": current_weather.get("main", {}).get("temp"),
                            "conditions": (current_weather.get("weather") or [{}])[0].get("description")
                        }
                        print(f"Successfully fetched weather for {stop}")
                except Exception as e:
                    print(f"Error fetching weather for {stop}: {e}")
            
    return weather_by_place

# ------------------ History: Wikipedia + Wikivoyage + Wikidata + Nominatim + GeoSearch + DDG ------------------
def clean_place_title(title: str) -> str:
    t = re.sub(r"\\s*\\([^)]*\\)", "", title)  # remove (…)
    t = re.sub(r"\\s*,\\s*[^,]+$", "", t.strip())  # drop trailing ", City/State"
    return t.strip()

# A) Wikipedia REST summary
# (in app.py)
def wiki_rest_summary(title: str, lang: str) -> Optional[str]:
    safe = quote_plus(title)
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{safe}"
    try:
        # Increased timeout to 20 seconds
        j = requests.get(url, timeout=20, headers={"User-Agent": "SIH-Demo/1.0"}).json()
        if j.get("extract"):
            return j["extract"][:500]
    except Exception as e:
        # Added logging to show the actual error
        print(f"ERROR in wiki_rest_summary for '{title}': {e}")
    return None

# (in app.py)
def wiki_search_best_summary(title: str, lang: str) -> Optional[str]:
    try:
        url = f"https://{lang}.wikipedia.org/w/api.php"
        q = {"action": "query", "list": "search", "srsearch": title, "srlimit": 1, "format": "json"}
        # Increased timeout and added User-Agent
        j = requests.get(url, params=q, timeout=20, headers={"User-Agent": "SIH-Demo/1.0"}).json()
        hits = (j.get("query") or {}).get("search") or []
        if hits:
            best = hits[0].get("title")
            if best:
                # This function calls the one above, which now has better error handling
                return wiki_rest_summary(best, lang)
    except Exception as e:
        # Added logging to show the actual error
        print(f"ERROR in wiki_search_best_summary for '{title}': {e}")
    return None


# C) Wikivoyage summary
def wikivoyage_summary(title: str, lang: str) -> Optional[str]:
    safe = quote_plus(title)
    url = f"https://{lang}.wikivoyage.org/api/rest_v1/page/summary/{safe}"
    try:
        j = requests.get(url, timeout=10).json()
        if j.get("extract"):
            return j["extract"][:500]
    except Exception:
        pass
    return None

# D) Wikidata (short description)
def wikidata_short_description_from_title(title: str, lang: str = "en") -> Optional[str]:
    try:
        # 1) Wikipedia → QID
        url1 = "https://en.wikipedia.org/w/api.php"
        p1 = {"action": "query", "prop": "pageprops", "titles": title, "format": "json"}
        j1 = requests.get(url1, params=p1, timeout=10).json()
        pages = (j1.get("query") or {}).get("pages") or {}
        qid = None
        for _, pg in pages.items():
            qid = (pg.get("pageprops") or {}).get("wikibase_item")
            if qid: break
        if not qid: return None
        
        # 2) Wikidata entity
        url2 = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
        j2 = requests.get(url2, timeout=10).json()
        ent = (j2.get("entities") or {}).get(qid) or {}
        desc = ((ent.get("descriptions") or {}).get(lang) or {}).get("value")
        if desc:
            return desc[:300]
    except Exception:
        pass
    return None

# (in app.py)
# Replace your existing nominatim_wikipedia_summary function with this one.

def nominatim_wikipedia_summary(query: str, city_hint: Optional[str], lang: str = "en") -> Optional[str]:
    try:
        base = "https://nominatim.openstreetmap.org/search"
        q = query if not city_hint else f"{query} {city_hint}"
        params = {"q": q, "format": "json", "limit": 1, "addressdetails": 1, "extratags": 1}
        j = requests.get(base, params=params, headers={"User-Agent": "SIH-Demo/1.0"}, timeout=20).json()
        if not j:
            return None
        
        extratags = j[0].get("extratags") or {}
        wp = extratags.get("wikipedia")
        if not wp:
            return None
        
        # --- CORRECTED LOGIC ---
        # The OSM tag can be "hi:ताजमहल". We only want the article title, not the language prefix.
        wp_title = wp.split(":", 1)[-1]
        
        # We will ALWAYS use the 'lang' parameter ("en") passed into this function,
        # ensuring the result is strictly in the requested language.
        return wiki_rest_summary(wp_title, lang) or wikivoyage_summary(wp_title, lang)

    except Exception as e:
        print(f"ERROR in nominatim_wikipedia_summary for '{query}': {e}")
        return None

# NEW: Nominatim geocode → coordinates
def nominatim_geocode(place: str, city_hint: Optional[str] = None) -> Optional[dict]:
    try:
        q = place if not city_hint else f"{place} {city_hint}"
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": q, "format": "json", "limit": 1, "addressdetails": 1, "extratags": 1}
        j = requests.get(url, params=params, timeout=12,
                        headers={"User-Agent": "SIH-Demo/1.0"}).json()
        if not j:
            return None
        item = j[0]
        return {
            "lat": float(item.get("lat")), "lon": float(item.get("lon")),
            "extratags": item.get("extratags", {})
        }
    except Exception:
        return None

# NEW: Wikipedia GeoSearch near lat/lon → pick nearest article
def wiki_geosearch_summary(lat: float, lon: float, lang: str = "en", radius_m: int = 12000) -> Optional[str]:
    try:
        url = f"https://{lang}.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "geosearch",
            "gscoord": f"{lat}|{lon}",
            "gsradius": radius_m,
            "gslimit": 10,
            "format": "json"
        }
        j = requests.get(url, params=params, timeout=10).json()
        hits = (j.get("query") or {}).get("geosearch") or []
        if not hits:
            return None
        best_title = hits[0].get("title")
        if not best_title:
            return None
        return wiki_rest_summary(best_title, lang)
    except Exception:
        return None

def wiki_get_page_info(title: str, lang: str = "en") -> Optional[str]:
    """Direct Wikipedia API call to get page information"""
    try:
        # First, search for the page
        search_url = f"https://{lang}.wikipedia.org/w/api.php"
        search_params = {
            "action": "query",
            "list": "search",
            "srsearch": title,
            "format": "json",
            "srlimit": 1
        }
        
        search_response = requests.get(search_url, params=search_params, timeout=10)
        search_data = search_response.json()
        
        if not search_data.get("query", {}).get("search"):
            return None
            
        # Get the actual page content
        page_url = f"https://{lang}.wikipedia.org/w/api.php"
        page_params = {
            "action": "query",
            "prop": "extracts",
            "exintro": True,
            "titles": search_data["query"]["search"][0]["title"],
            "format": "json",
            "explaintext": True
        }
        
        page_response = requests.get(page_url, params=page_params, timeout=10)
        page_data = page_response.json()
        
        # Extract the page content
        pages = page_data.get("query", {}).get("pages", {})
        page_content = next(iter(pages.values()))
        
        if "extract" in page_content:
            return page_content["extract"][:500]  # Limit to 500 characters
            
        return None
        
    except Exception as e:
        print(f"Wikipedia API error: {e}")
        return None


# NEW: Wikidata sitelink via QID (if Nominatim returns 'wikidata')
def wikidata_sitelink_summary(qid: str, lang: str = "en") -> Optional[str]:
    try:
        data = requests.get(
            f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json",
            timeout=10
        ).json()
        ent = (data.get("entities") or {}).get(qid) or {}
        sitelinks = ent.get("sitelinks") or {}
        key_lang = f"{lang}wiki"
        page = (sitelinks.get(key_lang) or sitelinks.get("enwiki") or {}).get("title")
        if page:
            return wiki_rest_summary(page, lang if key_lang in sitelinks else "en")
    except Exception:
        pass
    return None

# F) DuckDuckGo Instant Answer (no key) — last resort
def ddg_instant_answer_summary(q: str) -> Optional[str]:
    try:
        url = "https://api.duckduckgo.com/"
        params = {"q": q, "format": "json", "no_html": 1, "no_redirect": 1}
        j = requests.get(url, params=params, timeout=8,
                        headers={"User-Agent": "SIH-Demo/1.0"}).json()
        abstract = (j.get("AbstractText") or "").strip()
        if abstract:
            return abstract[:500]
        heading = (j.get("Heading") or "").strip()
        if heading and (j.get("Abstract") or "").strip():
            return f"{heading}: {(j.get('Abstract') or '').strip()[:480]}"
    except Exception:
        pass
    return None

def _try(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception:
        return None

# (in app.py)
# Replace your existing get_place_history_auto function with this one.

def get_place_history_auto(title: str,
                           city_hint: Optional[str] = None,
                           langs: list[str] = ["en"]) -> Optional[str]:
    """
    Get place history with a final, powerful search engine fallback.
    """
    
    clean_title = clean_place_title(title)
    
    # --- Waterfall Method ---
    # Steps 1 & 2: Try direct Wikipedia and Wikipedia Search
    for lang in langs:
        if summary := wiki_rest_summary(clean_title, lang):
            return summary
        if summary := wiki_search_best_summary(clean_title, lang):
            return summary

    # Step 3: Try location-based search via Nominatim (with and without city hint)
    if summary := nominatim_wikipedia_summary(clean_title, city_hint):
        return summary
    if summary := nominatim_wikipedia_summary(clean_title, None):
        return summary

    # Step 4: Try location-based search via coordinates
    geo_coords = nominatim_geocode(clean_title, city_hint) or nominatim_geocode(clean_title, None)
    if geo_coords:
        for lang in langs:
            if summary := wiki_geosearch_summary(geo_coords['lat'], geo_coords['lon'], lang):
                return summary

    # FINAL FIX: Step 5 - Use DuckDuckGo as a last resort.
    # This is excellent at finding popular places with ambiguous names.
    if summary := ddg_instant_answer_summary(clean_title):
        return summary

    # Fallback message if all methods fail
    return f"{title} is a notable tourist destination. While detailed information is currently unavailable, it's recommended to consult local tourism resources or guides for accurate historical and cultural details."
    
    
    # ------------------ Place classification + best-time windows ------------------
def classify_place_type(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ["fort","citadel","bastion","palace"]): return "heritage_fort"
    if any(k in n for k in ["temple","mandir","dargah","monastery","shrine","church","mosque"]): return "religious_site"
    if any(k in n for k in ["museum","gallery","memorial","hall of fame"]): return "museum"
    if any(k in n for k in ["park","national park","sanctuary","wildlife","forest","zoo","garden"]): return "park_nature"
    if any(k in n for k in ["beach","lake","river","waterfall","dam","ghat","island","cave"]): return "waterfront_or_cave"
    if any(k in n for k in ["market","bazaar","bazar"]): return "market"
    return "general_sight"

def best_time_window(place_type: str, mode: str, wx_current: Optional[dict], wx_forecast: List[dict]) -> str:
    m = (mode or "driving").lower()
    main_now = (wx_current or {}).get("conditions","").lower() if wx_current else ""
    rainy_now = any(k in main_now for k in ["rain","drizzle","thunder"])
    hazy_now  = any(k in main_now for k in ["haze","smoke"])
    rainy_soon = any(any(k in (f.get("summary","").lower()) for k in ["rain","drizzle","thunder"]) for f in wx_forecast[:4])

    if place_type in ("heritage_fort","park_nature","waterfront_or_cave","general_sight"):
        if rainy_now or rainy_soon:
            window = "late morning (10–12 if showers ease) or shift to a clearer slot"
        elif hazy_now:
            window = "early morning (7–9) for better visibility; late afternoon (16–18) as second choice"
        else:
            window = "early morning (7–10) or late afternoon (16–18)"
    elif place_type == "religious_site":
        window = "early morning (6–9) or early evening (17–19)"
        if rainy_now or rainy_soon:
            window += "; carry light rainwear"
    elif place_type == "museum":
        window = "mid-day (12–15) — ideal for indoor time if it’s hot/rainy"
    elif place_type == "market":
        window = "evening (17–20) for ambience; go before dusk if you prefer lighter crowds"
    else:
        window = "morning (8–11) or late afternoon (16–18)"

    if m in ("walking","transit"):
        window += "; avoid late night if unfamiliar with the area"
    return window

# ------------------ Parallel per-place builder ------------------
# (in app.py)
# Replace the entire build_place_details_parallel function with this corrected version.

# (in app.py)
# Replace the entire build_place_details_parallel function with this corrected version.

def build_place_details_parallel(stops: list[str],
                                lang_primary: str,
                                mode: str,
                                wx_bundle: Dict[str, Any],
                                city_hint: Optional[str]) -> list[dict]:
    details = []
    wx_current = wx_bundle.get("current")
    wx_forecast = wx_bundle.get("forecast", [])
    resolved_city = (wx_current or {}).get("place") or city_hint
    
    # parallel fetch of histories (multi-source, no Google)
    results: Dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=min(8, max(2, len(stops)))) as ex:
        fut_map = {
            # CORRECTED LINE: This now correctly passes ONLY the primary language.
            ex.submit(get_place_history_auto, s, resolved_city, [lang_primary]): s
            for s in stops
        }
        for fut in as_completed(fut_map):
            s = fut_map[fut]
            try:
                results[s] = (fut.result() or "Summary not found; consider local signage/guide notes.")
            except Exception:
                results[s] = "Summary not found; consider local signage/guide notes."
    
    for s in stops:
        ptype = classify_place_type(s)
        best = best_time_window(ptype, mode, wx_current, wx_forecast)
        details.append({"place": s, "type": ptype, "best_time": best, "history": results.get(s)})
    
    return details

# ------------------ Tips (no numeric crime index exposed) ------------------
def tips_from_mode(mode: str) -> list[str]:
    m = (mode or "driving").lower()
    if m == "walking":
        return [
            "Prefer well-lit, busier streets after dusk; avoid isolated shortcuts.",
            "Use pedestrian crossings; long arterials aren't walk-friendly end-to-end.",
            "Wear comfortable footwear and keep a power bank for maps."
        ]
    if m == "transit":
        return [
            "Check last train/bus timings for your return; keep a backup cab plan.",
            "Keep small change/UPI handy for quick tickets.",
            "Avoid overcrowded coaches with large bags; step aside to plan transfers."
        ]
    return [
        "Budget time for parking near monuments; use official lots.",
        "Avoid peak-hour cross-town drives—cluster nearby sights together.",
        "Save the route link so you can re-navigate quickly after detours."
    ]

def tips_from_weather_bundle(wx_bundle: Dict[str, Any]) -> list[str]:
    out = []
    c = wx_bundle.get("current")
    if not c:
        return out
    main = (c.get("conditions") or "").lower()
    if "rain" in main or "drizzle" in main:
        out.append("Carry a compact rain jacket; add 10–15 minutes buffer for outdoor hops.")
    if "thunder" in main:
        out.append("Avoid waterfronts/open viewpoints during lightning; pick indoor sights first.")
    if "haze" in main or "smoke" in main:
        out.append("If sensitive to air quality, prefer indoor attractions mid-day; keep a mask handy.")
    if "clear" in main:
        out.append("Great for viewpoints—schedule outdoor stops earlier and museums later.")
    return out

def tips_from_places(stops: list[str]) -> list[str]:
    out = []
    txt = " ".join([s.lower() for s in stops])
    if any(k in txt for k in ["fort","citadel","bastion"]):
        out.append("Large forts mean long walks—carry water; best photos at golden hour.")
    if any(k in txt for k in ["park","national park","sanctuary","wildlife","forest"]):
        out.append("Follow trail markers; don't feed wildlife; drones usually need permits.")
    if any(k in txt for k in ["temple","mandir","dargah","monastery","shrine","church","mosque"]):
        out.append("Dress modestly; remove footwear where required; photography may be limited inside.")
    if any(k in txt for k in ["museum","gallery","memorial"]):
        out.append("Ticket queues vary—check counters/UPI; lockers may be needed for large bags.")
    if any(k in txt for k in ["beach","lake","river","waterfall","dam","ghat","island","cave"]):
        out.append("Respect safety flags/advisories near water; avoid slippery edges after rain.")
    return out

def personalize_recommendations(stops: list[str], mode: str, wx_bundle: Dict[str, Any]) -> list[str]:
    tips = []
    c = wx_bundle.get("current")
    if c:
        tips.append(f"Plan outdoor stops in the cooler slot; current weather near {c['place']} is {c['temp_C']}°C with {c['conditions']}.")
    tips += tips_from_mode(mode)
    tips += tips_from_weather_bundle(wx_bundle)
    tips += tips_from_places(stops)
    
    # de-duplicate & cap
    seen = set(); uniq = []
    for t in tips:
        k = t.lower()
        if k not in seen:
            uniq.append(t); seen.add(k)
    return uniq[:8]

# ------------------ Bad-weather alternatives (wiki search) ------------------
def wiki_search_places(city: str, query: str, lang: str = "en", limit: int = 3) -> list[str]:
    try:
        url = f"https://{lang}.wikipedia.org/w/api.php"
        params = {"action": "query", "list": "search", "srsearch": f"{query} in {city}", "srlimit": limit, "format": "json"}
        j = requests.get(url, params=params, timeout=10).json()
        hits = (j.get("query") or {}).get("search") or []
        return [h.get("title") for h in hits if h.get("title")]
    except Exception:
        return []

def suggest_bad_weather_alternatives(city_hint: Optional[str], stops: list[str], wx_bundle: dict, lang: str = "en") -> list[str]:
    current = (wx_bundle or {}).get("current") or {}
    forecast = (wx_bundle or {}).get("forecast") or []
    main = (current.get("conditions") or "").lower()
    rainy_now = any(k in main for k in ["rain", "drizzle", "thunder"])
    rainy_soon = any(any(k in (f.get("summary","").lower()) for k in ["rain","drizzle","thunder"]) for f in forecast[:4])
    
    if not (rainy_now or rainy_soon):
        return []
    
    city = (city_hint or (current.get("place") or "").strip() or (stops[0] if stops else "")).strip()
    if not city:
        return [
            "Shift outdoor sights after showers; do a nearby museum/gallery first.",
            "Pick an indoor market/food court; carry a compact rain jacket.",
            "Temple/monastery visits work well in light rain (mind footwear/queues)."
        ]
    
    buckets = [
        f"museums in {city}", f"art galleries in {city}",
        f"indoor attractions in {city}", f"shopping malls in {city}",
        f"temples in {city}", f"science centres in {city}"
    ]
    
    seen = set(); alts = []
    for q in buckets:
        for t in wiki_search_places(city, q, lang=lang, limit=2):
            k = t.lower()
            if k not in seen:
                seen.add(k); alts.append(t)
            if len(alts) >= 6:
                break
        if len(alts) >= 6:
            break
    
    if not alts:
        return [
            f"Swap to a museum or covered market in {city}; revisit outdoor stops when rain eases.",
            "Pick an indoor heritage/memorial or a science center until the weather clears."
        ]
    
    return alts[:6]

# (in app.py)
# Replace the existing chat_with_groq function

async def chat_with_groq(messages: List[Dict], system_prompt: str, temperature: float = 0.7) -> str:
    """Enhanced Groq API call for conversations"""
    if not GROQ_API_KEY:
        return "I'm sorry, but I'm not properly configured to respond right now."
    
    try:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        formatted_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            formatted_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        payload = {
            "model": "llama-3.1-8b-instant",  # <-- UPDATED MODEL
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": 1000,
            "stream": False
        }
        
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result["choices"][0]["message"]["content"]
        else:
            error_details = response.text
            print(f"Groq API Error: {error_details}") # Added for better debugging
            return f"I apologize, but I'm having trouble processing your request right now. (Error: {response.status_code})"
            
    except Exception as e:
        print(f"Exception in chat_with_groq: {e}") # Added for better debugging
        return "I'm experiencing some technical difficulties. Please try again in a moment."

# (in app.py)
# Replace the existing stream_chat_with_groq function

async def stream_chat_with_groq(messages: List[Dict], system_prompt: str):
    """Stream responses from Groq API"""
    if not GROQ_API_KEY:
        yield "I'm sorry, but I'm not properly configured to respond right now."
        return
    
    try:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        formatted_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            formatted_messages.append({"role": msg["role"], "content": msg["content"]})
        
        payload = {
            "model": "llama-3.1-8b-instant",  # <-- UPDATED MODEL
            "messages": formatted_messages,
            "temperature": 0.7,
            "max_tokens": 1000,
            "stream": True
        }
        
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30,
            stream=True
        )
        
        if response.status_code == 200:
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data = line[6:]
                        if data.strip() == '[DONE]':
                            break
                        try:
                            json_data = json.loads(data)
                            if 'choices' in json_data:
                                delta = json_data['choices'][0].get('delta', {})
                                if 'content' in delta:
                                    yield delta['content']
                        except json.JSONDecodeError:
                            continue
        else:
            yield f"I apologize, but I'm having trouble processing your request right now."
            
    except Exception as e:
        yield "I'm experiencing some technical difficulties. Please try again in a moment."

# Context-Aware Response Generation
def extract_travel_context(message: str, session: ChatSession) -> Dict[str, Any]:
    """Extract travel-related context from user message and session"""
    context = {
        "locations_mentioned": [],
        "travel_intent": None,
        "time_references": [],
        "preferences": session.user_context.get("preferences", {})
    }
    
    # Simple keyword extraction (you can enhance this with NLP)
    message_lower = message.lower()
    
    # Travel intents
    if any(word in message_lower for word in ["plan", "trip", "travel", "visit", "go to"]):
        context["travel_intent"] = "planning"
    elif any(word in message_lower for word in ["weather", "temperature", "rain", "sunny"]):
        context["travel_intent"] = "weather_inquiry"
    elif any(word in message_lower for word in ["hotel", "stay", "accommodation", "book"]):
        context["travel_intent"] = "accommodation"
    elif any(word in message_lower for word in ["food", "restaurant", "eat", "cuisine"]):
        context["travel_intent"] = "dining"
    
    return context

def build_system_prompt(session: ChatSession, travel_context: Dict[str, Any]) -> str:
    """Build dynamic system prompt based on context"""
    
    base_prompt = """You are TravelBuddy, an intelligent and friendly tourist assistant chatbot. You help travelers plan trips, get local information, weather updates, and travel advice.

Key capabilities:
- Provide detailed travel information and recommendations
- Give weather updates and travel advisories  
- Suggest itineraries and local attractions
- Answer questions about places, culture, and logistics
- Remember conversation context and user preferences

Personality: Helpful, enthusiastic about travel, knowledgeable, and conversational. Use emojis occasionally to be friendly.

Guidelines:
- Always be helpful and accurate
- If you don't know something, admit it and suggest alternatives
- Ask clarifying questions when needed
- Remember what the user has told you in this conversation
- Provide practical, actionable advice"""

    # Add session context if available
    if session.user_context:
        context_info = []
        if "current_location" in session.user_context:
            context_info.append(f"User's current/mentioned location: {session.user_context['current_location']}")
        if "travel_dates" in session.user_context:
            context_info.append(f"Travel dates: {session.user_context['travel_dates']}")
        if "preferences" in session.user_context:
            prefs = session.user_context["preferences"]
            if prefs:
                context_info.append(f"User preferences: {prefs}")
        
        if context_info:
            base_prompt += f"\\n\\nContext from conversation:\\n" + "\\n".join(context_info)
    
    # Add recent conversation context
    recent_messages = session.get_recent_messages(5)
    if recent_messages:
        base_prompt += f"\\n\\nRecent conversation context: The user has been discussing travel topics. Refer to previous messages when relevant."
    
    return base_prompt

async def generate_enhanced_response(message: str, session: ChatSession) -> Dict[str, Any]:
    """Generate context-aware response with travel data integration"""

    # Extract context from message
    travel_context = extract_travel_context(message, session)

    # Build system prompt
    system_prompt = build_system_prompt(session, travel_context)

    # Prepare messages for Groq
    recent_messages = session.get_recent_messages(8)

    # Add current user message
    current_messages = recent_messages + [{"role": "user", "content": message}]

    # Get AI response  ✅ pass current_messages here
    ai_response = await chat_with_groq(current_messages, system_prompt)

    # Suggestions (unchanged)
    suggestions = []
    if travel_context["travel_intent"] == "planning":
        suggestions = [
            "What's the weather like there? ☀️",
            "Tell me about local attractions 🏛️",
            "What's the best time to visit? 🕐",
            "Any local food recommendations? 🍜"
        ]
    elif travel_context["travel_intent"] == "weather_inquiry":
        suggestions = [
            "What should I pack for this weather? 🎒",
            "Are there indoor alternatives? 🏢",
            "What's the forecast for next few days? 📅"
        ]
    else:
        suggestions = [
            "Can you help me plan an itinerary? 🗺️",
            "What's the weather forecast? 🌤️",
            "Tell me about local attractions 🎯",
            "Any travel tips? 💡"
        ]

    return {
        "response": ai_response,
        "suggestions": suggestions[:3],
        "context_data": travel_context
    }

# (in app.py)
# Replace the existing rewrite_with_groq function

def rewrite_with_groq(block: str) -> str:
    if not GROQ_API_KEY:
        return block
    try:
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "llama-3.1-8b-instant",  # <-- UPDATED MODEL
            "temperature": 0.6,
            "messages": [
                {"role": "system",
                 "content": "Rewrite this travel advice for clarity and a friendly, conversational tone. Keep names/links unchanged. Be concise; use bullets where natural."},
                {"role": "user",
                 "content": "Rewrite this for a chat reply (no hallucinations):\\n\\n" + block}
            ]
        }
        j = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=15).json()
        alt = (j.get("choices") or [{}])[0].get("message", {}).get("content")
        return alt.strip() if alt else block
    except Exception as e:
        print(f"Exception in rewrite_with_groq: {e}") # Added for better debugging
        return block

# ------------------ Enhanced API Endpoints ------------------

@chatbot_router.get("/health")
def health():
    return {"ok": True}


# NEW: Streaming chat endpoint for real-time responses
@chatbot_router.post("/chat/stream")
async def chat_stream_endpoint(chat_request: ChatMessage):
    """Streaming chat endpoint for real-time responses"""

    session = get_or_create_session(chat_request.session_id)

    # Update context
    if chat_request.location:
        session.update_context("current_location", chat_request.location)

    # Add user message
    session.add_message("user", chat_request.message)

    # Build system prompt + messages
    travel_context = extract_travel_context(chat_request.message, session)
    system_prompt = build_system_prompt(session, travel_context)
    recent_messages = session.get_recent_messages(8)
    current_messages = recent_messages + [{"role": "user", "content": chat_request.message}]

    async def stream_response():
        try:
            full_response = ""
            # ✅ stream using current_messages (includes the latest user turn)
            async for chunk in stream_chat_with_groq(current_messages, system_prompt):
                full_response += chunk
                yield f"data: {json.dumps({'chunk': chunk, 'session_id': session.session_id})}\n\n"

            # Add complete response to session
            session.add_message("assistant", full_response, travel_context)

            # Send completion signal
            yield f"data: {json.dumps({'done': True, 'session_id': session.session_id})}\n\n"

        except Exception:
            error_msg = "I'm experiencing some technical difficulties."
            yield f"data: {json.dumps({'chunk': error_msg, 'error': True})}\n\n"

    return StreamingResponse(stream_response(), media_type="text/plain")

# NEW: Enhanced travel planning with conversational context
@chatbot_router.post("/chat/travel-plan")
async def enhanced_travel_planning(chat_request: ChatMessage):
    """Enhanced travel planning with conversational context"""
    
    session = get_or_create_session(chat_request.session_id)
    
    # This integrates your existing travel planning with chat context
    try:
        # Extract location from message or context
        location = chat_request.location or session.user_context.get("current_location")
        
        if location:
            # Use your existing weather and place functions
            wx_bundle = gather_weather([location], location)
            
            # Generate conversational response about the travel plan
            travel_prompt = f"""
            The user wants to plan a trip to {location}. 
            Current weather: {wx_bundle.get('current', {})}
            
            Provide a helpful, conversational response about planning their trip, 
            incorporating the weather information naturally.
            """
            
            system_prompt = build_system_prompt(session, {"travel_intent": "planning"})
            ai_response = await chat_with_groq(
                [{"role": "user", "content": travel_prompt}], 
                system_prompt
            )
            
            # Update session context
            session.update_context("current_location", location)
            session.update_context("weather_data", wx_bundle)
            session.add_message("user", chat_request.message)
            session.add_message("assistant", ai_response)
            
            return ChatResponse(
                response=ai_response,
                session_id=session.session_id,
                suggestions=[
                    f"Tell me more about {location} attractions",
                    "What's the best time to visit?",
                    "Any local food recommendations?"
                ],
                context_data={"weather": wx_bundle, "location": location}
            )
        else:
            return ChatResponse(
                response="I'd love to help you plan your trip! Which destination are you thinking about visiting? 🌍",
                session_id=session.session_id,
                suggestions=["Paris, France", "Tokyo, Japan", "New York, USA"],
                context_data={}
            )
            
    except Exception as e:
        return ChatResponse(
            response="I'm having trouble accessing travel information right now. Could you tell me more about where you'd like to go?",
            session_id=session.session_id,
            suggestions=["Try again", "Ask about weather", "Get travel tips"]
        )

# NEW: Session management endpoints
@chatbot_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 20):
    """Get conversation history for a session"""
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")
    
    session = sessions[session_id]
    messages = session.get_recent_messages(limit)
    
    return {
        "session_id": session_id,
        "messages": messages,
        "context": session.user_context
    }

@chatbot_router.delete("/chat/session/{session_id}")
async def clear_session(session_id: str):
    """Clear a chat session"""
    if session_id in sessions:
        del sessions[session_id]
        return {"message": "Session cleared successfully"}
    else:
        raise HTTPException(404, "Session not found")

@chatbot_router.get("/chat/sessions")
async def list_active_sessions():
    """List all active sessions (for debugging)"""
    return {
        "active_sessions": len(sessions),
        "sessions": [
            {
                "session_id": sid,
                "message_count": len(session.messages),
                "last_activity": session.last_activity.isoformat(),
                "context": session.user_context
            }
            for sid, session in sessions.items()
        ]
    }

# (in app.py)
# Replace your entire /chat-plan endpoint function with this one.
# (in app.py)
# REPLACE your entire @app.post("/chat-plan") endpoint with this function.
# This makes the powerful planning logic reusable.

def generate_itinerary_plan_response(itinerary_text: str) -> str:
    """
    Takes itinerary text and generates the full, detailed chat reply.
    This contains all the logic from your original /chat-plan endpoint.
    """
    # Parse places
    stops = parse_itinerary_text(itinerary_text)
    
    if not stops:
        return "It looks like you're trying to plan a trip, but I couldn't understand the places. Could you list them more clearly, for example: 'Place A -> Place B'?"

    # --- This is the same powerful logic you already wrote ---
    
    # 1. Fetch weather for ALL stops.
    weather_data = gather_weather_for_stops(stops)
    
    # 2. Create a legacy bundle for other functions.
    # We'll use the first stop as the city_hint for simplicity here.
    city_hint = stops[0]
    legacy_wx_bundle = gather_weather(stops, city_hint)
    
    # Per-place details
    per_place = build_place_details_parallel(
        stops=stops,
        lang_primary="en",
        mode="driving",
        wx_bundle=legacy_wx_bundle,
        city_hint=city_hint
    )
    
    # Personalized tips
    personal_tips = personalize_recommendations(stops, "driving", legacy_wx_bundle)
    
    # Maps URL
    maps_share = make_share_directions_link(stops, "driving")
    
    # Weather block
    weather_lines = []
    if weather_data:
        weather_lines.append("🌦️ Weather Outlook:")
        for stop_name in stops:
            weather = weather_data.get(stop_name)
            if weather:
                place_name = weather.get('place', stop_name)
                temp = weather.get('temp_C', 'N/A')
                conditions = weather.get('conditions', 'not available')
                weather_lines.append(f"• *{place_name}*: {round(temp) if isinstance(temp, float) else temp}°C, {conditions}.")
    weather_block = "\n".join(weather_lines)

    # Main content block for rewriting
    main_content_lines = [f"Here is your personalized plan for: {' ➜ '.join(stops)}"]
    if maps_share:
        main_content_lines.append(f"🗺️ Open in Maps: {maps_share}")

    bad_alts = suggest_bad_weather_alternatives(city_hint, stops, legacy_wx_bundle, lang="en")
    if bad_alts:
        main_content_lines.append("\n🌧️ If weather turns bad, consider:")
        for t in bad_alts[:2]:
            main_content_lines.append(f"• {t}")
    
    main_content_lines.append("\n📝 Per-place notes:")
    for d in per_place[:4]:
        main_content_lines.append(f"• *{d['place']}*: Best time — {d['best_time']}.")
        main_content_lines.append(f"  > _{d['history']}_")

    if personal_tips:
        main_content_lines.append("\n💡 Suggestions:")
        for t in personal_tips[:5]:
            main_content_lines.append(f"• {t}")

    rewritten_main_block = rewrite_with_groq("\n".join(main_content_lines))

    # Combine the blocks
    reply_parts = rewritten_main_block.split('\n')
    insert_position = 2 if maps_share else 1
    reply_parts.insert(insert_position, weather_block)
    
    return "\n".join(reply_parts)

# (in app.py)
# REPLACE your existing /chat endpoint with this upgraded, intelligent version.

@chatbot_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(chat_request: ChatMessage):
    session = get_or_create_session(chat_request.session_id)
    user_message = chat_request.message
    session.add_message("user", user_message)

    # Intent detection
    intent = detect_intent(user_message)

    if intent == "greeting":
        final_response = (
            "👋 Hi there! I'm your TravelBuddy. "
            "I can help you plan your trips, provide weather updates, "
            "share safety tips, or translate phrases. What would you like to do today?"
        )
        suggestions = ["Plan a trip", "Weather update", "Local attractions"]

    elif intent == "itinerary_plan":
        # Generate detailed itinerary response with map links and weather
        final_response = generate_itinerary_plan_response(user_message)
        suggestions = ["Tell me more about the first place", "What should I wear?", "Are these places crowded?"]

    else:
        # Extract travel context for a tailored response
        travel_context = extract_travel_context(user_message, session)
        system_prompt = build_system_prompt(session, travel_context)

        # Call AI model to generate response
        ai_response = await chat_with_groq(session.get_recent_messages(), system_prompt)
        
        # Rewrite AI response for clarity and friendliness
        final_response = rewrite_with_groq(ai_response)

        # Suggestions based on intent/context
        if travel_context.get("travel_intent") == "planning":
            suggestions = [
                "What's the weather like there?",
                "Tell me about local attractions",
                "What's the best time to visit?"
            ]
        elif travel_context.get("travel_intent") == "weather_inquiry":
            suggestions = [
                "What should I pack?",
                "Are there indoor activities?",
                "What's the forecast for the next few days?"
            ]
        else:
            suggestions = [
                "Can you help me plan an itinerary?",
                "What's the weather forecast?",
                "Tell me about local attractions",
                "Give me travel tips"
            ]

    session.add_message("assistant", final_response)
    return ChatResponse(
        response=final_response,
        session_id=session.session_id,
        suggestions=suggestions
    )

print(
    "HAS_OWM=", bool(OPENWEATHER_API_KEY),
    "HAS_GROQ=", bool(GROQ_API_KEY),
    "| .env:", "found" if _env_path.exists() else "NOT FOUND",
    "| keys loaded:", len(_env_vars)
)

