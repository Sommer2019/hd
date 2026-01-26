import os
import requests
from icalendar import Calendar
from datetime import datetime, timezone

# --- KONFIGURATION ---
CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
USER_TOKEN = os.getenv('TWITCH_TOKEN') 
CHANNEL_NAME = os.getenv('TWITCH_CHANNEL')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') # WICHTIG: Service Role Key nutzen

ICS_URL = "https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics?past_months=3&future_months=36"

def update_supabase(event_data):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase Config fehlt (URL oder KEY).")
        return
    
    url = f"{SUPABASE_URL}/rest/v1/streams"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    payload = {
        "id": 1, 
        "title": event_data['title'],
        "start_time": event_data['start_time']
    }
    r = requests.post(url, headers=headers, json=payload)
    print(f"Supabase Update Status: {r.status_code}")
    if r.status_code >= 400: print(f"Supabase Fehler: {r.text}")

def sync():
    # 1. iCal laden (Wichtig für beide Plattformen)
    print("Lade iCal Feed...")
    response = requests.get(ICS_URL)
    if "BEGIN:VCALENDAR" not in response.text:
        print("Fehler: Ungültiger iCal Feed.")
        return
        
    cal = Calendar.from_ical(response.content)
    now = datetime.now(timezone.utc)
    upcoming_events = []

    # Events parsen
    for event in cal.walk('vevent'):
        start = event.get('dtstart').dt
        if not isinstance(start, datetime): continue
        if start.tzinfo is None: start = start.replace(tzinfo=timezone.utc)
        if start > now:
            upcoming_events.append({
                "title": str(event.get('summary'))[:140],
                "start_time": start.strftime('%Y-%m-%dT%H:%M:%SZ'),
                "duration": int((event.get('dtend').dt - start).total_seconds() / 60)
            })

    if not upcoming_events:
        print("Keine zukünftigen Events gefunden.")
        return

    upcoming_events.sort(key=lambda x: x['start_time'])

    # 2. SUPABASE UPDATE (Unabhängig von Twitch)
    print(f"Update Supabase mit: {upcoming_events[0]['title']}")
    update_supabase(upcoming_events[0])

    # 3. TWITCH SYNC
    print("Starte Twitch Sync...")
    twitch_headers = {
        "Client-Id": CLIENT_ID,
        "Authorization": f"Bearer {USER_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        # ID holen
        u_resp = requests.get(f"https://api.twitch.tv/helix/users?login={CHANNEL_NAME}", headers=twitch_headers)
        u_resp.raise_for_status()
        b_id = u_resp.json()['data'][0]['id']

        for ev in upcoming_events:
            payload = {
                "start_time": ev['start_time'],
                "timezone": "Europe/Berlin",
                "duration": str(ev['duration']),
                "is_recurring": False,
                "title": ev['title']
            }
            r = requests.post("https://api.twitch.tv/helix/schedule/segment", 
                              headers=twitch_headers, json=payload, params={"broadcaster_id": b_id})
            print(f"Twitch '{ev['title']}': {r.status_code}")
    except Exception as e:
        print(f"Twitch Sync fehlgeschlagen (Check dein Token!): {e}")

if __name__ == "__main__":
    sync()
