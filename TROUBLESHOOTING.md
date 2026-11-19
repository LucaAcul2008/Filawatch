# 🔧 Filawatch Troubleshooting

Falls etwas nicht funktioniert, schau hier zuerst rein.

## Setup-Probleme (lokal)

### `npm install` schlägt fehl bei `better-sqlite3`
better-sqlite3 muss native kompiliert werden, dafür brauchst du:

**Windows:**
1. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) installieren mit "Desktop Development with C++"
2. Im backend-Ordner: `npm rebuild better-sqlite3`

**Linux/Pi:**
```bash
sudo apt-get install build-essential python3
cd backend && npm rebuild better-sqlite3
```

**macOS:**
```bash
xcode-select --install
cd backend && npm rebuild better-sqlite3
```

### Backend startet nicht: "EADDRINUSE Port 3001"
Anderer Prozess nutzt Port 3001:
```bash
PORT=3002 npm start
```
Dann auch in `frontend/vite.config.js` den Proxy auf 3002 ändern.

### Frontend "Failed to fetch" / "Network Error"
- Backend läuft? `http://localhost:3001/api/health` öffnen
- CORS-Problem? Schau in die Backend-Logs
- Vite-Proxy konfiguriert? Siehe `frontend/vite.config.js`

---

## Bambu Cloud Login

### "Login fehlgeschlagen" — Email/Passwort scheinen richtig
- Region prüfen → für Österreich: **EU**
- Bambu-Account-Passwort vor kurzem geändert? → noch mal eingeben
- Falls du Bambu-Account über Google/Apple OAuth angelegt hast: Du musst erst ein Passwort setzen!
  1. Bambu Handy App öffnen
  2. Person-Icon unten rechts
  3. Account Security → Change Password
  4. Passwort setzen → dann in Filawatch damit einloggen

### "2FA-Code akzeptiert ihn nicht"
- Code aus der Authenticator-App hat nur 30 Sekunden Gültigkeit — schnell eingeben
- Zeit auf deinem Handy prüfen — wenn die nicht stimmt, ist auch der TOTP-Code falsch
- Versuch's mit dem nächsten Code (warte 30 Sek)
- Backup-Codes hast du? Die gehen auch

### "Email-Code kommt nicht"
- Spam-Ordner checken
- Code ist nur 5 Minuten gültig
- "Erneut anfordern": Im Filawatch auf "Zurück", dann nochmal Login klicken

### Drucker erscheint nicht in der Liste
- Drucker im selben Bambu-Account registriert?
- Drucker online? (in der Bambu Handy App nachschauen)
- Klick "Reconnect" im Settings

---

## Drucker-Status / MQTT

### "Drucker offline" obwohl er an ist
- Cloud-Modus: Wartung an Bambu's Servern? → bambulab.com Status checken
- LAN-Modus: PC im selben Netz wie Drucker?
- Reconnect klicken (Settings → Drucker)
- Backend neu starten → MQTT verbindet sich neu

### "Token-Refresh fehlgeschlagen" in den Logs
- Refresh-Token ist abgelaufen oder ungültig (passiert nach längerer Inaktivität)
- Lösung: In Settings → Drucker → Neu konfigurieren → Cloud-Login von vorne

### Status-Updates kommen nicht im Frontend an
- Browser-Tab geschlossen und wieder geöffnet?
- Browser-Konsole prüfen (F12) → SSE-Verbindung sichtbar?
- Hinter Reverse Proxy (nginx, Cloudflare): SSE muss durchgelassen werden, kein Buffering

---

## Push-Notifications

### Notifications kommen nicht
1. Berechtigung erteilt? Browser-Einstellungen → Site Settings → Notifications
2. Service Worker registriert? Browser-DevTools → Application → Service Workers
3. Auf iOS: muss in Safari sein UND als PWA installiert (Home-Screen)
4. Auf Android: App muss min. einmal geöffnet worden sein

### "VAPID-Keys nicht gefunden"
Backend neu starten — beim ersten Start werden die Keys generiert und in der DB gespeichert.

### Notifications doppelt
Du hast die App mehrfach in unterschiedlichen Browsern installiert. Jede Subscription bekommt eine Notification. Lösung: Aus den Browsern abmelden die du nicht brauchst.

---

## Azure-Probleme

### Deployment hängt / dauert ewig
- VS Code: Output-Tab → Azure App Service zeigt Logs
- Azure CLI: `az webapp log tail --resource-group filawatch-rg --name filawatch-luca`
- Beim ersten Deploy dauert `npm install` bis zu 5 Minuten
- Falls länger als 10 min: Cancel und nochmal versuchen

### "Application Error" auf der App Service URL
1. **Logs ansehen:** App Service → Log stream
2. Häufige Ursachen:
   - **PORT falsch:** `PORT=8080` UND `WEBSITES_PORT=8080` setzen
   - **Startup Command falsch:** muss `bash /home/site/wwwroot/startup.sh` sein
   - **node_modules fehlt:** `SCM_DO_BUILD_DURING_DEPLOYMENT=true` setzen
   - **better-sqlite3 nicht kompiliert:** Linux App Service hat normalerweise alle Build-Tools, falls nicht: zip mit `node_modules/` direkt deployen statt von Azure bauen lassen

