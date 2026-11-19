# 🚀 Filawatch auf Azure deployen

Diese Anleitung führt dich Schritt für Schritt durch das Deployment von Filawatch auf deinem Azure Education Account. Du brauchst dafür ungefähr **30 Minuten** beim ersten Mal.

## Was wir aufsetzen

```
┌──────────────────────────────────────────────────┐
│  AZURE                                           │
│                                                  │
│  ┌────────────────────┐  ┌────────────────────┐ │
│  │ App Service        │  │ Storage Account    │ │
│  │ (Linux, Node 20)   │  │                    │ │
│  │                    │  │ Container:         │ │
│  │ Filawatch Backend  │──│ filawatch-backups  │ │
│  │ + Frontend (PWA)   │  │ (für Daily Backup) │ │
│  └────────────────────┘  └────────────────────┘ │
│         ▲                                        │
└─────────┼────────────────────────────────────────┘
          │
          │ MQTT (über Bambu Cloud)
          │
   ┌──────┴──────┐
   │ Bambu Cloud │
   │  (Bambu's   │
   │   Server)   │
   └──────┬──────┘
          │
          │ MQTT
          │
   ┌──────┴──────┐         ┌──────────────┐
   │ Bambu P2S   │         │ Du / Familie │
   │ (zuhause)   │         │ Browser/PWA  │
   └─────────────┘         └──────────────┘
                                    │
                                    │ HTTPS
                                    ▼
                            filawatch.azurewebsites.net
```

**Wichtig zu verstehen:** Dein Drucker steht zuhause, dein Backend läuft auf Azure — und sie reden über die Bambu Cloud miteinander. Das ist der Trick warum das mit Azure funktioniert ohne dass dein PC zuhause läuft!

---

## 📑 Inhalt

