# FILAWATCH v7 🎛️📱☁️🖨️

Production-ready Filament- und 3D-Drucker-Verwaltung für den **Bambu Lab P2S**.

## ✨ Neu in v7

- 🎮 **Drucker-Fernsteuerung** — Pause/Resume/Stop/Notfall-Aus, Kammer-Licht, 4 Geschwindigkeits-Modi (Silent/Std/Sport/Ludicrous) direkt aus der Web-UI via MQTT. Admin-only, mit Activity-Log und Bestätigungs-Dialogen bei Stop/Notfall.
- ⚡ **Notfall-Aus** — Stop + M104/M140/M107 in einem Rutsch, mit prominentem rot-pulsierenden Button
- 📷 **Foto nachträglich bearbeiten** — Drag&Drop-Upload und Foto-Delete auf allen Drucken, auch wenn schon ein Foto existiert
- 🌓 **Dark/Light-Theme** — Toggle im Header und in den Settings, Industrial-Blueprint-Dark bleibt Default, Light ist sauber-hell für Tageslicht
- 🔔 **Toast-System** — alle `alert()`/`confirm()` in den Haupt-Flows durch animierte Toasts ersetzt (bottom-right, slide-in, click-to-dismiss)
- 📱 **Mobile-Optimierung** — Bottom-Navigation mit 5 Haupt-Tabs, 44x44px Touch-Targets, verbesserte Modals
- 🎨 **Filamente visuell überarbeitet** — großer Farbblock als Card-Header, animierte Progress-Bars mit Shimmer-Effekt, Hover-Lift, Trocknungs-Badge mit Wasser-Animation, Card/List-View-Toggle, schöner Empty-State

## Neu in v6

- 🎞️ **40+ Filament-Vorlagen** — alle offiziellen Bambu Lab Filamente plus Polymaker, Sunlu, Eryone, Overture
- ⚖️ **"Spule wiegen"** — Gesamtgewicht eintippen, Filawatch rechnet automatisch das Filament-Gewicht aus
- 📏 **Verbleibende Druckmeter** — basierend auf Material-Dichten (PLA 1.24, PETG 1.27 etc.)
- ✅ **"Reicht das noch?"-Check** — beim Druck-Anlegen prüft Filawatch ob das Filament reicht
- 📊 **Spulen-Statistiken** — Druckhistorie, Erfolgsquote, Verbrauchsverlauf pro Spule mit Charts
- 💧 **Trocknungs-Erinnerungen** — automatische Push-Notification jeden Montag für hygroskopische Materialien (PETG, Nylon, TPU, PA-CF)
- 📦 **3MF-Upload mit Vorschau** — drag & drop, zeigt Vorschaubild + Druckzeit + Filament-Verbrauch + alle Slicer-Settings
- 🖨️ **Slicer-Integration** — neuer "SLICER"-Tab, "Print via Bambu Connect"-Button öffnet Bambu Connect direkt mit der Datei
- ☁️ **Bambu Cloud Library Upload** — 3MF-Files in deine Bambu Cloud hochladen

Plus alles aus v5: 2FA, Auto Token-Refresh, Daily Backup, Smart Notifications, CSV-Export, Monats-Charts, PWA, Multi-User, Push, QR-Codes, Wartungs-Tracker.

## Schnellstart

```bash
cd backend && npm install && npm start
cd frontend && npm install && npm run dev
```

Browser: http://localhost:5173 · Login: `admin` / `admin1234`

Für Azure-Deployment → siehe **AZURE.md**

## Wichtig zur Slicer-Integration

Bambu hat seit Firmware 01.08+ einen Authorization-Schutz. Drucke direkt aus Filawatch starten geht nur über **Bambu Connect** als Vermittler. Filawatch generiert dafür eine `bambu-connect://` URL die du einmal anklickst — Bambu Connect öffnet sich, du klickst dort "Print", fertig. Bambu Connect muss installiert sein und Filawatch auf dem gleichen Rechner laufen.

