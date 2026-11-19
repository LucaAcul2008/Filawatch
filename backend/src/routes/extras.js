import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Wishlist
router.get('/wishlist', (req, res) => {
  res.json(db.prepare('SELECT * FROM wishlist ORDER BY priority DESC, created_at DESC').all());
});

router.post('/wishlist', (req, res) => {
  const id = nanoid(12);
  const w = req.body;
  db.prepare(`
    INSERT INTO wishlist (id, name, material, color_hex, shop_url, estimated_price, priority, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, w.name, w.material || null, w.color_hex || null, w.shop_url || null, w.estimated_price || null, w.priority || 2, w.notes || null);
  res.json(db.prepare('SELECT * FROM wishlist WHERE id = ?').get(id));
});

router.delete('/wishlist/:id', (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Ideas
router.get('/ideas', (req, res) => {
  res.json(db.prepare('SELECT * FROM print_ideas ORDER BY is_done, created_at DESC').all());
});

router.post('/ideas', (req, res) => {
  const id = nanoid(12);
  const i = req.body;
  db.prepare(`
    INSERT INTO print_ideas (id, title, description, source_url, image_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, i.title, i.description || null, i.source_url || null, i.image_url || null);
  res.json(db.prepare('SELECT * FROM print_ideas WHERE id = ?').get(id));
});

router.put('/ideas/:id/toggle', (req, res) => {
  db.prepare('UPDATE print_ideas SET is_done = 1 - is_done WHERE id = ?').run(req.params.id);
  res.json(db.prepare('SELECT * FROM print_ideas WHERE id = ?').get(req.params.id));
});

router.delete('/ideas/:id', (req, res) => {
  db.prepare('DELETE FROM print_ideas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
