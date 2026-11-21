import { Router } from 'express';
import { all, get, run, tx, logActivity } from '../db.js';
import { HttpError, iso, money, num } from '../util.js';
import { like, nextDocNumber } from './common.js';

export const hrRouter = Router();

const EMP_SELECT = `SELECT e.*, d.name AS department_name, u.name AS user_name, u.avatar_color,
    (e.salary + e.allowances) AS gross_salary
  FROM employees e LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN users u ON u.id = e.user_id`;

hrRouter.get('/employees', (req, res) => {
  const { q, departmentId, status } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(e.name LIKE ? OR e.code LIKE ? OR e.email LIKE ? OR e.job_title LIKE ?)'); params.push(like(q), like(q), like(q), like(q)); }
  if (departmentId) { where.push('e.department_id = ?'); params.push(departmentId); }
  if (status && status !== 'all') { where.push('e.status = ?'); params.push(status); }
  const items = all(`${EMP_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY e.code`, ...params);
  const departments = all(`SELECT d.*, COUNT(e.id) AS employee_count FROM departments d LEFT JOIN employees e ON e.department_id = d.id GROUP BY d.id`);
  const stats = {
    total: items.length,
    active: items.filter((e) => e.status === 'active').length,
    onLeave: items.filter((e) => e.status === 'leave').length,
    payroll: items.filter((e) => e.status === 'active').reduce((s, e) => s + e.salary + e.allowances, 0),
    avgSalary: items.length ? Math.round(items.reduce((s, e) => s + e.salary, 0) / items.length) : 0,
  };
  res.json({ items, departments, stats });
});

hrRouter.get('/employees/:id', (req, res) => {
  const employee = get(`${EMP_SELECT} WHERE e.id = ?`, req.params.id);
  if (!employee) throw new HttpError(404, 'الموظف غير موجود');
  const leaves = all('SELECT * FROM leaves WHERE employee_id = ? ORDER BY start_date DESC', employee.id);
  const payslips = all('SELECT * FROM payslips WHERE employee_id = ? ORDER BY period DESC', employee.id);
  const attendance = all('SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 30', employee.id);
  const projects = all(
    `SELECT p.id, p.name, p.code, pm.role FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE pm.user_id = ?`, employee.user_id || -1
  );
  const leaveBalance = { annual: 30, used: leaves.filter((l) => l.type === 'annual' && l.status === 'approved').reduce((s, l) => s + l.days, 0) };
  res.json({ employee, leaves, payslips, attendance, projects, leaveBalance });
});