Alternativ: Datei als 3MF herunterladen und manuell in Bambu Studio öffnen.

© Luca Aigner — Hobby-Projekt

Production-ready Filament- und 3D-Drucker-Verwaltung für den **Bambu Lab P2S**.
Komplette PWA mit Multi-User, Bambu Cloud Anbindung (mit 2FA-Support!), Push-Notifications, automatischen Backups, QR-Codes, Wartungs-Tracker und allem was du brauchst.

## ✨ Neu in v5

- 🔐 **2FA-Support** für Bambu Cloud (TOTP via Authenticator-App)
- 🔄 **Auto Token-Refresh** — der Bambu-Token wird automatisch erneuert bevor er abläuft
- 💾 **Automatisches Daily Backup** nach Azure Blob Storage (jede Nacht 3 Uhr, 30 Tage Retention)
- 📊 **Monats-Charts** im Dashboard (Drucke, kg, Kosten — letzte 6 Monate)
- 📄 **CSV-Export** der gesamten Druck-Historie (Excel-kompatibel mit BOM)
- 💡 **Smart Notifications** — wöchentliche Zusammenfassung jeden Sonntag
- 🛡️ **Production Hardening** — helmet security headers, CORS-Whitelist, Trust Proxy
- 🐳 **Dockerfile** + Build-Scripts für einfaches Deployment
- ☁️ **Komplettes Azure-Deployment** — alles auf Azure, dein PC darf aus bleiben

## 📑 Anleitungen

Diese ZIP enthält **drei** Anleitungen:

1. **README.md** (diese Datei) — Übersicht und schneller Local-Start
2. **AZURE.md** — Komplette Schritt-für-Schritt Azure-Deployment-Anleitung
3. **TROUBLESHOOTING.md** — Bei Problemen

---

## Schnellstart Lokal (zum Testen)

```bash
# Backend
cd backend
npm install
npm start

# In neuem Terminal: Frontend
cd frontend
npm install
npm run dev

# Browser: http://localhost:5173
# Login: admin / admin1234 → sofort Passwort ändern!
```

Für die Production-Deployment auf Azure → **siehe `AZURE.md`**

---

## Was kann Filawatch alles?

### 📊 Dashboard
- Live-Stats: Spulen, kg Filament, Druckzahl, Verbrauch, Druckzeit, Gesamt-Kosten
- Material-Verteilung als Pie-Chart
- Low-Stock-Warnungen
- **Monats-Verlauf** als Bar-Chart (letzte 6 Monate)
- User-Leaderboard mit Kosten pro User
- Live Activity-Feed
- CSV-Export-Button

### 🖨️ Live-Drucker-Status
- **Bambu Cloud Modus** mit 2FA-Support
- LAN-Modus als Alternative
- Live-Fortschritt, Layer, Restzeit, alle Temperaturen
- Alle AMS-Slots mit Filament-Farben

### 🎞️ Filament-Verwaltung
- Komplette Spulen-Verwaltung mit Bestand, Drucktemperaturen, Lagerort
- **QR-Codes** mit druckbarem Label (80×50mm)
- **Bambu Studio Profile-Export**

### 📜 Druck-Historie
- Karten-Layout mit Foto-Thumbnails
- **Foto- und STL-Upload** zu jedem Druck
- Automatische Kostenrechnung
- **Auto-Logging** vom Drucker

### 🛠️ Tools
- **Galerie:** Lightbox für alle Druck-Fotos
- **Kalender:** Monatsansicht aller Drucke
- **Wartungs-Tracker:** 6 vordefinierte P2S-Tasks mit Druckstunden-Berechnung

### 🔔 Push-Benachrichtigungen
- Druck gestartet / fertig / fehlgeschlagen
- Filament fast leer
- **Wöchentliche Zusammenfassung** jeden Sonntag

### 👥 Multi-User
- JWT-Login, bcrypt-Passwörter
- Admin und User Rollen
- Pro-User-Statistiken

