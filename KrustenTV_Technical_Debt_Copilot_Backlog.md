# KrüstchenTV – Technical-Debt-Backlog und Copilot-Bauanleitungen

## Zweck dieses Dokuments

Dieses Dokument ist für die schrittweise Umsetzung im **GitHub-Copilot-Agent-Modus in VS Code** gedacht. Es basiert auf dem aktuell vorliegenden Repository mit ESM-JavaScript, `discord.js`, YouTube Data API, Watch2Gether und den Dateien `index.js`, `categories.js`, `youtube.js`, `queue_builder.js`, `w2g_history.js` und `w2g_push.js`.

Der Bot wird nur in einer vertrauenswürdigen Freundesgruppe auf einem Discord-Server genutzt. Deshalb vermeidet der Zielentwurf unnötige Mandanten-, Kubernetes- oder Enterprise-Komplexität. Er beseitigt trotzdem Risiken, die auch auf einem privaten Server relevant sind: verlorene JSON-Schreibvorgänge, doppelte W2G-Pushes, nicht reproduzierbare Queues, unkontrollierte API-Aufrufe, abgelaufene Discord-Interaktionen und Tests, die den produktiven Code nicht wirklich ausführen.

Die Prompts sind absichtlich klein geschnitten. **Immer nur einen Prompt umsetzen, prüfen und committen.** Ein einziger Mega-Prompt für die gesamte Modernisierung wäre deutlich fehleranfälliger.

---

## Verbindliche Zielentscheidungen

Diese Entscheidungen gelten für alle Tickets und sollen nicht in jedem Ticket neu diskutiert werden:

1. **Runtime:** Node.js `>=20`, npm, ESM. Kein Wechsel zu TypeScript im Rahmen dieses Backlogs.
2. **Sprache:** Englische Bezeichner im Code; deutsche, nutzergerichtete Discord-Texte bleiben deutsch.
3. **Persistenz:** SQLite über `better-sqlite3`, ohne ORM. Eine lokale Datei ist für einen einzelnen Bot-Prozess ausreichend und leicht zu sichern.
4. **Datenbankpfad:** Standard `data/krustentv.sqlite`, überschreibbar über `DATABASE_PATH`.
5. **Zeitangaben:** In der Datenbank ausschließlich UTC als ISO-8601-Text. Lokale Darstellung darf Discord-Timestamps verwenden.
6. **Architektur:** Dünner Bootstrap, testbarer Application-Container, Services und Repositories mit Dependency Injection. Das Importieren eines Moduls darf weder Discord-Login noch Command-Registrierung noch Netzwerkzugriffe auslösen.
7. **HTTP:** Alle Requests mit `AbortController`, Statusprüfung, begrenzten Antwortgrößen und redigierten Logs. Keine echten Netzwerkzugriffe in Tests.
8. **W2G-Sicherheit:** Mutierende POST-Requests werden lokal serialisiert und über persistente Push-Jobs nachvollziehbar gemacht. Nach einem unklaren Timeout wird nicht blind automatisch erneut gepusht.
9. **Queue-Logik:** Der Queue-Builder ist rein und führt keine YouTube-Requests aus. Metadaten werden vorher geladen.
10. **Discord-Komponenten:** Custom IDs maximal 100 Zeichen; Select-Menüs maximal 25 Optionen; Embeds und Action Rows werden vor dem Senden begrenzt oder paginiert.
11. **Tests:** Produktionsdateien und produktive Datenbank werden nie von Tests verändert. Tests nutzen `:memory:` oder temporäre Verzeichnisse.
12. **Kompatibilität:** Bestehende Nutzerflüsse sollen während der Modernisierung grundsätzlich erhalten bleiben. Veraltete Wrapper dürfen vorübergehend bestehen, müssen aber intern auf neue Services delegieren.
13. **Secrets:** Tokens und API-Keys dürfen weder in Git noch in Logs, Fehlerobjekten, Snapshots oder Test-Fixtures erscheinen.
14. **Dokumentation:** Der tatsächliche Code ist zunächst die Quelle der Wahrheit. Widersprüchliche Dokumentation wird am Ende an die implementierte Realität angepasst.

---

## So werden die Prompts in VS Code verwendet

1. Einen neuen Branch für genau ein Ticket erstellen, zum Beispiel `refactor/td-001-quality-baseline`.
2. VS Code im Repository-Root öffnen.
3. GitHub Copilot Chat auf **Agent** stellen.
4. Den vollständigen Prompt des Tickets einfügen.
5. Den Agenten Dateien ändern und die genannten Prüfkommandos ausführen lassen.
6. Diff prüfen. Besonders Datenbankmigrationen, Fehlerpfade, Discord-Custom-IDs und Netzwerk-Mocks manuell ansehen.
7. Nur committen, wenn die Abnahmekriterien erfüllt sind.
8. Erst danach mit dem nächsten Ticket fortfahren.

Wenn Copilot während eines Tickets eine größere Architekturänderung vorschlägt, die zu einem späteren Ticket gehört, soll diese **nicht vorgezogen** werden. Stattdessen soll Copilot einen kurzen Hinweis unter „Restarbeiten“ hinterlassen.

---

## Globale Definition of Done

Jedes Ticket gilt erst als erledigt, wenn alle zutreffenden Punkte erfüllt sind:

- Der Scope des Tickets ist vollständig, ohne unzusammenhängende Nebenrefactorings.
- Neue öffentliche Funktionen haben JSDoc für Parameter, Rückgabewerte und Fehlerfälle.
- Eingaben werden an der Modulgrenze validiert.
- Fehlertexte für Discord enthalten keine internen Stacktraces oder Secrets.
- Neue Logik hat positive, negative und mindestens einen Grenzfalltest.
- Tests führen keine echten Discord-, YouTube- oder Watch2Gether-Aufrufe aus.
- `npm run lint`, `npm test` und später `npm run check` sind erfolgreich.
- Migrationen sind wiederholbar und zerstören keine vorhandenen Daten.
- Bei nicht ausführbaren Prüfungen nennt Copilot exakt den Grund; es darf keinen Erfolg behaupten.
- Relevante Dokumentation und `.env.example` sind aktualisiert.
- Copilot beendet seine Antwort mit:
  - geänderten Dateien,
  - ausgeführten Kommandos und Ergebnissen,
  - Daten-/Konfigurationsmigrationen,
  - bekannten Restproblemen.

---

## Zielstruktur

Die Struktur darf inkrementell entstehen. Am Ende soll sie ungefähr so aussehen:

```text
index.js
src/
  bootstrap.js
  app/
    createApplication.js
  config/
    config.js
  db/
    database.js
    migrate.js
    migrations/
  repositories/
    categoryRepository.js
    videoHistoryRepository.js
    sessionRepository.js
    pushJobRepository.js
  services/
    authorizationService.js
    candidateService.js
    queueService.js
    sessionService.js
    w2gService.js
    youtubeService.js
  discord/
    commandDefinitions.js
    interactionRouter.js
    handlers/
      adminHandlers.js
      tvHandlers.js
      maintenanceHandlers.js
    views/
      adminViews.js
      tvViews.js
      commonViews.js
  utils/
    asyncMutex.js
    customId.js
    errors.js
    logger.js
    text.js
scripts/
  register-commands.js
  migrate-legacy-data.js
  backup-database.js
tests/
  unit/
  integration/
  fixtures/
data/
  .gitkeep
```

---

## Priorisierung und Abhängigkeiten

| ID | Titel | Priorität | Abhängigkeiten | Ergebnis |
|---|---|---:|---|---|
| TD-001 | Qualitäts-Baseline und Entwicklungswerkzeuge | P0 | – | Reproduzierbare Checks und klare Runtime |
| TD-002 | Zentrale Konfiguration | P0 | TD-001 | Keine ENV-Schattenzustände, testbare Config |
| TD-003 | Nebenwirkungsfreier Bootstrap | P0 | TD-002 | Importierbare und testbare Bot-Anwendung |
| TD-004 | SQLite-Grundlage und Migration Runner | P0 | TD-002 | Transaktionale Persistenz |
| TD-005 | Kategorien-/Channel-Repository und Legacy-Import | P0 | TD-004 | Keine verlorenen JSON-Updates |
| TD-006 | Video-History-Semantik und Repository | P0 | TD-004 | Konsistente Ausschluss- und Datumslogik |
| TD-007 | Sicherer und robuster YouTube-Service | P0 | TD-002, TD-003 | Validierte URLs, Timeouts, Batching |
| TD-008 | Reiner, deterministischer Queue-Builder | P0 | TD-007 | Korrekte Auswahl ohne Netzwerk im Algorithmus |
| TD-009 | W2G-Service mit Push-Jobs und Serialisierung | P0 | TD-004, TD-006 | Nachvollziehbare, bestmöglich idempotente Pushes |
| TD-010 | Persistente Flow-Sessions und Double-Click-Schutz | P0 | TD-004, TD-003 | Keine Session-Kollisionen oder Doppelaktionen |
| TD-011 | Discord-Handler und Views modularisieren | P1 | TD-003, TD-010 | Wartbarer Interaktionscode |
| TD-012 | Discord-Limits und Pagination | P1 | TD-011 | Skalierende UI ohne API-Fehler |
| TD-013 | Konfigurierbare Autorisierung | P1 | TD-002, TD-011 | Admin-Aktionen kontrollierbar, Freundesmodus möglich |
| TD-014 | Fehlerklassen, Logging und Observability | P1 | TD-003, TD-007, TD-009 | Diagnose ohne Secret-Leaks |
| TD-015 | Reale Unit-/Integrationstests und Coverage | P0 | TD-005 bis TD-014 | Tests prüfen echten Anwendungscode |
| TD-016 | Betrieb, Backups, Command-Registrierung und Dokumentation | P1 | TD-001 bis TD-015 | Wartbarer Betrieb und nachvollziehbare Wiederherstellung |

