# 🎬 KrüstchenTV Bot - Neue Architektur

## Übersicht
Der Bot folgt einer **strikten hierarchischen Navigation** mit drei Hauptbereiche:
- 🎬 **TV START** - Nutzer-Selbstbedienung
- 🛠️ **ADMIN** - Verwaltungsfunktionen
- ❓ **HILFE** - Kurze Übersicht

## Struktur-Prinzipien
✅ **Keine Sackgassen** – Jede Ansicht hat einen Zurück-Button
✅ **Nutzergebundene Sessions** – Verhindert Interaktionen von anderen Nutzern  
✅ **Ephemeral Errors** – Fehlermeldungen nur für den Nutzer sichtbar
✅ **Session Cleanup** – Speicherverwaltung nach Completion
✅ **Minimal Text, Klare UI** – Button-gesteuert, nicht text-input schwer

---

## 🎬 TV START FLOW (5 Schritte)

### Schritt 1: Übersicht
- Zeigt verfügbare Videos pro Kategorie
- Sammelt Infos: Anzahl Videos, Gesamtminuten
- **Buttons:** 30min / 60min / 90min / Custom

### Schritt 2: Watchtime wählen
- Bei Custom: Modal mit Minuteneingabe
- Speichert in Session
- **Buttons:** 4 Optionen oder Modal

### Schritt 3: Kategorien auswählen
- Zeigt alle Kategorien mit Toggle-Status
- Mehrfach-Selektion möglich
- **Buttons:** Kategorie-Toggle (✅/⭕) + Weiter + Zurück

### Schritt 4: Queue erstellen
- Nutzt `buildWeightedQueue()` mit ausgewählten Kategorien
- Pusht zu Watch2Gether
- Markiert Videos als "gesehen"

### Schritt 5: Ergebnis
- Zeigt: Anzahl Videos, Gesamtminuten, Ziel-Watchtime
- **Buttons:** 🔁 Erneut / 📋 Zur Playlist / ⬅️ Hauptmenü

---

## 🛠️ ADMIN FLOW

### Admin Hauptmenü
```
📦 Übersicht  |  📂 Kategorien
📺 Channels  |  🧹 Wartung
⬅️ Hauptmenü
```

### 📦 Übersicht
- Zeigt alle Kategorien + Channels
- Read-only View
- **Buttons:** ⬅️ Admin-Menü

### 📂 Kategorien
```
Optionen:
- 📋 Liste (Read-only)
- ➕ Hinzufügen (Modal)
- ✏️ Umbenennen (Select + Modal)
- 🗑️ Löschen (Select)
- ⬅️ Admin-Menü
```

### 📺 Channels
```
Optionen:
- 📋 Liste (Read-only)
- ➕ Hinzufügen (Modal: Channel-ID, Name, Kategorie)
- ❌ Entfernen (Select)
- 🔀 Verschieben (Select → Select Zielkategorie)
- ⬅️ Admin-Menü
```

### 🧹 Wartung
```
Optionen:
- 🩺 Kategorie-Gesundheit (Prüft letzte Upload-Daten)
- 🔌 W2G-API testen (testW2GConnection)
- ⬅️ Admin-Menü
```

---

## ❓ HILFE-FLOW

- Kurze 5-6 Punkt Übersicht
- **Keine** detaillierten Parameterlisten
- **Buttons:** ⬅️ Hauptmenü

---

## Session Management

```javascript
// Sessions sind pro userId
const sessions = new Map();

// Struktur:
{
  userId: {
    step: 'overview|watchtime|categories|build|result',
    watchtime: 30,
    categoryVideos: { ... },
    selectedCategories: ['Cat1', 'Cat2'],
    renameFrom: 'OldName',  // für Rename-Flow
    moveChId: '...',        // für Channel-Move-Flow
    moveFromCat: '...'
  }
}

// Cleanup nach TV-Flow-Completion:
clearSession(userId)
```

---

## Command Registrierung

```
/krustentv menu     → Hauptmenü zeigen
/krustentv ping     → Bot-Verbindungstest
/krustentv help     → Hilfe anzeigen
```

---

## Button ID Schema

Format: `action:target:params:userId`

