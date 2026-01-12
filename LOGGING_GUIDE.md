# 🔍 Logging & Debugging Guide

## Überblick

Überall im Bot wurden **strategische `console.log()` Statements** eingefügt, damit du beim UI-Test in Discord alle Fehler sofort sehen kannst.

## Wo die Logs ausgegeben werden

Starte den Bot in einem Terminal:
```bash
cd c:\Users\rahnp\krustentv-bot
node index.js
```

Das Terminal zeigt alle Logs live, während du den Bot in Discord benutzt.

---

## Log-Formate nach Aktion

### 📝 Slash Commands
```
📝 Slash Command: /krustentv menu von TestUser
  📍 Verarbeite Subcommand: menu
  ✅ Zeige Hauptmenü
```

### 🔘 Button Presses
```
🔘 Button: nav:tv_start von TestUser
  🔐 User Check: Button-User=123456789, Requester=123456789
  ✅ Button-Validierung ok, verarbeite: nav
  📍 Navigation zu: tv_start
  📺 === TV START FLOW STARTED ===
```

### 📊 Select Menus
```
📊 Select Menu: cat:delete_select (1 Wert(e)) von TestUser
  🔐 Security Check: Menu-User=123456789, Requester=123456789
  ✅ Select Menu: cat:delete_select, Wert: Category1
    🗑️ Lösche Kategorie: "Category1"
    ✅ Kategorie gelöscht
```

### 📋 Modal Submissions
```
📋 Modal Submit: tv:watchtime_modal von TestUser
  🔐 User Check: Button-User=123456789, Requester=123456789
  ✅ Button-Validierung ok, verarbeite: modal
  📋 Modal Submit: tv:watchtime_modal von TestUser
    ⏱️ Custom Watchtime: 60 Min
    ✅ Watchtime gespeichert, zeige Kategorien
```

---

## TV START FLOW - Detaillierte Logs

```
📺 === TV START FLOW STARTED ===
  📥 Schritt 1: Sammle Videos...
  ✅ 4 Kategorien geladen
    🔄 Kategorie "Musik": 2 Channels
      ✓ UC123456: 15 Videos
      ✓ UC789012: 8 Videos
    ✅ "Musik": 23 Videos, 127 Min
    🔄 Kategorie "Gaming": 1 Channel
      ✓ UC345678: 5 Videos
    ✅ "Gaming": 5 Videos, 45 Min
  ✅ Schritt 1 fertig: 28 Videos, 172 Min
  
  (User wählt Watchtime: 60 Min)
    ⏱️ Watchtime: 60 Min
    ✅ Watchtime gespeichert
    (User wählt Kategorien)
    
  (User klickt "Weiter")
    ✅ Kategorien bestätigt: 2 ausgewählt
    🏗️ Queue Build Started
      Kategorien: Musik, Gaming, Watchtime: 60 Min
      ✅ Queue gebaut: 8 Videos, 58/60 Min
    📤 Push zu Watch2Gether...
      ✅ W2G Push erfolgreich
      ✅ 8 Videos als gesehen markiert
  📺 === TV START FLOW COMPLETED ===
```

---

## ADMIN FLOWS - Logs

### Kategorie hinzufügen
```
🛠️ Admin Action: categories
📂 Category Action: add
    📝 Custom Watchtime Modal öffnen
    
(User füllt Modal)
📋 Modal Submit: cat:add_modal von TestUser
    ➕ Neue Kategorie: "Podcasts"
      ✅ Kategorie erstellt
```

### Channel entfernen
```
🛠️ Admin Action: channels
📺 Channel Action: remove
    
(User wählt Channel aus Select-Menu)
📊 Select Menu: ch:remove_select (1 Wert(e)) von TestUser
    ❌ Entferne Channel: "UC123456" aus "Musik"
    ✅ Channel entfernt
```

### Channel verschieben
```
📺 Channel Action: move
    
(User selects Source Channel)
📊 Select Menu: ch:move_select (1 Wert(e)) von TestUser
    🔀 Move Channel: "UC123456" von "Musik" → Zielwahl
    
(User selects Target Category)
📊 Select Menu: ch:move_target (1 Wert(e)) von TestUser
    ✅ Channel verschoben: "UC123456" von "Musik" → "Gaming"
```

