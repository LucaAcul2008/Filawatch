import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, '..', 'data'), { recursive: true });
mkdirSync(join(__dirname, '..', 'uploads'), { recursive: true });
mkdirSync(join(__dirname, '..', 'uploads', 'photos'), { recursive: true });
mkdirSync(join(__dirname, '..', 'uploads', 'files'), { recursive: true });

const db = new Database(join(__dirname, '..', 'data', 'filatrack.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    avatar_color TEXT NOT NULL DEFAULT '#ffb800',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS filaments (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    material TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#cccccc',
    diameter REAL NOT NULL DEFAULT 1.75,
    initial_weight_g INTEGER NOT NULL DEFAULT 1000,
    current_weight_g INTEGER NOT NULL DEFAULT 1000,
    spool_weight_g INTEGER NOT NULL DEFAULT 250,
    purchase_date TEXT,
    price REAL,
    shop_url TEXT,
    location TEXT,
    nozzle_temp INTEGER,
    bed_temp INTEGER,
    print_speed INTEGER,
    last_dried TEXT,
    notes TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prints (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    filament_id TEXT,
    weight_used_g REAL NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT,
    file_path TEXT,
    image_path TEXT,
    auto_logged INTEGER NOT NULL DEFAULT 0,
    cost_material REAL,
    cost_power REAL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (filament_id) REFERENCES filaments(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    material TEXT,
    color_hex TEXT,
    shop_url TEXT,
    estimated_price REAL,
    priority INTEGER NOT NULL DEFAULT 2,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS print_ideas (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    source_url TEXT,
    image_url TEXT,
    is_done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    keys TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bambu_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'cloud',
    email TEXT,
    user_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    region TEXT NOT NULL DEFAULT 'eu',
    device_id TEXT,
    device_serial TEXT,
    device_name TEXT,
    lan_host TEXT,
    lan_access_code TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    interval_hours INTEGER,
    interval_days INTEGER,
    last_done_at TEXT,
    last_done_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS threemf_files (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    metadata_json TEXT,
    uploaded_by TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    cloud_url TEXT,
    cloud_uploaded_at TEXT
  );

  -- v7: AMS-Slot-Zuordnung (welche Spule steckt in welchem AMS-Slot)
  CREATE TABLE IF NOT EXISTS ams_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL,
    filament_id TEXT NOT NULL,
    last_remain_pct INTEGER,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (unit_id, slot_id),
    FOREIGN KEY (filament_id) REFERENCES filaments(id) ON DELETE CASCADE
  );
`);

// Default-Settings für Kosten
const settingsDefaults = [
  { key: 'cost_power_kwh', value: '0.30' },        // € pro kWh
  { key: 'cost_printer_watts', value: '150' },     // Durchschnitt P2S beim Drucken
];
for (const s of settingsDefaults) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
}

// Default Wartungstasks für Bambu P2S
const maintenanceCount = db.prepare('SELECT COUNT(*) AS c FROM maintenance_tasks').get().c;
if (maintenanceCount === 0) {
  const tasks = [
    { name: 'Düse reinigen', desc: 'Düse von außen reinigen', hours: 50 },
    { name: 'Heizbett reinigen', desc: 'PEI-Platte mit Isopropanol reinigen', hours: 20 },
    { name: 'Riemen-Spannung prüfen', desc: 'X- und Y-Riemen kontrollieren', hours: 200 },
    { name: 'Linearführungen schmieren', desc: 'Lineare Achsen mit Fett schmieren', hours: 300 },
    { name: 'Düse wechseln', desc: 'Verschleiß der Düse prüfen', hours: 500 },
    { name: 'Lüfter reinigen', desc: 'Hotend-Lüfter und Gehäuse von Staub befreien', hours: 100 },
  ];
  for (const t of tasks) {
    const id = Math.random().toString(36).slice(2, 14);
    db.prepare('INSERT INTO maintenance_tasks (id, name, description, interval_hours) VALUES (?, ?, ?, ?)').run(id, t.name, t.desc, t.hours);
  }
}

// Helper für Activity Log
export function logActivity(user, action, target, detail) {
  try {
    db.prepare(`
      INSERT INTO activity_log (id, user_id, user_name, action, target, detail)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Math.random().toString(36).slice(2, 14),
      user?.id || null,
      user?.display_name || 'System',
      action,
      target || null,
      detail || null
    );
  } catch (e) {
    console.error('Activity log error:', e);
  }
}

export default db;
