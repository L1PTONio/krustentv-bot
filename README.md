# KrüstchenTV Bot

## English

A stable, currently beta-focused Discord bot that collects new YouTube videos and pushes them to a fixed Watch2Gether room.

> Beta status: Intended for private/friend testing, not a fully hardened production setup.

### 🔧 Features
- Automatic discovery of new videos by category/channel
- Interactive TV flow: watchtime, category selection, order strategy, preview, push
- Watch2Gether bulk push (max 50 items per request)
- Discovery view for currently available (unseen) videos per category
- Push history in the admin menu (published and pushed timestamps)
- Persistence via `categories.json` and `w2g_history.json`
- Optional time filter via `MIN_VIDEO_PUBLISHED_AT`

### ⚙️ Requirements
- Node.js 22+
- Discord Application (bot token, client ID)
- YouTube Data API key (v3)
- Watch2Gether API key + room ID (streamkey)

### 🔐 Configuration (.env)

Use the same `.env` block shown above.

Important:
- `W2G_API_KEY` must belong to an account that is a member of the target room.
- `W2G_DRY_RUN=true` skips real Watch2Gether POST calls.
- `W2G_FORCE_LIVE=true` forces live push even in dry run mode (with valid credentials).

### Installation & Development

```bash
npm install
npm run dev   # node --watch index.js
# or
npm start
```

For faster slash-command iteration, set `DISCORD_GUILD_ID`.

### 📥 Slash Commands (`/krustentv`)
- `/krustentv menu` - open main menu (TV/Admin/Help)
- `/krustentv ping` - connectivity check
- `/krustentv help` - help page
- `/krustentv version` - running bot version

Note:
- Older direct subcommands like `start`, `overview`, `category_*`, `channel_*` are no longer registered.
- Those flows are handled through menu/button/modal interactions.

### 🔁 Data Model (Short)
- `categories.json`: categories and channels
- `w2g_history.json`: pushed/seen video IDs and push history
- Seen videos stay filtered until watch history is manually cleared

### ▶️ Playback Modes
- `Shuffle` (default): random order
- `Category Blocks`: grouped by category
- `Published (Newest first)`: descending by publish date
- `Published (Oldest first)`: ascending by publish date

### 🎯 Filtering
- Only videos with at least 181 seconds
- Detected shorts/short-form content is filtered out
- Already pushed/seen videos are skipped

### 🧪 Testing
- `npm test`
- `npm run test:coverage`

### ⚠️ Troubleshooting
- Every interaction is answered exactly once
- For W2G `403`: verify room membership and `W2G_ROOM_ID`
- Missing env values trigger fail-fast startup errors

### 📂 File Structure (Short)
- `index.js` - Discord setup and routing
- `youtube.js` - YouTube resolution and API requests
- `w2g_push.js` - Watch2Gether push/validation
- `w2g_history.js` - seen/push history
- `queue_builder.js` - queue logic wrapper
- `categories.js` - category/channel persistence

## Deutsch

Ein stabiler, derzeit beta-orientierter Discord-Bot, der neue YouTube-Videos sammelt und per Watch2Gether API in einen festen Raum pusht.

> Beta-Status: Für privaten Freundes-/Testbetrieb gedacht, nicht als vollständig abgesicherter Produktivbetrieb.

### 🔧 Features
- Automatische Suche nach neuen Videos pro Kategorie/Channel
- Interaktiver TV-Flow: Watchtime, Kategorie-Auswahl, Reihenfolge, Vorschau, Push
- Watch2Gether Bulk-Push (max. 50 Items pro Request)
- Discovery-Ansicht mit verfügbaren (ungesehenen) Videos pro Kategorie
- Push-History im Admin-Menü (Veröffentlichungs- und Push-Zeitpunkt)
- Persistenz über `categories.json` und `w2g_history.json`
- Optionaler Zeitfilter via `MIN_VIDEO_PUBLISHED_AT`

### ⚙️ Voraussetzungen
- Node.js 22+
- Discord Application (Bot Token, Client ID)
- YouTube Data API Key (v3)
- Watch2Gether API Key + Room ID (streamkey)

### 🔐 Konfiguration (.env)