Empfohlene Reihenfolge: **TD-001 bis TD-016 ohne Überspringen**. Die Feature-Backlogs für Inbox und präzise Zeitplanung setzen mindestens TD-001 bis TD-012 sowie TD-015 voraus.

---

# Detaillierte Copilot-Prompts

## TD-001 – Qualitäts-Baseline und Entwicklungswerkzeuge

### Ziel

Eine reproduzierbare, ehrliche Qualitäts-Baseline schaffen, ohne in diesem Ticket die Bot-Logik umzubauen.

### Copilot-Prompt

```text
Arbeite im aktuellen KrüstchenTV-Repository. Implementiere ausschließlich Ticket TD-001 „Qualitäts-Baseline und Entwicklungswerkzeuge“.

Kontext:
- Das Projekt ist ESM-JavaScript mit discord.js, node-fetch und Jest.
- Der aktuelle Einstiegspunkt ist index.js.
- Bestehende Tests dürfen in diesem Ticket noch inhaltlich unvollständig sein, aber die Testausführung und die Berichterstattung müssen reproduzierbar werden.
- Vertraue bei Widersprüchen dem Code, nicht den Status-Dokumenten.

Aufgaben:
1. Ergänze in package.json:
   - engines.node = ">=20"
   - scripts: lint, test:coverage, check und check:syntax.
   - check soll mindestens lint, check:syntax und test ausführen.
   - Ändere package-lock.json ausschließlich über npm-Kommandos, niemals manuell.
2. Füge ESLint für ESM hinzu. Nutze eine moderne Flat-Config in eslint.config.js mit @eslint/js und globals.
   - Node- und Jest-Globals korrekt konfigurieren.
   - Keine globale automatische Umformatierung des gesamten Repositories.
   - Unbenutzte Variablen als Fehler behandeln, aber bewusst ungenutzte Catch-Parameter mit einem führenden Unterstrich erlauben.
3. Implementiere scripts/check-syntax.js, das alle produktiven .js-Dateien und Tests mit node --check prüft oder äquivalent zuverlässig validiert. Ignoriere node_modules und data.
4. Ergänze .editorconfig.
5. Erstelle .env.example mit allen aktuell verwendeten Variablen. Verwende nur Platzhalter, keine echten Werte. Dokumentiere W2G_DRY_RUN und W2G_FORCE_LIVE eindeutig.
6. Ergänze .gitignore um:
   - data/*.sqlite, data/*.sqlite-*, data/backups/, coverage/, .env.* mit Ausnahme .env.example,
   - temporäre Testdateien.
7. Erstelle docs/BASELINE.md mit:
   - tatsächlich ausgeführten Kommandos,
   - tatsächlichen Ergebnissen,
   - bekannten bestehenden Fehlern oder nicht installierbaren Paketen,
   - ausdrücklich keiner erfundenen Coverage-Angabe.
8. Entferne oder korrigiere in diesem Ticket keine fachlichen Funktionen.

Tests und Prüfungen:
- npm install oder npm ci ausführen.
- npm run check:syntax ausführen.
- npm run lint ausführen.
- npm test ausführen.
- npm run test:coverage ausführen.
- Falls ein Kommando wegen der lokalen Registry oder Umgebung nicht ausführbar ist, dokumentiere den exakten Fehler in docs/BASELINE.md und behaupte keinen Erfolg.

Abnahmekriterien:
- package.json enthält eine klare Node-Runtime und die neuen Scripts.
- ESLint kann das Repository analysieren.
- Syntaxprüfung umfasst alle relevanten JavaScript-Dateien.
- .env.example enthält keine Secrets.
- docs/BASELINE.md unterscheidet sauber zwischen bestanden, fehlgeschlagen und nicht ausführbar.
- Keine fachliche Verhaltensänderung am Bot.

Beende mit einer kompakten Liste aller geänderten Dateien, ausgeführten Kommandos, Resultate und Restprobleme.
```

---

## TD-002 – Zentrale, validierte Konfiguration

### Ziel

Alle Environment-Variablen einmalig, typisiert und testbar auswerten. Keine Module sollen Konfiguration beim Import in Konstanten einfrieren.

### Copilot-Prompt

```text
Implementiere ausschließlich Ticket TD-002 „Zentrale, validierte Konfiguration“ im KrüstchenTV-Repository. TD-001 ist bereits umgesetzt.

Problem im Bestand:
- index.js validiert eine feste Liste von ENV-Variablen.
- youtube.js und w2g_push.js lesen ENV-Werte beim Modulimport und frieren sie dadurch für Tests und Laufzeit ein.
- Dry-Run und Force-Live sind nicht als konsistente Konfigurationsregeln modelliert.

Zielarchitektur:
- src/config/config.js exportiert loadConfig(env = process.env) und optional redactConfig(config).
- loadConfig hat keine Seiteneffekte und beendet nicht selbst den Prozess.
- Der Bootstrap entscheidet, wie ein Config-Fehler ausgegeben und der Prozess beendet wird.

Implementiere:
1. Ein unveränderliches Config-Objekt mit mindestens:
   - nodeEnv
   - discord.token, clientId, guildId
   - youtube.apiKey, requestTimeoutMs
   - w2g.apiKey, roomId, dryRun, forceLive, requestTimeoutMs, minRequestIntervalMs, debug
   - database.path
   - video.minPublishedAt als Date oder null
   - admin.userIds, admin.roleIds, admin.allowAllMembers
   - sessions.ttlMinutes
2. Hilfsparser für required string, optional string, boolean, positive integer, CSV-ID-Liste und ISO-8601-Datum.
3. Validierungsregeln:
   - DISCORD_TOKEN, DISCORD_CLIENT_ID und YOUTUBE_API_KEY sind im normalen Bot-Betrieb Pflicht.
   - W2G_API_KEY und W2G_ROOM_ID sind Pflicht, wenn nicht dryRun aktiv ist oder forceLive aktiv ist.
   - forceLive und dryRun dürfen nicht zu einem stillen, widersprüchlichen Zustand führen. forceLive hat Vorrang und verlangt Credentials.
   - Room-ID nur alphanumerisch, Bindestrich und Unterstrich.
   - Timeout- und TTL-Werte müssen sinnvolle positive Grenzen haben.
   - MIN_VIDEO_PUBLISHED_AT muss ein valides Datum sein, falls gesetzt.
4. Eigene ConfigValidationError mit einer Liste verständlicher Feldfehler.
5. redactConfig darf Token/API-Key niemals vollständig ausgeben; am besten nur „configured: true/false“.
6. Migriere die unmittelbaren ENV-Lesezugriffe in index.js, youtube.js und w2g_push.js so weit, dass diese Module ihre Werte nicht mehr beim Import einfrieren. Nutze vorübergehende Factory-Funktionen oder Config-Parameter; vermeide in diesem Ticket einen kompletten Architekturumbau.
7. Aktualisiere .env.example und README nur für die tatsächlichen Variablen und Defaults.

Tests:
- tests/unit/config.test.js mit Tabellenfällen für gültige Config, fehlende Pflichtwerte, dryRun ohne W2G-Credentials, forceLive ohne Credentials, ungültige Booleans, Zahlen, Room-ID und Datum.
- Teste, dass redactConfig keine bekannten Secret-Testwerte enthält.
- Teste, dass zwei loadConfig-Aufrufe mit unterschiedlichen env-Objekten unterschiedliche Werte liefern; kein Import-Caching.

Nicht-Ziele:
- Noch keine SQLite-Implementierung.
- Noch keine vollständige Aufteilung von index.js.
- Keine echten Netzwerkaufrufe.

Abnahme:
- Kein produktives Modul hält API-Keys als importzeitlich berechnete Konstante.
- Konfigurationsfehler sind gesammelt und verständlich.
- Bestehendes Verhalten bleibt ansonsten erhalten.
- npm run check ist erfolgreich.

Berichte am Ende geänderte Dateien, Config-Schema, Defaults, Migration für bestehende .env-Dateien und Testresultate.
```

