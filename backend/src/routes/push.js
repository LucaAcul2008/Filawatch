import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { getPublicKey } from '../push.js';

const router = Router();

router.get('/key', (req, res) => {
  res.json({ publicKey: getPublicKey() });
});

router.post('/subscribe', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys) return res.status(400).json({ error: 'Endpoint und keys erforderlich' });
  // Falls schon vorhanden → update
  const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  if (existing) {
    db.prepare('UPDATE push_subscriptions SET user_id = ?, keys = ? WHERE id = ?')
      .run(req.user.id, JSON.stringify(keys), existing.id);
  } else {
    db.prepare(`INSERT INTO push_subscriptions (id, user_id, endpoint, keys) VALUES (?, ?, ?, ?)`)
      .run(nanoid(12), req.user.id, endpoint, JSON.stringify(keys));
  }
  res.json({ ok: true });
});

router.post('/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

export default router;
