import { Router } from 'express';
import { nanoid } from 'nanoid';
import db, { logActivity } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendNotificationToAll } from '../push.js';
import { calcLengthMeters, calcWeightFromLength, MATERIAL_DENSITIES, HYGROSCOPIC_MATERIALS, daysSince } from '../materials.js';

const router = Router();
router.use(requireAuth);

// Anreichern eines Filaments mit berechneten Feldern
function enrich(f) {
  if (!f) return f;
  const length_m = calcLengthMeters(f.current_weight_g, f.diameter, f.material);
  const length_initial_m = calcLengthMeters(f.initial_weight_g, f.diameter, f.material);
  const days_since_dried = daysSince(f.last_dried);
  const is_hygroscopic = HYGROSCOPIC_MATERIALS.has(f.material);
  const needs_drying = is_hygroscopic && (days_since_dried === null || days_since_dried > 60);
  // AMS-Slot-Info (falls zugeordnet)
  const assignment = db.prepare('SELECT unit_id, slot_id FROM ams_assignments WHERE filament_id = ?').get(f.id);
  return {
    ...f,
    length_remaining_m: length_m,
    length_initial_m: length_initial_m,
    is_hygroscopic,
    days_since_dried,
    needs_drying,
    in_ams: !!assignment,
    ams_unit_id: assignment ? assignment.unit_id : null,
    ams_slot_id: assignment ? assignment.slot_id : null,
  };
}

router.get('/', (req, res) => {
  const includeArchived = req.query.archived === 'true';
  const rows = db.prepare(
    `SELECT * FROM filaments WHERE is_archived = ? ORDER BY brand, color_name`
  ).all(includeArchived ? 1 : 0);
  res.json(rows.map(enrich));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(enrich(row));
});

// Statistik für eine Spule
router.get('/:id/stats', (req, res) => {
  const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });

  const usage = db.prepare(`
    SELECT
      COUNT(*) AS prints,
      COALESCE(SUM(weight_used_g), 0) AS total_used_g,
      COALESCE(SUM(duration_minutes), 0) AS total_minutes,
      COALESCE(SUM(cost_material), 0) AS total_cost,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS fail_count,
      MIN(started_at) AS first_use,
      MAX(started_at) AS last_use
    FROM prints WHERE filament_id = ?
  `).get(req.params.id);

  // Verlauf: Verbrauch über Zeit
  const history = db.prepare(`
    SELECT date(started_at) AS date, COALESCE(SUM(weight_used_g), 0) AS used
    FROM prints WHERE filament_id = ?
    GROUP BY date(started_at)
    ORDER BY date
  `).all(req.params.id);

  const successRate = usage.prints > 0 ? Math.round(usage.success_count / usage.prints * 100) : 0;

  res.json({
    filament: enrich(f),
    usage: {
      prints: usage.prints,
      total_used_g: usage.total_used_g,
      total_minutes: usage.total_minutes,
      total_cost: usage.total_cost,
      success_count: usage.success_count,
      fail_count: usage.fail_count,
      success_rate: successRate,
      first_use: usage.first_use,
      last_use: usage.last_use,
    },
    history,
  });
});