```env
# Optional: defaults to development when empty or unset
NODE_ENV=development

DISCORD_TOKEN=bot_token_here
DISCORD_CLIENT_ID=application_client_id
# optional for fast dev registration in one guild
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

# Optional: empty values fall back to built-in defaults
DATABASE_PATH=data/krustentv.sqlite
# Optional: only include videos published on/after this timestamp (ISO 8601)
MIN_VIDEO_PUBLISHED_AT=2026-01-01T00:00:00Z

ADMIN_USER_IDS=
ADMIN_ROLE_IDS=
ADMIN_ALLOW_ALL_MEMBERS=false
SESSION_TTL_MINUTES=60
```

Wichtig:
- `W2G_API_KEY` muss zu einem Account gehören, der Mitglied im Room ist.
- `W2G_DRY_RUN=true` überspringt echte Watch2Gether-POSTs.
- `W2G_FORCE_LIVE=true` erzwingt Live-Push trotz Dry-Run (mit gültigen Credentials).

### Installation & Entwicklung

```bash
npm install
npm run dev   # node --watch index.js
# oder
npm start
```

Für schnelle Slash-Command-Entwicklung: `DISCORD_GUILD_ID` setzen.

### 🚀 Hosting auf bot-hosting.net
- Node.js 22+ verwenden
- `npm install` als Installationsbefehl
- `npm start` als Startbefehl
- `.env` mit echten Secrets im Host-Setup hinterlegen
- Für den ersten Deploy: `W2G_DRY_RUN=true`

Weitere Infos:
- [docs/BOT_HOSTING_NET.md](docs/BOT_HOSTING_NET.md)
- [docs/BETA_FUNCTIONALITY_CHECKLIST.md](docs/BETA_FUNCTIONALITY_CHECKLIST.md)
- [docs/BETA_OPERATIONS_CHECKLIST.md](docs/BETA_OPERATIONS_CHECKLIST.md)
- [docs/BETA_RELEASE_CHECKLIST.md](docs/BETA_RELEASE_CHECKLIST.md)

### 📥 Slash Commands (`/krustentv`)
- `/krustentv menu` - Hauptmenü (TV/Admin/Hilfe)
- `/krustentv ping` - Verbindungscheck
- `/krustentv help` - Hilfeseite
- `/krustentv version` - aktuelle Version

Hinweis:
- Ältere Direkt-Subcommands wie `start`, `overview`, `category_*`, `channel_*` sind nicht mehr separat registriert.
- Diese Funktionen laufen über Menü-/Button-/Modal-Interaktionen.

### 🔁 Datenmodell (Kurz)
- `categories.json`: Kategorien und Channels
- `w2g_history.json`: gepushte/gesehene Video-IDs und Push-History
- Gesehene Videos bleiben gefiltert, bis die Watch-History manuell gelöscht wird

### ▶️ Playback-Modi
- `Shuffle` (default): zufällige Reihenfolge
- `Category Blocks`: nach Kategorien blockweise
- `Veröffentlichung (Neueste zuerst)`: Datum absteigend
- `Veröffentlichung (Älteste zuerst)`: Datum aufsteigend

### 🎯 Filterlogik
- Nur Videos ab 181 Sekunden
- Erkannte Shorts/Kurzvideos werden gefiltert
- Bereits gepushte/gesehene Videos werden übersprungen

### 🧪 Testing
- `npm test`
- `npm run test:coverage`

### ⚠️ Troubleshooting
- Jede Interaction wird genau einmal beantwortet
- Bei `403` von W2G: Room-Mitgliedschaft und `W2G_ROOM_ID` prüfen
- Fehlende ENV: fail-fast Startup mit klarer Meldung

### 📂 Dateistruktur (Kurz)
- `index.js` - Discord Setup und Routing
- `youtube.js` - YouTube-Auflösung und API Requests
- `w2g_push.js` - Watch2Gether Push/Validierung
- `w2g_history.js` - Gesehen/Push-History
- `queue_builder.js` - Queue-Logik Wrapper
- `categories.js` - Kategorien/Channels Persistenz

## Contributing

PRs are welcome. Please include tests and a short description.

## License

ISC
