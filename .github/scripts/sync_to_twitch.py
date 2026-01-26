import os
import requests
from icalendar import Calendar
from datetime import datetime, timezone

# --- KONFIGURATION ---
CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
USER_TOKEN = os.getenv('TWITCH_TOKEN') 
CHANNEL_NAME = os.getenv('TWITCH_CHANNEL')

# Supabase Config (Optional, falls du es nutzt)
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

ICS_URL = "https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics?past_months=3&future_months=36"

def get_broadcaster_id(headers):
    url = f"https://api.twitch.tv/helix/users?login={CHANNEL_NAME}"
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    return r.json()['data'][0]['id']

def update_supabase(event_data):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    
    url = f"{SUPABASE_URL}/rest/v1/streams"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    # Wir speichern den nächsten Stream immer unter ID 1
    payload = {
        "id": 1, 
        "title": event_data['title'],
        "start_time": event_data['start_time']
    }
    r = requests.post(url, headers=headers, json=payload)
    print(f"Supabase Update: {r.status_code}")

def sync():
    headers = {
        "Client-Id": CLIENT_ID,
        "Authorization": f"Bearer {USER_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        b_id = get_broadcaster_id(headers)
    except Exception as e:
        print(f"Fehler: Konnte Broadcaster ID nicht laden. Check dein Token! {e}")
        return

    # iCal laden
    response = requests.get(ICS_URL)
    if "BEGIN:VCALENDAR" not in response.text:
        print("Fehler: Ungültiger iCal Feed.")
        return
        
    cal = Calendar.from_ical(response.content)
    now = datetime.now(timezone.utc)
    
    upcoming_events = []

    for event in cal.walk('vevent'):
        start = event.get('dtstart').dt
        if not isinstance(start, datetime): continue
        if start.tzinfo is None: start = start.replace(tzinfo=timezone.utc)

        if start > now:
            end = event.get('dtend').dt
            if end.tzinfo is None: end = end.replace(tzinfo=timezone.utc)
            duration = int((end - start).total_seconds() / 60)
            
            title = str(event.get('summary'))[:140]
            start_iso = start.strftime('%Y-%m-%dT%H:%M:%SZ')

            upcoming_events.append({"title": title, "start_time": start_iso})

            # 1. Twitch Sync
            payload = {
                "start_time": start_iso,
                "timezone": "Europe/Berlin",
                "duration": str(duration),
                "is_recurring": False,
                "title": title
            }
            
            r = requests.post(
                "https://api.twitch.tv/helix/schedule/segment", 
                headers=headers, 
                json=payload, 
                params={"broadcaster_id": b_id}
            )
            print(f"Twitch Sync '{title}': {r.status_code}")

    # 2. Supabase Update (nur den zeitlich nächsten Stream)
    if upcoming_events:
        # Sortieren nach Zeit, falls iCal unsortiert ist
        upcoming_events.sort(key=lambda x: x['start_time'])
        update_supabase(upcoming_events[0])

if __name__ == "__main__":
    sync()
