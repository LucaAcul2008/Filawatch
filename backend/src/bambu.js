// Bambu Bridge - unterstützt Cloud und LAN Modus
import mqtt from 'mqtt';
import db from './db.js';
import { BambuCloud } from './bambuCloud.js';
import { sendNotificationToAll } from './push.js';

let printerState = {
  connected: false,
  status: 'unknown',
  progress: 0,
  remaining_time: 0,
  current_layer: 0,
  total_layers: 0,
  nozzle_temp: 0,
  nozzle_target: 0,
  bed_temp: 0,
  bed_target: 0,
  chamber_temp: 0,
  print_name: '',
  ams: [],
  last_update: null,
  error: null,
  mode: null,
  device_name: null,
};

const subscribers = new Set();
let client = null;
let cloud = null;
let currentDeviceId = null;

// Track previous values to detect events
let prevStatus = null;
let prevProgress = 0;
let currentPrintLogged = false;
let printStartTime = null;

export function getPrinterState() {
  return printerState;
}

export function subscribePrinter(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function broadcast() {
  for (const cb of subscribers) {
    try { cb(printerState); } catch (e) { console.error(e); }
  }
}

// Auto-Logging: Wenn Druck startet → Log-Eintrag erstellen, wenn fertig → updaten
function handleAutoLogging(p) {
  const isPrinting = printerState.status === 'RUNNING' || printerState.status === 'PAUSE';
  const wasPrinting = prevStatus === 'RUNNING' || prevStatus === 'PAUSE';

  // Druck gestartet
  if (isPrinting && !wasPrinting && printerState.print_name && !currentPrintLogged) {
    currentPrintLogged = true;
    printStartTime = Date.now();
    sendNotificationToAll({
      title: '🖨️ Druck gestartet',
      body: printerState.print_name,
      tag: 'print-start',
    });
  }

  // Druck fertig (von RUNNING/PAUSE → FINISH/IDLE)
  if (!isPrinting && wasPrinting && currentPrintLogged) {
    const duration = printStartTime ? Math.round((Date.now() - printStartTime) / 60000) : 0;
    const isSuccess = printerState.status === 'FINISH';
    try {
      const id = Math.random().toString(36).slice(2, 14);
      db.prepare(`
        INSERT INTO prints (id, title, weight_used_g, duration_minutes, status, started_at, auto_logged)
        VALUES (?, ?, 0, ?, ?, ?, 1)
      `).run(
        id,
        printerState.print_name || 'Auto-Druck',
        duration,
        isSuccess ? 'success' : 'failed',
        new Date(printStartTime).toISOString()
      );
    } catch (e) { console.error('Auto-log insert failed:', e); }

    sendNotificationToAll({
      title: isSuccess ? '✅ Druck fertig!' : '❌ Druck fehlgeschlagen',
      body: printerState.print_name,
      tag: 'print-end',
    });

    currentPrintLogged = false;
    printStartTime = null;
  }

  prevStatus = printerState.status;
}

// v7: Auto-Sync AMS-Slots → Filament-Bestand
// Wenn im AMS eine zugeordnete Spule steckt und der `remain`-Wert sinkt,
// wird der Verbrauch proportional vom Filament-Bestand abgezogen.
// Sicherheits-Guards:
//   - nur Werte in [0, 100] akzeptieren
//   - nur beim DRUCK verbrauchen (status === RUNNING)
//   - nur wenn neuer Wert STRIKT kleiner als last_remain_pct
//   - nur bis max. 15%-Delta pro Message (MQTT-Glitches abfangen)
function syncAmsAssignments(amsArray) {
  try {
    const assignments = db.prepare('SELECT * FROM ams_assignments').all();
    if (assignments.length === 0) return;

    const isRunning = printerState.status === 'RUNNING';

    for (const a of assignments) {
      const unit = amsArray.find(u => u.id === a.unit_id);
      if (!unit) continue;
      const slot = unit.slots.find(s => s.id === a.slot_id);
      if (!slot) continue;
      const remain = slot.remain;
      if (remain == null || remain < 0 || remain > 100) continue;

      const last = a.last_remain_pct;

      // Erste Beobachtung: nur speichern, nicht verbrauchen
      if (last == null) {
        db.prepare('UPDATE ams_assignments SET last_remain_pct = ? WHERE id = ?').run(remain, a.id);
        continue;
      }

      // Nur während Druck verbrauchen
      if (!isRunning) {
        // remain kann nach Re-Insert springen — einfach aktualisieren ohne Verbrauch
        if (remain !== last) {
          db.prepare('UPDATE ams_assignments SET last_remain_pct = ? WHERE id = ?').run(remain, a.id);
        }
        continue;
      }

      // Glitches / Re-Readings herausfiltern
      const deltaPct = last - remain;
      if (deltaPct <= 0) continue;           // gestiegen oder gleich — ignorieren
      if (deltaPct > 15) {                   // unrealistischer Sprung — nur sync
        db.prepare('UPDATE ams_assignments SET last_remain_pct = ? WHERE id = ?').run(remain, a.id);
        continue;
      }

      // Bestand proportional abziehen
      const fil = db.prepare('SELECT initial_weight_g, current_weight_g, brand, color_name FROM filaments WHERE id = ?').get(a.filament_id);
      if (!fil) continue;

      const gramsUsed = Math.round((deltaPct / 100) * fil.initial_weight_g);
      if (gramsUsed <= 0) {
        db.prepare('UPDATE ams_assignments SET last_remain_pct = ? WHERE id = ?').run(remain, a.id);
        continue;
      }

      const newWeight = Math.max(0, fil.current_weight_g - gramsUsed);
      db.prepare(`UPDATE filaments SET current_weight_g = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(newWeight, a.filament_id);
      db.prepare('UPDATE ams_assignments SET last_remain_pct = ? WHERE id = ?').run(remain, a.id);

      console.log(`[AMS-Sync] ${fil.brand} ${fil.color_name}: -${gramsUsed}g (remain ${last}% → ${remain}%), neu: ${newWeight}g`);
    }
  } catch (e) {
    console.error('[AMS-Sync] Fehler:', e.message);
  }
}

function handleMessage(msg) {
  if (!msg.print) return;
  const p = msg.print;

  if (p.gcode_state !== undefined) printerState.status = p.gcode_state;
  if (p.mc_percent !== undefined) printerState.progress = p.mc_percent;
  if (p.mc_remaining_time !== undefined) printerState.remaining_time = p.mc_remaining_time;
  if (p.layer_num !== undefined) printerState.current_layer = p.layer_num;
  if (p.total_layer_num !== undefined) printerState.total_layers = p.total_layer_num;
  if (p.nozzle_temper !== undefined) printerState.nozzle_temp = p.nozzle_temper;
  if (p.nozzle_target_temper !== undefined) printerState.nozzle_target = p.nozzle_target_temper;
  if (p.bed_temper !== undefined) printerState.bed_temp = p.bed_temper;
  if (p.bed_target_temper !== undefined) printerState.bed_target = p.bed_target_temper;
  if (p.chamber_temper !== undefined) printerState.chamber_temp = p.chamber_temper;
  if (p.subtask_name !== undefined) printerState.print_name = p.subtask_name;

  if (p.ams && p.ams.ams) {
    printerState.ams = p.ams.ams.map(unit => ({
      id: unit.id,
      humidity: unit.humidity,
      temp: unit.temp,
      slots: (unit.tray || []).map(t => ({
        id: t.id,
        type: t.tray_type || null,
        color: t.tray_color ? '#' + t.tray_color.substring(0, 6) : null,
        sub_brands: t.tray_sub_brands || null,
        remain: t.remain ?? null,
      })),
    }));

    // Low filament warning during print
    for (const unit of printerState.ams) {
      for (const slot of unit.slots) {
        if (slot.remain != null && slot.remain > 0 && slot.remain < 10 && printerState.status === 'RUNNING') {
          sendNotificationToAll({
            title: '⚠️ Filament fast leer',
            body: `Slot ${slot.id} hat nur noch ${slot.remain}% übrig`,
            tag: 'low-filament',
          });
        }
      }
    }

    // v7: Auto-Sync zugeordneter Spulen (AMS als wahre Quelle)
    syncAmsAssignments(printerState.ams);
  }

  printerState.last_update = new Date().toISOString();
  handleAutoLogging(p);
  broadcast();
}

function disconnectMqtt() {
  if (client) {
    try { client.end(true); } catch {}
    client = null;
  }
}

export async function startBambuBridge() {
  // Config aus DB laden (oder env-vars als fallback für initialen Setup)
  let config = db.prepare('SELECT * FROM bambu_config WHERE id = 1').get();

  if (!config) {
    // Fallback auf env vars (LAN mode legacy)
    if (process.env.BAMBU_HOST && process.env.BAMBU_ACCESS_CODE && process.env.BAMBU_SERIAL) {
      db.prepare(`
        INSERT INTO bambu_config (id, mode, lan_host, lan_access_code, device_serial, device_id)
        VALUES (1, 'lan', ?, ?, ?, ?)
      `).run(process.env.BAMBU_HOST, process.env.BAMBU_ACCESS_CODE, process.env.BAMBU_SERIAL, process.env.BAMBU_SERIAL);
      config = db.prepare('SELECT * FROM bambu_config WHERE id = 1').get();
    } else {
      console.log('[Bambu] Keine Konfiguration gefunden. Bitte über die Web-UI konfigurieren.');
      printerState.error = 'Drucker noch nicht konfiguriert. Gehe zu Settings → Drucker.';
      return;
    }
  }

  disconnectMqtt();

  if (config.mode === 'cloud') {
    if (!config.access_token || !config.device_id) {
      printerState.error = 'Cloud-Konfiguration unvollständig. Bitte einloggen.';
      return;
    }
    cloud = new BambuCloud(config.region || 'eu');
    cloud.setToken(config.access_token);
    // Falls userId nicht im Token war (z.B. nach 2FA-Login) → via Profile-API holen
    if (!cloud.userId) {
      try {
        await cloud.ensureUserId();
      } catch (err) {
        console.error('[Bambu] Profile-API Fehler:', err.message);
      }
    }
    const creds = cloud.getMqttCredentials();
    if (!creds) {
      printerState.error = 'Cloud-Token ungültig — userId konnte nicht ermittelt werden. Bitte erneut einloggen.';
      return;
    }
    currentDeviceId = config.device_id;
    printerState.mode = 'cloud';
    printerState.device_name = config.device_name;
    connectMqtt(creds.host, creds.port, creds.username, creds.password, currentDeviceId);
  } else {
    if (!config.lan_host || !config.lan_access_code || !config.device_serial) {
      printerState.error = 'LAN-Konfiguration unvollständig.';
      return;
    }
    currentDeviceId = config.device_serial;
    printerState.mode = 'lan';
    printerState.device_name = 'P2S (LAN)';
    connectMqtt(config.lan_host, 8883, 'bblp', config.lan_access_code, currentDeviceId);
  }
}

function connectMqtt(host, port, username, password, deviceId) {
  console.log(`[Bambu] Verbinde zu ${host}:${port} (device ${deviceId})...`);

  client = mqtt.connect(`mqtts://${host}:${port}`, {
    username,
    password,
    rejectUnauthorized: false,
    reconnectPeriod: 10000,
    connectTimeout: 15000,
    clientId: `filawatch_${Math.random().toString(16).slice(2, 10)}`,
  });

  const reportTopic = `device/${deviceId}/report`;
  const requestTopic = `device/${deviceId}/request`;

  client.on('connect', () => {
    console.log('[Bambu] MQTT verbunden!');
    printerState.connected = true;
    printerState.error = null;
    client.subscribe(reportTopic, (err) => {
      if (err) console.error('[Bambu] Subscribe Fehler:', err);
    });
    client.publish(requestTopic, JSON.stringify({
      pushing: { sequence_id: '0', command: 'pushall' }
    }));
    broadcast();
  });

  client.on('message', (topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString());
      handleMessage(msg);
    } catch {}
  });

  client.on('error', (err) => {
    console.error('[Bambu] Fehler:', err.message);
    printerState.error = err.message;
    printerState.connected = false;
    broadcast();
  });

  client.on('close', () => {
    printerState.connected = false;
    broadcast();
  });
}

export async function reconnectBridge() {
  await startBambuBridge();
}

// v7: Publish a command to the printer (control)
export function publishCommand(payload) {
  if (!client || !currentDeviceId) {
    throw new Error('Drucker nicht verbunden');
  }
  if (!printerState.connected) {
    throw new Error('MQTT-Verbindung nicht aktiv');
  }
  const topic = `device/${currentDeviceId}/request`;
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

export function isPrinterConnected() {
  return printerState.connected && !!client && !!currentDeviceId;
}
