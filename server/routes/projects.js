import { Router } from 'express';
import { all, get, run, tx, logActivity } from '../db.js';
import { HttpError, iso, num } from '../util.js';
import { like, nextDocNumber, paginate, recalcProject } from './common.js';

export const projectsRouter = Router();

const PROJECT_SELECT = `
  SELECT p.*,
         c.name AS customer_name,
         u.name AS manager_name,
         u.avatar_color AS manager_color,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.stage = 'done') AS task_done,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.stage <> 'done'
            AND t.due_date < date('now')) AS task_overdue,
         (SELECT COALESCE(SUM(hours), 0) FROM timesheets ts WHERE ts.project_id = p.id) AS logged_hours
    FROM projects p
    LEFT JOIN partners c ON c.id = p.customer_id
    LEFT JOIN users u ON u.id = p.manager_id`;

projectsRouter.get('/projects', (req, res) => {
  const { q, stage, priority, customer, manager, health, view } = req.query;
  const where = [];
  const params = [];
  if (q) { where.push('(p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ? OR c.name LIKE ?)'); params.push(like(q), like(q), like(q), like(q)); }
  if (stage && stage !== 'all') { where.push('p.stage = ?'); params.push(stage); }
  if (priority && priority !== 'all') { where.push('p.priority = ?'); params.push(priority); }
  if (health && health !== 'all') { where.push('p.health = ?'); params.push(health); }
  if (customer) { where.push('p.customer_id = ?'); params.push(customer); }
  if (manager) { where.push('p.manager_id = ?'); params.push(manager); }
  const sql = `${PROJECT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC`;
  const items = all(sql, ...params);
  const summary = {
    total: items.length,
    budget: items.reduce((s, p) => s + p.budget, 0),
    spent: items.reduce((s, p) => s + p.spent, 0),
    avgProgress: items.length ? Math.round(items.reduce((s, p) => s + p.progress, 0) / items.length) : 0,
    byStage: items.reduce((acc, p) => { acc[p.stage] = (acc[p.stage] || 0) + 1; return acc; }, {}),
  };
  if (view === 'kanban' || view === 'list') return res.json({ items, summary });
  res.json({ items, summary });
});

projectsRouter.get('/projects/:id', (req, res) => {
  const project = get(`${PROJECT_SELECT} WHERE p.id = ?`, req.params.id);
  if (!project) throw new HttpError(404, 'المشروع غير موجود');
  const members = all(
    `SELECT u.id, u.name, u.job_title, u.avatar_color, pm.role
       FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?`, project.id
  );
  const tasks = all(
    `SELECT t.*, u.name AS assignee_name, u.avatar_color AS assignee_color
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = ? ORDER BY t.position, t.id`, project.id
  );
  const timesheets = all(
    `SELECT ts.*, u.name AS user_name, t.title AS task_title
       FROM timesheets ts LEFT JOIN users u ON u.id = ts.user_id LEFT JOIN tasks t ON t.id = ts.task_id
      WHERE ts.project_id = ? ORDER BY ts.date DESC LIMIT 40`, project.id
  );
  const invoices = all(
    `SELECT id, number, date, due_date, status, total, amount_paid FROM invoices
      WHERE project_id = ? ORDER BY date DESC`, project.id
  );
  const activities = all(
    `SELECT a.*, u.name AS user_name, u.avatar_color FROM activities a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.entity = 'project' AND a.entity_id = ? ORDER BY a.created_at DESC LIMIT 15`, project.id
  );
  const hours = get('SELECT COALESCE(SUM(hours), 0) h, COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) b FROM timesheets WHERE project_id = ?', project.id);
  res.json({
    project, members, tasks, timesheets, invoices, activities,
    stats: {
      hoursLogged: hours?.h || 0,
      billableHours: hours?.b || 0,
      invoiced: invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0),
      collected: invoices.reduce((s, i) => s + i.amount_paid, 0),
      budgetRemaining: project.budget - project.spent,
      utilization: project.budget ? Math.round((project.spent / project.budget) * 100) : 0,
    },
  });
});

projectsRouter.post('/projects', (req, res) => {
  const b = req.body || {};
  if (!b.name) throw new HttpError(400, 'اسم المشروع مطلوب');
  const code = b.code || nextDocNumber('PRJ', 'projects', { column: 'code', width: 3 });
  const exists = get('SELECT id FROM projects WHERE code = ?', code);
  if (exists) throw new HttpError(400, 'رمز المشروع مستخدم مسبقاً');
  const id = Number(run(
    `INSERT INTO projects (code, name, customer_id, manager_id, stage, priority, start_date, end_date,
       budget, spent, progress, description, tags, health)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'good')`,
    code, b.name, b.customerId || null, b.managerId || null, b.stage || 'planning', b.priority || 'medium',
    b.startDate || iso(), b.endDate || null, num(b.budget), b.description || null, b.tags || null
  ).lastInsertRowid);
  if (b.managerId) run('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', id, b.managerId, 'مدير المشروع');
  logActivity(req.user.id, 'project', id, 'create', `أنشأ مشروع «${b.name}» بميزانية ${num(b.budget).toLocaleString('en-US')} د.ع`);
  res.status(201).json(get(`${PROJECT_SELECT} WHERE p.id = ?`, id));
});

