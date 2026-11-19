import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth, requireAdmin } from '../auth.js';
import { logActivity } from '../db.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Falscher Username oder Passwort' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, email: user.email, role: user.role, avatar_color: user.avatar_color }
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

router.put('/me', requireAuth, (req, res) => {
  const { display_name, email, avatar_color, password } = req.body;
  const updates = { display_name, email, avatar_color };
  db.prepare(`UPDATE users SET display_name = COALESCE(?, display_name), email = COALESCE(?, email), avatar_color = COALESCE(?, avatar_color) WHERE id = ?`)
    .run(updates.display_name, updates.email, updates.avatar_color, req.user.id);
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), req.user.id);
  }
  res.json(db.prepare('SELECT id, username, display_name, email, role, avatar_color FROM users WHERE id = ?').get(req.user.id));
});

// Admin: alle User auflisten
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, display_name, email, role, avatar_color, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

// Admin: neuen User erstellen
router.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { username, display_name, email, password, role, avatar_color } = req.body;
  if (!username || !password || !display_name) {
    return res.status(400).json({ error: 'username, display_name und password erforderlich' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: 'Username bereits vergeben' });
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO users (id, username, display_name, email, password_hash, role, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, display_name, email || null, hashPassword(password), role || 'user', avatar_color || '#ffb800');
  logActivity(req.user, 'user_created', username, display_name);
  res.json(db.prepare('SELECT id, username, display_name, email, role, avatar_color FROM users WHERE id = ?').get(id));
});

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Du kannst dich nicht selbst löschen' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