---

## TD-003 – Nebenwirkungsfreier Bootstrap und Application Factory

### Ziel

Das Projekt muss importierbar und testbar sein, ohne sofort Commands zu registrieren oder sich bei Discord anzumelden.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-003 „Nebenwirkungsfreier Bootstrap und Application Factory“. TD-001 und TD-002 sind abgeschlossen.

Ausgangslage:
- index.js registriert Commands und ruft client.login direkt beim Import auf.
- Fast alle Discord-Handler liegen in einer Datei mit über 2.000 Zeilen.
- Dieses Ticket schafft Testbarkeit, teilt aber die einzelnen Handler noch nicht vollständig auf; das folgt in TD-011.

Implementierung:
1. Lasse index.js zu einem sehr dünnen Einstiegspunkt werden, der loadConfig aufruft und anschließend startApplication(config) aus src/bootstrap.js startet.
2. Erstelle src/app/createApplication.js. Die Factory soll Abhängigkeiten annehmen oder erzeugen und mindestens zurückgeben:
   - config
   - logger
   - discordClient
   - interactionRouter beziehungsweise vorläufige Handler-Registrierung
   - start(), stop(), registerCommands()
3. Erstelle eine Discord-Client-Factory. Der Client wird erst in start() eingeloggt.
4. Verschiebe die aktuelle Command-Definition in src/discord/commandDefinitions.js als reine Funktion oder Konstante.
5. Kapsle die bestehende Interaktionslogik zunächst in ein importierbares Modul, zum Beispiel src/discord/legacyBotController.js. Es ist akzeptabel, dass dieses Modul vorübergehend groß bleibt. Es darf aber keine Login-, process.exit- oder Command-Registrierungs-Seiteneffekte beim Import haben.
6. registerCommands() muss explizit aufgerufen werden. Behalte vorerst das bestehende Laufzeitverhalten über eine Config-Option REGISTER_COMMANDS_ON_START bei, Default true für Kompatibilität; TD-016 trennt dies endgültig.
7. Global Error Handler werden im Bootstrap registriert und bei stop() wieder entfernt, damit Tests keine Listener ansammeln.
8. stop() muss den Discord-Client sauber zerstören und später erweiterbar sein.
9. Exporte so gestalten, dass Tests Fake-Client, Fake-REST und Fake-Logger injizieren können.

Tests:
- Import von index-nahen Modulen darf weder client.login noch REST.put aufrufen.
- createApplication mit Fakes erzeugt eine Anwendung ohne Netzwerk.
- start() ruft login genau einmal auf.
- stop() ruft destroy genau einmal auf und ist idempotent.
- registerCommands() nutzt Guild-Routes, wenn guildId gesetzt ist, sonst globale Routes.
- Config-Fehler im Bootstrap führen zu einem kontrollierten Fehlerpfad; Tests sollen process.exit nicht tatsächlich beenden, sondern den Bootstrap als Funktion testen.

Constraints:
- Noch keine fachliche Änderung an Menüs oder Queue.
- Kein kompletter Handler-Split in diesem Ticket.
- Keine echten Discord-Aufrufe in Tests.

Abnahme:
- Ein Test kann die Anwendung importieren und erzeugen, ohne Login oder REST-Aufruf.
- index.js enthält nur Bootstrap-Logik.
- npm run check ist erfolgreich.

Am Ende: Dateibaum der neuen Module, ausgeführte Tests und verbleibende Legacy-Kopplungen nennen.
```

---

## TD-004 – SQLite-Grundlage und Migration Runner

### Ziel

Eine kleine, robuste Datenbankgrundlage mit Transaktionen, Migrationsversionen und testbarer Verbindungsverwaltung schaffen.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-004 „SQLite-Grundlage und Migration Runner“. Vorbedingungen: TD-001 bis TD-003.

Technische Entscheidung:
- Nutze better-sqlite3 ohne ORM.
- Produktivpfad standardmäßig data/krustentv.sqlite, über config.database.path überschreibbar.
- Tests nutzen :memory: oder temporäre Dateien.

Aufgaben:
1. Füge better-sqlite3 als Dependency hinzu und aktualisiere package-lock über npm.
2. Erstelle src/db/database.js mit createDatabase({ path, logger }).
   - Elternverzeichnis anlegen, außer bei :memory:.
   - PRAGMA foreign_keys = ON.
   - PRAGMA journal_mode = WAL für Dateidatenbanken.
   - PRAGMA busy_timeout mit einem dokumentierten Default.
   - Sichere close()-Methode, idempotent.
3. Erstelle einen Migration Runner in src/db/migrate.js.
   - Tabelle schema_migrations(version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT).
   - Migrationen in deterministischer Reihenfolge.
   - Jede Migration in einer Transaktion.
   - Bereits angewendete Versionen überspringen.
   - Fehler lassen die jeweilige Migration vollständig zurückrollen.
4. Erstelle die initiale Migration mit Tabellen:
   - categories: id, name eindeutig ohne Beachtung der Groß-/Kleinschreibung, weight >= 1, created_at, updated_at.
   - channels: id als YouTube-Channel-ID, name, created_at, updated_at.
   - category_channels: category_id, channel_id, created_at, zusammengesetzter Primärschlüssel, Foreign Keys mit sinnvollen Delete-Regeln.
   - video_history: video_id, status, first_pushed_at, last_pushed_at, seen_at, ignored_at, source, created_at, updated_at. Status per CHECK begrenzen.
   - app_settings: key, value_json, updated_at.
   - flow_sessions: id, guild_id, user_id, channel_id, message_id, kind, state_json, status, version, expires_at, created_at, updated_at.
   - push_jobs: id, idempotency_key eindeutig, room_id, status, payload_hash, total_items, completed_items, error_code, error_message, created_at, updated_at.
   - push_job_items: job_id, position, video_id, url, title, status, error_message, pushed_at; Primärschlüssel job_id + position.
5. Füge geeignete Indizes für Session-Ablauf, Push-Status und History-Status hinzu.
6. Alle Timestamps werden als UTC-ISO-Strings geschrieben. Erstelle einen injizierbaren clock-Helper oder übergib now-Funktionen an Repositories; keine verstreuten new Date()-Aufrufe in zukünftigen Repositories.
7. Ergänze npm-Script db:migrate, das nur Migrationen ausführt und danach sauber schließt.
8. Registriere DB open/migrate/close im Application Lifecycle, ohne bestehende JSON-Module schon zu ersetzen.

Tests:
- Neue :memory:-DB enthält alle Tabellen und Indizes.
- Migration Runner ist idempotent.
- Eine absichtlich fehlschlagende Testmigration rollt vollständig zurück.
- Foreign-Key-Verhalten testen.
- close() ist idempotent.
- Dateipfad mit fehlendem Elternordner wird korrekt erstellt.

Nicht-Ziele:
- Noch kein Import von categories.json oder w2g_history.json.
- Noch keine Änderung der fachlichen Module.

Abnahme:
- npm run db:migrate funktioniert auf leerer Datenbank.
- Migrationen sind transaktional und wiederholbar.
- Tests verwenden keine produktive Datei.
- data/krustentv.sqlite bleibt durch .gitignore außerhalb von Git.

Berichte Schema, Indizes, Migrationsversion und Testresultate.
```

---

## TD-005 – Kategorien-/Channel-Repository und Legacy-Import

### Ziel

Die nicht nebenläufigkeitssichere JSON-Persistenz ersetzen und Channel-Verschiebungen atomar machen.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-005 „Kategorien-/Channel-Repository und Legacy-Import“. TD-004 ist fertig.

Bestehende Probleme:
- categories.js liest und schreibt die gesamte JSON-Datei pro Operation.
- Parallele Änderungen können sich überschreiben.
- Channel-Verschieben besteht aus Entfernen und anschließendem Hinzufügen und ist nicht atomar.
- Lesefehler werden fälschlich als leere Konfiguration interpretiert.

Implementiere:
1. src/repositories/categoryRepository.js als Klasse oder Factory mit injizierter DB und Clock.
2. Öffentliche Methoden:
   - listCategories() mit Channels und weight in einer stabilen Reihenfolge.
   - getCategoryByName(name).
   - createCategory(name, { weight = 1 }).
   - renameCategory(oldName, newName).
   - deleteCategory(name) nur wenn leer.
   - addChannel(categoryName, { id, name }).
   - removeChannel(categoryName, channelId).
   - moveChannel({ channelId, fromCategory, toCategory }) in genau einer DB-Transaktion.
   - listChannels(categoryName).
   - setCategoryWeight(name, weight), auch wenn die UI dafür erst später kommt.
