import os
import requests
from icalendar import Calendar
from datetime import datetime

# Konfiguration aus GitHub Secrets
CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
CLIENT_SECRET = os.getenv('TWITCH_CLIENT_SECRET')
CHANNEL_NAME = os.getenv('TWITCH_CHANNEL')
ICS_URL = "https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics?past_months=3&future_months=36"

def get_access_token():
    url = f"https://id.twitch.tv/oauth2/token?client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}&grant_type=client_credentials&scope=channel:manage:schedule"
    r = requests.post(url)
    return r.json().get('access_token')

def get_broadcaster_id(token):
    url = f"https://api.twitch.tv/helix/users?login={CHANNEL_NAME}"
    headers = {"Client-Id": CLIENT_ID, "Authorization": f"Bearer {token}"}
    return requests.get(url, headers=headers).json()['data'][0]['id']

def clear_current_schedule(token, broadcaster_id):
    # Holt die Segmente der nächsten 7 Tage und löscht sie (Clean Up)
    url = "https://api.twitch.tv/helix/schedule"
    headers = {"Client-Id": CLIENT_ID, "Authorization": f"Bearer {token}"}
    res = requests.get(url, headers=headers, params={"broadcaster_id": broadcaster_id})
    
    data = res.json().get('data')
    if data and data.get('segments'):
        for segment in data['segments']:
            requests.delete(f"{url}/segment", headers=headers, params={
                "broadcaster_id": broadcaster_id,
                "id": segment['id']
            })
        print("Alten Plan bereinigt.")

def sync():
    token = get_access_token()
    b_id = get_broadcaster_id(token)
    
    # 1. Altes aufräumen
    clear_current_schedule(token, b_id)

    # 2. iCal laden
    response = requests.get(ICS_URL)
    cal = Calendar.from_ical(response.content)
    
    headers = {
        "Client-Id": CLIENT_ID, 
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    for event in cal.walk('vevent'):
        start = event.get('dtstart').dt
        # Nur zukünftige Termine
        if isinstance(start, datetime) and start.replace(tzinfo=None) > datetime.now():
            end = event.get('dtend').dt
            duration = int((end - start).total_seconds() / 60)
            
            payload = {
                "start_time": start.strftime('%Y-%m-%dT%H:%M:%SZ'),
                "timezone": "Europe/Berlin",
                "duration": str(duration),
                "is_recurring": False,
                "title": str(event.get('summary'))[:140] # Twitch Limit
            }
            
            r = requests.post(
                "https://api.twitch.tv/helix/schedule/segment", 
                headers=headers, 
                json=payload, 
                params={"broadcaster_id": b_id}
            )
            print(f"Sync '{payload['title']}': {r.status_code}")

if __name__ == "__main__":
    sync()
