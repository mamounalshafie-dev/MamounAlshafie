import { Router } from 'express';
import { all, get } from '../db.js';
import { money, iso } from '../util.js';

export const dashboardRouter = Router();

const yearStart = `${new Date().getFullYear()}-01-01`;

dashboardRouter.get('/dashboard', (req, res) => {
  const revenueYtd = get(
    `SELECT COALESCE(SUM(jl.credit - jl.debit), 0) v FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND a.type = 'income' AND je.date >= ?`, yearStart
  )?.v || 0;
  const expenseYtd = get(
    `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) v FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND a.type = 'expense' AND je.date >= ?`, yearStart
  )?.v || 0;
  const ar = get(
    `SELECT COALESCE(SUM(total - amount_paid), 0) v, COUNT(*) c FROM invoices
      WHERE status NOT IN ('paid','draft','cancelled') AND total > amount_paid`
  ) || { v: 0, c: 0 };
  const overdue = get(
    `SELECT COALESCE(SUM(total - amount_paid), 0) v, COUNT(*) c FROM invoices
      WHERE status NOT IN ('paid','draft','cancelled') AND total > amount_paid AND due_date < date('now')`
  ) || { v: 0, c: 0 };
  const cash = get(
    `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) v FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND a.code IN ('1100','1200')`
  )?.v || 0;
  const ap = get(
    `SELECT COALESCE(SUM(jl.credit - jl.debit), 0) v FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND a.code = '2100'`
  )?.v || 0;

  const projectStats = get(`
    SELECT COUNT(*) total,
      SUM(CASE WHEN stage = 'in_progress' THEN 1 ELSE 0 END) active,
      SUM(CASE WHEN stage = 'done' THEN 1 ELSE 0 END) done,
      SUM(CASE WHEN health = 'at_risk' THEN 1 ELSE 0 END) at_risk,
      COALESCE(SUM(budget), 0) budget, COALESCE(SUM(spent), 0) spent,
      COALESCE(AVG(progress), 0) progress
    FROM projects WHERE stage <> 'cancelled'`);
  const taskStats = get(`
    SELECT COUNT(*) total,
      SUM(CASE WHEN stage <> 'done' THEN 1 ELSE 0 END) open,
      SUM(CASE WHEN stage <> 'done' AND due_date < date('now') THEN 1 ELSE 0 END) overdue,
      SUM(CASE WHEN stage = 'done' AND done_at >= date('now', '-30 days') THEN 1 ELSE 0 END) done30
    FROM tasks`);
  const counts = {
    customers: get("SELECT COUNT(*) c FROM partners WHERE type = 'customer'")?.c || 0,
    vendors: get("SELECT COUNT(*) c FROM partners WHERE type = 'vendor'")?.c || 0,
    products: get('SELECT COUNT(*) c FROM products')?.c || 0,
    employees: get("SELECT COUNT(*) c FROM employees WHERE status <> 'terminated'")?.c || 0,
    invoices: get("SELECT COUNT(*) c FROM invoices WHERE status <> 'cancelled'")?.c || 0,
    quotations: get("SELECT COUNT(*) c FROM quotations WHERE status IN ('draft','sent')")?.c || 0,
    pendingLeaves: get("SELECT COUNT(*) c FROM leaves WHERE status = 'pending'")?.c || 0,
    lowStock: get('SELECT COUNT(*) c FROM products WHERE stock_qty <= reorder_level')?.c || 0,
  };
  const inventoryValue = get('SELECT COALESCE(SUM(stock_qty * cost_price), 0) v FROM products')?.v || 0;

  const months = all(`
    WITH RECURSIVE seq(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM seq WHERE n < 11)
    SELECT strftime('%Y-%m', date('now', 'start of month', '-' || n || ' months')) AS month
      FROM seq ORDER BY month`);

  const revenueByMonth = all(`
    SELECT substr(je.date, 1, 7) month, SUM(jl.credit - jl.debit) v
      FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
      JOIN accounts a ON a.id = jl.account_id
     WHERE je.status = 'posted' AND a.type = 'income'
       AND je.date >= date('now', 'start of month', '-11 months')
     GROUP BY month`);
  const expenseByMonth = all(`
    SELECT substr(je.date, 1, 7) month, SUM(jl.debit - jl.credit) v
      FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
      JOIN accounts a ON a.id = jl.account_id
     WHERE je.status = 'posted' AND a.type = 'expense'
       AND je.date >= date('now', 'start of month', '-11 months')
     GROUP BY month`);
  const revMap = Object.fromEntries(revenueByMonth.map((r) => [r.month, r.v]));
  const expMap = Object.fromEntries(expenseByMonth.map((r) => [r.month, r.v]));
  const trend = months.map((m) => ({
    month: m.month,
    revenue: money(revMap[m.month] || 0),
    expense: money(expMap[m.month] || 0),
    profit: money((revMap[m.month] || 0) - (expMap[m.month] || 0)),
  }));

  const pipeline = all(`
    SELECT p.id, p.code, p.name, p.stage, p.progress, p.budget, p.spent, p.priority, p.health,
           p.end_date, c.name AS customer_name
      FROM projects p LEFT JOIN partners c ON c.id = p.customer_id
     WHERE p.stage NOT IN ('done','cancelled') ORDER BY p.priority = 'critical' DESC, p.end_date ASC LIMIT 8`);

  const invoiceStatus = all(`SELECT status, COUNT(*) count, COALESCE(SUM(total), 0) total FROM invoices GROUP BY status`);

  const topCustomers = all(`
    SELECT p.name, COALESCE(SUM(i.total), 0) revenue, COUNT(i.id) invoices
      FROM partners p JOIN invoices i ON i.customer_id = p.id AND i.status NOT IN ('draft','cancelled')
     GROUP BY p.id ORDER BY revenue DESC LIMIT 5`);

  const recentInvoices = all(`
    SELECT i.id, i.number, i.date, i.status, i.total, i.amount_paid, c.name customer_name
      FROM invoices i LEFT JOIN partners c ON c.id = i.customer_id
     WHERE i.status <> 'cancelled' ORDER BY i.date DESC, i.id DESC LIMIT 6`);

  const activities = all(`
    SELECT a.*, u.name AS user_name, u.avatar_color FROM activities a
      LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 10`);

  const upcoming = all(`
    SELECT id, code, name, end_date, progress FROM projects
     WHERE stage IN ('in_progress','review','planning') AND end_date IS NOT NULL
       AND end_date BETWEEN date('now', '-10 days') AND date('now', '+60 days')
     ORDER BY end_date LIMIT 5`);

  const myTasks = all(`
    SELECT t.id, t.title, t.stage, t.priority, t.due_date, p.name AS project_name,
      CASE WHEN t.due_date < date('now') AND t.stage <> 'done' THEN 1 ELSE 0 END AS is_overdue
      FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.assignee_id = ? AND t.stage <> 'done'
     ORDER BY t.due_date IS NULL, t.due_date LIMIT 6`, req.user.id);

  const workload = all(`
    SELECT u.id, u.name, u.avatar_color, u.job_title,
      SUM(CASE WHEN t.stage <> 'done' THEN 1 ELSE 0 END) open_tasks,
      COALESCE(SUM(CASE WHEN t.stage <> 'done' THEN t.estimated_hours ELSE 0 END), 0) hours
      FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
     WHERE u.active = 1 GROUP BY u.id ORDER BY open_tasks DESC LIMIT 6`);

  const lowStock = all(`SELECT id, name, sku, stock_qty, reorder_level, uom FROM products
    WHERE stock_qty <= reorder_level ORDER BY (stock_qty - reorder_level) LIMIT 5`);

  const atRisk = all(`SELECT id, code, name, progress, end_date, health, budget, spent FROM projects
    WHERE health = 'at_risk' AND stage NOT IN ('done','cancelled') LIMIT 4`);

  const overdueInvoices = all(`SELECT i.id, i.number, i.due_date, i.total, i.amount_paid, c.name customer_name,
      CAST(julianday('now') - julianday(i.due_date) AS INTEGER) days
    FROM invoices i LEFT JOIN partners c ON c.id = i.customer_id
    WHERE i.status NOT IN ('paid','draft','cancelled') AND i.total > i.amount_paid AND i.due_date < date('now')
    ORDER BY days DESC LIMIT 5`);

  res.json({
    kpis: {
      revenueYtd: money(revenueYtd),
      expenseYtd: money(expenseYtd),
      profitYtd: money(revenueYtd - expenseYtd),
      margin: revenueYtd ? Math.round(((revenueYtd - expenseYtd) / revenueYtd) * 100) : 0,
      cash: money(cash),
      ar: money(ar.v), arCount: ar.c,
      ap: money(ap),
      overdue: money(overdue.v), overdueCount: overdue.c,
      inventoryValue: money(inventoryValue),
      projects: {
        total: projectStats?.total || 0,
        active: projectStats?.active || 0,
        done: projectStats?.done || 0,
        atRisk: projectStats?.at_risk || 0,
        budget: money(projectStats?.budget || 0),
        spent: money(projectStats?.spent || 0),
        progress: Math.round(projectStats?.progress || 0),
        utilization: projectStats?.budget ? Math.round((projectStats.spent / projectStats.budget) * 100) : 0,
      },
      tasks: {
        total: taskStats?.total || 0, open: taskStats?.open || 0,
        overdue: taskStats?.overdue || 0, done30: taskStats?.done30 || 0,
      },
      counts,
    },
    trend, pipeline, invoiceStatus, topCustomers, recentInvoices, activities,
    upcoming, myTasks, workload, alerts: { lowStock, atRisk, overdueInvoices },
  });
});

