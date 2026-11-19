import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { BambuCloud } from '../bambuCloud.js';
import { reconnectBridge, getPrinterState, publishCommand, isPrinterConnected } from '../bambu.js';
import { logActivity } from '../db.js';

const router = Router();

// Aktuelle Konfig (ohne Tokens) abrufen
router.get('/config', requireAuth, (req, res) => {
  const cfg = db.prepare('SELECT id, mode, email, region, device_id, device_serial, device_name, lan_host, updated_at FROM bambu_config WHERE id = 1').get();
  res.json(cfg || null);
});

// LAN-Modus konfigurieren
router.post('/config/lan', requireAuth, requireAdmin, (req, res) => {
  const { lan_host, lan_access_code, device_serial } = req.body;
  if (!lan_host || !lan_access_code || !device_serial) {
    return res.status(400).json({ error: 'lan_host, lan_access_code und device_serial erforderlich' });
  }
  db.prepare(`
    INSERT INTO bambu_config (id, mode, lan_host, lan_access_code, device_serial, device_id, device_name, updated_at)
    VALUES (1, 'lan', ?, ?, ?, ?, 'P2S (LAN)', datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      mode='lan', lan_host=excluded.lan_host, lan_access_code=excluded.lan_access_code,
      device_serial=excluded.device_serial, device_id=excluded.device_id,
      device_name='P2S (LAN)', updated_at=datetime('now')
  `).run(lan_host, lan_access_code, device_serial, device_serial);
  reconnectBridge();
  res.json({ ok: true });
});