### "Cannot find module 'better-sqlite3'"
Lokal builden und alles inkl. `node_modules` deployen:
```bash
cd backend
rm -rf node_modules
npm ci --omit=dev
zip -r ../filawatch-deploy.zip . -x "data/*" "uploads/*"
az webapp deploy --resource-group filawatch-rg --name filawatch-luca --src-path ../filawatch-deploy.zip --type zip
```

### Static Frontend wird nicht gefunden ("Cannot GET /")
- `build.sh` lokal ausgeführt? → `backend/public/index.html` muss existieren
- Im Deploy enthalten? → check die ZIP

### Backups werden nicht erstellt
- `AZURE_STORAGE_CONNECTION_STRING` korrekt gesetzt?
- Im Storage Account → Containers → `filawatch-backups` sollte automatisch entstehen
- Manuell triggern: Settings → Azure Blob Backup → "Jetzt backupen"
- Logs prüfen: `[Cron] Backup OK: ...` sollte erscheinen

### App Service schläft ein (Free Tier)
Free Tier (F1) hat keine "Always On" Option — nach 20 Minuten Inaktivität schläft der Server ein und der MQTT-Connection bricht ab. Lösungen:
1. **B1 Tier nutzen** (mit Education Credit gratis) → Always On = On
2. **Cron-Pinger einrichten:** Free Service wie [cron-job.org](https://cron-job.org) der alle 10 Minuten den `/api/health` Endpoint aufruft → hält die App wach

### "Drucker funktioniert lokal aber nicht auf Azure"
- **Cloud-Modus:** Sollte funktionieren, weil Bambu Cloud die Verbindung tunnelt. Nochmal einloggen über Settings → Drucker → Neu konfigurieren.
- **LAN-Modus:** Funktioniert NICHT auf Azure. Azure kann deinen Drucker zuhause nicht direkt erreichen. → Auf Cloud-Modus wechseln.

### Datenbank weg nach Update
- Sollte nicht passieren wenn du nur `src/` und `node_modules/` deployst
- Vorbeugung: **Daily Backup aktivieren!** (passiert automatisch wenn Azure Storage konfiguriert ist)
- Wiederherstellung: Storage Account → Container `filawatch-backups` → letztes Backup runterladen → per SSH (Schritt 12 in AZURE.md) nach `/home/site/wwwroot/backend/data/filawatch.db` kopieren

### Kosten zu hoch
- Pricing Tier zurückstufen: App Service Plan → Scale up → F1 (free) oder D1 (shared)
- Storage: alte Auto-Backups löschen (Filawatch tut das automatisch nach 30 Tagen)
- App Service stoppen wenn du gerade nicht druckst

---

## PWA-Probleme

### Install-Banner kommt nicht auf Android
- HTTPS muss aktiv sein (auf Azure ist es automatisch, auf localhost geht es auch)
- Service Worker muss registriert sein (DevTools → Application)
- Min-Anforderungen: manifest.json + icons + sw.js — alle vorhanden
- "Bereits abgelehnt"? localStorage löschen: `localStorage.removeItem('filawatch_install_dismissed')`

### iOS PWA: Push funktioniert nicht
iOS unterstützt Web Push nur seit Safari 16.4 (iOS 16.4+) und nur wenn die App **über Safari** als PWA installiert wurde. Push aus Chrome/Firefox auf iOS funktioniert nicht.

### PWA zeigt alte Version nach Update
Service Worker Cache:
1. Browser DevTools → Application → Service Workers → "Update on reload" aktivieren
2. Hard Reload (Ctrl+Shift+R)
3. Oder: Service Worker komplett deregistrieren und neu laden

---

## Allgemeine Tipps

### Backend-Logs lesen
- Lokal: einfach im Terminal wo `npm start` läuft
- Azure: App Service → Log stream
- pm2: `pm2 logs filawatch-backend`

### Datenbank manuell anschauen
SQLite-DB öffnen mit [DB Browser for SQLite](https://sqlitebrowser.org/) (gratis).
- Lokal: `backend/data/filawatch.db`
- Azure: per SSH runterladen oder Backup verwenden

### Komplettes Reset
```bash
# Lokal
rm -rf backend/data backend/uploads
# Backend neu starten → leere DB, neuer Admin-User
```

### "Es funktioniert irgendwie gar nichts"
1. Ist Node.js 20+ installiert? `node --version`
2. Backend läuft? Health-Check öffnen
3. Frontend läuft? Browser → http://localhost:5173
4. Browser-Konsole (F12) → Errors?
5. Backend-Konsole → Errors?
6. **Letzter Ausweg:** Backend stoppen, `backend/data/filawatch.db` löschen, neu starten → komplett frischer Stand

### Bug gefunden? Feature-Idee?
Frag einfach Claude — das ganze Projekt ist von Claude generiert und kann jederzeit erweitert werden!
