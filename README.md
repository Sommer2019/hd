HD — Linkseite

Kurze statische Website mit Links zu Streamplan, RessourcePack, Socials und Clips.

## Features

### Clip des Monats
Automatisches monatliches Voting-System für Twitch-Clips:
- Clips werden automatisch ab dem 22. jedes Monats abgerufen
- Voting läuft in der letzten Woche des Monats
- Ergebnisse werden automatisch berechnet und angezeigt
- Siehe: `clipdesmonats.html`

### Clip des Jahres (Neu!)
Manuelle zweite Voting-Runde für besondere Events:
- Kann nur über GitHub Actions gestartet/beendet werden
- Verwendet Top 10 aus vorherigen Monats-Votings
- Gewinner werden unter `/cdj` angezeigt
- Siehe: `SECOND_VOTING_FEATURE.md` für Details

## Dateien

### Haupt-Seiten
- `index.html` — Startseite
- `clipdesmonats.html` — Clip des Monats Voting
- `cdj.html` — Clip des Jahres Anzeige
- `actuator/data.html` — Actuator Data (Statistiken & Metriken)
- `impressum.html` — Impressum
- `streamplan.html` — Streamplan
- `streamelements.html` — StreamElements Integration
- `ob.html` — OnlyBart

### Styles
- `css/styles.css` — Hauptstil
- `css/clip-voting.css` — Voting-spezifische Styles

### JavaScript
- `js/clip-voting.js` — Voting-System Logik
- `js/clip-des-jahres.js` — Clip des Jahres Anzeige
- `js/supabase-client.js` — Supabase Datenbank Client

### Backend Scripts
- `.github/scripts/fetch-clips.js` — Twitch Clips abrufen
- `.github/scripts/calculate-results.js` — Voting-Ergebnisse berechnen
- `.github/scripts/submit-vote.js` — Vote verarbeiten
- `.github/scripts/start-second-voting.js` — Zweite Voting-Runde starten
- `.github/scripts/end-second-voting.js` — Zweite Voting-Runde beenden
- `.github/scripts/check-second-voting-expiry.js` — Ablauf prüfen
- `.github/scripts/db-helper.js` — Datenbank Hilfsfunktionen

### GitHub Actions Workflows
- `.github/workflows/fetch-clips.yml` — Automatisches Clips abrufen
- `.github/workflows/calculate-results.yml` — Automatische Ergebnisberechnung
- `.github/workflows/submit-vote.yml` — Vote-Verarbeitung
- `.github/workflows/start-second-voting.yml` — Zweite Runde starten
- `.github/workflows/end-second-voting.yml` — Zweite Runde beenden
- `.github/workflows/check-second-voting-expiry.yml` — Tägliche Ablaufprüfung

## Dokumentation
- `SUPABASE_CONFIG_SETUP.md` — **Supabase Konfiguration mit Environment Variables**
- `SECOND_VOTING_FEATURE.md` — Komplette Feature-Dokumentation
- `DATABASE_MIGRATION.md` — Datenbank-Migrations-Anleitung
- `SETUP_GUIDE.md` — Setup-Anleitung
- `SUPABASE_SETUP.md` — Supabase-Konfiguration

## Entwicklung

### Voraussetzungen
- Node.js 18+
- Supabase Account
- Twitch API Credentials (für Clips)

### Setup
```bash
npm install

# For local development, create .env file with Supabase credentials
cp .env.example .env
# Edit .env and add your credentials

# Generate config.js from environment variables
npm run build-config
```

### Verfügbare Scripts
```bash
npm run fetch-clips              # Clips von Twitch abrufen
npm run calculate-results        # Voting-Ergebnisse berechnen
npm run start-second-voting      # Zweite Voting-Runde starten
npm run end-second-voting        # Zweite Voting-Runde beenden
npm run check-second-voting-expiry  # Ablauf prüfen
```

### Testing
```bash
node test-db-helper.js           # Datenbank-Funktionen testen
```

## Anzeigen

Lokal: Öffne `index.html` im Browser (z.B. Doppelklick oder per "Öffnen mit").

Live: Deployed auf GitHub Pages oder Hosting-Provider deiner Wahl.

## Design

Farb-Accent: #7C4DFF (lilablau)

## Lizenz

Alle Rechte vorbehalten - HD1920x1080 / FullHD Media
