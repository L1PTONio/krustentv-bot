# Beta-Funktionsprüfung für bot-hosting.net

Diese Checkliste ist so aufgebaut, dass sie später direkt für den Deploy-Flow „Source → GitHub → My Repos“ verwendet werden kann.

## 1. Repository- und Deploy-Ready
- [ ] Das Repository ist sauber auf GitHub verfügbar und enthält die aktuelle Beta-Version
- [ ] Die Haupt-Branch-Strategie ist klar (z. B. `main` für die stabile Beta-Release-Variante)
- [ ] `package.json` enthält alle benötigten Start- und Test-Skripte
- [ ] `npm install` und `npm start` laufen lokal sauber
- [ ] `.env.example` ist aktuell und enthält alle wichtigen Variablen

## 2. Bot-Funktionalität prüfen
- [ ] `/krustentv ping` antwortet korrekt
- [ ] `/krustentv help` zeigt die Beta-Version und den Beta-Hinweis
- [ ] Hauptmenü, TV-Flow, Admin-Menü und Hilfe öffnen ohne Fehler
- [ ] Admin-Aktionen sind für autorisierte Nutzer zugänglich und für andere blockiert
- [ ] Session-Handling funktioniert nach einer kurzen Pause oder einem Neustart weiterhin
- [ ] Watch2Gether-Flow lässt sich in Dry-Run sauber testen

## 3. GitHub- und Host-Integration
- [ ] Der GitHub-Repo-Name ist für den Host klar festgelegt
- [ ] Der richtige Branch wird später im Host-Setup ausgewählt
- [ ] Keine sensiblen Secrets im Repo liegen
- [ ] `.env`-Werte werden im Host separat hinterlegt
- [ ] Der Host kann das Projekt direkt aus dem GitHub-Repo beziehen

## 4. Beta-Betriebscheck
- [ ] Live-Pushes sind nur nach Prüfung freigegeben
- [ ] Logging ist aktiv und nachvollziehbar
- [ ] Fehlerfälle werden sichtbar und können schnell nachverfolgt werden
- [ ] Der erste Beta-User-Flow ist erfolgreich getestet
