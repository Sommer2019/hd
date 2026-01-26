import os
import requests
from icalendar import Calendar
from datetime import datetime, timezone, timedelta

# --- KONFIGURATION ---
CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
USER_TOKEN = os.getenv('TWITCH_TOKEN')
CHANNEL_NAME = os.getenv('TWITCH_CHANNEL')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
ICS_URL = "https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics?past_months=3&future_months=36"

def should_run_now(cal, now):
    """Prüft, ob ein Stream vor ca. 30 Minuten gestartet ist."""
    for event in cal.walk('vevent'):
        start = event.get('dtstart').dt
        if not isinstance(start, datetime): continue
        
        # Sicherstellen, dass wir in UTC (GMT) vergleichen
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        else:
            start = start.astimezone(timezone.utc)

        # Zeitdifferenz in Minuten: Jetzt minus Startzeit
        diff_minutes = (now - start).total_seconds() / 60
        
        # Wenn der Stream vor 30-65 Minuten gestartet ist, triggern wir den Sync
        # (Puffer von 5 Min, falls die Action mal 1-2 Min später startet)
        if 30 <= diff_minutes <= 65:
            print(f"Trigger gefunden: '{event.get('summary')}' startete vor {int(diff_minutes)} Min.")
            return True
    return False

def sync():
    now = datetime.now(timezone.utc)
    
    print("Lade iCal Feed...")
    response = requests.get(ICS_URL)
    cal = Calendar.from_ical(response.content)

    # CHECK: Ist jetzt der richtige Zeitpunkt (Start + 30 Min)?
    # Falls du das Skript manuell startest, ignorieren wir den Check
    if os.getenv('GITHUB_EVENT_NAME') != 'workflow_dispatch':
        if not should_run_now(cal, now):
            print("Kein passender Stream-Start (GMT+30min) gefunden. Beende Skript.")
            return

    # --- AB HIER FOLGT DEINE BESTEHENDE LOGIK ---
    # 1. Supabase aufräumen & neuen Stream eintragen
    # 2. Twitch Sync
    print("Starte Synchronisation...")
    # ... (Dein bisheriger Code zum Löschen/Schreiben)

if __name__ == "__main__":
    sync()
