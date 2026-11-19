import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'filawatch-dev-secret-please-change-in-production';
const JWT_EXPIRES = '30d';

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

// Express middleware: auth required
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht eingeloggt' });
  }
  const payload = verifyToken(auth.slice(7));
  if (!payload) return res.status(401).json({ error: 'Token ungültig' });

  const user = db.prepare('SELECT id, username, display_name, email, role, avatar_color FROM users WHERE id = ?').get(payload.id);
  if (!user) return res.status(401).json({ error: 'User nicht mehr vorhanden' });
  req.user = user;
  next();
}

// Optional auth - sets req.user if token present, doesn't fail otherwise
export function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload) {
      req.user = db.prepare('SELECT id, username, display_name, email, role, avatar_color FROM users WHERE id = ?').get(payload.id);
    }
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin-Rechte erforderlich' });
  }
  next();
}

// Beim Server-Start: Falls noch keine User existieren, einen Admin anlegen
export function ensureInitialAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count === 0) {
    const id = Math.random().toString(36).slice(2, 14);
    const defaultPw = process.env.INITIAL_ADMIN_PASSWORD || 'admin1234';
    db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, role, avatar_color)
      VALUES (?, ?, ?, ?, 'admin', '#ffb800')
    `).run(id, 'admin', 'Admin', hashPassword(defaultPw));
    console.log('');
    console.log('==========================================');
    console.log('  ERSTER ADMIN-USER ERSTELLT');
    console.log('  Username: admin');
    console.log(`  Passwort: ${defaultPw}`);
    console.log('  >>> BITTE NACH LOGIN ÄNDERN! <<<');
    console.log('==========================================');
    console.log('');
  }
}