### Maintenance Tests
```
🧹 Maintenance: health
    🩺 Kategorie-Gesundheit laden...
      (Prüft Upload-Daten)
      ✅ Musik — Aktiv (2d ago)
      ⚠️ Gaming — 15 Tage
      ❌ Podcasts — 45 Tage (inaktiv)

🧹 Maintenance: w2g_test
    🔌 W2G-API testen...
      ✅ Connection OK
```

---

## Error-Logs zu verstehen

### ❌ SECURITY Fehler
```
🔘 Button: nav:main von TestUser
  🔐 User Check: Button-User=999999999, Requester=123456789
  ❌ SECURITY: Unauthorized button press
```
→ **Bedeutung**: Ein anderer Nutzer versucht einen Button von jemandem anderem zu drücken. Das ist normal – der Bot lehnt es korrekt ab.

### ⚠️ Validierungs-Fehler
```
📋 Modal Submit: tv:watchtime_modal von TestUser
    ⏱️ Custom Watchtime: -30 Min
    ⚠️ Ungültige Eingabe: -30
```
→ **Bedeutung**: Nutzer gab ungültige Zahl ein. Bot lehnt es ab und fordert neue Eingabe.

### ❌ API-Fehler
```
📺 === TV START FLOW STARTED ===
  📥 Schritt 1: Sammle Videos...
  ✅ 2 Kategorien geladen
    🔄 Kategorie "Musik": 2 Channels
      ✓ UC123456: 15 Videos
      ⚠️ Fehler für Channel UC789012: YouTube API Error
```
→ **Bedeutung**: YouTube API antwortet nicht für einen Channel. Bot setzt fort mit anderen Channels.

### ❌ Unerwarteter Fehler
```
❌ Fehler im TV-Start: Cannot read property 'addFields' of undefined
```
→ **Bedeutung**: Ein Fehler im Code (z.B. undefined-Variablen). Stack Trace zeigt genaue Zeile.

---

## Debug-Tipps

### 1. **Log-Ausgabe in Datei speichern**
```bash
node index.js > bot-logs.txt 2>&1
```
Alle Logs werden in `bot-logs.txt` geschrieben (hilfreich für lange Sessions).

### 2. **Nur Error-Logs anschauen**
```bash
node index.js 2>&1 | grep "❌"
```
Filtert nur Fehler.

### 3. **Mit Zeitstempel-Logs**
Modifiziere in index.js:
```javascript
console.log(`[${new Date().toLocaleTimeString()}] 📝 Slash Command: ...`)
```

### 4. **Ganze Session-Logs anschauen**
Terminal öffnen → Bot starten → IRC zu Discord offen haben → Aktion ausführen → Terminal prüfen.

---

## Häufige Log-Sequenzen

### ✅ Erfolgreicher Button Press
```
🔘 Button: nav:main von TestUser
  🔐 User Check: Button-User=123456789, Requester=123456789
  ✅ Button-Validierung ok, verarbeite: nav
  📍 Navigation zu: main
  (Modal/Embed wird angezeigt)
```

### ❌ Fehlgeschlagener Button Press (falsche User)
```
🔘 Button: nav:main von TestUser
  🔐 User Check: Button-User=999999999, Requester=123456789
  ❌ SECURITY: Unauthorized button press
```

### ✅ TV Flow Completion
```
📺 === TV START FLOW STARTED ===
  📥 Schritt 1: Sammle Videos...
  (... weitere Logs ...)
  📤 Push zu Watch2Gether...
    ✅ W2G Push erfolgreich
  📺 === TV START FLOW COMPLETED ===
```

---

## Was du beim Testen prüfen solltest

1. **Navigation** – Alle Buttons funktionieren, Logs zeigen korrekte Actions
2. **User Binding** – Nur der richtige User kann auf Buttons drücken
3. **Modals** – Logs zeigen Modal-Submit, Validierung funktioniert
4. **Video-Sammlung** – Logs zeigen Video-Count pro Kategorie
5. **W2G Push** – Logs zeigen erfolgreichen API-Call
6. **Errors** – Alle Fehler werden gelogged und gemeldet

---

## Logging Checkliste für Production

- [x] Alle Commands geloggt
- [x] Alle Button-Presses geloggt
- [x] Sicherheits-Checks geloggt
- [x] API-Calls geloggt
- [x] Fehler mit Stack-Traces geloggt
- [x] Session-Übergänge geloggt
- [ ] Optional: Logs in Datei speichern
- [ ] Optional: Log-Levels (DEBUG, INFO, WARN, ERROR)

---

**Der Bot ist jetzt vollständig instrumentiert für Live-Testing! 🚀**