### Beispiele:
```
nav:main:userId                          // Navigation → Hauptmenü
nav:tv_start:userId                      // Navigation → TV Start
nav:admin:userId                         // Navigation → Admin

tv:watchtime:30:userId                   // TV: Watchtime 30 Min
tv:watchtime_custom:userId               // TV: Custom Modal
tv:category:EncCatName:userId            // TV: Toggle Kategorie
tv:category_next:userId                  // TV: Kategorien OK → Build
tv:category_back:userId                  // TV: Zurück zu Watchtime

tv:result_again:userId                   // TV Result: Erneut starten
tv:result_playlist:userId                // TV Result: Zur Playlist
tv:result_main:userId                    // TV Result: Hauptmenü

admin:overview:userId                    // Admin: Übersicht
admin:categories:userId                  // Admin: Kategorien-Menü
admin:channels:userId                    // Admin: Channels-Menü
admin:maintenance:userId                 // Admin: Wartungs-Menü

cat:list:userId                          // Admin: Kategorien auflisten
cat:add:userId                           // Admin: Kategorie hinzufügen
cat:rename:userId                        // Admin: Kategorie umbenennen
cat:delete:userId                        // Admin: Kategorie löschen

ch:list:userId                           // Admin: Channels auflisten
ch:add:userId                            // Admin: Channel hinzufügen
ch:remove:userId                         // Admin: Channel entfernen
ch:move:userId                           // Admin: Channel verschieben

maint:health:userId                      // Admin: Health-Check
maint:w2g_test:userId                    // Admin: W2G-Test
```

### Select Menu IDs:
```
cat:delete_select:userId
cat:rename_select:userId
ch:remove_select:userId
ch:move_select:userId
ch:move_target:userId
```

### Modal IDs:
```
tv:watchtime_modal:userId
cat:add_modal:userId
cat:rename_modal:userId
ch:add_modal:userId
```

---

## Fehlerbehandlung

### Fehler-Szenarien
1. **Security**: Button von anderem Nutzer → Ephemeral "Nur du kannst..."
2. **Validation**: Leere Eingaben → Ephemeral "Name darf nicht leer sein"
3. **API-Fehler**: YouTube, W2G → Nutzer-freundliche Nachricht + Zurück-Button
4. **Session-Fehler**: Ungültige Session → Clear + Hauptmenü

### Error Replies
- Alle Fehler mit `MessageFlags.Ephemeral` wenn möglich
- Rückfall auf `editReply()` nach `deferUpdate()`
- Fallback-Buttons für Recovery

---

## Testing

```bash
npm test
```

✅ 7 Tests, 2 Suites (w2g_history, categories)
- queue_builder Tests ausstehend
- Integration Tests ausstehend

---

## Implementierte Module

### Core (index.js)
- Command Registration
- Session Management
- Navigation Handlers
- TV START Flow (5 Steps)
- ADMIN Flow (4 Submenus)
- HELP Flow
- Select Menus, Modals, Buttons
- Error Handling

### Supporting (unchanged)
- **youtube.js** – Channel Videos, Details, 60sec Filter
- **w2g_push.js** – Watch2Gether API, Playlist Fetch
- **w2g_history.js** – Video Cache, "gesehen"-Markierung
- **queue_builder.js** – Weighted Queue Build
- **categories.js** – Category/Channel CRUD
- **interaction_utils.js** – Safe Reply/Defer Helpers

---

## Nächste Schritte / Roadmap

- [ ] Live Bot-Testing im Discord (alle Flows)
- [ ] Kategorie-Gewichtsystem (weight in UI)
- [ ] Pagination für lange Listen
- [ ] Voice-Channel Announcement nach Push
- [ ] Watchtime-Historie pro Nutzer
- [ ] Admin-Rollen-Check (optional)
- [ ] Playlist-Share-URL Auto-Copy

---

## Deployment

1. Syntax Check: `node --check index.js` ✅
2. Tests: `npm test` ✅
3. Environment Setup: `.env` mit TOKEN, API Keys
4. Start: `node index.js`
5. Check: `npm start` oder Discord `/krustentv ping`

---

**Bot Status: ✅ Ready to Deploy**
