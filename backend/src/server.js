import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

import filamentsRouter from './routes/filaments.js';
import printsRouter from './routes/prints.js';
import statsRouter from './routes/stats.js';
import extrasRouter from './routes/extras.js';
import extras2Router from './routes/extras2.js';
import authRouter from './routes/auth.js';
import pushRouter from './routes/push.js';
import printerRouter from './routes/printer.js';
import threemfRouter from './routes/threemf.js';

import db from './db.js';
import { startBambuBridge, getPrinterState, subscribePrinter } from './bambu.js';
import { ensureInitialAdmin, optionalAuth, verifyToken } from './auth.js';
import { initPush } from './push.js';
import { startCronJobs } from './cron.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();

// Trust proxy für Azure App Service / Reverse Proxies
app.set('trust proxy', 1);

// Security Headers (in Production etwas strenger)
app.use(helmet({
  contentSecurityPolicy: false, // wir liefern auch das Frontend → keine strict CSP
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // damit Foto-Downloads gehen
}));

// CORS — in Production restriktiver
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : null;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || !allowedOrigins) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));

// Static uploads (Fotos und STL-Files)
app.use('/uploads', express.static(join(__dirname, '..', 'uploads'), {
  maxAge: isProduction ? '7d' : 0,
}));

// SSE Live-Stream (Auth via query-token weil EventSource keine Headers sendet)
// MUSS VOR allen Router-Mounts stehen, weil '/api' Catchall-Router (extras/extras2)
// sonst global requireAuth auf /api/printer/stream anwenden würden
app.get('/api/printer/stream', (req, res) => {
  const token = req.query.token;
  if (!token) {
    console.log('[Stream] 401 — no token in query');
    return res.status(401).end();
  }
  const payload = verifyToken(token);
  if (!payload) {
    console.log('[Stream] 401 — verifyToken returned null');
    return res.status(401).end();
  }
  console.log(`[Stream] OK — user=${payload.username}`);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(getPrinterState())}\n\n`);

  const unsub = subscribePrinter((state) => {
    res.write(`data: ${JSON.stringify(state)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsub();
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/push', pushRouter);
app.use('/api/filaments', filamentsRouter);
app.use('/api/prints', printsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/printer', printerRouter);
app.use('/api/threemf', threemfRouter);
app.use('/api', extrasRouter);
app.use('/api', extras2Router);

// Drucker-Status (geschützt)
app.get('/api/printer/status', optionalAuth, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Auth nötig' });
  res.json(getPrinterState());
});

// === Health Check für Azure App Service ===
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    const printer = getPrinterState();
    res.json({
      ok: true,
      uptime: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      db: 'ok',
      printer: {
        connected: printer.connected,
        mode: printer.mode,
      },
      version: '7.0',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// === Production: Frontend statisch ausliefern ===
// Wenn /public oder ../frontend/dist existiert, servieren wir das ebenfalls
const staticDirs = [
  join(__dirname, '..', 'public'),
  join(__dirname, '..', '..', 'frontend', 'dist'),
];
for (const dir of staticDirs) {
  if (existsSync(dir)) {
    console.log(`[Server] Serving static frontend from: ${dir}`);
    app.use(express.static(dir, { maxAge: isProduction ? '1d' : 0 }));
    // SPA-Fallback: alle nicht-API-Routen auf index.html
    app.get(/^(?!\/api|\/uploads).*/, (req, res, next) => {
      const indexPath = join(dir, 'index.html');
      if (existsSync(indexPath)) return res.sendFile(indexPath);
      next();
    });
    break;
  }
}

// Error Handler
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Interner Serverfehler',
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[Filawatch v7] Backend läuft auf ${HOST}:${PORT}`);
  console.log(`[Filawatch v7] Mode: ${isProduction ? 'PRODUCTION' : 'development'}`);
  ensureInitialAdmin();
  initPush();
  startBambuBridge();
  startCronJobs();
});
