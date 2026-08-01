# KrüstchenTV Bot

Ein stabiler Discord-Bot, der automatisch neue YouTube‑Videos sammelt und per Watch2Gether API in einen festen Raum pusht.

## 🔧 Features
- Automatische Suche nach neuen Videos pro Kategorie/Channel
- Interaktiver Start‑Dialog (Watchtime, Kategorie‑Toggle, Bulk‑Push)
- Watch2Gether Bulk‑Push (max. 50 Items / Request)
- Persistenz: `categories.json` + `w2g_history.json` (verhütet Doppelungen)
- **Optionaler Zeit-Filter:** `MIN_VIDEO_PUBLISHED_AT` ermöglicht das Ignorieren von Videos, die vor einem konfigurierten Datum veröffentlicht wurden (nützlich, um alte/bereits verarbeitete Videos auszuschließen).
- Sauberes Fehler‑Handling & UX‑konforme Interaction‑Antworten

## ⚙️ Voraussetzungen
- Node.js 18+ (ESM, `type: "module"` in `package.json`)
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

## 📥 Verfügbare Slash-Commands (`/krustentv`)
- `/krustentv ping` — prüft Bot-Verbindung
- `/krustentv test_w2g` — Testet Watch2Gether Verbindung
- `/krustentv start` — startet den interaktiven Push-Dialog (inkl. Playback-Modus: Shuffle / Category Blocks / Manuelle Reihenfolge)
- `/krustentv overview` — zeigt Kategorien & Channels

Kategorie-Management:
- `/krustentv category_list`
- `/krustentv category_add name`
- `/krustentv category_rename old new`
- `/krustentv category_delete name` (nur wenn leer)

Channel-Management:
- `/krustentv channel_list category`
- `/krustentv channel_add category input` (URL / ID / @Handle)
- `/krustentv channel_remove category channel_id`

## 🔁 Datenmodell (Kurz)
- `categories.json` enthält Objekt mit Kategorien → Channels (siehe Datei im Repo)
- `w2g_history.json` speichert bereits gepushte Video‑IDs und `lastCacheReset` (Cache gilt bis 12:00 Uhr)

## ▶️ Playback-Modi (Queue-Mix)
Nach Auswahl von Watchtime und Kategorien kannst du wählen, wie die Videos abgespielt werden:
- `Shuffle` (default): Kategorien werden fair gemischt (intern chronologisch)
- `Category Blocks`: Kategorien werden blockweise (z.B. alphabetisch) abgespielt
- `Manual Order`: Du legst die Kategorie-Reihenfolge explizit fest

Diese Auswahl beeinflusst nur die Reihenfolge, nicht die Auswahl der Videos (die Queue-Auswahl respektiert weiterhin Gewichtungen und Watchtime).

## 🧭 Watch2Gether Hinweise
- Es existiert genau **ein** Room (Room ID via `W2G_ROOM_ID`)
- Push erfolgt per Bulk (max. 50 Items / Request) an:
  `POST https://api.w2g.tv/rooms/{ROOM_ID}/playlists/current/playlist_items/sync_update`
- Body muss `w2g_api_key` enthalten (nicht als Header)

## 🧪 Testing & Entwicklung
- Für Integrationstests: setze `DISCORD_GUILD_ID` zum schnellen Command-Iterieren.
- Unit‑Tests (noch zu ergänzen) — Vorschlag: Jest für `categories.js` & `w2g_history.js`.

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
