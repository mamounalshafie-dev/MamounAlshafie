import { Router } from 'express';
import { all, get, run, logActivity, setting, setSetting } from '../db.js';
import { hashPassword } from '../auth.js';
import { HttpError, iso } from '../util.js';

export const adminRouter = Router();

const ADMIN = ['admin'];

adminRouter.get('/settings', (req, res) => {
  res.json({
    company: setting('company', {}),
    modules: setting('modules', {}),
  });
});

adminRouter.patch('/settings', (req, res) => {
  if (!ADMIN.includes(req.user.role)) throw new HttpError(403, 'تعديل الإعدادات متاح لمدير النظام فقط');
  const { company, modules } = req.body || {};
  if (company) setSetting('company', { ...setting('company', {}), ...company });
  if (modules) setSetting('modules', { ...setting('modules', {}), ...modules });
  logActivity(req.user.id, 'settings', null, 'update', 'حدّث إعدادات الشركة والنظام');
  res.json({ company: setting('company', {}), modules: setting('modules', {}) });
});

adminRouter.get('/users', (req, res) => {
  const users = all(`
    SELECT u.id, u.name, u.email, u.role, u.job_title, u.department, u.phone, u.avatar_color, u.active,
           u.last_login, u.created_at,
           (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.stage <> 'done') AS open_tasks,
           (SELECT COUNT(*) FROM project_members pm WHERE pm.user_id = u.id) AS projects
      FROM users u ORDER BY u.name`);
  res.json(users);
});