3. Validierung:
   - Namen trimmen; leer, nur Whitespace oder überlang ablehnen.
   - Case-insensitive Duplikate verhindern.
   - Weight als Integer in einem dokumentierten Bereich, z. B. 1 bis 10.
   - YouTube-Channel-ID validieren, sofern eine UC-ID gespeichert wird.
4. Domänenspezifische Fehler: NotFoundError, ConflictError, ValidationError. Falls TD-014 noch nicht existiert, lege minimale Fehlerklassen in src/utils/errors.js an und erweitere sie später.
5. categories.js bleibt vorübergehend als Compatibility Wrapper erhalten, delegiert aber vollständig an das Repository aus dem Application Container oder eine klar dokumentierte Default-Instanz. Keine JSON-Schreibvorgänge mehr im normalen Betrieb.
6. Erstelle scripts/migrate-legacy-data.js und einen idempotenten Legacy-Importer:
   - categories.json sicher lesen und Schema validieren.
   - Vor Import eine timestamped Kopie unter data/legacy-backups/ anlegen.
   - Kategorien, weights und Channels in einer Transaktion importieren.
   - Bei erneutem Lauf keine Duplikate und keine Überschreibung neuer DB-Daten.
   - Importstatus in app_settings speichern.
   - --force darf nur nach expliziter Bestätigung beziehungsweise eindeutigem Flag neu importieren; niemals still löschen.
7. npm-Script migrate:legacy ergänzen.
8. Passe die aktuellen Aufrufer so an, dass sie das Repository nutzen, ohne die Discord-UX in diesem Ticket neu zu gestalten.

Tests:
- Vollständige CRUD-Fälle einschließlich Fehlerfälle.
- Case-insensitive Duplikate.
- Löschen nicht leerer Kategorie.
- moveChannel ist atomar; provoziere einen Fehler am Ziel und beweise, dass die Quelle unverändert bleibt.
- Mehrere Promise.all-Schreiboperationen verlieren keine Kategorien oder Channels.
- Legacy-Import auf leerer DB, erneuter idempotenter Lauf, ungültiges JSON, ungültiges Schema und Backup-Erzeugung.
- Kein Test verändert categories.json im Repository.

Abnahme:
- Normale Bot-Funktionen lesen/schreiben Kategorien nur noch über SQLite.
- Channel-Move ist eine Transaktion.
- Legacy-Daten können sicher und nachvollziehbar importiert werden.
- npm run check erfolgreich.

Am Ende genaue Migrationsanleitung für bestehende Installationen angeben.
```

---

## TD-006 – Video-History-Semantik und Repository

### Ziel

Die widersprüchliche Cache-/Datumslogik durch eine explizite, dauerhaft nachvollziehbare Verarbeitungshistorie ersetzen.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-006 „Video-History-Semantik und Repository“.

Bestandsprobleme:
- w2g_history.js speichert nur videoId -> true.
- Ein harter Cutoff 2026-01-01 widerspricht MIN_VIDEO_PUBLISHED_AT.
- Die Mittags-Reset-Logik ist fachlich unklar und wird nicht zuverlässig verwendet.
- „gesehen“ bedeutet im Bestand tatsächlich meist „zu W2G gepusht“.

Zielmodell:
- Unterscheide mindestens pushed, seen und ignored.
- Ein Video gilt für die normale Kandidatenauswahl als verarbeitet, sobald es erfolgreich gepusht oder explizit ignoriert wurde.
- Ein automatischer täglicher Reset entfällt.

Implementiere:
1. src/repositories/videoHistoryRepository.js mit Methoden:
   - get(videoId)
   - getMany(videoIds)
   - isProcessed(videoId)
   - markPushed(videoIds, { source, pushedAt, jobId optional })
   - markSeen(videoIds, { seenAt })
   - markIgnored(videoIds, { ignoredAt, source })
   - clear({ before optional, statuses optional }) für bewusste Wartung
2. Upserts müssen first_pushed_at erhalten und last_pushed_at aktualisieren.
3. Implementiere src/services/videoEligibilityService.js oder eine vergleichbare reine Funktion:
   - filterProcessed(videos)
   - Filter nach config.video.minPublishedAt.
   - Definiere explizit den Umgang mit fehlendem oder ungültigem publishedAt. Default: ablehnen und Diagnosegrund published_at_missing beziehungsweise published_at_invalid; über ALLOW_VIDEOS_WITHOUT_PUBLISHED_AT kann dies bewusst erlaubt werden.
   - Liefere accepted und rejected mit Gründen, nicht nur ein gefiltertes Array.
4. w2g_history.js bleibt als Compatibility Wrapper:
   - isVideoSeen darf vorübergehend isProcessed aufrufen.
   - markVideoSeen/markVideosSeen delegieren mit klarer Deprecated-JSDoc auf markPushed.
   - isCacheValid wird entfernt oder als deprecated no-op mit Warnung belassen, aber nirgendwo mehr fachlich genutzt.
5. Legacy-Import aus w2g_history.json:
   - true-Einträge als pushed importieren.
   - Backup wie in TD-005.
   - Idempotent über app_settings.
6. Entferne den hartcodierten 2026-Cutoff vollständig.
7. Aktualisiere Hilfe und README nur so weit, dass sie nicht mehr von einem täglichen Cache-Reset sprechen.

Tests:
- Upsert-Timestamps und first/last-Verhalten.
- processed für pushed und ignored, nicht automatisch für nur vorhandene Metadaten.
- minPublishedAt inklusive exakt am Grenzwert.
- fehlende/ungültige Datumswerte mit beiden Config-Modi.
- Legacy-Import und Wiederholung.
- Clock injizieren; keine Tests abhängig von aktueller Uhrzeit.
- Mehrere markPushed-Aufrufe verlieren keine IDs.

Abnahme:
- Keine harte Datumsgrenze im Code.
- Kein automatischer Mittags-Reset.
- Fachbegriffe pushed/seen/ignored sind im Code und in Tests eindeutig.
- Bestehende Aufrufer funktionieren über Wrapper weiter.
- npm run check erfolgreich.

Am Ende Breaking Changes, Legacy-Mapping und neue ENV-Variable dokumentieren.
```

---

## TD-007 – Sicherer und robuster YouTube-Service

### Ziel

YouTube-Aufrufe zentralisieren, SSRF-artige URL-Missbräuche verhindern, Fehler korrekt auswerten und API-Aufwand reduzieren.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-007 „Sicherer und robuster YouTube-Service“.

Bestandsprobleme:
- resolveChannelId prüft teilweise nur, ob der Text „youtube.com“ enthält, und ruft anschließend die Nutzereingabe serverseitig ab.
- node-fetch v3 unterstützt die verwendete timeout-Option nicht als verlässlichen Request-Timeout.
- response.ok und YouTube-Fehlerpayloads werden nicht überall geprüft.
- Video-Details werden einzeln und seriell geladen.
- API-Key steht in zusammengesetzten URLs und könnte in Logs landen.

Ziel:
- src/services/youtubeService.js als injizierbarer Service mit config, fetch, logger und optional clock.
- Keine Netzwerkzugriffe beim Import.

Implementiere:
1. Einen gemeinsamen requestJson-Helper für YouTube GETs:
   - URL und URLSearchParams verwenden.
   - AbortController-Timeout.
   - response.ok prüfen.
   - JSON-Fehlerpayload sicher parsen.
   - maximal zwei Retries nur für sichere GET-Requests bei 429 und ausgewählten 5xx mit begrenztem Backoff und Jitter.
   - API-Key in Logs immer redigieren.
2. Sichere Channel-Eingabe:
   - Direkte UC-ID akzeptieren.
   - @handle akzeptieren.
   - URLs nur über new URL parsen.
   - Nur https und Hostnamen youtube.com, www.youtube.com oder m.youtube.com erlauben.
   - Credentials, eigene Ports, IP-Adressen und fremde Hosts ablehnen.
   - Für HTML-Fallback die URL aus validiertem Host und validiertem Pfad selbst rekonstruieren; nie eine beliebige Nutzereingabe direkt fetchen.
   - Redirects entweder manuell validieren oder vollständig vermeiden. Maximal drei validierte Redirects.
   - Begrenze HTML-Antwortgröße, bevor der komplette Body verarbeitet wird.
3. Service-Methoden:
   - getChannelInfo(channelId)
   - resolveChannelId(input)
   - getChannelUploads(channelId, { maxResults })
   - getVideoDetails(videoId)
   - getVideoDetailsBatch(videoIds), in API-Batches von maximal 50 IDs, dedupliziert und stabil auf Eingabereihenfolge abbildbar.
