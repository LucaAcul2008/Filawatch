import { Router } from 'express';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { getSetting, setSetting } from '../settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = Router();
router.use(requireAuth);

// --- ACTIVITY FEED ---
router.get('/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rows = db.prepare(`
    SELECT a.*, u.avatar_color
    FROM activity_log a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// --- QR CODE GENERATION ---
router.get('/filaments/:id/qr', async (req, res) => {
  const f = db.prepare('SELECT id, brand, color_name, material FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });

  // Die URL zum Filament (relativ — wird clientseitig zu absoluter URL)
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const url = `${proto}://${host}/?filament=${f.id}`;

  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#0a0e1a', light: '#ffffff' },
      width: 300,
    });
    res.type('svg').send(svg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// QR Code als PNG Data URL (für Download)
router.get('/filaments/:id/qr.png', async (req, res) => {
  const f = db.prepare('SELECT id, brand, color_name, material FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const url = `${proto}://${host}/?filament=${f.id}`;
  try {
    const buf = await QRCode.toBuffer(url, { type: 'png', width: 600, margin: 2 });
    res.type('png').send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Druckbares Label: QR + Infos
router.get('/filaments/:id/label', async (req, res) => {
  const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const url = `${proto}://${host}/?filament=${f.id}`;
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 0, width: 200, color: { dark: '#000', light: '#fff' } });
  // Inneres <svg> extrahieren
  const qrInner = qrSvg.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '<g transform="translate(20,60) scale(0.7)">').replace(/<\/svg>/, '</g>');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${f.brand} ${f.color_name}</title>
<style>
  @page { size: 80mm 50mm; margin: 0; }
  body { margin: 0; font-family: system-ui, sans-serif; }
  .label { width: 80mm; height: 50mm; padding: 4mm; display: flex; gap: 3mm; page-break-after: always; box-sizing: border-box; }
  .info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { font-size: 11pt; font-weight: 700; }
  .material { font-size: 14pt; font-weight: 800; color: #000; }
  .meta { font-size: 7pt; color: #666; line-height: 1.3; }
  .swatch { width: 8mm; height: 8mm; border: 1px solid #000; display: inline-block; vertical-align: middle; margin-right: 2mm; }
  .qr { width: 35mm; height: 35mm; }
  .qr svg { width: 100%; height: 100%; }
  @media print { .print-btn { display: none; } }
  .print-btn { padding: 8px 16px; margin: 16px; }
</style></head><body>
<button class="print-btn" onclick="window.print()">Drucken</button>
<div class="label">
  <div class="info">
    <div>
      <div class="brand">${f.brand}</div>
      <div class="material">${f.material}</div>
      <div style="margin-top:2mm"><span class="swatch" style="background:${f.color_hex}"></span><span style="font-size:9pt">${f.color_name}</span></div>
    </div>
    <div class="meta">
      ⌀ ${f.diameter}mm · ${f.initial_weight_g}g<br>
      ${f.nozzle_temp ? `Düse: ${f.nozzle_temp}°C` : ''} ${f.bed_temp ? `· Bett: ${f.bed_temp}°C` : ''}
    </div>
  </div>
  <div class="qr">
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${qrInner}</svg>
  </div>
</div>
</body></html>`;
  res.type('html').send(html);
});

// --- SETTINGS ---
router.get('/settings', (req, res) => {
  res.json({
    cost_power_kwh: parseFloat(getSetting('cost_power_kwh', '0.30')),
    cost_printer_watts: parseFloat(getSetting('cost_printer_watts', '150')),
    azure_backup_enabled: getSetting('azure_backup_enabled', '0') === '1',
    azure_last_backup: getSetting('azure_last_backup', null),
  });
});

router.put('/settings', requireAdmin, (req, res) => {
  const { cost_power_kwh, cost_printer_watts } = req.body;
  if (cost_power_kwh !== undefined) setSetting('cost_power_kwh', cost_power_kwh);
  if (cost_printer_watts !== undefined) setSetting('cost_printer_watts', cost_printer_watts);
  res.json({ ok: true });
});

// --- BAMBU STUDIO PROFILE EXPORT ---
// Exportiert ein einzelnes Filament als Bambu Studio-kompatibles JSON
router.get('/filaments/:id/profile', (req, res) => {
  const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });

  // Bambu Studio filament profile (vereinfacht — kann im Slicer importiert werden)
  const profile = {
    type: 'filament',
    name: `${f.brand} ${f.material} ${f.color_name}`,
    from: 'user',
    filament_vendor: [f.brand],
    filament_type: [f.material],
    filament_colour: [f.color_hex],
    filament_diameter: [String(f.diameter)],
    nozzle_temperature: f.nozzle_temp ? [String(f.nozzle_temp)] : undefined,
    nozzle_temperature_initial_layer: f.nozzle_temp ? [String(f.nozzle_temp + 5)] : undefined,
    hot_plate_temp: f.bed_temp ? [String(f.bed_temp)] : undefined,
    hot_plate_temp_initial_layer: f.bed_temp ? [String(f.bed_temp)] : undefined,
    filament_max_volumetric_speed: f.print_speed ? [String(f.print_speed)] : undefined,
    version: '1.0.0',
    is_custom_defined: '1',
  };

  // Remove undefined
  for (const k of Object.keys(profile)) {
    if (profile[k] === undefined) delete profile[k];
  }

  res.set('Content-Disposition', `attachment; filename="${f.brand}_${f.material}_${f.color_name}.json"`);
  res.type('json').send(JSON.stringify(profile, null, 2));
});

// --- AZURE BLOB BACKUP ---
router.post('/backup/azure', requireAdmin, async (req, res) => {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_BACKUP_CONTAINER || 'filatrack-backups';
  if (!connStr) return res.status(400).json({ error: 'AZURE_STORAGE_CONNECTION_STRING nicht gesetzt' });

  try {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const client = BlobServiceClient.fromConnectionString(connStr);
    const container = client.getContainerClient(containerName);
    await container.createIfNotExists();

    const dbPath = join(__dirname, '..', '..', 'data', 'filatrack.db');
    if (!existsSync(dbPath)) return res.status(500).json({ error: 'DB-Datei nicht gefunden' });
    const buf = readFileSync(dbPath);

    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const blobName = `filatrack-${date}.db`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(buf);

    setSetting('azure_last_backup', new Date().toISOString());
    setSetting('azure_backup_enabled', '1');
    res.json({ ok: true, blobName, size: buf.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/backup/list', requireAdmin, async (req, res) => {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_BACKUP_CONTAINER || 'filatrack-backups';
  if (!connStr) return res.status(400).json({ error: 'Azure nicht konfiguriert' });
  try {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const client = BlobServiceClient.fromConnectionString(connStr);
    const container = client.getContainerClient(containerName);
    const blobs = [];
    for await (const blob of container.listBlobsFlat()) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength,
        created: blob.properties.createdOn,
      });
    }
    blobs.sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json(blobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MAINTENANCE TRACKER ---
router.get('/maintenance', (req, res) => {
  const tasks = db.prepare('SELECT * FROM maintenance_tasks ORDER BY name').all();
  // Berechne aktuellen Stand: Stunden seit letzter Erledigung
  const totalMinutes = db.prepare('SELECT COALESCE(SUM(duration_minutes),0) AS s FROM prints').get().s;
  const totalHours = totalMinutes / 60;

  const enriched = tasks.map(t => {
    let hoursSinceLast = 0;
    if (t.last_done_at) {
      const minutesSince = db.prepare(`
        SELECT COALESCE(SUM(duration_minutes),0) AS s FROM prints WHERE started_at >= ?
      `).get(t.last_done_at).s;
      hoursSinceLast = minutesSince / 60;
    } else {
      hoursSinceLast = totalHours;
    }
    const dueIn = t.interval_hours - hoursSinceLast;
    return {
      ...t,
      hours_since_last: Math.round(hoursSinceLast * 10) / 10,
      due_in_hours: Math.round(dueIn * 10) / 10,
      is_due: dueIn <= 0,
      progress_pct: Math.min(100, Math.max(0, (hoursSinceLast / t.interval_hours) * 100)),
    };
  });
  res.json(enriched);
});

router.post('/maintenance/:id/done', (req, res) => {
  db.prepare('UPDATE maintenance_tasks SET last_done_at = datetime(\'now\'), last_done_by = ? WHERE id = ?')
    .run(req.user.display_name, req.params.id);
  res.json({ ok: true });
});

router.post('/maintenance', requireAdmin, (req, res) => {
  const { name, description, interval_hours } = req.body;
  if (!name || !interval_hours) return res.status(400).json({ error: 'name und interval_hours erforderlich' });
  const id = Math.random().toString(36).slice(2, 14);
  db.prepare('INSERT INTO maintenance_tasks (id, name, description, interval_hours) VALUES (?, ?, ?, ?)')
    .run(id, name, description || null, interval_hours);
  res.json(db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(id));
});

router.delete('/maintenance/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM maintenance_tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- KALENDER: Drucke gruppiert nach Datum ---
router.get('/calendar', (req, res) => {
  const month = req.query.month; // YYYY-MM
  let where = '';
  let params = [];
  if (month) {
    where = "WHERE strftime('%Y-%m', p.started_at) = ?";
    params.push(month);
  }
  const rows = db.prepare(`
    SELECT p.id, p.title, p.started_at, p.duration_minutes, p.weight_used_g, p.status,
           p.image_path, p.user_id,
           f.color_hex AS filament_hex, f.brand AS filament_brand,
           u.display_name AS user_name, u.avatar_color AS user_avatar_color
    FROM prints p
    LEFT JOIN filaments f ON f.id = p.filament_id
    LEFT JOIN users u ON u.id = p.user_id
    ${where}
    ORDER BY p.started_at DESC
  `).all(...params);
  res.json(rows);
});

// --- GALLERY: Nur Drucke mit Foto ---
router.get('/gallery', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, f.color_hex AS filament_hex, f.brand AS filament_brand, f.color_name AS filament_color,
           u.display_name AS user_display_name, u.avatar_color AS user_avatar_color
    FROM prints p
    LEFT JOIN filaments f ON f.id = p.filament_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.image_path IS NOT NULL AND p.image_path != ''
    ORDER BY p.started_at DESC
  `).all();
  res.json(rows);
});

// --- CSV EXPORT der Druckhistorie ---
router.get('/export/prints.csv', (req, res) => {
  const rows = db.prepare(`
    SELECT p.started_at, p.title, u.display_name AS user_name,
           f.brand AS filament_brand, f.material, f.color_name,
           p.weight_used_g, p.duration_minutes, p.status,
           p.cost_material, p.cost_power, p.notes, p.auto_logged
    FROM prints p
    LEFT JOIN filaments f ON f.id = p.filament_id
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.started_at DESC
  `).all();

  const header = ['Datum', 'Titel', 'User', 'Marke', 'Material', 'Farbe',
                  'Gramm', 'Minuten', 'Status', 'Material-Kosten', 'Strom-Kosten',
                  'Gesamt', 'Notizen', 'Auto-Logged'];

  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [header.join(';')];
  for (const r of rows) {
    const total = (r.cost_material || 0) + (r.cost_power || 0);
    lines.push([
      r.started_at, r.title, r.user_name, r.filament_brand, r.material, r.color_name,
      r.weight_used_g, r.duration_minutes, r.status,
      (r.cost_material || 0).toFixed(2), (r.cost_power || 0).toFixed(2), total.toFixed(2),
      r.notes, r.auto_logged ? 'ja' : 'nein',
    ].map(escape).join(';'));
  }

  // BOM für Excel-UTF-8-Erkennung
  const csv = '\uFEFF' + lines.join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="filawatch-prints-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
});

// --- MONATSSTATISTIK für Charts ---
router.get('/stats/monthly', (req, res) => {
  const months = parseInt(req.query.months) || 12;
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', started_at) AS month,
      COUNT(*) AS prints,
      COALESCE(SUM(weight_used_g), 0) AS grams,
      COALESCE(SUM(duration_minutes), 0) AS minutes,
      COALESCE(SUM(cost_material + cost_power), 0) AS total_cost,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success
    FROM prints
    WHERE started_at >= datetime('now', '-${months} months')
    GROUP BY month
    ORDER BY month
  `).all();
  res.json(rows);
});

export default router;
