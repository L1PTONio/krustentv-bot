# KrüstchenTV Bot

Ein stabiler, aber noch beta-gestützter Discord-Bot, der automatisch neue YouTube‑Videos sammelt und per Watch2Gether API in einen festen Raum pusht.

> Beta-Status: Dieser Bot ist aktuell als Beta-Version gedacht und eignet sich für den privaten Freundes-/Testbetrieb, nicht als vollständig abgesicherter Produktivbetrieb.

## 🔧 Features
- Automatische Suche nach neuen Videos pro Kategorie/Channel
- Interaktiver TV-Flow (Watchtime, Kategorie-Auswahl, Reihenfolge, Vorschau, Push)
- Watch2Gether Bulk‑Push (max. 50 Items / Request)
- Discovery-Ansicht mit verfügbaren (ungesehenen) Videos pro Kategorie
- Push-History im Admin-Menü (mit Veröffentlichungs- und Push-Zeitpunkt)
- Persistenz: `categories.json` + `w2g_history.json` (verhütet Doppelungen)
- **Optionaler Zeit-Filter:** `MIN_VIDEO_PUBLISHED_AT` ermöglicht das Ignorieren von Videos, die vor einem konfigurierten Datum veröffentlicht wurden (nützlich, um alte/bereits verarbeitete Videos auszuschließen).
- Sauberes Fehler‑Handling & UX‑konforme Interaction‑Antworten

## ⚙️ Voraussetzungen
- Node.js 22+ (ESM, `type: "module"` in `package.json`)
- Discord Application (Bot Token, Client ID)
- YouTube Data API Key (v3)
- Watch2Gether API Key + Room ID (streamkey)

## 🔐 Konfiguration und Environment-Variablen
Erstelle eine `.env` im Projektroot. Die Werte werden zentral über die Konfigurationslogik geladen und validiert:

```env
# Optional: defaults to development when empty or unset
NODE_ENV=development

DISCORD_TOKEN=bot_token_here
DISCORD_CLIENT_ID=application_client_id
# optional für schnelle Entwicklung (registriert nur in dieser Guild)
DISCORD_GUILD_ID=guild_id_for_dev

YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_REQUEST_TIMEOUT_MS=10000

W2G_API_KEY=your_w2g_api_key
W2G_ROOM_ID=streamkey_of_room
W2G_DRY_RUN=false
W2G_FORCE_LIVE=false
W2G_REQUEST_TIMEOUT_MS=10000
W2G_MIN_REQUEST_INTERVAL_MS=1000
W2G_DEBUG=false

# Optional: empty values fall back to the built-in defaults
DATABASE_PATH=data/krustentv.sqlite
# Optional: nur Videos berücksichtigen, die an/ab diesem Datum veröffentlicht wurden (ISO 8601)
# Beispiel: MIN_VIDEO_PUBLISHED_AT=2026-01-01T00:00:00Z
MIN_VIDEO_PUBLISHED_AT=2026-01-01T00:00:00Z

ADMIN_USER_IDS=
ADMIN_ROLE_IDS=
ADMIN_ALLOW_ALL_MEMBERS=false
SESSION_TTL_MINUTES=60
```

> WICHTIG: `W2G_API_KEY` muss zu einem Account gehören, der Mitglied des Rooms ist. Wenn `W2G_DRY_RUN=true`, werden echte Watch2Gether-POSTs übersprungen. Mit `W2G_FORCE_LIVE=true` wird Live-Push trotz Dry-Run erzwingt, sofern die nötigen Credentials gesetzt sind.

## Installation & Entwicklung
```bash
npm install
npm run dev   # node --watch index.js
# oder
npm start
```

Für schnelle Slash-Command-Entwicklung: setze `DISCORD_GUILD_ID` → Commands werden direkt in dieser Guild registriert.

## 🚀 Hosting auf bot-hosting.net
Für den Beta-Deploy auf bot-hosting.net sind folgende Punkte wichtig:
- Node.js 22+ verwenden
- `npm install` als Installationsbefehl setzen
- `npm start` als Startbefehl setzen
- Eine `.env`-Datei mit den echten Secrets im Host-Setup hinterlegen
- Für den ersten Beta-Deploy empfiehlt sich `W2G_DRY_RUN=true`, bis der Live-Flow stabil geprüft ist

