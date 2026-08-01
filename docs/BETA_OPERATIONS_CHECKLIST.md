# Beta-Betriebs- und Monitoring-Checkliste

Diese Liste ergänzt die Hosting- und Beta-Funktionsprüfungen um den operativen Betrieb.

## 1. Logging und Sichtbarkeit
- [ ] Wichtige Events werden im Log sichtbar protokolliert
- [ ] Start, Login, Slash-Command-Aufruf und Fehlerfälle sind nachvollziehbar
- [ ] Watch2Gether- und YouTube-Fehler werden deutlich markiert
- [ ] Logs sind für Beta-Nutzer und Admins leicht zugänglich

## 2. Fehler- und Recovery-Handling
- [ ] Token- oder API-Fehler lösen keinen kompletten Crash aus
- [ ] Der Bot reagiert auf Fehler mit verständlichen Rückmeldungen
- [ ] Ein Restart des Bots nach einem Fehler ist dokumentiert
- [ ] Bei fehlenden Umgebungsvariablen bricht der Start früh und klar ab

## 3. Betriebsabläufe
- [ ] Der Bot kann nach einem Neustart ohne manuelle Eingriffe weiterlaufen
- [ ] Persistenz-Dateien bleiben erhalten
- [ ] Admin- und Nutzer-Interaktionen sind auch nach einem Restart stabil
- [ ] Die erste Beta-Nutzergruppe kann den Bot ohne weitere Hilfestellung nutzen

## 4. Support und Verantwortlichkeiten
- [ ] Ein kurzer Support-Text für Beta-Nutzer ist vorhanden
- [ ] Es ist klar, wer bei Problemen zuerst angeschaut wird
- [ ] Bekannte Einschränkungen sind dokumentiert und kommuniziert