4. Video-Details sollen mindestens durationSeconds, viewCount und vorhandene Snippet-/Live-Metadaten liefern, ohne Feature-9-Logik vorwegzunehmen.
5. parseIsoDuration als exportierte reine Funktion mit Tests.
6. Concurrency bei parallelen Channel-Aufrufen begrenzen, zum Beispiel mit einem kleinen eigenen mapWithConcurrency-Helper. Kein ungebremstes Promise.all über beliebig viele Kanäle.
7. Alte Exporte in youtube.js delegieren vorübergehend an den neuen Service; keine doppelte Implementierung.
8. Aussagekräftige ExternalServiceError-Objekte mit service, operation, status, retryable und sicherer Nutzerbotschaft.

Tests mit injiziertem Fake-Fetch:
- UC-ID, Handle und erlaubte URLs.
- Bösartige URLs wie youtube.com.example.org, userinfo@127.0.0.1, http, Port und Redirect zu fremdem Host werden abgelehnt.
- Timeout-Abbruch.
- 404, 403/Quota, 429 mit Retry und 500 mit begrenztem Retry.
- Kein Retry bei 400.
- Batch-Grenzen 1, 50, 51 und Duplikate.
- ISO-Dauern mit Stunden, Minuten, Sekunden und ungültigen Werten.
- In Logs/Feldern darf der Test-API-Key nicht vorkommen.

Nicht-Ziele:
- Noch kein periodischer Inbox-Scanner.
- Keine echten YouTube-Aufrufe in Tests.

Abnahme:
- Keine beliebigen Hosts werden gefetcht.
- Alle Requests haben echte Abort-Timeouts.
- Details können in Batches geladen werden.
- Bestehender Bot nutzt den neuen Service.
- npm run check erfolgreich.

Am Ende API-Methoden, Retry-Regeln und Sicherheitsentscheidungen zusammenfassen.
```

---

## TD-008 – Reiner, deterministischer Queue-Builder

### Ziel

Die bestehende Queue-Auswahl korrekt, reproduzierbar und unabhängig von externen APIs machen. Die hochpräzise Optimierung aus Feature 10 wird noch nicht implementiert.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-008 „Reiner, deterministischer Queue-Builder“.

Bestandsprobleme:
- queue_builder.js ruft getVideoDetails im Auswahlalgorithmus auf.
- Videos mit unbekannter Dauer werden als 0 Sekunden behandelt.
- Ein zu langes Video kann Schleifen per break beenden, obwohl spätere Videos passen würden.
- Shuffle ist nicht reproduzierbar.
- Eingaben und Gewichtungen sind nur schwach validiert.

Ziel:
- Der Planner ist eine reine Funktion. Alle Kandidaten besitzen vor dem Aufruf eine valide durationSeconds.
- Bestehende Strategien shuffle und category_blocks bleiben erhalten.
- Feature 10 kann später einen präziseren Optimierer ergänzen, ohne Discord-Code zu ändern.

Implementiere:
1. Definiere per JSDoc den VideoCandidate-Vertrag: id, title, durationSeconds, publishedAt optional, category, channelId optional.
2. Erstelle src/services/queueService.js oder src/domain/queueBuilder.js mit:
   - buildQueue(candidates, options)
   - buildWeightedQueue(categoryMap, options)
   - calculateTotalWatchtime(videos)
3. Options mindestens:
   - targetSeconds
   - toleranceSeconds
   - strategy: shuffle oder category_blocks
   - seed für deterministischen Zufall
   - allowSingleOversize default false
4. Validierung:
   - target > 0, tolerance >= 0, finite integers.
   - durationSeconds muss > 0 und finite sein; andernfalls Kandidat ablehnen und Diagnosegrund liefern.
   - IDs deduplizieren.
   - Category weight als Integer 1 bis 10 begrenzen.
5. Algorithmische Korrekturen:
   - Zu lange Kandidaten immer überspringen, niemals die gesamte Suche abbrechen.
   - Keine 0-Sekunden-Videos auswählen.
   - Der Fallback darf nur ein überlanges Einzelvideo nehmen, wenn allowSingleOversize explizit true ist.
   - Interne Category-Arrays nicht mutieren; Eingaben bleiben unverändert.
   - Shuffle über eine kleine seedbare PRNG oder injizierte random-Funktion deterministisch machen.
6. Rückgabe:
   - queue
   - totalSeconds und gerundete Darstellung nur zusätzlich, nicht als einzige Wahrheit
   - targetSeconds, toleranceSeconds, deltaSeconds
   - withinTolerance
   - rejectedCandidates mit reason
   - seed und strategy
7. Bestehende queue_builder.js-Exporte als Compatibility Wrapper erhalten und dort Minuten in Sekunden umrechnen.
8. Der TV-Flow muss vor dem Planner über youtubeService.getVideoDetailsBatch fehlende Dauern hydratisieren. Unbekannte Dauern werden sichtbar ausgeschlossen.

Tests:
- Exakter Treffer.
- Unterfüllung und Toleranz.
- Zu langes Video vor passenden Videos; passende müssen trotzdem gewählt werden.
- Nur überlange Videos mit allowSingleOversize false/true.
- Dauer 0, NaN, negativ und fehlend.
- Doppelte ID.
- Gleicher Seed ergibt gleiche Reihenfolge; andere Seeds dürfen abweichen.
- category_blocks bleibt gruppiert.
- Eingabeobjekte und Arrays werden nicht mutiert.
- Der Queue-Builder führt keinen Fetch aus und importiert youtubeService nicht.

Abnahme:
- Planner ist rein und deterministisch.
- Bekannte Abbruchfehler sind durch Regressionstests abgedeckt.
- UI zeigt ausgeschlossene Videos mit unbekannter Dauer zumindest zusammengefasst an.
- npm run check erfolgreich.

Keine dynamische Programmierung oder „+20 Minuten“-Funktion in diesem Ticket implementieren.
```

---

## TD-009 – W2G-Service mit Push-Jobs, Serialisierung und sicherem Health Check

### Ziel

Doppel-Pushes und unklare Teilfehler bestmöglich beherrschen und den mutierenden Verbindungstest entfernen.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-009 „W2G-Service mit Push-Jobs, Serialisierung und sicherem Health Check“.

Wichtige Realität:
- Die externe W2G-API kann lokale Datenbanktransaktionen nicht atomar teilen.
- Nach einem Netzwerk-Timeout kann unklar sein, ob ein POST serverseitig wirksam war.
- Implementiere deshalb keine falsche Exactly-once-Garantie. Unklare Zustände müssen sichtbar und manuell entscheidbar sein.

Bestandsprobleme:
- Parallele Pushes teilen eine nicht geschützte lastRequestTime.
- Chunks werden teilweise übertragen, History aber erst ganz am Ende markiert.
- Ein erneuter Versuch kann Duplikate erzeugen.
- testW2GConnection fügt ein echtes Testvideo hinzu.

Implementiere src/services/w2gService.js mit injizierter Config, Fetch, Logger, Clock, PushJobRepository und VideoHistoryRepository.

1. Lokale Serialisierung:
   - Ein AsyncMutex oder Promise-Queue serialisiert sämtliche mutierenden W2G-Requests pro Room.
   - Rate-Limit-Zeitpunkt wird innerhalb derselben kritischen Sektion aktualisiert.
2. Push-Jobs:
   - createPushJob(items, idempotencyKey) speichert Payload-Hash, Items und Status pending.
   - Gleicher idempotencyKey plus gleicher Hash liefert vorhandenes Ergebnis.
   - Gleicher Key plus anderer Hash ist ConflictError.
   - Jobstatus: pending, running, partially_succeeded, succeeded, failed, needs_review.
   - Itemstatus: pending, in_flight, pushed, failed, unknown.
3. Chunking:
   - Maximal 50 Items pro Request.
   - Vor jedem POST Items in_flight markieren und committen.
   - Nach eindeutig erfolgreicher Response Items pushed markieren und direkt videoHistory.markPushed für genau diese IDs ausführen.
   - Bei eindeutigem HTTP-Fehler ohne Erfolg Items failed.
   - Bei Timeout, Verbindungsabbruch nach Request-Start oder nicht eindeutigem Resultat Items unknown und Job needs_review. Diese Items nicht automatisch erneut senden.
4. Resume:
   - resumePushJob(jobId) darf nur pending/failed Items senden.
   - unknown Items benötigen eine explizite Option confirmRetryUnknown=true und sollen vorher in der UI gewarnt werden.
5. Retry-Regeln:
   - Keine blinden automatischen Retries für mutierende POSTs.
   - Rate-Limit-Wartezeit ist erlaubt, aber erneutes POSTen nach unklarer Übertragung nicht.
6. HTTP:
   - AbortController-Timeout.
   - Request-/Response-Logs ohne API-Key.
   - Antworttext begrenzen und sicher parsen.
7. Dry-Run:
   - Dry-Run erzeugt nachvollziehbare Jobs und markiert Items als simulated oder pushed mit einem klaren dry_run-Merkmal; entscheide ein konsistentes Schema und teste es.
   - Keine externe Anfrage.