projectsRouter.patch('/projects/:id', (req, res) => {
  const project = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!project) throw new HttpError(404, 'المشروع غير موجود');
  const b = req.body || {};
  const map = {
    name: 'name', code: 'code', customerId: 'customer_id', managerId: 'manager_id', stage: 'stage',
    priority: 'priority', startDate: 'start_date', endDate: 'end_date', budget: 'budget', spent: 'spent',
    progress: 'progress', description: 'description', tags: 'tags', health: 'health',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { sets.push(`${col} = ?`); params.push(b[k] === '' ? null : b[k]); }
  }
  if (!sets.length) return res.json(project);
  run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, ...params, project.id);
  if (b.stage) {
    logActivity(req.user.id, 'project', project.id, 'update', `حدّث مرحلة مشروع «${project.name}» إلى ${b.stage}`);
  }
  res.json(get(`${PROJECT_SELECT} WHERE p.id = ?`, project.id));
});

projectsRouter.delete('/projects/:id', (req, res) => {
  const project = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!project) throw new HttpError(404, 'المشروع غير موجود');
  if (req.user.role !== 'admin' && req.user.role !== 'manager') throw new HttpError(403, 'لا تملك صلاحية حذف المشاريع');
  run('DELETE FROM projects WHERE id = ?', project.id);
  logActivity(req.user.id, 'project', project.id, 'delete', `حذف مشروع «${project.name}»`);
  res.json({ ok: true });
});

projectsRouter.post('/projects/:id/members', (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId) throw new HttpError(400, 'يجب اختيار عضو');
  run('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', req.params.id, userId, role || 'عضو فريق');
  res.status(201).json({ ok: true });
});

projectsRouter.delete('/projects/:id/members/:userId', (req, res) => {
  run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', req.params.id, req.params.userId);
  res.json({ ok: true });
});

/* ------------------------------- tasks ---------------------------- */

const TASK_SELECT = `
  SELECT t.*, p.name AS project_name, p.code AS project_code,
         u.name AS assignee_name, u.avatar_color AS assignee_color,
         CASE WHEN t.due_date < date('now') AND t.stage <> 'done' THEN 1 ELSE 0 END AS is_overdue
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id`;

projectsRouter.get('/tasks', (req, res) => {
  const { q, projectId, stage, priority, assignee, mine, overdue } = req.query;
  const where = [];
  const params = [];
  if (q) { where.push('(t.title LIKE ? OR t.description LIKE ? OR p.name LIKE ?)'); params.push(like(q), like(q), like(q)); }
  if (projectId) { where.push('t.project_id = ?'); params.push(projectId); }
  if (stage && stage !== 'all') { where.push('t.stage = ?'); params.push(stage); }
  if (priority && priority !== 'all') { where.push('t.priority = ?'); params.push(priority); }
  if (assignee) { where.push('t.assignee_id = ?'); params.push(assignee); }
  if (mine === 'true') { where.push('t.assignee_id = ?'); params.push(req.user.id); }
  if (overdue === 'true') { where.push("t.due_date < date('now') AND t.stage <> 'done'"); }
  const items = all(
    `${TASK_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.position, t.id`,
    ...params
  );
  const stats = {
    total: items.length,
    done: items.filter((t) => t.stage === 'done').length,
    overdue: items.filter((t) => t.is_overdue).length,
    byStage: items.reduce((acc, t) => { acc[t.stage] = (acc[t.stage] || 0) + 1; return acc; }, {}),
  };
  res.json({ items, stats });
});