dashboardRouter.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  const term = `%${q}%`;
  const results = [
    ...all(`SELECT id, code, name, stage, progress FROM projects WHERE name LIKE ? OR code LIKE ? LIMIT 5`, term, term)
      .map((r) => ({ type: 'project', id: r.id, title: r.name, subtitle: `${r.code} · ${r.stage}`, url: `/projects/${r.id}` })),
    ...all(`SELECT t.id, t.title, t.stage, p.name project_name FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
            WHERE t.title LIKE ? LIMIT 5`, term)
      .map((r) => ({ type: 'task', id: r.id, title: r.title, subtitle: r.project_name || 'بدون مشروع', url: `/tasks?q=${encodeURIComponent(q)}` })),
    ...all(`SELECT id, name, type, city FROM partners WHERE name LIKE ? OR email LIKE ? LIMIT 5`, term, term)
      .map((r) => ({ type: r.type === 'vendor' ? 'vendor' : 'customer', id: r.id, title: r.name,
        subtitle: `${r.type === 'vendor' ? 'مورد' : 'عميل'}${r.city ? ' · ' + r.city : ''}`,
        url: r.type === 'vendor' ? '/vendors' : `/customers/${r.id}` })),
    ...all(`SELECT id, number, total, status FROM invoices WHERE number LIKE ? LIMIT 5`, term)
      .map((r) => ({ type: 'invoice', id: r.id, title: r.number, subtitle: `فاتورة · ${r.status}`, url: `/invoices/${r.id}` })),
    ...all(`SELECT id, sku, name, stock_qty FROM products WHERE name LIKE ? OR sku LIKE ? LIMIT 5`, term, term)
      .map((r) => ({ type: 'product', id: r.id, title: r.name, subtitle: `${r.sku} · المخزون ${r.stock_qty}`, url: `/inventory/${r.id}` })),
    ...all(`SELECT id, name, job_title FROM employees WHERE name LIKE ? OR code LIKE ? LIMIT 5`, term, term)
      .map((r) => ({ type: 'employee', id: r.id, title: r.name, subtitle: r.job_title || 'موظف', url: `/hr/employees/${r.id}` })),
  ];
  res.json({ results });
});

dashboardRouter.get('/meta', (req, res) => {
  res.json({
    users: all('SELECT id, name, email, role, job_title, department, avatar_color FROM users WHERE active = 1 ORDER BY name'),
    customers: all("SELECT id, name FROM partners WHERE type = 'customer' ORDER BY name"),
    vendors: all("SELECT id, name FROM partners WHERE type = 'vendor' ORDER BY name"),
    products: all('SELECT id, sku, name, sale_price, cost_price, uom, stock_qty, category FROM products WHERE active = 1 ORDER BY name'),
    projects: all("SELECT id, code, name, stage FROM projects WHERE stage <> 'cancelled' ORDER BY name"),
    departments: all('SELECT * FROM departments ORDER BY name'),
    accounts: all('SELECT id, code, name, type FROM accounts ORDER BY code'),
    stages: ['planning', 'in_progress', 'on_hold', 'review', 'done', 'cancelled'],
    today: iso(),
  });
});