8. Health Check:
   - testW2GConnection darf keinen POST und kein Testvideo erzeugen.
   - Nutze einen vorhandenen read-only Playlist-Request, falls er mit der bestehenden API funktioniert.
   - Trenne „lokale Konfiguration valide“ von „Remote read check erfolgreich“. Falls kein verlässlicher Remote-Check möglich ist, sage dies in Resultat und UI ausdrücklich; niemals Erfolg vortäuschen.
9. getCurrentPlaylist normalisiert Erfolg/Fehler und liefert stets eine dokumentierte Form.
10. Alte Exporte in w2g_push.js delegieren an den Service.

Tests:
- Chunkgrößen 1, 50, 51, 120.
- Zwei parallele Pushes laufen seriell.
- Gleicher Idempotency-Key wird nicht doppelt gesendet.
- Konflikt bei Key mit anderer Payload.
- Erfolg im ersten Chunk, Fehler im zweiten: erster Chunk bleibt in DB/history erfolgreich.
- Timeout führt zu unknown/needs_review und keinem automatischen Retry.
- Resume sendet nur erlaubte Items.
- Dry-Run macht keinen Fetch.
- Health Check macht keinen POST.
- Logs enthalten den Test-API-Key nicht.

Abnahme:
- Doppelklick mit gleichem Key löst keinen zweiten Push aus.
- Teilfortschritt ist nach Neustart rekonstruierbar.
- Der Wartungsbutton fügt nie ein Testvideo hinzu.
- npm run check erfolgreich.

Am Ende die garantierten und nicht garantierbaren Idempotenz-Eigenschaften ehrlich dokumentieren.
```

---

## TD-010 – Persistente Flow-Sessions und Double-Click-Schutz

### Ziel

Session-Kollisionen, veraltete Buttons und doppelte Bestätigungen verhindern. Sessions sollen einen Bot-Neustart kurzzeitig überstehen können.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-010 „Persistente Flow-Sessions und Double-Click-Schutz“.

Bestandsproblem:
- sessions ist eine Map nur nach userId.
- Zwei Guilds, zwei Nachrichten oder parallele Flows desselben Nutzers kollidieren.
- Sessions haben keine TTL.
- Ein Doppelklick auf „Push bestätigen“ kann denselben Effekt mehrfach starten.

Implementiere:
1. src/repositories/sessionRepository.js für die Tabelle flow_sessions.
2. src/services/sessionService.js mit:
   - create({ guildId, userId, channelId, messageId, kind, initialState, ttlMinutes })
   - get(sessionId)
   - update(sessionId, expectedVersion, updater oder newState)
   - transition(sessionId, expectedStatus, nextStatus)
   - claimAction(sessionId, actionKey) für einmalige, atomare Aktionen
   - complete(sessionId)
   - expireOldSessions()
3. Session-ID:
   - kryptografisch zufällig, URL-/Custom-ID-sicher, deutlich kürzer als UUID-Text.
   - Keine erratbaren fortlaufenden IDs in Discord-Custom-IDs.
4. Custom-ID-Codec in src/utils/customId.js:
   - buildCustomId({ namespace, action, sessionId, entityId optional })
   - parseCustomId(value)
   - validiert erlaubte Zeichen und Länge <= 100.
   - Nutzerdaten und Kategorienamen nicht direkt in Custom IDs kodieren; stattdessen kurze DB-/Session-Referenzen.
5. Autorisierung pro Flow:
   - Der Session-Eigentümer muss zum Interaction-User passen, sofern der Flow nicht explizit als shared markiert ist.
   - Guild und Channel bei Interaktionen prüfen.
6. TTL:
   - Default aus Config, z. B. 30 Minuten.
   - Abgelaufene Interaktion erhält eine verständliche Nachricht mit Button/Anweisung zum Neustart.
   - Cleanup beim Start und periodisch; Scheduler muss bei stop() beendet werden.
7. Push-Bestätigung:
   - claimAction(sessionId, 'confirm_push') atomar vor dem W2G-Aufruf.
   - Zweiter Klick erhält „wird bereits verarbeitet“ oder das vorhandene Ergebnis.
   - Idempotency-Key für W2G aus Session-ID und Push-Sequenz ableiten.
8. Session-State als versioniertes JSON speichern. Validierung pro kind/step einbauen, mindestens für tv_flow.
9. Bestehende userId-basierten Sessions schrittweise ersetzen; keine globale Map mehr als Source of Truth.

Tests:
- Zwei Flows desselben Users kollidieren nicht.
- Gleiche User-ID in zwei Guilds kollidiert nicht.
- Optimistic-Locking-Konflikt.
- Doppelte claimAction: genau ein Gewinner.
- Ablauf mit Fake Clock.
- Manipulierte/zu lange Custom IDs werden abgelehnt.
- Falscher User, Guild oder Channel wird abgelehnt.
- Wiederladen einer Session nach Erzeugen einer neuen Application-Instanz mit derselben Test-DB.

Abnahme:
- Kein produktiver Flow wird nur über userId adressiert.
- Doppelte Push-Bestätigung kann höchstens einen Push-Job erzeugen.
- Sessions laufen kontrolliert ab.
- npm run check erfolgreich.

Am Ende Session-Schema, TTL und Umgang mit alten Nachrichten dokumentieren.
```

---

## TD-011 – Discord-Handler und Views modularisieren

### Ziel

Die monolithische `index.js`-Logik in testbare Router, Handler und reine View-Builder zerlegen, ohne die Oberfläche unnötig neu zu erfinden.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-011 „Discord-Handler und Views modularisieren“. TD-003 und TD-010 sind abgeschlossen.

Ziel:
- interactionRouter entscheidet nur, welcher Handler zuständig ist.
- Handler koordinieren Services.
- View-Builder erzeugen Discord-Payloads ohne Netzwerk und sind separat testbar.

Vorgehen:
1. Erstelle src/discord/interactionRouter.js mit klarer Dispatch-Tabelle für Chat Commands, Buttons, Selects und Modals.
2. Erstelle Handler-Module mindestens für:
   - main/help
   - tv flow
   - admin categories/channels
   - maintenance
3. Erstelle View-Module mindestens für:
   - main/help views
   - tv views
   - admin views
   - common error/expired views
4. Dependencies werden über createHandlers({ services, repositories, config, logger }) injiziert. Keine versteckten Singletons.
5. Reine View-Funktionen erhalten Plain Objects und liefern Payloads mit content, embeds, components. Sie rufen interaction nicht selbst auf.
6. Einheitlicher Interaction-Lifecycle:
   - Eine zentrale Funktion entscheidet deferReply, deferUpdate, editReply oder followUp.
   - Modals dürfen nicht vor showModal deferred werden.
   - Fehlerhandler darf eine bereits beantwortete Interaction nicht ein zweites Mal beantworten.
7. Entferne duplizierte oder unerreichbare Logik. Im Bestand existiert die Channel-add-select-Verarbeitung an mehr als einer Stelle; behalte genau einen echten Pfad.
8. Verwende den Custom-ID-Codec und SessionService aus TD-010.
9. Alte legacyBotController-Datei nach erfolgreicher Migration entfernen oder zu einem kleinen Adapter reduzieren.
10. index.js und bootstrap bleiben dünn.
11. Nutzertexte und Hauptfluss zunächst erhalten; fachliche Feature-Erweiterungen gehören nicht in dieses Ticket.

Tests:
- Router dispatcht jede Interaction-Art an den richtigen Handler.
- Unbekannte oder malformed Custom IDs liefern sichere Fehlerantwort.
- View-Builder sind deterministisch und haben keine Seiteneffekte.
- Modal-Pfade rufen showModal ohne vorheriges defer auf.
- Bereits deferred/replied wird korrekt über editReply/followUp behandelt.
- Mindestens ein vollständiger TV-Navigationspfad und ein Admin-Pfad nutzen echten Router + Handler + Fakes, nicht nachgebildete Booleans.

Abnahme:
- Kein produktives Modul mit mehreren hundert Zeilen gemischter Router-, View- und Service-Logik; begründe Ausnahmen.
- Interaktionstests importieren echten Anwendungscode.
- Kein Discord-Login in Tests.
- npm run check erfolgreich.