Weitere Details sind in [docs/BOT_HOSTING_NET.md](docs/BOT_HOSTING_NET.md) beschrieben. Für die Beta-Funktionsprüfung und den späteren GitHub-Deploy-Flow steht zusätzlich [docs/BETA_FUNCTIONALITY_CHECKLIST.md](docs/BETA_FUNCTIONALITY_CHECKLIST.md) zur Verfügung. Für den operativen Betrieb der Beta-Phase ergänzt [docs/BETA_OPERATIONS_CHECKLIST.md](docs/BETA_OPERATIONS_CHECKLIST.md) die Checkliste. Für den finalen Abschluss- und Go-Live-Check steht [docs/BETA_RELEASE_CHECKLIST.md](docs/BETA_RELEASE_CHECKLIST.md) bereit.

## 📥 Verfügbare Slash-Commands (`/krustentv`)
- `/krustentv menu` — öffnet das aktuelle Hauptmenü mit TV-, Admin- und Hilfe-Aktionen
- `/krustentv ping` — prüft Bot-Verbindung
- `/krustentv help` — zeigt die aktuelle Hilfeseite mit Version
- `/krustentv version` — zeigt die aktuell laufende Bot-Version

> Hinweis: Die älteren Direkt-Subcommands wie `start`, `overview`, `category_*` und `channel_*` sind im aktuellen Refactor nicht mehr als eigene Slash-Commands registriert; sie werden über das Menü und die Button-/Modal-Interaktionen gesteuert.

## 🔁 Datenmodell (Kurz)
- `categories.json` enthält Objekt mit Kategorien → Channels (siehe Datei im Repo)
- `w2g_history.json` speichert bereits gepushte/gesehene Video‑IDs und Push-History
- Gesehene Videos bleiben gefiltert, bis die Watch-History manuell gelöscht wird

## ▶️ Playback-Modi (Queue-Mix)
Nach Auswahl von Watchtime und Kategorien kannst du wählen, wie die Videos abgespielt werden:
- `Shuffle` (default): Videos werden zufällig gemischt
- `Category Blocks`: Videos werden blockweise nach Kategorien sortiert
- `Veröffentlichung (Neueste zuerst)`: Sortierung nach Datum absteigend
- `Veröffentlichung (Älteste zuerst)`: Sortierung nach Datum aufsteigend

Diese Auswahl beeinflusst nur die Reihenfolge, nicht die Auswahl der Videos (die Queue-Auswahl respektiert weiterhin Gewichtungen und Watchtime).

## 🎯 Aktuelle Filterlogik
- Nur Videos ab 181 Sekunden werden berücksichtigt
- Als Shorts/Kurzvideos erkannte Inhalte werden gefiltert
- Bereits gepushte/gesehene Videos werden für Discovery und Queue übersprungen

## 🧭 Watch2Gether Hinweise
- Es existiert genau **ein** Room (Room ID via `W2G_ROOM_ID`)
- Push erfolgt per Bulk (max. 50 Items / Request) an:
  `POST https://api.w2g.tv/rooms/{ROOM_ID}/playlists/current/playlist_items/sync_update`
- Body muss `w2g_api_key` enthalten (nicht als Header)

## 🧪 Testing & Entwicklung
- Für Integrationstests: setze `DISCORD_GUILD_ID` zum schnellen Command-Iterieren.
- Testen mit Jest:
  - `npm test`
  - `npm run test:coverage`

## ⚠️ Best Practices / Troubleshooting
- Jede Interaction wird exakt einmal beantwortet (deferReply / editReply / followUp via helper).
- Bei `403` von W2G: prüfe, ob API‑User im Room ist, oder ob `W2G_ROOM_ID` korrekt ist.
- Fehlende ENV → Startup bricht ab mit klarer Fehlermeldung (fail‑fast).

## 📂 Dateistruktur (Kurz)
- `index.js` — Discord Setup, Command Router
- `youtube.js` — YouTube-Auflösung & API‑Requests
- `w2g_push.js` — Watch2Gether Push / Validierung
- `w2g_history.js` — Gesehene Videos & Cache
- `queue_builder.js` — Queue‑Logik (ALT → NEU)
- `categories.js` — Kategorien & Channels persistieren

## Mitwirken / Contributing
PRs willkommen — bitte Tests und kurze Beschreibung beifügen.

## Lizenz
ISC