adminRouter.post('/users', (req, res) => {
  if (!ADMIN.includes(req.user.role)) throw new HttpError(403, 'إضافة المستخدمين متاحة لمدير النظام فقط');
  const b = req.body || {};
  if (!b.name || !b.email || !b.password) throw new HttpError(400, 'الاسم والبريد وكلمة المرور مطلوبة');
  if (String(b.password).length < 6) throw new HttpError(400, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  if (get('SELECT id FROM users WHERE lower(email) = lower(?)', b.email)) throw new HttpError(400, 'البريد الإلكتروني مستخدم مسبقاً');
  const id = Number(run(
    `INSERT INTO users (name, email, password_hash, role, job_title, department, phone, avatar_color, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    b.name, b.email, hashPassword(b.password), b.role || 'employee', b.jobTitle || null,
    b.department || null, b.phone || null, b.avatarColor || '#4f46e5'
  ).lastInsertRowid);
  logActivity(req.user.id, 'user', id, 'create', `أضاف مستخدماً جديداً: ${b.name}`);
  res.status(201).json(get('SELECT id, name, email, role, job_title, department, avatar_color, active FROM users WHERE id = ?', id));
});

adminRouter.patch('/users/:id', (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!user) throw new HttpError(404, 'المستخدم غير موجود');
  if (!ADMIN.includes(req.user.role) && req.user.id !== user.id) throw new HttpError(403, 'لا تملك الصلاحية');
  const b = req.body || {};
  const sets = []; const params = [];
  const map = { name: 'name', role: 'role', jobTitle: 'job_title', department: 'department', phone: 'phone', avatarColor: 'avatar_color', active: 'active' };
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) {
      if (['role', 'active'].includes(k) && !ADMIN.includes(req.user.role)) continue;
      sets.push(`${col} = ?`); params.push(b[k]);
    }
  }
  if (b.password) {
    if (!ADMIN.includes(req.user.role)) throw new HttpError(403, 'تغيير كلمات المرور متاح لمدير النظام');
    sets.push('password_hash = ?'); params.push(hashPassword(b.password));
  }
  if (!sets.length) return res.json(user);
  run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...params, user.id);
  res.json(get('SELECT id, name, email, role, job_title, department, phone, avatar_color, active, last_login FROM users WHERE id = ?', user.id));
});

adminRouter.delete('/users/:id', (req, res) => {
  if (!ADMIN.includes(req.user.role)) throw new HttpError(403, 'حذف المستخدمين متاح لمدير النظام فقط');
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'لا يمكنك حذف حسابك الحالي');
  run('DELETE FROM users WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

adminRouter.get('/activities', (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  res.json(all(`
    SELECT a.*, u.name AS user_name, u.avatar_color, u.job_title
      FROM activities a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT ?`, limit));
});

adminRouter.get('/users/workload', (req, res) => {
  res.json(all(`
    SELECT u.id, u.name, u.avatar_color, u.job_title,
      COUNT(t.id) tasks, COALESCE(SUM(CASE WHEN t.stage <> 'done' THEN 1 ELSE 0 END), 0) open_tasks,
      COALESCE(SUM(ts.hours), 0) hours
      FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
      LEFT JOIN timesheets ts ON ts.user_id = u.id AND ts.date >= date('now', '-30 days')
     GROUP BY u.id ORDER BY open_tasks DESC`));
});

adminRouter.get('/system/info', (req, res) => {
  const counts = {};
  for (const t of ['projects', 'tasks', 'invoices', 'partners', 'products', 'employees', 'journal_entries']) {
    counts[t] = get(`SELECT COUNT(*) c FROM ${t}`).c;
  }
  res.json({
    version: '2.0.0',
    name: 'NOOR ERP',
    database: 'SQLite (WAL)',
    today: iso(),
    counts,
    node: process.version,
    uptime: Math.round(process.uptime()),
  });
});

adminRouter.get('/nav-counts', (req, res) => {
  const counts = {
    projects: get("SELECT COUNT(*) c FROM projects WHERE stage NOT IN ('done','cancelled')").c,
    tasks: get("SELECT COUNT(*) c FROM tasks WHERE stage <> 'done'").c,
    overdueInvoices: get("SELECT COUNT(*) c FROM invoices WHERE status NOT IN ('paid','draft','cancelled') AND due_date < date('now')").c,
    pendingLeaves: get("SELECT COUNT(*) c FROM leaves WHERE status = 'pending'").c,
    lowStock: get('SELECT COUNT(*) c FROM products WHERE stock_qty <= reorder_level').c,
    quotations: get("SELECT COUNT(*) c FROM quotations WHERE status IN ('draft','sent')").c,
  };
  const alerts = [
    ...all(`SELECT i.id, i.number, i.due_date, p.name AS customer FROM invoices i LEFT JOIN partners p ON p.id = i.customer_id
            WHERE i.status NOT IN ('paid','draft','cancelled') AND i.due_date < date('now') ORDER BY i.due_date LIMIT 3`)
      .map((r) => ({ id: `inv-${r.id}`, title: `فاتورة متأخرة ${r.number}`, sub: `${r.customer || ''} · استحقت في ${r.due_date}`, url: `/invoices/${r.id}`, tone: 'red' })),
    ...all("SELECT id, name, progress FROM projects WHERE health = 'at_risk' AND stage NOT IN ('done','cancelled') LIMIT 2")
      .map((r) => ({ id: `prj-${r.id}`, title: `مشروع في خطر: ${r.name}`, sub: `نسبة الإنجاز ${r.progress}%`, url: `/projects/${r.id}`, tone: 'amber' })),
    ...all('SELECT id, name, stock_qty, uom FROM products WHERE stock_qty <= reorder_level LIMIT 2')
      .map((r) => ({ id: `prd-${r.id}`, title: `مخزون منخفض: ${r.name}`, sub: `المتوفر ${r.stock_qty} ${r.uom}`, url: `/inventory/${r.id}`, tone: 'amber' })),
    ...(counts.pendingLeaves ? [{ id: 'leaves', title: `${counts.pendingLeaves} طلب إجازة بانتظار الموافقة`, sub: 'الموارد البشرية', url: '/hr/leaves', tone: 'blue' }] : []),
  ];
  res.json({ counts, alerts });
});