Am Ende Modul-Mapping alt -> neu und entfernte Duplikate nennen.
```

---

## TD-012 – Discord-Limits, Pagination und sichere Textausgabe

### Ziel

Alle Menüs und Embeds auch bei vielen Kategorien, Channels und Videos zuverlässig rendern.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-012 „Discord-Limits, Pagination und sichere Textausgabe“.

Bestandsprobleme:
- Kategoriebuttons können mehr als fünf Action Rows erzeugen.
- Select-Menüs können mehr als 25 Optionen erhalten.
- Embeds können mehr als 25 Felder oder zu viele Zeichen enthalten.
- Titel, Kategorienamen und Videolisten werden nicht zentral gekürzt.

Implementiere:
1. src/discord/ui/limits.js mit den relevanten Discord-Grenzen als benannte Konstanten.
2. src/discord/ui/text.js:
   - truncate(text, max, suffix)
   - safeFieldName, safeFieldValue, safeDescription, safeLabel
   - splitTextIntoPages oder chunkLines unter Beachtung von Zeichenlimits.
3. src/discord/ui/pagination.js:
   - paginate(items, page, pageSize)
   - clamp page
   - Page-Metadaten totalPages, hasPrevious, hasNext.
4. Kategorieauswahl:
   - Verwende ein StringSelectMenu mit maximal 25 Optionen pro Seite oder eine andere skalierende Lösung.
   - Mehrfachauswahl unterstützen, soweit Discord-Limits es erlauben.
   - Bei mehr als 25 Kategorien Page-Navigation und Session-State verwenden.
   - Bereits gewählte Kategorien über Seiten hinweg erhalten.
5. Kategorien-/Channel-Adminlisten und -auswahlen paginieren.
6. Queue-Vorschau:
   - Maximal eine sichere Anzahl Videos anzeigen und „… weitere“ ergänzen.
   - Lange Titel kürzen.
   - Verteilungsstatistik paginieren oder zusammenfassen.
7. EmbedBuilder nicht mit mehr als erlaubten Feldern oder Gesamtzeichen befüllen. Implementiere eine assertValidPayload-Funktion für Tests/Development, die vor dem Discord-Aufruf verständlich scheitert.
8. Custom IDs über TD-010, keine langen URL-encodierten Kategorienamen.
9. Leere Listen, exakt 25, 26, 100 Einträge und sehr lange Unicode-Texte korrekt behandeln.
10. UI-Texte bleiben deutsch.

Tests:
- Payloads mit 0, 1, 25, 26 und 100 Kategorien.
- Fünf-Row-Grenze wird nie überschritten.
- Select-Optionen nie >25.
- Embed-Felder nie >25 und Texte innerhalb der Limits.
- Pagination vor/zurück, manipulierte Page-Werte und abgelaufene Session.
- Unicode/Emoji-Kürzung erzeugt keine Exceptions und bleibt innerhalb der JS-/Discord-Grenze.

Abnahme:
- Kein dynamischer View-Builder kann durch Anzahl der Kategorien/Channels eine offensichtlich ungültige Discord-Payload erzeugen.
- Pagination bleibt nutzergebunden und session-sicher.
- npm run check erfolgreich.

Am Ende die gewählten Page-Größen und UX-Änderungen dokumentieren.
```

---

## TD-013 – Konfigurierbare Autorisierung für den Freundesgruppenbetrieb

### Ziel

Mutierende Admin-Funktionen schützen, ohne den privaten Server unnötig streng zu machen.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-013 „Konfigurierbare Autorisierung“.

Kontext:
- Der Bot läuft auf einem privaten Freundes-Server.
- TV-Start und später Inbox-Triage dürfen grundsätzlich allen Servermitgliedern offenstehen.
- Kategorien, Channels, Wartung, History-Clear und W2G-Diagnose sollen konfigurierbar geschützt sein.

Implementiere src/services/authorizationService.js.

Regeln für admin/mutating actions:
1. Erlaubt, wenn mindestens eine Bedingung zutrifft:
   - Discord-Guild-Owner,
   - ManageGuild-Berechtigung,
   - User-ID in ADMIN_USER_IDS,
   - eine Rollen-ID in ADMIN_ROLE_IDS,
   - ADMIN_ALLOW_ALL_MEMBERS=true.
2. ADMIN_ALLOW_ALL_MEMBERS ist ein expliziter Freundesmodus und standardmäßig false. Dokumentiere die Auswirkung deutlich.
3. DMs sind für guildbezogene Admin-Aktionen nicht erlaubt.
4. Die Prüfung erfolgt unmittelbar vor jeder mutierenden Aktion, nicht nur beim Anzeigen des Admin-Menüs.
5. Read-only Übersichten dürfen optional breiter verfügbar sein; definiere klare Policies wie tv.use, inbox.triage, admin.read, admin.write, maintenance.execute, w2g.push.
6. W2G-Push darf standardmäßig allen Nutzern erlaubt bleiben, die ihren eigenen TV-Flow gestartet haben; über W2G_PUSH_USER_IDS oder eine Policy konfigurierbar machen, falls bereits sinnvoll. Vermeide eine unnötige Pflichtkonfiguration.
7. Fehlerantwort ist knapp und enthält keine Rollen-/Allowlist-Details.
8. Auditiere Autorisierungsablehnungen strukturiert mit userId, guildId und action, aber ohne Nutzereingaben/Secrets.
9. Buttons dürfen für nicht berechtigte Nutzer ausgeblendet oder disabled werden, aber die serverseitige Prüfung bleibt zwingend.

Tests:
- Guild Owner, ManageGuild, erlaubter User, erlaubte Rolle, allowAll.
- Nutzer ohne Berechtigung.
- DM.
- Admin-Menü sichtbar, aber direkte manipulierte Custom-ID für Mutation wird trotzdem blockiert.
- Berechtigungsänderung zwischen Menüanzeige und Klick wird berücksichtigt.
- TV-Flow bleibt im Standard für Mitglieder nutzbar.

Abnahme:
- Jede Kategorie-/Channel-Mutation und Wartungsaktion nutzt eine benannte Policy.
- Kein Schutz beruht nur auf versteckten Buttons.
- Freundesmodus ist mit einer ENV-Variable möglich und ausdrücklich sichtbar.
- npm run check erfolgreich.

Am Ende Policy-Matrix und neue ENV-Variablen dokumentieren.
```

---

## TD-014 – Fehlerklassen, strukturiertes Logging und Diagnose

### Ziel

Fehler für Nutzer verständlich, für Entwickler diagnostizierbar und für Secrets sicher behandeln.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-014 „Fehlerklassen, strukturiertes Logging und Diagnose“.

Implementiere:
1. src/utils/errors.js mit mindestens:
   - AppError mit code, userMessage, cause, details, retryable
   - ValidationError
   - NotFoundError
   - ConflictError
   - AuthorizationError
   - ExternalServiceError
   - SessionExpiredError
2. src/utils/logger.js:
   - strukturierte Logmethoden debug/info/warn/error.
   - Kontextbindung per child({ correlationId, sessionId, jobId, guildId, userId }).
   - Zentrale Redaction für DISCORD_TOKEN, YOUTUBE_API_KEY, W2G_API_KEY und Felder wie authorization, token, apiKey, w2g_api_key.
   - Nutze entweder eine kleine eigene Implementierung oder pino; entscheide dich für eine Variante und teste sie.
3. Jede Interaction erhält eine correlationId. Session-ID und Push-Job-ID werden ergänzt, sobald vorhanden.
4. Zentrale Fehlerabbildung:
   - Validation -> deutsche Eingabehinweise.
   - Authorization -> knappe Ablehnung.
   - External retryable -> temporärer Dienstfehler.
   - Conflict -> Aktion wurde bereits verarbeitet/geändert.
   - Unerwartet -> generische Nachricht plus correlationId.
5. Stacktraces nur in Logs, nie in Discord.
6. HTTP-Fehlerdetails und Antworttexte begrenzen und redigieren.
7. Global process handlers:
   - unhandledRejection und uncaughtException loggen.
   - Bei uncaughtException kontrollierten Shutdown einleiten; nicht unbestimmt weiterlaufen.
   - Listener beim Application stop() entfernen.
8. Maintenance-Übersicht um lokale Diagnose ergänzen:
   - DB erreichbar/migriert,
   - Session-Cleanup aktiv,
   - letzter W2G-Jobstatus,
   - keine Secrets.
9. Debug-Logs über Config steuerbar; Standard nicht übermäßig laut.

Tests:
- Fehlerklasse und Mapping.
- Redaction mit Secrets in verschachtelten Objekten und URLs.
- Unerwarteter Fehler zeigt correlationId, aber keinen Stack.
- Logger child context.
- Controlled shutdown mit Fake-App; process.exit nicht wirklich aufrufen.
- External response body wird gekürzt.

Abnahme:
- Keine direkten console.log/error im produktiven Kern, außer eventuell im allerfrühesten Bootstrap-Fallback; begründe Reststellen.
- Nutzer sehen sichere deutsche Meldungen.
- Logs erlauben Session-/Job-Korrelation.
- npm run check erfolgreich.

Am Ende Logging-Format, Redaction-Felder und Error-Codes dokumentieren.
```

---

## TD-015 – Reale Unit-/Integrationstests und Coverage

### Ziel

Die vorhandenen Tests durch Prüfungen ersetzen, die echten Router-, Service- und Repository-Code ausführen.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-015 „Reale Unit-/Integrationstests und Coverage“.