### ☁️ Azure Integration
- Manuelles Backup auf Knopfdruck
- **Automatisches Daily Backup** (Cron um 3 Uhr nachts)
- 30-Tage Backup-Retention mit Auto-Cleanup

### 📱 Progressive Web App
- Installierbar auf iOS und Android
- Offline-Fähig (Service Worker mit Cache-Strategie)
- Push-Notifications auch wenn die App geschlossen ist

---

## Tech-Stack

- **Frontend:** React 18 + Vite + Tailwind + Recharts + Service Worker (PWA)
- **Backend:** Node.js 20 + Express + better-sqlite3 + mqtt.js + helmet + node-cron
- **DB:** SQLite (eine Datei)
- **Deployment:** Azure App Service (Linux) + Azure Blob Storage
- **Auth:** JWT + bcrypt
- **Push:** Web Push API mit VAPID
- **Live:** Server-Sent Events (SSE)

---

## Architektur

```
filawatch-v7/
├── backend/                    Node.js + Express
│   ├── src/
│   │   ├── server.js          Production-ready entry point
│   │   ├── db.js
│   │   ├── auth.js            JWT + bcrypt
│   │   ├── push.js            Web Push (VAPID)
│   │   ├── settings.js
│   │   ├── cron.js            Background-Tasks (Backup, Token-Refresh, Weekly)
│   │   ├── bambu.js           MQTT-Bridge (Cloud + LAN)
│   │   ├── bambuCloud.js      Cloud API mit Email-Code + 2FA
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── filaments.js
│   │       ├── prints.js
│   │       ├── stats.js
│   │       ├── printer.js     Cloud-Login-Wizard
│   │       ├── push.js
│   │       ├── extras.js
│   │       └── extras2.js     QR, Backup, Calendar, Gallery, CSV, Monthly
│   ├── data/                  SQLite-DB
│   ├── public/                Gebautes Frontend (nach build.sh)
│   └── uploads/               Fotos + STL-Files
├── frontend/                  React + Vite + Tailwind
│   ├── public/                PWA-Icons, Manifest, Service Worker
│   └── src/
│       └── components/        Login, Dashboard, Filaments, PrinterLive,
│                              Prints, Tools, Settings, Calendar, Gallery,
│                              Maintenance, ActivityFeed, InstallBanner, ...
├── Dockerfile                 Multi-stage Build für Container-Deployment
├── build.sh / build.bat       Build-Script (Frontend → backend/public)
├── startup.sh                 Azure App Service Startup
├── README.md                  ← du bist hier
├── AZURE.md                   Azure-Deployment-Schritt-für-Schritt
└── TROUBLESHOOTING.md         Bei Problemen
```

---

## Erster Login

```
Username: admin
Passwort: admin1234
```

**Sofort nach dem ersten Login:** Settings → Mein Profil → Passwort ändern!

In `backend/.env`:
```env
INITIAL_ADMIN_PASSWORD=mein-sicheres-passwort
JWT_SECRET=ein-mega-langes-zufaelliges-secret-12345
```

---

## Environment-Variablen

```env
# Server
PORT=3001
NODE_ENV=production
HOST=0.0.0.0

# JWT - in Production UNBEDINGT ÄNDERN!
JWT_SECRET=change-this-in-production-please

# Initial Admin (nur beim ersten Start)
INITIAL_ADMIN_PASSWORD=admin1234

# Push Notifications
VAPID_SUBJECT=mailto:deine@email.com

# CORS Whitelist (kommagetrennt) - leer = alle erlaubt
ALLOWED_ORIGINS=https://filawatch.azurewebsites.net,https://meine-domain.at

# Azure Blob Backup
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_BACKUP_CONTAINER=filawatch-backups
```

---

🚀 **Komplette Azure-Deployment-Anleitung in `AZURE.md`!**

Bei Fragen oder Bugs → einfach Claude wieder fragen.
**© Luca Aigner**
