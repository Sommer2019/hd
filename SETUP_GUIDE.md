# Quick Setup Guide - Twitch Clip Voting System

## 🚀 Schnellstart

Folge diesen Schritten, um das Clip Voting System auf deiner GitHub Pages Seite einzurichten:

### 1. Twitch App erstellen (5 Minuten)

1. Gehe zu https://dev.twitch.tv/console/apps/create
2. Fülle das Formular aus:
   - **Name:** HD Clip Voting (oder beliebiger Name)
   - **OAuth Redirect URLs:** `https://sommer2019.github.io/hd/html/clips-voting.html`
     - ⚠️ Ersetze `sommer2019.github.io/hd` mit deiner echten GitHub Pages Domain!
     - Falls du eine Custom Domain hast, füge auch diese hinzu
   - **Category:** Website Integration
3. Klicke auf "Create"
4. Kopiere die **Client ID**
5. Klicke auf "New Secret" und kopiere auch das **Client Secret**

### 2. Repository konfigurieren (3 Minuten)

#### GitHub Secrets und Variables hinzufügen:
1. Gehe zu deinem Repository
2. Settings → Secrets and variables → Actions
3. **Tab "Secrets"** → New repository secret:
   - Name: `TWITCH_CLIENT_ID`, Value: [Deine Client ID]
   - Name: `TWITCH_CLIENT_SECRET`, Value: [Dein Client Secret]
4. **Tab "Variables"** → New repository variable:
   - Name: `GITHUB_PAGES_DOMAIN`, Value: [Deine GitHub Pages Domain, z.B. `username.github.io`]
   - ⚠️ Nur die Domain, ohne `https://` und ohne Pfad!

#### Config-Datei anpassen:
1. Öffne `config.txt` im Repository
2. Ersetze `YOUR_CLIENT_ID_HERE` mit deiner echten Client ID
3. Passe die Daten an:
   ```
   VOTING_START=2026-01-15T00:00:00
   VOTING_END=2026-01-22T23:59:59
   CLIPS_START=2026-01-01T00:00:00
   CLIPS_END=2026-01-15T00:00:00
   ```

#### Clips-Daten aktualisieren:
1. Öffne `clips-data.json`
2. Ersetze `sommer2019.github.io` mit deiner Domain in allen `embed_url` Feldern
3. Oder lass die GitHub Action automatisch Clips fetchen (siehe unten)

### 3. Clips automatisch fetchen (Optional)

Die GitHub Action ist bereits eingerichtet! Sie läuft:
- ✅ Alle 6 Stunden automatisch
- ✅ Bei Änderungen an `config.txt`
- ✅ Manuell über Actions Tab → "Fetch Twitch Clips" → "Run workflow"

**Erste Ausführung:**
1. Gehe zu Actions Tab
2. Wähle "Fetch Twitch Clips"
3. Klicke "Run workflow"
4. Warte ~30 Sekunden
5. `clips-data.json` wird automatisch aktualisiert!

### 4. GitHub Pages aktivieren (falls noch nicht)

1. Repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main` oder `master`
4. Folder: `/ (root)`
5. Save

Deine Seite ist in wenigen Minuten verfügbar unter:
`https://DEIN-USERNAME.github.io/REPO-NAME/html/clips-voting.html`

### 5. Testen! 🎉

1. Besuche deine Voting-Seite
2. Klicke "Mit Twitch anmelden"
3. Autorisiere die App
4. Vote für einen Clip!

## 📝 Was passiert nach dem Setup?

- **Während des Votings:** Benutzer können für Clips voten
- **Nach dem Voting-Ende:** Automatische Anzeige der Ergebnisse
- **Clips aktualisieren:** GitHub Action macht das automatisch alle 6h

## ❓ Troubleshooting

### "Twitch Client ID nicht konfiguriert"
→ Hast du `config.txt` mit deiner echten Client ID aktualisiert?

### OAuth Redirect funktioniert nicht
→ Stelle sicher, dass die URL in der Twitch App EXAKT mit deiner GitHub Pages URL übereinstimmt:
- ✅ Richtig: `https://username.github.io/repo/html/clips-voting.html`
- ❌ Falsch: `http://username.github.io/repo/html/clips-voting.html` (http statt https)
- ❌ Falsch: `https://username.github.io/repo/html/clips-voting.html/` (Trailing slash)

### Clips werden nicht angezeigt
→ Überprüfe in `clips-data.json`:
- Ist der `parent` Parameter in `embed_url` korrekt?
- Sollte deine Domain sein (ohne `https://` und ohne Pfad)
- Beispiel: `parent=sommer2019.github.io`

### GitHub Action schlägt fehl
→ Stelle sicher, dass beide Secrets (`TWITCH_CLIENT_ID` und `TWITCH_CLIENT_SECRET`) korrekt hinzugefügt wurden

## 🎨 Anpassungen

### Design ändern
Bearbeite `css/voting.css` - nutzt die gleichen CSS-Variablen wie die Hauptseite

### Anzahl Clips ändern
Ändere `MAX_CLIPS` in `config.txt`

### Voting-Zeitraum ändern
Ändere `VOTING_START` und `VOTING_END` in `config.txt`

## 📚 Mehr Infos

Siehe `VOTING_README.md` für detaillierte Dokumentation.

## 🆘 Support

Bei Problemen:
1. Überprüfe die Browser-Konsole (F12) auf Fehler
2. Schaue in den Actions Logs nach Fehlern
3. Erstelle ein Issue im Repository