1. [Voraussetzungen](#voraussetzungen)
2. [Schritt 1: Resource Group erstellen](#schritt-1-resource-group-erstellen)
3. [Schritt 2: Storage Account anlegen](#schritt-2-storage-account-anlegen)
4. [Schritt 3: App Service Plan und App Service erstellen](#schritt-3-app-service-plan-und-app-service-erstellen)
5. [Schritt 4: Environment-Variablen konfigurieren](#schritt-4-environment-variablen-konfigurieren)
6. [Schritt 5: Code deployen](#schritt-5-code-deployen)
7. [Schritt 6: Erste Anmeldung](#schritt-6-erste-anmeldung)
8. [Schritt 7: PWA aufs Handy](#schritt-7-pwa-aufs-handy)
9. [Schritt 8: Custom Domain (optional)](#schritt-8-custom-domain-optional)
10. [Updates deployen](#updates-deployen)
11. [Logs ansehen](#logs-ansehen)
12. [Kosten im Auge behalten](#kosten-im-auge-behalten)

---

## Voraussetzungen

- ✅ Azure Education Subscription (du hast die)
- ✅ Azure CLI installiert ODER Azure Portal ([portal.azure.com](https://portal.azure.com))
- ✅ Node.js 20+ auf deinem PC (für den Build)
- ✅ Visual Studio Code (empfohlen) mit der **Azure App Service Extension**
- ✅ Bambu Lab Account
- ✅ Das filawatch-v7 ZIP entpackt

---

## Schritt 1: Resource Group erstellen

Eine Resource Group ist ein "Container" für alle zusammengehörenden Azure-Ressourcen.

### Im Azure Portal

1. Auf [portal.azure.com](https://portal.azure.com) einloggen
2. Oben in der Suche **"Resource groups"** eintippen → klicken
3. **+ Create**
4. Werte:
   - **Subscription:** Azure for Students (deine Education Sub)
   - **Resource group:** `filawatch-rg`
   - **Region:** `West Europe` (oder `Germany West Central` für Niedrigste Latenz aus Österreich)
5. **Review + Create** → **Create**

### Alternativ mit Azure CLI

```bash
az login
az group create --name filawatch-rg --location westeurope
```

---

## Schritt 2: Storage Account anlegen

Den brauchen wir für die automatischen Backups.

### Im Azure Portal

1. Suche **"Storage accounts"** → **+ Create**
2. Werte:
   - **Subscription:** Azure for Students
   - **Resource group:** `filawatch-rg`
   - **Storage account name:** `filawatchstorage` (muss global eindeutig sein, vielleicht `filawatchstorage` + deine Initialen)
   - **Region:** West Europe (gleiche wie Resource Group!)
   - **Performance:** Standard
   - **Redundancy:** **LRS** (Locally Redundant — günstigste Option, reicht für Backups)
3. **Review + Create** → **Create**
4. Warten bis fertig (~30 Sekunden) → **Go to resource**

### Connection String holen

1. Im Storage Account links auf **"Access keys"** (unter Security + networking)
2. Bei **key1** → **"Show"** klicken bei **Connection string**
3. Den ganzen String kopieren — sieht so aus:
   ```
   DefaultEndpointsProtocol=https;AccountName=filawatchstorage;AccountKey=...;EndpointSuffix=core.windows.net
   ```
4. **Diesen String aufheben** — den brauchst du in Schritt 4!

> 💡 Den Container `filawatch-backups` musst du nicht manuell anlegen — Filawatch erstellt ihn automatisch beim ersten Backup.

---

## Schritt 3: App Service Plan und App Service erstellen

Der App Service ist der eigentliche Web-Server für Filawatch.

### Im Azure Portal

1. Suche **"App Services"** → **+ Create** → **Web App**
2. **Basics**:
   - **Subscription:** Azure for Students
   - **Resource group:** `filawatch-rg`
   - **Name:** `filawatch-luca` (muss global eindeutig sein → wird zu `filawatch-luca.azurewebsites.net`)
   - **Publish:** **Code** (nicht Container)
   - **Runtime stack:** **Node 20 LTS**
   - **Operating System:** **Linux**
   - **Region:** West Europe
3. **App Service Plan**:
   - **Linux Plan:** Create new → `filawatch-plan`
   - **Pricing plan:** Klick **"Explore pricing plans"**
     - Wähle **B1 (Basic)** — 1 Core, 1.75 GB RAM, ~13 €/Monat
     - **Mit Education Credit kostenlos!** Du hast normalerweise $100/Jahr Credit.
     - Alternativ **F1 (Free)** — 60 min CPU/Tag, 1 GB RAM. Reicht zum Testen, aber Free Tier hat einige Einschränkungen (kein Always On, ggf. langsam, Drucker-MQTT-Connection bricht ggf. ab)
     - **Empfehlung: B1**
4. **Database:** Skip (wir nutzen die SQLite die im Container/auf der Disk liegt)
5. **Deployment:** Skip → **Continue**
6. **Networking:** Skip → **Continue**
7. **Monitoring:** **Enable Application Insights: No** (kannst du später aktivieren)
8. **Tags:** Skip
9. **Review + Create** → **Create**
10. Warten bis fertig (~2 Minuten) → **Go to resource**

> ⚠️ **Wichtig bei Free Tier (F1):** Wechsle nach dem Setup unter **Configuration → General settings → Always On = Off** (bei F1 ist es nicht verfügbar). Bei B1 oder höher: **Always On = On**! Sonst schläft der Server ein und der Drucker-MQTT bricht ab.

### Persistente Storage aktivieren

Damit deine SQLite-DB einen Neustart überlebt:

1. Im App Service → **Configuration** → **General settings**
2. **Stack:** Node 20 LTS (sollte schon stehen)
3. **Startup Command:** `bash /home/site/wwwroot/startup.sh`
4. Oben **Save**

> 💡 Auf Linux App Services ist `/home` automatisch persistent über App-Restarts hinweg. Unsere `data/` und `uploads/` Verzeichnisse landen unter `/home/site/wwwroot/backend/` und überleben dadurch Restarts und sogar manche Updates.

---

## Schritt 4: Environment-Variablen konfigurieren

Hier setzen wir die ganzen Settings für Filawatch.

1. Im App Service → **Settings → Environment variables** (in neueren Portalen) oder **Configuration → Application settings**
2. Klick **+ Add** für jede dieser Variablen:

| Name | Wert | Wofür |
|---|---|---|
| `NODE_ENV` | `production` | Production-Mode |
| `PORT` | `8080` | Azure Linux nutzt 8080 |
| `WEBSITES_PORT` | `8080` | Azure muss wissen wo er draufgehen soll |
| `JWT_SECRET` | (siehe unten ⬇️) | Auth-Token-Verschlüsselung |
| `INITIAL_ADMIN_PASSWORD` | `dein-sicheres-passwort` | Erstes Admin-Passwort |
| `VAPID_SUBJECT` | `mailto:deine@email.com` | Push-Notification-Identifier |
| `AZURE_STORAGE_CONNECTION_STRING` | (aus Schritt 2) | Für Backups |
| `AZURE_BACKUP_CONTAINER` | `filawatch-backups` | Container-Name |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` | Azure soll npm install ausführen |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` | Node-Version |

**JWT_SECRET generieren:**
```bash
# Auf deinem PC im Terminal:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Kopier den langen String als Wert für JWT_SECRET.

3. Wenn alle Variablen drin sind → **Save** oben

---

## Schritt 5: Code deployen

Jetzt der spannende Teil — den Code auf Azure bringen!

### Variante A: Mit VS Code (empfohlen für Anfänger)

1. **Azure Account** Extension in VS Code installieren
2. **Azure App Service** Extension installieren
3. F1 → "Azure: Sign In" → mit deinem Azure-Account einloggen
4. Im VS Code Sidebar: **Azure** Tab öffnen → unter App Services siehst du `filawatch-luca`

**Erst lokal builden:**

```bash
cd filawatch-v7
# Linux/Mac:
./build.sh
# Windows:
build.bat
```

Das baut das Frontend und kopiert es nach `backend/public`.

**Dann deployen:**

5. Rechtsklick auf `filawatch-luca` in der Azure-Sidebar → **Deploy to Web App**
6. Wähle den Ordner `backend` aus der entpackten ZIP
7. Bestätige "Deploy" → "Yes"
8. Warten — VS Code zippt den Backend-Ordner und uploaded ihn (~3-5 Minuten beim ersten Mal)

> 💡 **Alternative: ganzes Projekt deployen.** Wenn du keine Lust hast `build.sh` lokal auszuführen, kannst du auch den **kompletten** `filawatch-v7` Ordner deployen. Dann baut Azure den Frontend selbst über das `startup.sh` Script (siehe oben). Dauert beim ersten Start länger.

### Variante B: Zip-Deploy mit Azure CLI

```bash
cd filawatch-v7
./build.sh                          # Frontend bauen
cd backend
zip -r ../filawatch-deploy.zip .    # Backend zippen
cd ..

az webapp deploy \
  --resource-group filawatch-rg \
  --name filawatch-luca \
  --src-path filawatch-deploy.zip \
  --type zip
```

### Variante C: GitHub Actions (für Profis)

Wenn du den Code auf GitHub hast: App Service → Deployment Center → GitHub → Repository wählen → Azure generiert eine GitHub Action die bei jedem Push automatisch deployt.

### Deployment prüfen

Nach dem Deploy:
1. Browser → `https://filawatch-luca.azurewebsites.net/api/health`
2. Sollte JSON zurückgeben:
   ```json
   { "ok": true, "uptime": 5, "memory_mb": 80, "db": "ok", "version": "5.0" }
   ```
3. Wenn ja → 🎉 läuft!
4. Wenn nicht → siehe [Logs ansehen](#logs-ansehen)

---

## Schritt 6: Erste Anmeldung

1. Im Browser: `https://filawatch-luca.azurewebsites.net`
2. Login mit `admin` und deinem `INITIAL_ADMIN_PASSWORD`
3. **Settings → Mein Profil** → Passwort ändern!
4. **Settings → Drucker einrichten:**
   - Klick **☁ BAMBU CLOUD**
   - Email + Passwort vom Bambu-Account
   - Region: **EU**
   - ▸ Login
   - **Wenn du 2FA aktiviert hast:** Du wirst zu einer 2FA-Eingabe weitergeleitet
     - Öffne deine Authenticator-App (Google Authenticator / Authy / 1Password / etc.)
     - Gib den aktuellen 6-stelligen Code ein
   - **Oder:** Wenn nur Email-Verifizierung aktiv ist → Code aus der Email eingeben
5. Drucker aus der Liste auswählen
6. **Settings → User verwalten** → Accounts für Vater und Mutter anlegen
7. **Settings → Push-Benachrichtigungen** → Aktivieren

✨ **Dein Filawatch läuft jetzt komplett auf Azure!** Dein PC darf aus bleiben.

---

## Schritt 7: PWA aufs Handy

### Android (Chrome / Edge)
1. `https://filawatch-luca.azurewebsites.net` öffnen
2. Install-Banner oben → **Installieren** klicken
3. App-Icon erscheint auf dem Homescreen

### iOS (Safari!)
1. **Muss Safari sein** — Chrome auf iOS unterstützt keine PWAs
2. URL öffnen
3. Teilen-Button (Quadrat mit Pfeil) → **"Zum Home-Bildschirm"**
4. Hinzufügen

→ Vollbild-App mit Push-Notifications, von überall erreichbar.

---

## Schritt 8: Custom Domain (optional)

`filawatch-luca.azurewebsites.net` ist ok aber `filawatch.lucs.at` ist cooler.

1. Du brauchst eine eigene Domain (Namecheap, Hosteurope, etc.)
2. App Service → **Custom domains** → **+ Add custom domain**
3. **Domain provider:** All other domain services
4. Domain eingeben → Azure zeigt dir DNS-Records die du bei deinem Provider eintragen musst (CNAME + TXT)
5. DNS eintragen, warten (kann 5-30 min dauern)
6. **Validate** in Azure → wenn grün → **Add**
7. **TLS/SSL settings → Bindings → + Add binding** → Domain wählen → **Managed Certificate** (gratis von Azure!)

---

## Updates deployen

Wenn du was änderst und neu deployen willst:

```bash
cd filawatch-v7
./build.sh
# Dann wieder VS Code Deploy oder:
cd backend
zip -r ../update.zip .
az webapp deploy --resource-group filawatch-rg --name filawatch-luca --src-path ../update.zip --type zip
```

> ⚠️ **Wichtig:** Die **Datenbank** und die **Uploads** (Fotos, STL-Files) bleiben beim Deploy erhalten weil sie unter `/home/site/wwwroot/backend/data/` und `/uploads/` liegen — der Deploy überschreibt nur die `src/`-Files und `node_modules`.

---

## Logs ansehen

### Im Azure Portal
1. App Service → **Monitoring → Log stream**
2. Live-Logs vom Server

### Mit Azure CLI
```bash
az webapp log tail --resource-group filawatch-rg --name filawatch-luca
```

### SSH in den Container
1. App Service → **Development Tools → SSH** → "Go"
2. Du bist drin! Probier:
   ```bash
   cd /home/site/wwwroot/backend
   ls -la data/        # SQLite-DB
   ls -la uploads/     # Fotos
   tail -f /home/LogFiles/*.log
   ```

---

## Kosten im Auge behalten

Azure Education Account hat normalerweise **$100 Credit pro Jahr**. Das reicht easy für Filawatch:

| Service | Monatliche Kosten |
|---|---|
| App Service B1 | ~13 € |
| Storage Account (LRS, paar GB) | ~0,02 € |
| Bandwidth (gering) | ~0 € |
| **Gesamt** | **~13 €/Monat** |

Im Education Credit ist das **kostenlos**.

### Cost Alerts einrichten
1. Subscription → **Cost Management → Budgets** → **+ Add**
2. Budget: z.B. 20€ pro Monat
3. Alert bei 80% → Email an dich

### Wenn das Geld aus geht
- Auf Free Tier (F1) wechseln: App Service Plan → **Scale up** → F1
- Oder App Service stoppen wenn du es nicht brauchst (Stop Button im Portal)

---

## 🎉 Fertig!

Du hast jetzt:
- ✅ Filawatch komplett auf Azure laufen, dein PC kann aus
- ✅ Erreichbar von überall: PC, Handy, Tablet
- ✅ PWA installierbar auf allen Geräten
- ✅ Push-Notifications direkt aus der Cloud
- ✅ Tägliches automatisches Backup
- ✅ HTTPS mit gratis SSL-Zertifikat
- ✅ 2FA-tauglich

**Bei Problemen:** Schau in die `TROUBLESHOOTING.md`!
