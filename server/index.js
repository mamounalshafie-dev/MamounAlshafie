import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSeeded, seed } from './seed.js';
import { get } from './db.js';
import { createSession, destroySession, hashPassword, parseCookies, requireAuth, SESSION_COOKIE, userFromRequest, verifyPassword } from './auth.js';
import { HttpError } from './util.js';
import { registerRoutes } from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const app = express();

if (!isSeeded()) {
  console.log('→ Seeding database for first run…');
  seed();
}

app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  jobTitle: u.job_title, department: u.department, phone: u.phone,
  avatarColor: u.avatar_color,
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'يرجى إدخال البريد الإلكتروني وكلمة المرور');
  const user = get('SELECT * FROM users WHERE lower(email) = lower(?) AND active = 1', String(email).trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }
  const { token, expires } = createSession(user.id);
  get('UPDATE users SET last_login = ? WHERE id = ?', new Date().toISOString(), user.id);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: 7 * 864e5, secure: process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'https',
  });
  res.json({ user: publicUser(user), token, expires });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(parseCookies(req)[SESSION_COOKIE] || req.headers['x-session-token']);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'غير مسجل الدخول' });
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) throw new HttpError(400, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
  const row = get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!verifyPassword(currentPassword, row.password_hash)) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة');
  get('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(newPassword), req.user.id);
  res.json({ ok: true, message: 'تم تحديث كلمة المرور بنجاح' });
});

/* ------------------------------------------------------------------ */
/*  Protected API                                                      */
/* ------------------------------------------------------------------ */
app.use('/api', requireAuth);
registerRoutes(app);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* ------------------------------------------------------------------ */
/*  Static frontend                                                    */
/* ------------------------------------------------------------------ */
const dist = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'المسار غير موجود' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'حدث خطأ غير متوقع في الخادم' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server listening on http://0.0.0.0:${PORT}`);
});
