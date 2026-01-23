# Supabase Setup für Page View Tracking

Diese Anleitung erklärt, wie Sie die `page_views` Tabelle in Supabase einrichten.

## Voraussetzungen

- Supabase Account (https://supabase.com)
- Zugriff auf Ihr Supabase Projekt

## Schritt 1: Erstellen Sie die `page_views` Tabelle

1. Öffnen Sie Ihr Supabase Projekt
2. Navigieren Sie zu **SQL Editor**
3. Führen Sie folgendes SQL aus:

```sql
-- Erstelle die page_views Tabelle
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redirect_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Erstelle Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session_page_time ON page_views(session_id, page_path, viewed_at);

-- Optional: Erstelle eine Funktion um alte Daten zu löschen (älter als 2 Jahre)
CREATE OR REPLACE FUNCTION cleanup_old_page_views()
RETURNS void AS $$
BEGIN
  DELETE FROM page_views
  WHERE viewed_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Optional: Kommentar hinzufügen
COMMENT ON TABLE page_views IS 'Speichert Seitenaufrufe mit 2-Minuten-Cooldown pro Session/Seite';
COMMENT ON COLUMN page_views.session_id IS 'Session ID aus localStorage (persistent über Browser-Tabs)';
COMMENT ON COLUMN page_views.page_path IS 'Pfad der besuchten Seite (z.B. /index.html)';
COMMENT ON COLUMN page_views.viewed_at IS 'Zeitstempel des Seitenaufrufs';
COMMENT ON COLUMN page_views.redirect_info IS 'Optional: Redirect-Informationen für 404-Seite (JSON)';
```

## Schritt 2: Row Level Security (RLS) konfigurieren

Für öffentlichen Lesezugriff und anonymes Schreiben:

```sql
-- Aktiviere RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Policy für öffentliches Lesen (für Statistiken)
CREATE POLICY "Allow public read access" ON page_views
  FOR SELECT
  USING (true);

-- Policy für öffentliches Schreiben (für Tracking)
CREATE POLICY "Allow public insert" ON page_views
  FOR INSERT
  WITH CHECK (true);

-- Policy für kein Update/Delete durch öffentliche User
CREATE POLICY "Deny public update" ON page_views
  FOR UPDATE
  USING (false);

CREATE POLICY "Deny public delete" ON page_views
  FOR DELETE
  USING (false);
```

## Schritt 3: Verifizieren Sie die Einrichtung

Testen Sie die Tabelle mit folgenden Abfragen:

```sql
-- Teste Insert
INSERT INTO page_views (session_id, page_path, viewed_at)
VALUES ('test_session', '/test.html', NOW());

-- Teste Select
SELECT * FROM page_views ORDER BY viewed_at DESC LIMIT 10;

-- Teste Statistiken
SELECT 
  page_path,
  COUNT(*) as views
FROM page_views
WHERE viewed_at >= NOW() - INTERVAL '24 hours'
GROUP BY page_path
ORDER BY views DESC;

-- Lösche Testdaten
DELETE FROM page_views WHERE session_id = 'test_session';
```

## Schritt 4: Optional - Automatische Bereinigung einrichten

Erstellen Sie einen Cronjob in Supabase (erfordert pg_cron Extension):

```sql
-- Aktiviere pg_cron Extension (nur einmal nötig)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Erstelle einen Cronjob der monatlich alte Daten löscht
SELECT cron.schedule(
  'cleanup-old-page-views',
  '0 0 1 * *', -- Am 1. Tag jeden Monats um Mitternacht
  $$SELECT cleanup_old_page_views()$$
);
```

## Hinweise zur Funktionsweise

### Session-basiertes Tracking
- Das System verwendet eine **Session ID** aus localStorage
- Die Session ID wird beim ersten Besuch generiert und bleibt persistent
- Funktioniert über alle Browser-Tabs hinweg

### 2-Minuten-Cooldown (pro Seite)
- Besuche derselben Seite werden nur gezählt, wenn seit dem letzten Besuch 2 Minuten vergangen sind
- Der Cooldown gilt nur für die GLEICHE Seite, nicht global
- **Ausnahme**: Die 404-Seite hat KEINEN Cooldown und trackt jeden Besuch
- Dies verhindert Mehrfachzählungen durch Seiten-Reloads

### 404-Seite Redirect-Tracking
- Die 404-Seite trackt zusätzlich, ob eine Umleitung durchgeführt wurde
- Redirect-Informationen werden im `redirect_info` Feld (JSON) gespeichert
- Jeder 404-Besuch wird gezählt, unabhängig vom Cooldown

### Datenschutz
- Es werden keine IP-Adressen gespeichert
- Nur Session IDs (zufällig generierte Identifier)
- Daten können nach 2 Jahren automatisch gelöscht werden

## Statistiken anzeigen

Die Page View Statistiken sind verfügbar unter:
- `/actuator/data.html` - Vollständiges Statistik-Dashboard

## Troubleshooting

### Problem: Keine Daten in der Tabelle
- Überprüfen Sie, dass die RLS Policies korrekt sind
- Prüfen Sie die Browser-Konsole auf JavaScript-Fehler
- Verifizieren Sie, dass die Supabase URL und API Key korrekt sind

### Problem: Doppelte Einträge
- Überprüfen Sie die 2-Minuten-Logik in `page-view-tracker.js`
- Prüfen Sie, ob der Index `idx_page_views_session_page_time` existiert

### Problem: Langsame Abfragen
- Stellen Sie sicher, dass alle Indizes erstellt wurden
- Erwägen Sie, alte Daten regelmäßig zu archivieren oder zu löschen

## Support

Bei Fragen zur Einrichtung:
1. Prüfen Sie die Supabase Dokumentation: https://supabase.com/docs
2. Überprüfen Sie die Browser-Konsole auf Fehler
3. Testen Sie die SQL-Abfragen direkt im Supabase SQL Editor