Bestandsproblem:
- Ein großer Teil von tests/discord-interactions.test.js bildet Verhalten mit selbst gesetzten Booleans nach, statt die echten Handler zu importieren.
- Kategorien-/History-Tests verändern produktive JSON-Dateien.
- Dokumentation behauptet Coverage, die nicht verlässlich gemessen wird.

Aufgaben:
1. Ordne Tests in tests/unit und tests/integration.
2. Erstelle Test-Helfer:
   - createTestDatabase() mit :memory: und Migrationen.
   - createFakeClock().
   - createFakeLogger().
   - createMockFetch(sequence oder route map).
   - Discord Interaction Builder/Fakes mit Zustandsprüfung für defer/reply/edit/followUp/showModal.
3. Entferne Tests, die nur lokale Variablen oder nachgebildete Logik prüfen. Ersetze sie durch echte Imports von Router, Handlern, Services oder Repositories.
4. Unit-Abdeckung mindestens für:
   - config
   - customId
   - pagination/text limits
   - queue builder
   - eligibility/filter
   - YouTube-Parsing und Request-Fehler
   - W2G-Jobstatuslogik
   - Authorization
5. Integration-Abdeckung mindestens für:
   - Kategorie CRUD + atomarer Move auf echter Test-SQLite.
   - Legacy-Migration.
   - TV-Flow: Start -> Watchtime -> Kategorien -> Strategie -> Preview -> bestätigter Dry-Run-Push.
   - Doppelte Bestätigung erzeugt genau einen Push-Job.
   - Abgelaufene Session.
   - Admin-Autorisierung.
   - Teilfehler eines W2G-Multi-Chunk-Jobs.
6. Kein Test darf:
   - Discord login/REST live aufrufen,
   - YouTube/W2G live aufrufen,
   - categories.json, w2g_history.json oder data/krustentv.sqlite im Repository verändern.
7. Verwende Fake Timers oder Fake Clock für TTL/Backoff; keine langen echten sleeps.
8. Coverage:
   - npm run test:coverage.
   - Realistische Schwellen, zum Beispiel 80 % Lines/Statements/Functions und 70 % Branches für src; begründe abweichende Werte.
   - Keine 100-%-Behauptung, solange sie nicht gemessen ist.
   - Exkludiere nur dünne Bootstrap-Dateien und reine Command-Daten, nicht schwer testbaren Code pauschal.
9. Füge einen Regressionstest für jeden im Review identifizierten Fehler hinzu:
   - parallele Writes verlieren nichts,
   - zu langes Video beendet Queue-Suche nicht,
   - unbekannte Dauer wird nicht als 0 aufgenommen,
   - maliziöse YouTube-URL wird abgelehnt,
   - W2G-Test ist nicht mutierend,
   - Discord-Limits bei >25 Einträgen,
   - doppelter Push.
10. Aktualisiere TEST_COVERAGE.md oder ersetze es durch docs/TESTING.md mit tatsächlich generierten Zahlen und Anweisungen.

Abnahme:
- npm run check und npm run test:coverage erfolgreich.
- Tests prüfen echten Anwendungscode.
- Produktionsdaten bleiben unverändert; füge nach Möglichkeit einen Test/Guard dafür hinzu.
- Coverage-Bericht und Dokumentation stimmen überein.

Am Ende Testmatrix, gemessene Werte und bewusste Lücken nennen.
```

---

## TD-016 – Betrieb, Backups, Command-Registrierung und Dokumentation

### Ziel

Den modernisierten Bot sicher starten, stoppen, migrieren, sichern und nachvollziehbar betreiben können.

### Copilot-Prompt

```text
Implementiere ausschließlich TD-016 „Betrieb, Backups, Command-Registrierung und Dokumentation“. Alle vorherigen TD-Tickets sind abgeschlossen.

Aufgaben:
1. Command-Registrierung endgültig vom normalen Start trennen:
   - scripts/register-commands.js
   - npm run register:commands
   - Optional REGISTER_COMMANDS_ON_START nur noch für Entwicklung, Default false, mit Warnung.
2. Startup-Reihenfolge:
   - Config laden/validieren.
   - Logger initialisieren.
   - DB öffnen und Migrationen ausführen.
   - notwendige Legacy-Migration nur als expliziter Schritt, nicht still bei jedem Start.
   - Services/Router erstellen.
   - Scheduler/Cleanup starten.
   - Discord login.
3. Graceful Shutdown für SIGINT und SIGTERM:
   - neue Interaktionen nicht mehr annehmen oder freundlich ablehnen,
   - Scheduler stoppen,
   - laufende sichere lokale Operationen abschließen,
   - Discord Client zerstören,
   - DB schließen,
   - Timeout als letzte Schutzmaßnahme.
4. Backup-Script scripts/backup-database.js:
   - SQLite-sichere Backup-Methode verwenden, nicht nur blind die offene Datei kopieren.
   - Timestamped Datei unter data/backups.
   - Retention über BACKUP_RETENTION_COUNT, Default dokumentieren.
   - Prüfsumme und Metadaten-Datei erzeugen.
5. Restore-Dokumentation und optional scripts/verify-backup.js. Restore niemals automatisiert über eine laufende DB ausführen.
6. Smoke/Health:
   - npm run smoke prüft Config-Struktur, DB/Migrationen und reine Service-Initialisierung ohne Discord-Login oder Live-APIs.
7. package.json:
   - scripts start, dev, check, db:migrate, migrate:legacy, register:commands, backup, smoke konsistent.
8. Dokumentation neu konsolidieren:
   - README.md: reale Commands, Setup, Migration, Start, Dry-Run.
   - docs/ARCHITECTURE.md: tatsächliche Module und Datenflüsse.
   - docs/OPERATIONS.md: Backup, Restore, Logs, häufige Fehler.
   - docs/SECURITY.md: Secrets, Autorisierungsmodi, URL-Validierung, Grenzen lokaler W2G-Idempotenz.
   - docs/TESTING.md: echte Tests und Coverage.
   - Veraltete/duplizierte Statusdateien entweder aktualisieren, als historisch markieren oder entfernen.
9. .env.example vollständig aktualisieren und jede Variable mit Default und Wirkung kommentieren.
10. Keine produktiven JSON-Dateien mehr als Source of Truth. Legacy-Dateien nach erfolgreicher Migration nicht automatisch löschen; in Docs erklären, wann sie archiviert werden können.

Tests/Prüfungen:
- npm run check
- npm run test:coverage
- npm run smoke
- npm run db:migrate auf leerer temporärer DB und erneut
- Backup auf temporärer DB, Prüfsumme validieren
- Graceful-Shutdown-Test mit Fakes
- register-commands mit Fake REST in Test; kein Live-Aufruf

Abnahme:
- Ein neuer Nutzer kann anhand README und .env.example installieren, migrieren und starten.
- Commands werden nicht bei jedem Produktionsstart unnötig registriert.
- Backup und Restore sind nachvollziehbar.
- Dokumentation enthält keine nicht existierenden Slash-Commands oder Features.
- Alle Checks erfolgreich.

Am Ende eine Release-Checkliste und genaue Upgrade-Schritte von der alten JSON-Version liefern.
```

---

# Release-Gate nach Abschluss der Technical Debt

Bevor Feature 9 oder 10 begonnen wird, sollte folgender manueller Test auf einer Kopie der produktiven Daten erfolgen:

1. Alte JSON-Dateien sichern.
2. SQLite-Migration und Legacy-Import ausführen.
3. Kategorien und Channels mit der alten Konfiguration vergleichen.
4. Bot mit `W2G_DRY_RUN=true` starten.
5. Hauptmenü, Admin-Übersicht, Kategorie-/Channel-Änderung und TV-Preview testen.
6. Zwei Nutzer lassen parallel unterschiedliche Flows laufen.
7. Doppelt auf „Push“ klicken; es darf nur ein Push-Job entstehen.
8. Bot zwischen Preview und Bestätigung neu starten; Session-Verhalten prüfen.
9. Einen simulierten W2G-Teilfehler testen.
10. Backup erstellen und auf einer separaten Testdatenbank verifizieren.
11. Erst danach einen kontrollierten Live-Push mit wenigen Videos durchführen.

## Empfohlene Commit-Schnittfolge

```text
chore: establish quality baseline
refactor: centralize runtime configuration
refactor: create side-effect-free application bootstrap
feat: add sqlite migration infrastructure
refactor: migrate category persistence to sqlite
refactor: normalize video processing history
refactor: harden youtube client
fix: make queue builder pure and deterministic
refactor: add persistent w2g push jobs
refactor: persist discord flow sessions
refactor: split discord router handlers and views
fix: enforce discord component limits
feat: add configurable authorization policies
refactor: add structured errors and logging
test: replace mock-only tests with real integration coverage
docs: finalize operations migration and release guide
```
