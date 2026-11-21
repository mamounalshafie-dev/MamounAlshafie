import crypto from 'node:crypto';
import { get, run } from './db.js';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const [, salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = 'noor_session';
const SESSION_DAYS = 7;

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires);
  return { token, expires };
}

export function destroySession(token) {
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
}

export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

export function userFromRequest(req) {
  const token = parseCookies(req)[SESSION_COOKIE] || req.headers['x-session-token'];
  if (!token) return null;
  const row = get(
    `SELECT u.id, u.name, u.email, u.role, u.job_title, u.department, u.phone, u.avatar_color, u.active,
            s.token, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
    token
  );
  if (!row || !row.active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return row;
}

export function requireAuth(req, res, next) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' });
  req.user = user;
  next();
}

export const ROLE_LEVELS = { admin: 100, manager: 70, accountant: 60, sales: 50, employee: 30 };

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'مطلوب تسجيل الدخول' });
    if (req.user.role === 'admin') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'لا تملك الصلاحية لتنفيذ هذه العملية' });
    }
    next();
  };
}
