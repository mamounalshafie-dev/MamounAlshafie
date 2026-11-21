import { Router } from 'express';
import { all, get, run, tx, logActivity } from '../db.js';
import { HttpError, iso, money, num } from '../util.js';
import { like, nextDocNumber } from './common.js';

export const accountingRouter = Router();

const balances = (from, to) => {
  const where = ["je.status = 'posted'"];
  const params = [];
  if (from) { where.push('je.date >= ?'); params.push(from); }
  if (to) { where.push('je.date <= ?'); params.push(to); }
  return all(
    `SELECT a.id, a.code, a.name, a.type, a.parent_id,
            COALESCE(SUM(jl.debit), 0) AS debit, COALESCE(SUM(jl.credit), 0) AS credit
       FROM accounts a
       LEFT JOIN journal_lines jl ON jl.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jl.entry_id AND ${where.join(' AND ')}
      GROUP BY a.id ORDER BY a.code`,
    ...params
  );
};

accountingRouter.get('/accounts', (req, res) => {
  const rows = balances(req.query.from, req.query.to);
  const tree = rows.filter((r) => !r.parent_id).map((parent) => ({
    ...parent,
    children: rows.filter((r) => r.parent_id === parent.id).map((c) => ({
      ...c,
      balance: money(c.debit - c.credit),
    })),
    balance: money(parent.debit - parent.credit),
  }));
  res.json({ items: tree, flat: rows, totalDebit: rows.reduce((s, r) => s + r.debit, 0) });
});

accountingRouter.post('/accounts', (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name || !b.type) throw new HttpError(400, 'رمز الحساب والاسم والنوع مطلوبة');
  if (get('SELECT id FROM accounts WHERE code = ?', b.code)) throw new HttpError(400, 'رمز الحساب مستخدم مسبقاً');
  const id = Number(run(
    'INSERT INTO accounts (code, name, type, parent_id, active) VALUES (?, ?, ?, ?, 1)',
    b.code, b.name, b.type, b.parentId || null
  ).lastInsertRowid);
  res.status(201).json(get('SELECT * FROM accounts WHERE id = ?', id));
});

const JE_SELECT = `SELECT je.*, u.name AS created_by_name,
    (SELECT COUNT(*) FROM journal_lines l WHERE l.entry_id = je.id) AS line_count,
    (SELECT COALESCE(SUM(debit), 0) FROM journal_lines l WHERE l.entry_id = je.id) AS amount
  FROM journal_entries je LEFT JOIN users u ON u.id = je.created_by`;

accountingRouter.get('/journal-entries', (req, res) => {
  const { q, source, from, to, status } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(je.number LIKE ? OR je.memo LIKE ? OR je.reference LIKE ?)'); params.push(like(q), like(q), like(q)); }
  if (source && source !== 'all') { where.push('je.source = ?'); params.push(source); }
  if (status && status !== 'all') { where.push('je.status = ?'); params.push(status); }
  if (from) { where.push('je.date >= ?'); params.push(from); }
  if (to) { where.push('je.date <= ?'); params.push(to); }
  const items = all(`${JE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY je.date DESC, je.id DESC LIMIT 400`, ...params);
  res.json({ items, total: items.reduce((s, i) => s + i.amount, 0) });
});

accountingRouter.get('/journal-entries/:id', (req, res) => {
  const entry = get(`${JE_SELECT} WHERE je.id = ?`, req.params.id);
  if (!entry) throw new HttpError(404, 'القيد غير موجود');
  const lines = all(
    `SELECT jl.*, a.code AS account_code, a.name AS account_name, p.name AS partner_name, pr.name AS project_name
       FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       LEFT JOIN partners p ON p.id = jl.partner_id LEFT JOIN projects pr ON pr.id = jl.project_id
      WHERE jl.entry_id = ? ORDER BY jl.id`, entry.id
  );
  res.json({ entry, lines });
});

