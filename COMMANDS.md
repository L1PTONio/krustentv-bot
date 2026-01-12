# KrüstchenTV Bot - Slash Commands Übersicht

## ✅ Alle verfügbaren `/krustentv` Befehle

### 🔧 System & Diagnose
- **`/krustentv ping`**  
  Prüft Bot-Verbindung (Antwortet mit "Pong! 🏓")

- **`/krustentv test_w2g`**  
  Testet Watch2Gether API-Verbindung und zeigt Verbindungsstatus

- **`/krustentv help`** ⭐ **NEU**  
  Zeigt alle /krustentv Befehle mit kurzer Erklärung und Parametern

---

### 🎬 Watch2Gether Flows
- **`/krustentv start`**  
  Startet den interaktiven Watch2Gether-Dialog:
  1. Sammelt Videos von allen Channels
  2. Auswahl der Watchtime (30/60/90 Min oder custom)
  3. Auswahl der Kategorien
  4. Auswahl der Abspielmodus (Shuffle / Category Blocks / Manuelle Reihenfolge)
  5. Push zu W2G (mit LIVE-Bestätigung falls aktiviert)

- **`/krustentv w2g_playlist`**  
  Zeigt die aktuelle Watch2Gether Playlist

---

### 📊 Übersichten
- **`/krustentv overview`**  
  Zeigt alle Kategorien & Channels (komplette Übersicht)

- **`/krustentv category_list`**  
  Listet alle Kategorien

- **`/krustentv category_health`** ⭐ **NEU**  
  Führt einen Gesundheitscheck für alle Kategorien durch  
  - 🟢 aktiv (letztes Video ≤14 Tage)
  - 🟡 veraltet (15-30 Tage)
  - 🟠 kritisch (31-60 Tage)
  - 🔴 inaktiv (>60 Tage oder keine Videos)

---

### 📁 Kategorie-Management
- **`/krustentv category_add`**  
  Fügt eine Kategorie hinzu  
  **Parameter:**
  - `name` **(Pflicht)** — Name der Kategorie

- **`/krustentv category_rename`**  
  Benennt eine Kategorie um  
  **Parameter:**
  - `old` **(Pflicht)** — Alter Name
  - `new` **(Pflicht)** — Neuer Name

- **`/krustentv category_delete`**  
  Löscht eine Kategorie (nur wenn leer)  
  **Parameter:**
  - `name` **(Pflicht)** — Name der Kategorie

---

### 📺 Channel-Management
- **`/krustentv channel_list`**  
  Listet Channels einer Kategorie  
  **Parameter:**
  - `category` **(Pflicht)** — Name der Kategorie

- **`/krustentv channel_add`**  
  Fügt einen Channel zu einer Kategorie hinzu  
  **Parameter:**
  - `category` **(Pflicht)** — Name der Kategorie
  - `input` **(Pflicht)** — Channel-ID, URL oder Username

- **`/krustentv channel_remove`** ⭐ **INTERAKTIV**  
  Entfernt einen Channel aus einer Kategorie  
  **Hinweis:** Startet einen interaktiven Dialog mit Select-Menüs und Bestätigung
  - Wähle Kategorie
  - Wähle Channel
  - Bestätige Entfernung

- **`/krustentv channel_move`**  
  Verschiebt einen Channel von einer Kategorie in eine andere  
  **Parameter:**
  - `source` **(Pflicht)** — Quelle (Kategorie-Name)
  - `target` **(Pflicht)** — Ziel (Kategorie-Name)
  - `channel_id` **(Pflicht)** — Channel-ID

---

## 🎯 Empfohlene Command-Reihenfolge für Setup

1. **`/krustentv ping`** — Bot-Verbindung prüfen
2. **`/krustentv test_w2g`** — W2G-API testen
3. **`/krustentv category_add`** — Kategorien anlegen
4. **`/krustentv channel_add`** — Channels hinzufügen
5. **`/krustentv overview`** — Setup prüfen
6. **`/krustentv category_health`** — Channel-Aktivität prüfen
7. **`/krustentv start`** — Ersten Push durchführen

---

## ⚙️ Feature-Highlights

### ✨ Neue Features (seit letztem Update)
- **`/krustentv help`**: Vollständige Command-Dokumentation im Bot
- **`/krustentv category_health`**: Automatischer Gesundheitscheck aller Kategorien
- **Interactive channel_remove**: Kein Tippen mehr — alles per Select-Menü
- **Playback Strategien**: Shuffle / Category Blocks / Manuelle Reihenfolge
- **Category Weighting**: Gewichtung pro Kategorie für faire Video-Verteilung
- **LIVE Push Protection**: Explizite Bestätigung + Permission-Check für Live-Pushes
- **MIN_VIDEO_PUBLISHED_AT Filter**: Filtert Videos nach Veröffentlichungsdatum

---

## 🔐 Berechtigungen

- Alle Commands sind standardmäßig **Ephemeral** (nur für den Befehlsausführer sichtbar)
- **LIVE Push** erfordert eine der folgenden Berechtigungen:
  - Server-Owner
  - `ManageGuild` Permission
  - Explizit in `ALLOWED_LIVE_USER_IDS` gelistet

---

## 📝 Hinweise

- Alle Slash Commands sind unter dem Hauptbefehl `/krustentv` gruppiert
- Commands werden global oder guild-spezifisch registriert (je nach `DISCORD_GUILD_ID` in `.env`)
- Bot reagiert nur auf registrierte Slash Commands (keine Prefix-Commands)