projectsRouter.post('/tasks', (req, res) => {
  const b = req.body || {};
  if (!b.title) throw new HttpError(400, 'عنوان المهمة مطلوب');
  const id = Number(run(
    `INSERT INTO tasks (project_id, title, description, stage, priority, assignee_id, start_date, due_date,
      estimated_hours, spent_hours, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    b.projectId || null, b.title, b.description || null, b.stage || 'todo', b.priority || 'medium',
    b.assigneeId || null, b.startDate || iso(), b.dueDate || null, num(b.estimatedHours), b.tags || null
  ).lastInsertRowid);
  if (b.projectId) recalcProject(b.projectId);
  logActivity(req.user.id, 'task', id, 'create', `أنشأ مهمة «${b.title}»`);
  res.status(201).json(get(`${TASK_SELECT} WHERE t.id = ?`, id));
});

projectsRouter.patch('/tasks/:id', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', req.params.id);
  if (!task) throw new HttpError(404, 'المهمة غير موجودة');
  const b = req.body || {};
  const map = {
    title: 'title', description: 'description', stage: 'stage', priority: 'priority', assigneeId: 'assignee_id',
    startDate: 'start_date', dueDate: 'due_date', estimatedHours: 'estimated_hours', spentHours: 'spent_hours',
    tags: 'tags', projectId: 'project_id', position: 'position',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { sets.push(`${col} = ?`); params.push(b[k] === '' ? null : b[k]); }
  }
  if (b.stage === 'done' && task.stage !== 'done') { sets.push('done_at = ?'); params.push(new Date().toISOString()); }
  if (b.stage && b.stage !== 'done' && task.stage === 'done') { sets.push('done_at = NULL'); }
  if (!sets.length) return res.json(task);
  run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, ...params, task.id);
  const projectId = b.projectId || task.project_id;
  if (projectId) recalcProject(projectId);
  if (b.stage && b.stage !== task.stage) {
    logActivity(req.user.id, 'task', task.id, 'update', `${b.stage === 'done' ? 'أنجز' : 'حدّث'} مهمة «${task.title}»`);
  }
  res.json(get(`${TASK_SELECT} WHERE t.id = ?`, task.id));
});

projectsRouter.delete('/tasks/:id', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', req.params.id);
  if (!task) throw new HttpError(404, 'المهمة غير موجودة');
  run('DELETE FROM tasks WHERE id = ?', task.id);
  if (task.project_id) recalcProject(task.project_id);
  res.json({ ok: true });
});

/* ----------------------------- timesheets ------------------------- */

projectsRouter.get('/timesheets', (req, res) => {
  const { projectId, userId, from, to } = req.query;
  const where = [];
  const params = [];
  if (projectId) { where.push('ts.project_id = ?'); params.push(projectId); }
  if (userId) { where.push('ts.user_id = ?'); params.push(userId); }
  if (from) { where.push('ts.date >= ?'); params.push(from); }
  if (to) { where.push('ts.date <= ?'); params.push(to); }
  const items = all(
    `SELECT ts.*, u.name AS user_name, u.avatar_color, p.name AS project_name, t.title AS task_title
       FROM timesheets ts LEFT JOIN users u ON u.id = ts.user_id
       LEFT JOIN projects p ON p.id = ts.project_id LEFT JOIN tasks t ON t.id = ts.task_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ts.date DESC, ts.id DESC LIMIT 300`,
    ...params
  );
  const totals = get(
    `SELECT COALESCE(SUM(hours), 0) hours, COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) billable
       FROM timesheets ts ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, ...params
  );
  res.json({ items, totals });
});

projectsRouter.post('/timesheets', (req, res) => {
  const b = req.body || {};
  if (!b.projectId || !b.hours) throw new HttpError(400, 'المشروع وعدد الساعات مطلوبان');
  const id = Number(run(
    `INSERT INTO timesheets (task_id, project_id, user_id, date, hours, description, billable)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    b.taskId || null, b.projectId, b.userId || req.user.id, b.date || iso(), num(b.hours),
    b.description || null, b.billable === false ? 0 : 1
  ).lastInsertRowid);
  if (b.taskId) run('UPDATE tasks SET spent_hours = COALESCE(spent_hours, 0) + ? WHERE id = ?', num(b.hours), b.taskId);
  res.status(201).json(get('SELECT * FROM timesheets WHERE id = ?', id));
});

projectsRouter.delete('/timesheets/:id', (req, res) => {
  const row = get('SELECT * FROM timesheets WHERE id = ?', req.params.id);
  if (!row) throw new HttpError(404, 'السجل غير موجود');
  run('DELETE FROM timesheets WHERE id = ?', row.id);
  res.json({ ok: true });
});

/* ------------------------- project dashboard ---------------------- */

projectsRouter.get('/projects/:id/report', (req, res) => {
  const project = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!project) throw new HttpError(404, 'المشروع غير موجود');
  const tasks = all('SELECT stage, COUNT(*) c FROM tasks WHERE project_id = ? GROUP BY stage', project.id);
  const hoursByUser = all(
    `SELECT u.name, u.avatar_color, COALESCE(SUM(ts.hours), 0) hours
       FROM timesheets ts JOIN users u ON u.id = ts.user_id WHERE ts.project_id = ?
      GROUP BY u.id ORDER BY hours DESC`, project.id
  );
  res.json({ project, tasks, hoursByUser });
});