accountingRouter.post('/journal-entries', (req, res) => {
  const b = req.body || {};
  const lines = Array.isArray(b.lines) ? b.lines : [];
  if (lines.length < 2) throw new HttpError(400, 'القيد يجب أن يحتوي على سطرين على الأقل');
  let debit = 0; let credit = 0;
  lines.forEach((l) => {
    debit += num(l.debit); credit += num(l.credit);
    if (!l.accountId) throw new HttpError(400, 'يجب تحديد الحساب في كل سطر');
  });
  if (Math.abs(debit - credit) > 0.01) throw new HttpError(400, `القيد غير متوازن: مدين ${debit.toLocaleString('en-US')} / دائن ${credit.toLocaleString('en-US')}`);
  return tx(() => {
    const number = nextDocNumber('JV', 'journal_entries', { width: 4 });
    const id = Number(run(
      `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
       VALUES (?, ?, ?, ?, ?, 'manual', ?)`,
      number, b.date || iso(), b.reference || null, b.memo || '', b.status || 'posted', req.user.id
    ).lastInsertRowid);
    lines.forEach((l) => run(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, project_id, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, l.accountId, num(l.debit), num(l.credit), l.partnerId || null, l.projectId || null, l.memo || null
    ));
    logActivity(req.user.id, 'journal_entry', id, 'create', `سجّل قيداً محاسبياً ${number} بقيمة ${debit.toLocaleString('en-US')} د.ع`);
    res.status(201).json(get(`${JE_SELECT} WHERE je.id = ?`, id));
  });
});

accountingRouter.post('/journal-entries/:id/post', (req, res) => {
  const entry = get('SELECT * FROM journal_entries WHERE id = ?', req.params.id);
  if (!entry) throw new HttpError(404, 'القيد غير موجود');
  run("UPDATE journal_entries SET status = 'posted' WHERE id = ?", entry.id);
  logActivity(req.user.id, 'journal_entry', entry.id, 'post', `رحّل القيد ${entry.number} إلى الأستاذ العام`);
  res.json(get(`${JE_SELECT} WHERE je.id = ?`, entry.id));
});

accountingRouter.delete('/journal-entries/:id', (req, res) => {
  const entry = get('SELECT * FROM journal_entries WHERE id = ?', req.params.id);
  if (!entry) throw new HttpError(404, 'القيد غير موجود');
  if (['invoice', 'payment', 'purchase', 'payroll'].includes(entry.source)) {
    throw new HttpError(400, 'لا يمكن حذف قيد مرتبط بمستند آلي');
  }
  run('DELETE FROM journal_entries WHERE id = ?', entry.id);
  res.json({ ok: true });
});

accountingRouter.get('/reports/trial-balance', (req, res) => {
  const rows = balances(req.query.from, req.query.to)
    .filter((r) => r.debit || r.credit)
    .map((r) => ({
      code: r.code, name: r.name, type: r.type,
      debit: money(r.debit), credit: money(r.credit), balance: money(r.debit - r.credit),
    }));
  const totals = rows.reduce((acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }), { debit: 0, credit: 0 });
  res.json({ rows, totals: { debit: money(totals.debit), credit: money(totals.credit) }, balanced: Math.abs(totals.debit - totals.credit) < 0.01 });
});

accountingRouter.get('/reports/profit-loss', (req, res) => {
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || iso();
  const rows = balances(from, to);
  const income = rows.filter((r) => r.type === 'income' && (r.debit || r.credit))
    .map((r) => ({ code: r.code, name: r.name, amount: money(r.credit - r.debit) }));
  const expense = rows.filter((r) => r.type === 'expense' && (r.debit || r.credit))
    .map((r) => ({ code: r.code, name: r.name, amount: money(r.debit - r.credit) }));
  const totalIncome = money(income.reduce((s, r) => s + r.amount, 0));
  const totalExpense = money(expense.reduce((s, r) => s + r.amount, 0));
  const monthly = all(
    `SELECT substr(je.date, 1, 7) AS month,
        SUM(CASE WHEN a.type = 'income' THEN jl.credit - jl.debit ELSE 0 END) AS income,
        SUM(CASE WHEN a.type = 'expense' THEN jl.debit - jl.credit ELSE 0 END) AS expense
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND je.date BETWEEN ? AND ?
      GROUP BY month ORDER BY month`, from, to
  );
  res.json({
    from, to, income, expense,
    totals: { income: totalIncome, expense: totalExpense, net: money(totalIncome - totalExpense) },
    monthly,
  });
});