// "Spule wiegen" — User tippt aktuelles Gesamt-Gewicht ein
// Backend rechnet: filament_weight = total - spool_weight
router.post('/:id/weigh', (req, res) => {
  const { total_weight_g } = req.body;
  if (total_weight_g == null || total_weight_g < 0) {
    return res.status(400).json({ error: 'total_weight_g erforderlich' });
  }
  const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });

  const filament_g = Math.max(0, Math.round(total_weight_g - f.spool_weight_g));
  db.prepare(`UPDATE filaments SET current_weight_g = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(filament_g, req.params.id);

  logActivity(req.user, 'filament_weighed', `${f.brand} ${f.color_name}`, `${filament_g}g (gemessen ${total_weight_g}g)`);
  const updated = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  res.json(enrich(updated));
});

// Trocknung als erledigt markieren
router.post('/:id/dried', (req, res) => {
  const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE filaments SET last_dried = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(req.params.id);
  logActivity(req.user, 'filament_dried', `${f.brand} ${f.color_name}`);
  const updated = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  res.json(enrich(updated));
});

// "Reicht das noch?" — gegebene Menge mit Bestand vergleichen
router.post('/:id/can-print', (req, res) => {
  const { weight_needed_g, length_needed_m } = req.body;
  const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });

  let needed = weight_needed_g;
  if (needed == null && length_needed_m != null) {
    needed = calcWeightFromLength(length_needed_m, f.diameter, f.material);
  }
  if (needed == null) return res.status(400).json({ error: 'weight_needed_g oder length_needed_m erforderlich' });

  const has_enough = f.current_weight_g >= needed;
  const buffer = f.current_weight_g - needed;
  const buffer_pct = needed > 0 ? Math.round((f.current_weight_g / needed) * 100) : 999;

  res.json({
    filament: enrich(f),
    needed_g: Math.round(needed),
    available_g: f.current_weight_g,
    has_enough,
    buffer_g: Math.round(buffer),
    buffer_pct,
    warning: !has_enough ? 'Reicht nicht!' : (buffer_pct < 110 ? 'Knapp — Puffer < 10%' : null),
  });
});

// Ähnliche Filamente vorschlagen (gleiches Material+Farbe-Bereich, vorhanden)
router.get('/:id/similar', (req, res) => {
  const f = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });

  const similar = db.prepare(`
    SELECT * FROM filaments
    WHERE id != ? AND is_archived = 0 AND material = ? AND current_weight_g > 50
    ORDER BY current_weight_g DESC LIMIT 5
  `).all(req.params.id, f.material);

  res.json(similar.map(enrich));
});

// Material-Konstanten abrufen (für Frontend Berechnungen)
router.get('/_meta/materials', (req, res) => {
  res.json({
    densities: MATERIAL_DENSITIES,
    hygroscopic: Array.from(HYGROSCOPIC_MATERIALS),
  });
});

router.post('/', (req, res) => {
  const id = nanoid(12);
  const f = req.body;
  db.prepare(`
    INSERT INTO filaments (
      id, brand, material, color_name, color_hex, diameter,
      initial_weight_g, current_weight_g, spool_weight_g,
      purchase_date, price, shop_url, location,
      nozzle_temp, bed_temp, print_speed, last_dried, notes
    ) VALUES (
      @id, @brand, @material, @color_name, @color_hex, @diameter,
      @initial_weight_g, @current_weight_g, @spool_weight_g,
      @purchase_date, @price, @shop_url, @location,
      @nozzle_temp, @bed_temp, @print_speed, @last_dried, @notes
    )
  `).run({
    id,
    brand: f.brand || 'Unbekannt',
    material: f.material || 'PLA',
    color_name: f.color_name || 'Weiß',
    color_hex: f.color_hex || '#ffffff',
    diameter: f.diameter || 1.75,
    initial_weight_g: f.initial_weight_g || 1000,
    current_weight_g: f.current_weight_g ?? f.initial_weight_g ?? 1000,
    spool_weight_g: f.spool_weight_g || 250,
    purchase_date: f.purchase_date || null,
    price: f.price || null,
    shop_url: f.shop_url || null,
    location: f.location || null,
    nozzle_temp: f.nozzle_temp || null,
    bed_temp: f.bed_temp || null,
    print_speed: f.print_speed || null,
    last_dried: f.last_dried || null,
    notes: f.notes || null,
  });
  logActivity(req.user, 'filament_added', `${f.brand} ${f.color_name}`, `${f.material}`);
  const created = db.prepare('SELECT * FROM filaments WHERE id = ?').get(id);
  res.json(enrich(created));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const f = { ...existing, ...req.body, id: req.params.id };
  db.prepare(`
    UPDATE filaments SET
      brand=@brand, material=@material, color_name=@color_name, color_hex=@color_hex,
      diameter=@diameter, initial_weight_g=@initial_weight_g, current_weight_g=@current_weight_g,
      spool_weight_g=@spool_weight_g, purchase_date=@purchase_date, price=@price,
      shop_url=@shop_url, location=@location, nozzle_temp=@nozzle_temp,
      bed_temp=@bed_temp, print_speed=@print_speed, last_dried=@last_dried,
      notes=@notes, is_archived=@is_archived, updated_at=datetime('now')
    WHERE id=@id
  `).run(f);
  const updated = db.prepare('SELECT * FROM filaments WHERE id = ?').get(req.params.id);
  res.json(enrich(updated));
});

router.delete('/:id', (req, res) => {
  const f = db.prepare('SELECT brand, color_name FROM filaments WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM filaments WHERE id = ?').run(req.params.id);
  if (f) logActivity(req.user, 'filament_deleted', `${f.brand} ${f.color_name}`);
  res.json({ ok: true });
});

export default router;