hrRouter.post('/employees', (req, res) => {
  const b = req.body || {};
  if (!b.name) throw new HttpError(400, 'اسم الموظف مطلوب');
  let code = b.code;
  if (!code) {
    const rows = all("SELECT code FROM employees WHERE code LIKE 'EMP-%'");
    const max = rows.reduce((m, r) => {
      const n = parseInt(String(r.code).split('-').pop(), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    code = `EMP-${String(max + 1).padStart(3, '0')}`;
  }
  const id = Number(run(
    `INSERT INTO employees (code, name, user_id, department_id, job_title, email, phone, hire_date,
       salary, allowances, status, manager_id, national_id, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    code, b.name, b.userId || null, b.departmentId || null, b.jobTitle || null, b.email || null,
    b.phone || null, b.hireDate || iso(), num(b.salary), num(b.allowances), b.status || 'active',
    b.managerId || null, b.nationalId || null, b.address || null
  ).lastInsertRowid);
  logActivity(req.user.id, 'employee', id, 'create', `أضاف موظفاً جديداً: ${b.name}`);
  res.status(201).json(get(`${EMP_SELECT} WHERE e.id = ?`, id));
});

hrRouter.patch('/employees/:id', (req, res) => {
  const emp = get('SELECT * FROM employees WHERE id = ?', req.params.id);
  if (!emp) throw new HttpError(404, 'الموظف غير موجود');
  const b = req.body || {};
  const map = {
    name: 'name', userId: 'user_id', departmentId: 'department_id', jobTitle: 'job_title', email: 'email',
    phone: 'phone', hireDate: 'hire_date', salary: 'salary', allowances: 'allowances', status: 'status',
    managerId: 'manager_id', nationalId: 'national_id', address: 'address', birthDate: 'birth_date',
  };
  const sets = []; const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { sets.push(`${col} = ?`); params.push(b[k] === '' ? null : b[k]); }
  }
  if (!sets.length) return res.json(emp);
  run(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, ...params, emp.id);
  res.json(get(`${EMP_SELECT} WHERE e.id = ?`, emp.id));
});

hrRouter.delete('/employees/:id', (req, res) => {
  const emp = get('SELECT * FROM employees WHERE id = ?', req.params.id);
  if (!emp) throw new HttpError(404, 'الموظف غير موجود');
  if (!['admin', 'manager'].includes(req.user.role)) throw new HttpError(403, 'لا تملك صلاحية حذف الموظفين');
  run('DELETE FROM employees WHERE id = ?', emp.id);
  res.json({ ok: true });
});

/* ------------------------------- leaves --------------------------- */

const LEAVE_SELECT = `SELECT l.*, e.name AS employee_name, e.code AS employee_code, e.job_title,
    d.name AS department_name, u.avatar_color
  FROM leaves l JOIN employees e ON e.id = l.employee_id
  LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN users u ON u.id = e.user_id`;

hrRouter.get('/leaves', (req, res) => {
  const { status, employeeId, type } = req.query;
  const where = []; const params = [];
  if (status && status !== 'all') { where.push('l.status = ?'); params.push(status); }
  if (employeeId) { where.push('l.employee_id = ?'); params.push(employeeId); }
  if (type && type !== 'all') { where.push('l.type = ?'); params.push(type); }
  res.json(all(`${LEAVE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.start_date DESC`, ...params));
});

hrRouter.post('/leaves', (req, res) => {
  const b = req.body || {};
  if (!b.employeeId || !b.startDate || !b.endDate) throw new HttpError(400, 'الموظف وتواريخ الإجازة مطلوبة');
  const days = Math.max(1, Math.round((new Date(b.endDate) - new Date(b.startDate)) / 864e5) + 1);
  const id = Number(run(
    `INSERT INTO leaves (employee_id, type, start_date, end_date, days, status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    b.employeeId, b.type || 'annual', b.startDate, b.endDate, days, b.status || 'pending', b.reason || null
  ).lastInsertRowid);
  logActivity(req.user.id, 'leave', id, 'create', `سجّل طلب إجازة لمدة ${days} يوم`);
  res.status(201).json(get(`${LEAVE_SELECT} WHERE l.id = ?`, id));
});

hrRouter.patch('/leaves/:id', (req, res) => {
  const leave = get('SELECT * FROM leaves WHERE id = ?', req.params.id);
  if (!leave) throw new HttpError(404, 'طلب الإجازة غير موجود');
  const { status } = req.body || {};
  if (status) {
    if (!['approved', 'rejected', 'pending'].includes(status)) throw new HttpError(400, 'حالة غير صحيحة');
    run('UPDATE leaves SET status = ? WHERE id = ?', status, leave.id);
    if (status === 'approved') run("UPDATE employees SET status = 'leave' WHERE id = ? AND status = 'active'", leave.employee_id);
    logActivity(req.user.id, 'leave', leave.id, status, `${status === 'approved' ? 'وافق على' : 'رفض'} طلب إجازة`);
  }
  res.json(get(`${LEAVE_SELECT} WHERE l.id = ?`, leave.id));
});

/* ----------------------------- attendance ------------------------- */

hrRouter.get('/attendance', (req, res) => {
  const date = req.query.date || iso();
  const rows = all(
    `SELECT a.*, e.name AS employee_name, e.code, d.name AS department_name
       FROM attendance a JOIN employees e ON e.id = a.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE a.date = ? ORDER BY e.name`, date
  );
  const summary = {
    present: rows.filter((r) => r.status === 'present').length,
    late: rows.filter((r) => r.status === 'late').length,
    absent: rows.filter((r) => r.status === 'absent').length,
    leave: rows.filter((r) => r.status === 'leave').length,
    total: rows.length,
  };
  res.json({ date, rows, summary });
});

hrRouter.post('/attendance', (req, res) => {
  const b = req.body || {};
  if (!b.employeeId) throw new HttpError(400, 'الموظف مطلوب');
  const date = b.date || iso();
  run(
    `INSERT INTO attendance (employee_id, date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(employee_id, date) DO UPDATE SET check_in = excluded.check_in,
       check_out = excluded.check_out, status = excluded.status`,
    b.employeeId, date, b.checkIn || null, b.checkOut || null, b.status || 'present'
  );
  res.json({ ok: true });
});

/* ------------------------------ payroll --------------------------- */

hrRouter.get('/payslips', (req, res) => {
  const period = req.query.period || new Date().toISOString().slice(0, 7);
  const rows = all(
    `SELECT ps.*, e.name AS employee_name, e.code, e.job_title, d.name AS department_name
       FROM payslips ps JOIN employees e ON e.id = ps.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE ps.period = ? ORDER BY e.code`, period
  );
  const periods = all('SELECT DISTINCT period FROM payslips ORDER BY period DESC').map((r) => r.period);
  res.json({
    period, rows, periods,
    totals: {
      basic: rows.reduce((s, r) => s + r.basic, 0),
      allowances: rows.reduce((s, r) => s + r.allowances, 0),
      deductions: rows.reduce((s, r) => s + r.deductions, 0),
      net: rows.reduce((s, r) => s + r.net, 0),
    },
  });
});

hrRouter.post('/payslips/generate', (req, res) => {
  const period = (req.body || {}).period || new Date().toISOString().slice(0, 7);
  return tx(() => {
    const employees = all("SELECT * FROM employees WHERE status <> 'terminated'");
    let created = 0;
    employees.forEach((e) => {
      const exists = get('SELECT id FROM payslips WHERE employee_id = ? AND period = ?', e.id, period);
      if (exists) return;
      const deductions = Math.round(e.salary * 0.05);
      run(
        `INSERT INTO payslips (employee_id, period, basic, allowances, deductions, net, status, date)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
        e.id, period, e.salary, e.allowances, deductions, money(e.salary + e.allowances - deductions), iso()
      );
      created++;
    });
    logActivity(req.user.id, 'payroll', null, 'generate', `أنشأ كشوف رواتب لشهر ${period} (${created} موظف)`);
    res.json({ ok: true, created, period });
  });
});

hrRouter.post('/payslips/:id/pay', (req, res) => {
  const slip = get('SELECT * FROM payslips WHERE id = ?', req.params.id);
  if (!slip) throw new HttpError(404, 'كشف الراتب غير موجود');
  run("UPDATE payslips SET status = 'paid' WHERE id = ?", slip.id);
  res.json(get('SELECT * FROM payslips WHERE id = ?', slip.id));
});

hrRouter.get('/hr/overview', (req, res) => {
  const byDept = all(`
    SELECT d.name, COUNT(e.id) count, COALESCE(SUM(e.salary + e.allowances), 0) payroll
      FROM departments d LEFT JOIN employees e ON e.department_id = d.id GROUP BY d.id ORDER BY count DESC`);
  const headcount = get("SELECT COUNT(*) total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) active FROM employees");
  const pendingLeaves = get("SELECT COUNT(*) c FROM leaves WHERE status = 'pending'");
  const attendanceToday = all("SELECT status, COUNT(*) c FROM attendance WHERE date = date('now') GROUP BY status");
  res.json({ byDept, headcount, pendingLeaves: pendingLeaves?.c || 0, attendanceToday });
});