accountingRouter.get('/reports/balance-sheet', (req, res) => {
  const to = req.query.to || iso();
  const rows = balances(null, to);
  const assets = rows.filter((r) => r.type === 'asset' && (r.debit || r.credit))
    .map((r) => ({ code: r.code, name: r.name, amount: money(r.debit - r.credit) }));
  const liabilities = rows.filter((r) => r.type === 'liability' && (r.debit || r.credit))
    .map((r) => ({ code: r.code, name: r.name, amount: money(r.credit - r.debit) }));
  const equity = rows.filter((r) => r.type === 'equity' && (r.debit || r.credit))
    .map((r) => ({ code: r.code, name: r.name, amount: money(r.credit - r.debit) }));
  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.credit - r.debit, 0);
  const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.debit - r.credit, 0);
  const netIncome = money(income - expense);
  const totalAssets = money(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiabilities = money(liabilities.reduce((s, r) => s + r.amount, 0));
  const totalEquity = money(equity.reduce((s, r) => s + r.amount, 0) + netIncome);
  res.json({
    to, assets, liabilities, equity, netIncome,
    totals: {
      assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity,
      liabilitiesAndEquity: money(totalLiabilities + totalEquity),
    },
  });
});

accountingRouter.get('/reports/general-ledger/:accountId', (req, res) => {
  const account = get('SELECT * FROM accounts WHERE id = ?', req.params.accountId);
  if (!account) throw new HttpError(404, 'الحساب غير موجود');
  const lines = all(
    `SELECT jl.*, je.number, je.date, je.memo AS entry_memo, je.reference, p.name AS partner_name
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
       LEFT JOIN partners p ON p.id = jl.partner_id
      WHERE jl.account_id = ? AND je.status = 'posted' ORDER BY je.date, je.id`, account.id
  );
  let running = 0;
  const rows = lines.map((l) => {
    running += (account.type === 'asset' || account.type === 'expense') ? l.debit - l.credit : l.credit - l.debit;
    return { ...l, running: money(running) };
  });
  const totalDebit = money(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = money(rows.reduce((s, r) => s + r.credit, 0));
  res.json({ account, rows, totals: { debit: totalDebit, credit: totalCredit, balance: money(running) } });
});

accountingRouter.get('/reports/cash-flow', (req, res) => {
  const rows = all(
    `SELECT substr(je.date, 1, 7) month,
        SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) inflow,
        SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END) outflow
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
       JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND a.code IN ('1100', '1200')
        AND je.date >= date('now', '-11 months')
      GROUP BY month ORDER BY month`);
  const cash = get(
    `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS balance FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND a.code IN ('1100', '1200')`
  );
  res.json({ rows, balance: money(cash?.balance || 0) });
});

accountingRouter.get('/reports/ar-aging', (req, res) => {
  const invoices = all(`
    SELECT i.id, i.number, i.date, i.due_date, i.total, i.amount_paid, p.name AS customer_name,
           CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_overdue
      FROM invoices i LEFT JOIN partners p ON p.id = i.customer_id
     WHERE i.status NOT IN ('paid', 'draft', 'cancelled') AND i.total > i.amount_paid
     ORDER BY days_overdue DESC`);
  const buckets = { current: [], '1-30': [], '31-60': [], '61-90': [], '90+': [] };
  invoices.forEach((inv) => {
    const d = inv.days_overdue || 0;
    const key = d <= 0 ? 'current' : d <= 30 ? '1-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
    buckets[key].push(inv);
  });
  const summary = Object.entries(buckets).map(([label, rows]) => ({
    label, count: rows.length,
    amount: money(rows.reduce((s, r) => s + (r.total - r.amount_paid), 0)),
  }));
  res.json({ invoices, buckets, summary, total: money(summary.reduce((s, r) => s + r.amount, 0)) });
});
