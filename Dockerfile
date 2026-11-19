# Filawatch v5 - Production Dockerfile
# Multi-stage build: erst Frontend bauen, dann ins Backend kopieren

# === Stage 1: Frontend Build ===
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# === Stage 2: Backend mit gebautem Frontend ===
FROM node:20-alpine
WORKDIR /app

# Build-Tools für better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Backend Dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Backend Source
COPY backend/src ./src

# Gebauten Frontend ins Backend rein (server.js findet ihn dort automatisch)
COPY --from=frontend-build /app/frontend/dist ./public

# Persistente Verzeichnisse anlegen
RUN mkdir -p data uploads/photos uploads/files

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Healthcheck für Azure / Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["node", "src/server.js"]
