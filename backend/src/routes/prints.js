import { Router } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync, unlinkSync } from 'fs';
import db, { logActivity } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { sendNotificationToAll } from '../push.js';
import { calcPrintCost } from '../settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dirname, '..', '..', 'uploads');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(UPLOADS, 'photos')),
  filename: (req, file, cb) => cb(null, `${nanoid(12)}${extname(file.originalname)}`),
});

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(UPLOADS, 'files')),
  filename: (req, file, cb) => cb(null, `${nanoid(12)}${extname(file.originalname)}`),
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Nur Bilder erlaubt'));
  },
});

const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(stl|3mf|gcode|obj|step|stp)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Nur STL, 3MF, GCODE, OBJ, STEP erlaubt'));
  },
});

const router = Router();

router.get('/', optionalAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
           f.brand AS filament_brand, f.color_name AS filament_color,
           f.color_hex AS filament_hex, f.material AS filament_material,
           u.display_name AS user_display_name, u.avatar_color AS user_avatar_color
    FROM prints p
    LEFT JOIN filaments f ON f.id = p.filament_id
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.started_at DESC
  `).all();
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const id = nanoid(12);
  const p = req.body;

  // Kosten berechnen
  let costs = { material: 0, power: 0 };
  if (p.filament_id) {
    const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(p.filament_id);
    if (f) costs = calcPrintCost({ weight_used_g: p.weight_used_g || 0, duration_minutes: p.duration_minutes || 0 }, f);
  }

  db.prepare(`
    INSERT INTO prints (id, title, user_id, user_name, filament_id, weight_used_g, duration_minutes, status, started_at, notes, cost_material, cost_power)
    VALUES (@id, @title, @user_id, @user_name, @filament_id, @weight_used_g, @duration_minutes, @status, @started_at, @notes, @cost_material, @cost_power)
  `).run({
    id,
    title: p.title || 'Druck',
    user_id: req.user.id,
    user_name: req.user.display_name,
    filament_id: p.filament_id || null,
    weight_used_g: p.weight_used_g || 0,
    duration_minutes: p.duration_minutes || 0,
    status: p.status || 'success',
    started_at: p.started_at || new Date().toISOString(),
    notes: p.notes || null,
    cost_material: costs.material,
    cost_power: costs.power,
  });

  // Filament-Bestand reduzieren
  if (p.filament_id && p.weight_used_g) {
    db.prepare(`UPDATE filaments SET current_weight_g = MAX(0, current_weight_g - ?), updated_at = datetime('now') WHERE id = ?`)
      .run(Math.round(p.weight_used_g), p.filament_id);

    // Low-Stock-Notification?
    const f = db.prepare('SELECT current_weight_g, brand, color_name FROM filaments WHERE id = ?').get(p.filament_id);
    if (f && f.current_weight_g < 100) {
      sendNotificationToAll({
        title: '⚠️ Filament fast leer',
        body: `${f.brand} ${f.color_name}: nur noch ${f.current_weight_g}g`,
        tag: 'low-stock-' + p.filament_id,
      });
    }
  }

  logActivity(req.user, 'print_logged', p.title, `${p.weight_used_g}g`);
  res.json(db.prepare('SELECT * FROM prints WHERE id = ?').get(id));
});

router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM prints WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const p = { ...existing, ...req.body, id: req.params.id };
  db.prepare(`
    UPDATE prints SET title=?, filament_id=?, weight_used_g=?, duration_minutes=?, status=?, notes=?
    WHERE id=?
  `).run(p.title, p.filament_id, p.weight_used_g, p.duration_minutes, p.status, p.notes, req.params.id);
  res.json(db.prepare('SELECT * FROM prints WHERE id = ?').get(req.params.id));
});

// Foto-Upload
router.post('/:id/photo', requireAuth, photoUpload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein File hochgeladen' });
  const relPath = `/uploads/photos/${req.file.filename}`;

  // Altes Foto löschen
  const old = db.prepare('SELECT image_path FROM prints WHERE id = ?').get(req.params.id);
  if (old?.image_path) {
    const oldPath = join(UPLOADS, old.image_path.replace('/uploads/', ''));
    if (existsSync(oldPath)) try { unlinkSync(oldPath); } catch {}
  }

  db.prepare('UPDATE prints SET image_path = ? WHERE id = ?').run(relPath, req.params.id);
  res.json({ image_path: relPath });
});

// v7: Foto löschen
router.delete('/:id/photo', requireAuth, (req, res) => {
  const row = db.prepare('SELECT image_path FROM prints WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.image_path) {
    const p = join(UPLOADS, row.image_path.replace('/uploads/', ''));
    if (existsSync(p)) try { unlinkSync(p); } catch {}
  }
  db.prepare('UPDATE prints SET image_path = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// File-Upload (STL/3MF)
router.post('/:id/file', requireAuth, fileUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein File hochgeladen' });
  const relPath = `/uploads/files/${req.file.filename}`;
  db.prepare('UPDATE prints SET file_path = ? WHERE id = ?').run(relPath, req.params.id);
  res.json({ file_path: relPath, original_name: req.file.originalname });
});

router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT image_path, file_path FROM prints WHERE id = ?').get(req.params.id);
  if (existing) {
    if (existing.image_path) {
      try { unlinkSync(join(UPLOADS, existing.image_path.replace('/uploads/', ''))); } catch {}
    }
    if (existing.file_path) {
      try { unlinkSync(join(UPLOADS, existing.file_path.replace('/uploads/', ''))); } catch {}
    }
  }
  db.prepare('DELETE FROM prints WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
