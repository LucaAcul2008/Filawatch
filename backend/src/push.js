import webpush from 'web-push';
import db from './db.js';

let initialized = false;
let publicKey = null;

export function initPush() {
  let vapid = db.prepare("SELECT value FROM settings WHERE key = 'vapid'").get();
  let keys;
  if (vapid) {
    keys = JSON.parse(vapid.value);
  } else {
    keys = webpush.generateVAPIDKeys();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('vapid', ?)").run(JSON.stringify(keys));
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:filawatch@example.com',
    keys.publicKey,
    keys.privateKey
  );
  publicKey = keys.publicKey;
  initialized = true;
  console.log('[Push] VAPID initialized');
}

export function getPublicKey() {
  return publicKey;
}

// Throttle: gleiche tag nicht öfter als alle 60s schicken
const lastSent = new Map();
const THROTTLE_MS = 60000;

export function sendNotificationToAll(payload) {
  if (!initialized) return;
  if (payload.tag) {
    const last = lastSent.get(payload.tag) || 0;
    if (Date.now() - last < THROTTLE_MS) return;
    lastSent.set(payload.tag, Date.now());
  }

  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: JSON.parse(sub.keys),
    };
    webpush.sendNotification(subscription, JSON.stringify(payload)).catch(err => {
      // 404 oder 410 → expired → löschen
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    });
  }
}
