import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync, statSync, readFileSync } from 'fs';
import { nanoid } from 'nanoid';
import { requireAuth } from '../auth.js';
import { parse3mf } from '../threemf.js';
import db from '../db.js';
import { BambuCloud } from '../bambuCloud.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads', 'threemf');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

const router = Router();
router.use(requireAuth);

// POST /api/threemf/parse — File hochladen, parsen, Vorschau + Metadaten zurückgeben
// Datei bleibt auf dem Server (für späteren Print-Start)
router.post('/parse', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

  try {
    const result = await parse3mf(req.file.path);
    const fileId = nanoid(12);
    const newName = `${fileId}.3mf`;
    const newPath = join(UPLOAD_DIR, newName);

    // Datei umbenennen für stabile ID
    const { renameSync } = await import('fs');
    renameSync(req.file.path, newPath);

    // In DB speichern
    db.prepare(`
      INSERT INTO threemf_files (id, original_name, file_path, file_size, metadata_json, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      fileId,
      req.file.originalname,
      newPath,
      req.file.size,
      JSON.stringify(result.metadata),
      req.user.id
    );

    res.json({
      file_id: fileId,
      original_name: req.file.originalname,
      file_size: req.file.size,
      preview: result.preview,
      plate_count: result.plate_count,
      plates: result.plates,
      metadata: result.metadata,
    });
  } catch (err) {
    console.error('[3MF] Parse error:', err);
    if (req.file && existsSync(req.file.path)) {
      try { unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ error: `3MF parsen fehlgeschlagen: ${err.message}` });
  }
});

// GET /api/threemf — Liste aller hochgeladenen Files
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, u.display_name AS uploaded_by_name
    FROM threemf_files t
    LEFT JOIN users u ON u.id = t.uploaded_by
    ORDER BY t.uploaded_at DESC
  `).all();
  res.json(rows.map(r => ({
    ...r,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json) : null,
    metadata_json: undefined,
  })));
});

// GET /api/threemf/:id — Details eines Files (inkl. Vorschau aus Datei)
router.get('/:id', async (req, res) => {
  const row = db.prepare('SELECT * FROM threemf_files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!existsSync(row.file_path)) return res.status(404).json({ error: 'Datei nicht mehr vorhanden' });

  try {
    const result = await parse3mf(row.file_path);
    res.json({
      file_id: row.id,
      original_name: row.original_name,
      file_size: row.file_size,
      preview: result.preview,
      plates: result.plates,
      metadata: result.metadata,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/threemf/:id
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT file_path FROM threemf_files WHERE id = ?').get(req.params.id);
  if (row && existsSync(row.file_path)) {
    try { unlinkSync(row.file_path); } catch {}
  }
  db.prepare('DELETE FROM threemf_files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/threemf/:id/upload-to-cloud — File in Bambu Cloud Library hochladen
router.post('/:id/upload-to-cloud', async (req, res) => {
  const row = db.prepare('SELECT * FROM threemf_files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!existsSync(row.file_path)) return res.status(404).json({ error: 'Datei nicht mehr vorhanden' });

  const cfg = db.prepare('SELECT * FROM bambu_config WHERE id = 1').get();
  if (!cfg || !cfg.access_token) return res.status(400).json({ error: 'Bambu Cloud nicht konfiguriert' });

  try {
    const cloud = new BambuCloud(cfg.region || 'eu');
    cloud.setToken(cfg.access_token);
    if (!cloud.userId) await cloud.ensureUserId();

    const fileBuf = readFileSync(row.file_path);
    const result = await cloud.uploadFile(row.original_name, fileBuf);

    db.prepare(`UPDATE threemf_files SET cloud_url = ?, cloud_uploaded_at = datetime('now') WHERE id = ?`)
      .run(result.url || result.file_url || '', req.params.id);

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[3MF Cloud Upload]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/threemf/:id/bambu-connect-url — URL-Scheme für Bambu Connect generieren
// Bambu Connect öffnet sich und User klickt nur noch "Print"
router.get('/:id/bambu-connect-url', (req, res) => {
  const row = db.prepare('SELECT * FROM threemf_files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  // Wir brauchen einen lokalen Pfad — funktioniert nur wenn Bambu Connect auf dem gleichen
  // PC läuft wie der Server. Falls Server auf Azure läuft → File downloaden lassen
  const url = `bambu-connect://import-file?path=${encodeURIComponent(row.file_path)}&name=${encodeURIComponent(row.original_name)}&version=1.0.0`;

  res.json({
    url,
    note: 'Funktioniert nur wenn Bambu Connect auf dem gleichen Rechner installiert ist wie der Filawatch-Server. Sonst Datei erst herunterladen und manuell in Bambu Connect öffnen.',
  });
});

// GET /api/threemf/:id/download — File downloaden (für entferntes Bambu Connect)
router.get('/:id/download', (req, res) => {
  const row = db.prepare('SELECT * FROM threemf_files WHERE id = ?').get(req.params.id);
  if (!row || !existsSync(row.file_path)) return res.status(404).json({ error: 'Not found' });
  res.download(row.file_path, row.original_name);
});

export default router;
