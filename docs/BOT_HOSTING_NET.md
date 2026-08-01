# bot-hosting.net Setup für den KrüstchenTV-Bot

## Empfohlene Runtime
- Node.js 20+
- npm
- 1 CPU / 512 MB RAM reichen für die Beta-Phase aus, sofern keine hohen Parallelitäten erwartet werden

## Start- und Installationsbefehle
- Install: `npm install`
- Start: `npm start`

## Wichtige Hinweise für den Host
- Der Bot ist ein langfristig laufender Node-Prozess und sollte nicht mit `npm run dev` gestartet werden
- Für den Produktiv-/Beta-Betrieb wird `npm start` verwendet
- Die App erwartet eine `.env`-Datei im Repository-Root
- Die Persistenz-Dateien sollten im Workspace oder in einem persistenten Ordner liegen

## Empfohlene Umgebungsvariablen
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` (optional für Test-Guild)
- `YOUTUBE_API_KEY`
- `W2G_API_KEY`
- `W2G_ROOM_ID`
- `W2G_DRY_RUN=true` für die erste Beta-Phase, falls Live-Pushes noch nicht freigegeben sind
- `W2G_FORCE_LIVE=false`
- `ADMIN_USER_IDS` / `ADMIN_ROLE_IDS`
- `ADMIN_ALLOW_ALL_MEMBERS=false`
- `DATABASE_PATH=data/krustentv.sqlite`

## Persistenz und Dateisystem
- Die Bot-Daten sollten auf einem persistenten Dateisystem liegen
- Für die Beta-Phase sind die bestehenden JSON-/SQLite-Dateien ausreichend
- Falls der Host einen dedizierten persistenten Ordner anbietet, sollte `DATABASE_PATH` darauf zeigen

## Health-Check nach dem Deploy
- Bot startet ohne Fehler
- Slash-Commands sind registriert
- `/krustentv ping` antwortet
- `/krustentv help` zeigt die Beta-Ansicht

## Empfohlener Deploy-Checkliste
1. Repository auf dem Host laden
2. `npm install` ausführen
3. `.env` mit echten Werten anlegen
4. `npm start` starten
5. Logs prüfen
6. Bot mit `/krustentv ping` testen
