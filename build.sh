#!/usr/bin/env bash
# Build-Script für Filawatch v5
# Baut das Frontend und kopiert es nach backend/public,
# sodass das Backend alles aus einem Server liefern kann.
# Nutze dies vor dem Deployment.

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "==> Filawatch Build Script"
echo "==> Root: $ROOT"

# 1. Frontend bauen
echo ""
echo "==> Building frontend..."
cd "$ROOT/frontend"
npm ci
npm run build

# 2. Frontend nach backend/public kopieren
echo ""
echo "==> Copying built frontend to backend/public..."
rm -rf "$ROOT/backend/public"
mkdir -p "$ROOT/backend/public"
cp -r "$ROOT/frontend/dist/." "$ROOT/backend/public/"

# 3. Backend Dependencies installieren (production only)
echo ""
echo "==> Installing backend production dependencies..."
cd "$ROOT/backend"
npm ci --omit=dev

echo ""
echo "==> Build complete!"
echo "==> Du kannst jetzt im backend/ Ordner 'npm start' ausführen"
echo "==> Das Backend liefert dann auch das Frontend automatisch aus."
