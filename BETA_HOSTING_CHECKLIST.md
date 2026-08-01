# Beta-Phase & Hosting-Checkliste

Diese Liste bündelt die letzten Schritte, bis der Bot sauber in die Beta-Phase startet und auf bot-hosting.net betrieben werden kann.

## 1. Produkt- und Release-Readiness
- [ ] Beta-Status im gesamten Nutzer-Feedback klar sichtbar machen (README, Help, Start-Ansicht)
- [ ] Version/Release-Label final festlegen und konsistent anzeigen
- [ ] Kurzfassung der Beta-Ziele und Einschränkungen für Freunde/Testnutzer festhalten
- [ ] Bereits bekannte Einschränkungen dokumentieren und im Support-Text erwähnen
- [ ] Release-Notes für die erste Beta-Version vorbereiten

## 2. Konfiguration und Secrets
- [ ] Alle notwendigen Umgebungsvariablen geprüft und dokumentiert
- [ ] Beispiel-Datei für die Host-Umgebung aktualisieren
- [ ] Token, API-Keys und Admin-Konfiguration getrennt und sicher verwalten
- [ ] Standardwerte für Dry-Run/Live-Mode bewusst festlegen
- [ ] Admin-User und Rollen für den Beta-Betrieb final prüfen

## 3. Hosting auf bot-hosting.net
- [ ] Node.js-Laufzeit passend zur Projektanforderung auswählen (empfohlen: Node 22+)
- [ ] Repository/Branch für den Hosting-Deploy auswählen
- [ ] Startbefehl festlegen: `npm start`
- [ ] Installationsbefehl festlegen: `npm install`
- [ ] Persistente Datenablage für Session-/Daten-Dateien sicherstellen
- [ ] Logs, Restart-Policy und Ressourcen-Limits prüfen
- [ ] Health-/Start-Check nach dem ersten Deploy verifizieren

## 4. Bot-Funktionalität prüfen
- [ ] Slash-Commands werden korrekt registriert
- [ ] Hauptmenü, TV-Flow, Admin-Menü und Hilfe laufen ohne Fehler
- [ ] Admin-Aktionen sind für autorisierte Nutzer erreichbar und für andere blockiert
- [ ] Session-Handling funktioniert auch nach einem Restart sauber
- [ ] Watch2Gether-Interaktion in Dry-Run- und Live-Mode getestet
- [ ] Fehlerfälle und Recovery-Pfade sind nachvollziehbar

## 5. Monitoring und Betriebsbereitschaft
- [ ] Logging für wichtige Ereignisse aktiviert und verständlich
- [ ] Fehlermeldungen werden sichtbar und nachvollziehbar protokolliert
- [ ] Wiederherstellungsplan bei Token-/API-Fehlern dokumentiert
- [ ] Rollen-/Support-Plan für Beta-Nutzer definiert
- [ ] Backup-/Rollback-Plan für den nächsten Deploy vorbereitet

## 6. Abschluss-Check
- [ ] Letzter End-to-End-Test erfolgreich
- [ ] Bot ist online und erreichbar
- [ ] Erste Beta-Nutzer können den Bot ohne größere Probleme nutzen
- [ ] Nach dem Launch werden Logs und Fehlerberichte regelmäßig geprüft
