#!/usr/bin/env bash
# Azure App Service Linux Startup Script
# Wird automatisch von Azure beim Start ausgeführt
# Setze diesen Pfad als "Startup Command" in Azure: bash /home/site/wwwroot/startup.sh

cd /home/site/wwwroot/backend

# Falls public/ noch nicht vorhanden ist, baue das Frontend on-the-fly
if [ ! -d "public" ] && [ -d "../frontend" ]; then
  echo "==> Public-Verzeichnis fehlt, baue Frontend..."
  cd ../frontend
  npm ci --no-audit --no-fund
  npm run build
  cp -r dist ../backend/public
  cd ../backend
fi

# Production Dependencies sicherstellen
if [ ! -d "node_modules" ]; then
  echo "==> Installing dependencies..."
  npm ci --omit=dev --no-audit --no-fund
fi

echo "==> Starting Filawatch..."
node src/server.js
