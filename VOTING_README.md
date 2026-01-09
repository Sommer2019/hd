# Twitch Clip Voting System

## Übersicht

Dies ist ein vollständiges Twitch Clip Voting-System, das für GitHub Pages entwickelt wurde. Benutzer können sich mit ihrem Twitch-Account anmelden und für ihre Lieblings-Clips voten.

## Funktionen

- ✅ Twitch OAuth Authentifizierung
- ✅ Zeitgesteuertes Voting (Start- und Enddatum konfigurierbar)
- ✅ Ein Vote pro Benutzer (verifiziert über Twitch Account)
- ✅ Automatische Clip-Anzeige mit eingebetteten Playern
- ✅ Live-Ergebnisse nach Voting-Ende
- ✅ Vollständig client-seitig (GitHub Pages kompatibel)
- ✅ Responsive Design

## Konfiguration

### 1. Twitch App erstellen

1. Gehe zu https://dev.twitch.tv/console/apps
2. Erstelle eine neue App:
   - Name: "HD Clip Voting"
   - OAuth Redirect URLs: Füge deine GitHub Pages URL hinzu (z.B. `https://sommer2019.github.io/hd/html/clips-voting.html`)
   - Category: Website Integration
3. Kopiere die **Client ID**

### 2. Konfigurationsdatei anpassen

Bearbeite `config.txt` im Root-Verzeichnis:

```
# Voting Zeitraum
VOTING_START=2026-01-09T00:00:00
VOTING_END=2026-01-16T23:59:59

# Clip Zeitraum (welche Clips sollen angezeigt werden)
CLIPS_START=2025-12-01T00:00:00
CLIPS_END=2026-01-09T00:00:00

# Twitch Konfiguration
TWITCH_BROADCASTER_ID=hd1920x1080
TWITCH_CLIENT_ID=DEINE_CLIENT_ID_HIER

# Anzahl der Clips
MAX_CLIPS=10
```

**Wichtig:** Ersetze `DEINE_CLIENT_ID_HIER` mit deiner echten Twitch Client ID!

### 3. Clips vorbereiten

#### Option A: Manuelle Clips-Datei (Empfohlen für Start)

Bearbeite `clips-data.json` und füge deine echten Clip-URLs hinzu:

```json
{
  "clips": [
    {
      "id": "clip_1",
      "url": "https://www.twitch.tv/hd1920x1080/clip/ACTUAL_CLIP_SLUG",
      "embed_url": "https://clips.twitch.tv/embed?clip=ACTUAL_CLIP_SLUG&parent=sommer2019.github.io",
      "title": "Clip Titel",
      "creator_name": "Creator Name",
      "view_count": 1234,
      "created_at": "2025-12-15T14:30:00Z"
    }
  ]
}
```

**Wichtig:** Ersetze `sommer2019.github.io` mit deiner tatsächlichen Domain im `embed_url`!

#### Option B: GitHub Action für automatisches Clip-Fetching (Fortgeschritten)

Du kannst eine GitHub Action erstellen, die regelmäßig die Twitch API aufruft und `clips-data.json` aktualisiert. Dafür benötigst du:

1. Twitch App Secret (zusätzlich zur Client ID)
2. GitHub Action, die OAuth Token generiert
3. API-Aufruf an Twitch Clips Endpoint
4. Commit der aktualisierten clips-data.json

Beispiel-Workflow (`.github/workflows/fetch-clips.yml`):

```yaml
name: Fetch Twitch Clips
on:
  schedule:
    - cron: '0 */6 * * *'  # Alle 6 Stunden
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Fetch Clips
        env:
          TWITCH_CLIENT_ID: ${{ secrets.TWITCH_CLIENT_ID }}
          TWITCH_CLIENT_SECRET: ${{ secrets.TWITCH_CLIENT_SECRET }}
        run: |
          # Script zum Fetchen der Clips via Twitch API
          # und Aktualisierung von clips-data.json
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add clips-data.json
          git commit -m "Update clips data" || exit 0
          git push
```

## Verwendung

### Für Benutzer

1. Besuche die Voting-Seite: `https://DEINE-DOMAIN/html/clips-voting.html`
2. Klicke auf "Mit Twitch anmelden"
3. Autorisiere die App
4. Durchstöbere die Clips und klicke auf "Vote" für deinen Favoriten
5. Du kannst nur einmal voten!

### Phasen

Das System hat drei Phasen:

1. **Vor dem Voting** (vor VOTING_START): Benutzer sehen wann es startet
2. **Voting aktiv** (zwischen VOTING_START und VOTING_END): Benutzer können voten
3. **Voting beendet** (nach VOTING_END): Ergebnisse werden angezeigt

## Technische Details

### Architektur

- **Frontend-only**: Komplett client-seitig, kein Backend erforderlich
- **LocalStorage**: Speichert Votes und Auth-Token
- **Twitch OAuth**: Implicit Flow für sichere Authentifizierung
- **GitHub Pages**: Vollständig kompatibel mit statischem Hosting

### Dateien

```
├── config.txt              # Konfiguration
├── clips-data.json         # Clip-Daten
├── html/
│   └── clips-voting.html   # Voting-Seite
├── css/
│   └── voting.css         # Voting-Styles
└── js/
    └── voting.js          # Voting-Logik
```

### Sicherheit

- **Ein Vote pro User**: Verifiziert über Twitch User ID
- **Token Validation**: Tokens werden bei jedem Seitenaufruf validiert
- **Token Expiry**: Tokens laufen nach 24 Stunden ab
- **XSS Protection**: Alle User-Inputs werden escaped

### Einschränkungen

- Votes werden im Browser LocalStorage gespeichert (können gelöscht werden)
- Für produktive Nutzung mit hohem Voting-Volumen empfiehlt sich ein Backend
- Clip-Daten müssen manuell oder via GitHub Action aktualisiert werden

## Anpassungen

### Design anpassen

Bearbeite `css/voting.css` um Farben und Styles anzupassen. Das Design verwendet die gleichen CSS-Variablen wie die Hauptseite:

```css
--accent: #7C4DFF;  /* Hauptfarbe */
--bg-black: #070607;  /* Hintergrund */
```

### Anzahl der Clips ändern

Passe `MAX_CLIPS` in `config.txt` an.

### Voting-Zeitraum ändern

Passe `VOTING_START` und `VOTING_END` in `config.txt` an.

## Troubleshooting

### "Twitch Client ID nicht konfiguriert"
- Stelle sicher, dass du eine Twitch App erstellt und die Client ID in `config.txt` eingetragen hast

### Clips werden nicht geladen
- Überprüfe, ob `clips-data.json` existiert und gültig ist
- Prüfe Browser Console auf Fehler

### OAuth funktioniert nicht
- Stelle sicher, dass die Redirect URL in der Twitch App korrekt ist
- URL muss EXAKT mit der tatsächlichen URL übereinstimmen (inkl. https://)
- Füge alle möglichen URLs hinzu (z.B. mit und ohne www)

### Embeds werden nicht angezeigt
- Überprüfe den `parent` Parameter im `embed_url`
- Muss mit der tatsächlichen Domain übereinstimmen
- Bei lokaler Entwicklung füge `parent=localhost` hinzu

## Support

Bei Fragen oder Problemen, erstelle ein Issue im GitHub Repository.