// CLOUD: Login Schritt 1 - Email + Passwort
router.post('/cloud/login', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, region } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email und Passwort erforderlich' });

  const cloud = new BambuCloud(region || 'eu');
  try {
    const result = await cloud.login(email, password);
    if (result.token) {
      // Direkt eingeloggt - Devices holen
      const devices = await cloud.getDevices();
      db.prepare(`
        INSERT INTO bambu_config (id, mode, email, region, access_token, refresh_token, updated_at)
        VALUES (1, 'cloud', ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          mode='cloud', email=excluded.email, region=excluded.region,
          access_token=excluded.access_token, refresh_token=excluded.refresh_token,
          updated_at=datetime('now')
      `).run(email, region || 'eu', result.token, result.refreshToken || null);
      return res.json({ ok: true, devices });
    }
    if (result.needsCode) {
      return res.json({ needsCode: true });
    }
    if (result.needsTfa) {
      // tfaKey temporär in DB speichern damit der nächste Request ihn finden kann
      db.prepare(`
        INSERT INTO bambu_config (id, mode, email, region, updated_at)
        VALUES (1, 'cloud', ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET email=excluded.email, region=excluded.region, updated_at=datetime('now')
      `).run(email, region || 'eu');
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('bambu_tfa_key', ?)`).run(result.tfaKey);
      return res.json({ needsTfa: true });
    }
    res.status(400).json({ error: 'Unbekannte Login-Antwort' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CLOUD: Login Schritt 2a - Email-Code verifizieren
router.post('/cloud/verify', requireAuth, requireAdmin, async (req, res) => {
  const { email, code, region } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email und Code erforderlich' });

  const cloud = new BambuCloud(region || 'eu');
  try {
    const result = await cloud.verifyCode(email, code);
    const devices = await cloud.getDevices();
    db.prepare(`
      INSERT INTO bambu_config (id, mode, email, region, access_token, refresh_token, updated_at)
      VALUES (1, 'cloud', ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        mode='cloud', email=excluded.email, region=excluded.region,
        access_token=excluded.access_token, refresh_token=excluded.refresh_token,
        updated_at=datetime('now')
    `).run(email, region || 'eu', result.token, result.refreshToken || null);
    res.json({ ok: true, devices });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CLOUD: Login Schritt 2b - 2FA TOTP-Code verifizieren
router.post('/cloud/verify-tfa', requireAuth, requireAdmin, async (req, res) => {
  const { code, region } = req.body;
  if (!code) return res.status(400).json({ error: '2FA-Code erforderlich' });

  // tfaKey aus den temporären Settings holen
  const tfaKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'bambu_tfa_key'").get();
  if (!tfaKeyRow) return res.status(400).json({ error: 'Kein 2FA-Vorgang aktiv. Bitte erneut mit Email/Passwort einloggen.' });

  const cfgRow = db.prepare("SELECT email, region FROM bambu_config WHERE id = 1").get();
  const useRegion = region || cfgRow?.region || 'eu';

  const cloud = new BambuCloud(useRegion);
  try {
    const result = await cloud.verifyTfa(code, tfaKeyRow.value);
    const devices = await cloud.getDevices();
    db.prepare(`UPDATE bambu_config SET access_token = ?, updated_at = datetime('now') WHERE id = 1`)
      .run(result.token);
    db.prepare("DELETE FROM settings WHERE key = 'bambu_tfa_key'").run();
    res.json({ ok: true, devices });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CLOUD: Drucker auswählen (nach Login)
router.post('/cloud/select-device', requireAuth, requireAdmin, (req, res) => {
  const { dev_id, name } = req.body;
  if (!dev_id) return res.status(400).json({ error: 'dev_id erforderlich' });
  db.prepare(`UPDATE bambu_config SET device_id = ?, device_serial = ?, device_name = ?, updated_at = datetime('now') WHERE id = 1`)
    .run(dev_id, dev_id, name || 'Bambu Drucker');
  reconnectBridge();
  res.json({ ok: true });
});

// CLOUD: Devices erneut laden
router.get('/cloud/devices', requireAuth, requireAdmin, async (req, res) => {
  const cfg = db.prepare('SELECT * FROM bambu_config WHERE id = 1').get();
  if (!cfg || !cfg.access_token) return res.status(400).json({ error: 'Nicht eingeloggt' });
  const cloud = new BambuCloud(cfg.region || 'eu');
  cloud.setToken(cfg.access_token);
  try {
    const devices = await cloud.getDevices();
    res.json(devices);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reconnect manuell triggern
router.post('/reconnect', requireAuth, requireAdmin, async (req, res) => {
  await reconnectBridge();
  res.json({ ok: true, state: getPrinterState() });
});

// === v7: PRINTER CONTROL via MQTT ===
// Hinweis: Bambu blockt seit FW 01.08+ bestimmte Commands ggf. (Authorization-Schutz).
// Wir publishen trotzdem, der Drucker entscheidet selbst.

async function safePublish(payload, action, req, res) {
  if (!isPrinterConnected()) {
    return res.status(503).json({ error: 'Drucker nicht verbunden' });
  }
  try {
    await publishCommand(payload);
    try { logActivity(req.user, 'printer_control', action, JSON.stringify(payload).slice(0, 200)); } catch {}
    res.json({ ok: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.post('/control/pause', requireAuth, requireAdmin, (req, res) => {
  safePublish({ print: { sequence_id: '0', command: 'pause' } }, 'pause', req, res);
});

router.post('/control/resume', requireAuth, requireAdmin, (req, res) => {
  safePublish({ print: { sequence_id: '0', command: 'resume' } }, 'resume', req, res);
});

router.post('/control/stop', requireAuth, requireAdmin, (req, res) => {
  safePublish({ print: { sequence_id: '0', command: 'stop' } }, 'stop', req, res);
});

router.post('/control/light', requireAuth, requireAdmin, (req, res) => {
  const on = req.body?.on !== false; // default: on
  safePublish({
    system: {
      sequence_id: '0',
      command: 'ledctrl',
      led_node: 'chamber_light',
      led_mode: on ? 'on' : 'off',
      led_on_time: 500,
      led_off_time: 500,
      loop_times: 0,
      interval_time: 0,
    },
  }, on ? 'light_on' : 'light_off', req, res);
});

router.post('/control/speed', requireAuth, requireAdmin, (req, res) => {
  const level = String(req.body?.level || '2');
  if (!['1', '2', '3', '4'].includes(level)) {
    return res.status(400).json({ error: 'level muss 1..4 sein (1=silent,2=standard,3=sport,4=ludicrous)' });
  }
  safePublish({ print: { sequence_id: '0', command: 'print_speed', param: level } }, `speed_${level}`, req, res);
});

router.post('/control/emergency-stop', requireAuth, requireAdmin, async (req, res) => {
  if (!isPrinterConnected()) {
    return res.status(503).json({ error: 'Drucker nicht verbunden' });
  }
  try {
    // 1. Stop print
    await publishCommand({ print: { sequence_id: '0', command: 'stop' } });
    // 2. Cool down + fan off via gcode_line
    await publishCommand({
      print: {
        sequence_id: '0',
        command: 'gcode_line',
        param: 'M104 S0\nM140 S0\nM107\n',
      },
    });
    try { logActivity(req.user, 'printer_control', 'emergency_stop', 'Stop + Cooldown + Fan off'); } catch {}
    res.json({ ok: true, action: 'emergency_stop' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === v7: AMS SLOT ASSIGNMENTS ===
// Alle Zuordnungen auflisten (mit angereichertem Filament)
router.get('/ams/assignments', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT a.unit_id, a.slot_id, a.filament_id, a.last_remain_pct, a.assigned_at,
           f.brand, f.material, f.color_name, f.color_hex,
           f.current_weight_g, f.initial_weight_g
    FROM ams_assignments a
    JOIN filaments f ON f.id = a.filament_id
    ORDER BY a.unit_id, a.slot_id
  `).all();
  res.json(rows);
});

