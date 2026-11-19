// Background-Tasks (cron-jobs) für Production
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import db from './db.js';
import { setSetting, getSetting } from './settings.js';
import { BambuCloud } from './bambuCloud.js';
import { reconnectBridge } from './bambu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === Daily Backup nach Azure Blob ===
async function runDailyBackup() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) return; // Azure nicht konfiguriert → skip
  const containerName = process.env.AZURE_BACKUP_CONTAINER || 'filatrack-backups';
  console.log('[Cron] Starte Daily Backup nach Azure...');
  try {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const client = BlobServiceClient.fromConnectionString(connStr);
    const container = client.getContainerClient(containerName);
    await container.createIfNotExists();

    const dbPath = join(__dirname, '..', 'data', 'filatrack.db');
    if (!existsSync(dbPath)) {
      console.error('[Cron] DB-Datei nicht gefunden:', dbPath);
      return;
    }
    const buf = readFileSync(dbPath);
    const date = new Date().toISOString().split('T')[0];
    const blobName = `auto-${date}.db`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(buf);
    setSetting('azure_last_backup', new Date().toISOString());
    console.log(`[Cron] Backup OK: ${blobName} (${(buf.length / 1024).toFixed(0)} KB)`);

    // Alte Backups aufräumen — nur die letzten 30 Tage behalten
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for await (const item of container.listBlobsFlat()) {
      if (item.name.startsWith('auto-') && new Date(item.properties.createdOn).getTime() < cutoff) {
        await container.deleteBlob(item.name);
        deleted++;
      }
    }
    if (deleted > 0) console.log(`[Cron] ${deleted} alte Backups gelöscht`);
  } catch (err) {
    console.error('[Cron] Backup fehlgeschlagen:', err.message);
  }
}

// === Auto-Refresh des Bambu Cloud Tokens ===
async function checkAndRefreshBambuToken() {
  const cfg = db.prepare('SELECT * FROM bambu_config WHERE id = 1').get();
  if (!cfg || cfg.mode !== 'cloud' || !cfg.access_token || !cfg.refresh_token) return;

  const cloud = new BambuCloud(cfg.region || 'eu');
  cloud.setToken(cfg.access_token);
  if (!cloud.isTokenExpired()) return;

  console.log('[Cron] Bambu-Token läuft bald ab, refreshing...');
  try {
    const result = await cloud.refreshAccessToken(cfg.refresh_token);
    db.prepare(`UPDATE bambu_config SET access_token = ?, refresh_token = ?, updated_at = datetime('now') WHERE id = 1`)
      .run(result.token, result.refreshToken);
    console.log('[Cron] Token-Refresh OK');
    // MQTT-Verbindung mit neuem Token neu aufbauen
    await reconnectBridge();
  } catch (err) {
    console.error('[Cron] Token-Refresh fehlgeschlagen:', err.message);
  }
}

// === Smart Notifications: Wöchentliche Zusammenfassung ===
async function sendWeeklySummary() {
  try {
    const { sendNotificationToAll } = await import('./push.js');
    const stats = db.prepare(`
      SELECT
        COUNT(*) AS prints,
        COALESCE(SUM(weight_used_g), 0) AS grams,
        COALESCE(SUM(duration_minutes), 0) AS minutes,
        COALESCE(SUM(cost_material + cost_power), 0) AS total_cost,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success
      FROM prints
      WHERE started_at >= datetime('now', '-7 days')
    `).get();

    if (stats.prints === 0) return;

    const successRate = stats.prints > 0 ? Math.round(stats.success / stats.prints * 100) : 0;
    const hours = (stats.minutes / 60).toFixed(1);
    const kg = (stats.grams / 1000).toFixed(2);

    sendNotificationToAll({
      title: '📊 Deine Wochen-Zusammenfassung',
      body: `${stats.prints} Drucke (${successRate}% erfolgreich) · ${kg} kg · ${hours}h · ${stats.total_cost.toFixed(2)}€`,
      tag: 'weekly-summary',
    });
    console.log('[Cron] Wochen-Zusammenfassung gesendet');
  } catch (err) {
    console.error('[Cron] Weekly summary failed:', err.message);
  }
}

// === Trocknungs-Erinnerungen für hygroskopische Filamente ===
async function checkDryingReminders() {
  try {
    const { sendNotificationToAll } = await import('./push.js');
    const { HYGROSCOPIC_MATERIALS } = await import('./materials.js');

    // Filamente die hygroskopisch sind und seit > 60 Tagen nicht getrocknet wurden
    const filaments = db.prepare(`
      SELECT id, brand, color_name, material, last_dried
      FROM filaments
      WHERE is_archived = 0 AND current_weight_g > 100
    `).all();

    const needsDrying = filaments.filter(f => {
      if (!HYGROSCOPIC_MATERIALS.has(f.material)) return false;
      if (!f.last_dried) return true;
      const days = Math.floor((Date.now() - new Date(f.last_dried).getTime()) / (1000 * 60 * 60 * 24));
      return days > 60;
    });

    if (needsDrying.length === 0) return;

    const list = needsDrying.slice(0, 3).map(f => `${f.brand} ${f.material}`).join(', ');
    const more = needsDrying.length > 3 ? ` +${needsDrying.length - 3} weitere` : '';

    sendNotificationToAll({
      title: '💧 Filament-Trocknung empfohlen',
      body: `${needsDrying.length} Spule(n) sollten getrocknet werden: ${list}${more}`,
      tag: 'drying-reminder',
    });
    console.log(`[Cron] Trocknungs-Erinnerung gesendet (${needsDrying.length} Filamente)`);
  } catch (err) {
    console.error('[Cron] Drying reminder failed:', err.message);
  }
}

export function startCronJobs() {
  // Daily Backup um 3:00 Uhr nachts
  cron.schedule('0 3 * * *', runDailyBackup);
  console.log('[Cron] Daily Backup geplant: täglich 03:00');

  // Token-Check alle 6 Stunden
  cron.schedule('0 */6 * * *', checkAndRefreshBambuToken);
  console.log('[Cron] Bambu Token-Refresh-Check geplant: alle 6h');

  // Wöchentliche Zusammenfassung Sonntag 18:00
  cron.schedule('0 18 * * 0', sendWeeklySummary);
  console.log('[Cron] Wochen-Zusammenfassung geplant: Sonntag 18:00');

  // Trocknungs-Erinnerung jeden Montag 10:00
  cron.schedule('0 10 * * 1', checkDryingReminders);
  console.log('[Cron] Trocknungs-Erinnerung geplant: Montag 10:00');

  // Initial direkt prüfen ob Token bereits abgelaufen ist
  setTimeout(checkAndRefreshBambuToken, 30000);
}

export { runDailyBackup, checkAndRefreshBambuToken, sendWeeklySummary, checkDryingReminders };
