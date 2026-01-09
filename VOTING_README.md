# Twitch Clip Voting System

Ein vollständiges Voting-System für Twitch Clips mit OAuth-Authentifizierung und konfigurierbaren Zeiträumen.

## Features

- 🎬 Automatisches Laden der Top Clips über die Twitch API
- 🔐 Twitch OAuth Authentifizierung (ein Vote pro Account)
- ⚙️ Konfigurierbare Voting- und Clip-Zeiträume über Textdatei
- 🏆 Ergebnisseite mit Podium-Darstellung
- 📱 Responsive Design für alle Geräte
- 🔗 Direkte Verlinkung zu den Original-Clips

## Setup

### 1. Twitch Developer Anwendung erstellen

1. Gehe zu https://dev.twitch.tv/console/apps
2. Klicke auf "Register Your Application"
3. Fülle die Felder aus:
   - **Name**: HD Clip Voting (oder ein anderer Name)
   - **OAuth Redirect URLs**: `http://localhost:3000/auth/callback` (für lokale Entwicklung)
   - **Category**: Website Integration
4. Klicke auf "Create"
5. Notiere dir die **Client ID**
6. Klicke auf "New Secret" und notiere dir das **Client Secret**

### 2. Node.js Dependencies installieren

```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren

Erstelle eine `.env` Datei im Hauptverzeichnis:

```env
# Twitch API Credentials
TWITCH_CLIENT_ID=deine_client_id_hier
TWITCH_CLIENT_SECRET=dein_client_secret_hier
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback

# Session Secret (generiere einen zufälligen String)
SESSION_SECRET=ein_sehr_sicheres_zufälliges_secret

# Server Port
PORT=3000
```

### 4. Voting-Konfiguration anpassen

Bearbeite die `config.txt` Datei:

```txt
# Voting Period
VOTING_START=2026-01-10T00:00:00Z
VOTING_END=2026-01-31T23:59:59Z

# Clips Period (which clips to fetch)
CLIPS_START=2026-01-01T00:00:00Z
CLIPS_END=2026-01-09T23:59:59Z

# Twitch Settings
TWITCH_BROADCASTER_ID=hd1920x1080
MAX_CLIPS=10
```

**Hinweise:**
- Alle Datumsangaben müssen im ISO 8601 Format sein (YYYY-MM-DDTHH:MM:SSZ)
- `TWITCH_BROADCASTER_ID` ist der Twitch-Benutzername (nicht die numerische ID)
- `MAX_CLIPS` bestimmt, wie viele Clips zur Auswahl stehen

## Server starten

```bash
npm start
```

Der Server läuft dann auf `http://localhost:3000`

## Verwendung

### Für Benutzer

1. Besuche `http://localhost:3000/html/voting.html`
2. Melde dich mit deinem Twitch-Account an
3. Wähle deinen Lieblings-Clip aus
4. Gib deine Stimme ab
5. Nach dem Ende des Votings: Besuche `http://localhost:3000/html/results.html`

### Für Administratoren

**Voting-Zeitraum ändern:**
1. Bearbeite `config.txt`
2. Ändere `VOTING_START` und `VOTING_END`
3. Starte den Server neu

**Clips-Zeitraum ändern:**
1. Bearbeite `config.txt`
2. Ändere `CLIPS_START` und `CLIPS_END`
3. Starte den Server neu

## Deployment in Produktion

### 1. Twitch Redirect URI aktualisieren

In der Twitch Developer Console:
- Füge deine Produktions-URL hinzu: `https://deine-domain.de/auth/callback`

### 2. Umgebungsvariablen anpassen

In der `.env` Datei:
```env
TWITCH_REDIRECT_URI=https://deine-domain.de/auth/callback
SESSION_SECRET=ein_sehr_sicheres_production_secret
```

### 3. HTTPS aktivieren

In `server.js`:
```javascript
cookie: { secure: true } // Nur über HTTPS
```

### 4. Persistente Datenbank verwenden

Für Produktion solltest du die In-Memory-Storage durch eine echte Datenbank ersetzen:
- PostgreSQL
- MongoDB
- MySQL
- SQLite

Beispiel mit SQLite:

```bash
npm install better-sqlite3
```

```javascript
const Database = require('better-sqlite3');
const db = new Database('votes.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS votes (
    user_id TEXT PRIMARY KEY,
    clip_id TEXT NOT NULL,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS vote_counts (
    clip_id TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
  );
`);
```

## Dateistruktur

```
hd/
├── index.html              # Hauptseite mit Link zum Voting
├── html/
│   ├── voting.html         # Voting-Seite
│   ├── results.html        # Ergebnisseite
│   ├── Streamplan.html     # Bestehende Seiten
│   └── impressum.html
├── css/
│   └── styles.css          # Styles (inkl. Voting-Styles)
├── img/                    # Bilder und Icons
├── server.js               # Node.js Backend-Server
├── package.json            # Node.js Abhängigkeiten
├── config.txt              # Voting-Konfiguration
├── .env                    # Umgebungsvariablen (nicht in Git!)
├── .env.example            # Beispiel für .env
└── .gitignore              # Git-Ignore-Datei
```

## API Endpunkte

### GET /api/config
Gibt die Voting-Konfiguration zurück

### GET /api/clips
Gibt die verfügbaren Clips mit aktuellen Vote-Zahlen zurück

### GET /api/auth/twitch
Startet den Twitch OAuth Flow

### GET /auth/callback
Callback für Twitch OAuth

### GET /api/user
Gibt den aktuell angemeldeten Benutzer zurück

### POST /api/vote
```json
{
  "clipId": "clip-id-here"
}
```
Gibt eine Stimme für einen Clip ab

### GET /api/results
Gibt die Voting-Ergebnisse zurück (nur nach Ende des Votings)

### POST /api/logout
Meldet den Benutzer ab

## Fehlerbehandlung

**"Not authenticated"**: Benutzer muss sich mit Twitch anmelden
**"Voting has not started yet"**: Voting-Zeitraum noch nicht begonnen
**"Voting has ended"**: Voting-Zeitraum ist vorbei
**"You have already voted"**: Benutzer hat bereits abgestimmt
**"Results not available yet"**: Ergebnisse werden erst nach Ende des Votings angezeigt

## Sicherheit

- Twitch OAuth für Authentifizierung
- Session-basiertes Voting (ein Vote pro Account)
- Sichere Cookies (HTTPS in Produktion)
- Client-ID und Secret werden nicht im Frontend exponiert
- CORS-Schutz

## Support

Bei Fragen oder Problemen:
- GitHub Issues: [Repository URL]
- E-Mail: Admin@HD1920x1080.de

## Lizenz

© 2026 FullHD Media