// Eine einzelne Zuordnung setzen/aktualisieren
router.post('/ams/assignments', requireAuth, requireAdmin, (req, res) => {
  const unit_id = Number(req.body.unit_id);
  const slot_id = Number(req.body.slot_id);
  const filament_id = req.body.filament_id;
  if (Number.isNaN(unit_id) || Number.isNaN(slot_id) || !filament_id) {
    return res.status(400).json({ error: 'unit_id, slot_id und filament_id erforderlich' });
  }
  const fil = db.prepare('SELECT id, brand, color_name FROM filaments WHERE id = ?').get(filament_id);
  if (!fil) return res.status(404).json({ error: 'Filament nicht gefunden' });

  // Falls dieses Filament schon irgendwo anders zugeordnet ist → alte Zuordnung entfernen
  db.prepare('DELETE FROM ams_assignments WHERE filament_id = ?').run(filament_id);

  // Aktuellen remain-Wert aus Printer-State holen (als last_remain_pct Start)
  let currentRemain = null;
  try {
    const state = getPrinterState();
    const unit = state?.ams?.find(u => u.id === unit_id);
    const slot = unit?.slots?.find(s => s.id === slot_id);
    if (slot && typeof slot.remain === 'number') currentRemain = slot.remain;
  } catch {}

  db.prepare(`
    INSERT INTO ams_assignments (unit_id, slot_id, filament_id, last_remain_pct)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(unit_id, slot_id) DO UPDATE SET
      filament_id = excluded.filament_id,
      last_remain_pct = excluded.last_remain_pct,
      assigned_at = datetime('now')
  `).run(unit_id, slot_id, filament_id, currentRemain);

  try { logActivity(req.user, 'ams_assign', `Unit ${unit_id} Slot ${slot_id}`, `${fil.brand} ${fil.color_name}`); } catch {}
  res.json({ ok: true });
});

// Zuordnung entfernen (per unit/slot)
router.delete('/ams/assignments/:unit/:slot', requireAuth, requireAdmin, (req, res) => {
  const unit_id = Number(req.params.unit);
  const slot_id = Number(req.params.slot);
  const result = db.prepare('DELETE FROM ams_assignments WHERE unit_id = ? AND slot_id = ?').run(unit_id, slot_id);
  try { logActivity(req.user, 'ams_unassign', `Unit ${unit_id} Slot ${slot_id}`, null); } catch {}
  res.json({ ok: true, removed: result.changes });
});

export default router;
