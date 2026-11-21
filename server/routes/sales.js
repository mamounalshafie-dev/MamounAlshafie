import { Router } from 'express';
import { all, get, run, tx, logActivity } from '../db.js';
import { HttpError, iso, money, num } from '../util.js';
import { like, nextDocNumber } from './common.js';

export const salesRouter = Router();

const accId = (code) => get('SELECT id FROM accounts WHERE code = ?', code)?.id;

/* ------------------------------ partners -------------------------- */

salesRouter.get('/partners', (req, res) => {
  const { type, q, city, active } = req.query;
  const where = [];
  const params = [];
  if (type && type !== 'all') { where.push('p.type = ?'); params.push(type); }
  if (q) { where.push('(p.name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.contact_name LIKE ?)'); params.push(like(q), like(q), like(q), like(q)); }
  if (city) { where.push('p.city = ?'); params.push(city); }
  if (active === 'true') where.push('p.active = 1');
  const items = all(
    `SELECT p.*,
       (SELECT COALESCE(SUM(i.total), 0) FROM invoices i WHERE i.customer_id = p.id AND i.status NOT IN ('draft','cancelled')) AS revenue,
       (SELECT COALESCE(SUM(i.total - i.amount_paid), 0) FROM invoices i WHERE i.customer_id = p.id AND i.status NOT IN ('draft','cancelled')) AS outstanding,
       (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = p.id) AS invoice_count,
       (SELECT COUNT(*) FROM projects pr WHERE pr.customer_id = p.id) AS project_count
     FROM partners p ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.name`,
    ...params
  );
  const cities = all('SELECT DISTINCT city FROM partners WHERE city IS NOT NULL ORDER BY city').map((r) => r.city);
  res.json({ items, cities });
});

salesRouter.get('/partners/:id', (req, res) => {
  const partner = get('SELECT * FROM partners WHERE id = ?', req.params.id);
  if (!partner) throw new HttpError(404, 'العميل غير موجود');
  const invoices = all('SELECT * FROM invoices WHERE customer_id = ? ORDER BY date DESC LIMIT 50', partner.id);
  const projects = all('SELECT * FROM projects WHERE customer_id = ? ORDER BY created_at DESC', partner.id);
  const quotations = all('SELECT * FROM quotations WHERE customer_id = ? ORDER BY date DESC LIMIT 20', partner.id);
  res.json({
    partner, invoices, projects, quotations,
    stats: {
      revenue: invoices.filter((i) => !['draft', 'cancelled'].includes(i.status)).reduce((s, i) => s + i.total, 0),
      collected: invoices.reduce((s, i) => s + i.amount_paid, 0),
      outstanding: invoices.filter((i) => !['draft', 'cancelled'].includes(i.status)).reduce((s, i) => s + i.total - i.amount_paid, 0),
      invoiceCount: invoices.length,
      projectCount: projects.length,
    },
  });
});

salesRouter.post('/partners', (req, res) => {
  const b = req.body || {};
  if (!b.name) throw new HttpError(400, 'اسم الجهة مطلوب');
  const id = Number(run(
    `INSERT INTO partners (type, name, contact_name, email, phone, city, country, tax_id, address,
      credit_limit, payment_terms, rating, active, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    b.type || 'customer', b.name, b.contactName || null, b.email || null, b.phone || null,
    b.city || null, b.country || 'العراق', b.taxId || null, b.address || null,
    num(b.creditLimit), num(b.paymentTerms, 30), num(b.rating, 4), b.active === false ? 0 : 1, b.notes || null
  ).lastInsertRowid);
  logActivity(req.user.id, 'partner', id, 'create', `أضاف ${b.type === 'vendor' ? 'مورداً' : 'عميلاً'} جديداً: ${b.name}`);
  res.status(201).json(get('SELECT * FROM partners WHERE id = ?', id));
});

salesRouter.patch('/partners/:id', (req, res) => {
  const p = get('SELECT * FROM partners WHERE id = ?', req.params.id);
  if (!p) throw new HttpError(404, 'السجل غير موجود');
  const b = req.body || {};
  const map = {
    type: 'type', name: 'name', contactName: 'contact_name', email: 'email', phone: 'phone', city: 'city',
    country: 'country', taxId: 'tax_id', address: 'address', creditLimit: 'credit_limit',
    paymentTerms: 'payment_terms', rating: 'rating', notes: 'notes', active: 'active',
  };
  const sets = []; const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { sets.push(`${col} = ?`); params.push(b[k]); }
  }
  if (!sets.length) return res.json(p);
  run(`UPDATE partners SET ${sets.join(', ')} WHERE id = ?`, ...params, p.id);
  res.json(get('SELECT * FROM partners WHERE id = ?', p.id));
});

salesRouter.delete('/partners/:id', (req, res) => {
  const p = get('SELECT * FROM partners WHERE id = ?', req.params.id);
  if (!p) throw new HttpError(404, 'السجل غير موجود');
  const used = get('SELECT (SELECT COUNT(*) FROM invoices WHERE customer_id = ?) c1, (SELECT COUNT(*) FROM projects WHERE customer_id = ?) c2', p.id, p.id);
  if (used.c1 || used.c2) throw new HttpError(400, 'لا يمكن حذف سجل مرتبط بفواتير أو مشاريع، يمكن تعطيله بدلاً من ذلك');
  run('DELETE FROM partners WHERE id = ?', p.id);
  res.json({ ok: true });
});

/* ----------------------------- quoting ---------------------------- */

const Q_SELECT = `SELECT q.*, p.name AS customer_name, pr.name AS project_name, u.name AS created_by_name
  FROM quotations q LEFT JOIN partners p ON p.id = q.customer_id
  LEFT JOIN projects pr ON pr.id = q.project_id LEFT JOIN users u ON u.id = q.created_by`;

function calcLines(lines = [], defaultTax = 15) {
  let subtotal = 0; let tax = 0;
  const normalized = lines.map((l) => {
    const qty = num(l.qty, 1);
    const price = num(l.unitPrice, 0);
    const rate = l.taxRate === undefined || l.taxRate === null || l.taxRate === '' ? defaultTax : num(l.taxRate);
    const lineTotal = qty * price;
    subtotal += lineTotal;
    tax += lineTotal * rate / 100;
    return { ...l, qty, price, rate };
  });
  return { subtotal: money(subtotal), tax: money(tax), total: money(subtotal + tax), normalized };
}

salesRouter.get('/quotations', (req, res) => {
  const { q, status, customerId } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(q.number LIKE ? OR p.name LIKE ?)'); params.push(like(q), like(q)); }
  if (status && status !== 'all') { where.push('q.status = ?'); params.push(status); }
  if (customerId) { where.push('q.customer_id = ?'); params.push(customerId); }
  res.json(all(`${Q_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY q.date DESC, q.id DESC`, ...params));
});

salesRouter.get('/quotations/:id', (req, res) => {
  const quotation = get(`${Q_SELECT} WHERE q.id = ?`, req.params.id);
  if (!quotation) throw new HttpError(404, 'عرض السعر غير موجود');
  const lines = all('SELECT * FROM quotation_lines WHERE quotation_id = ? ORDER BY id', quotation.id);
  res.json({ quotation, lines });
});

salesRouter.post('/quotations', (req, res) => {
  const b = req.body || {};
  if (!b.customerId) throw new HttpError(400, 'يجب اختيار العميل');
  if (!Array.isArray(b.lines) || !b.lines.length) throw new HttpError(400, 'يجب إضافة بند واحد على الأقل');
  return tx(() => {
    const { subtotal, tax, total, normalized } = calcLines(b.lines);
    const number = nextDocNumber('QT', 'quotations');
    const id = Number(run(
      `INSERT INTO quotations (number, customer_id, project_id, date, valid_until, status, subtotal, tax, total, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      number, b.customerId, b.projectId || null, b.date || iso(), b.validUntil || null,
      b.status || 'draft', subtotal, tax, total, b.notes || null, req.user.id
    ).lastInsertRowid);
    normalized.forEach((l) => run(
      `INSERT INTO quotation_lines (quotation_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, ?)`,
      id, l.productId || null, l.description || '', l.qty, l.price, l.rate
    ));
    logActivity(req.user.id, 'quotation', id, 'create', `أنشأ عرض سعر ${number} بقيمة ${total.toLocaleString('en-US')} د.ع`);
    res.status(201).json(get(`${Q_SELECT} WHERE q.id = ?`, id));
  });
});

salesRouter.patch('/quotations/:id', (req, res) => {
  const q = get('SELECT * FROM quotations WHERE id = ?', req.params.id);
  if (!q) throw new HttpError(404, 'عرض السعر غير موجود');
  const b = req.body || {};
  return tx(() => {
    let totals = null;
    if (Array.isArray(b.lines)) {
      const c = calcLines(b.lines);
      totals = c;
      run('DELETE FROM quotation_lines WHERE quotation_id = ?', q.id);
      c.normalized.forEach((l) => run(
        `INSERT INTO quotation_lines (quotation_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, ?)`,
        q.id, l.productId || null, l.description || '', l.qty, l.price, l.rate
      ));
    }
    const map = {
      customerId: 'customer_id', projectId: 'project_id', date: 'date', validUntil: 'valid_until',
      status: 'status', notes: 'notes',
    };
    const sets = []; const params = [];
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { sets.push(`${col} = ?`); params.push(b[k] === '' ? null : b[k]); }
    }
    if (totals) {
      sets.push('subtotal = ?', 'tax = ?', 'total = ?');
      params.push(totals.subtotal, totals.tax, totals.total);
    }
    if (sets.length) run(`UPDATE quotations SET ${sets.join(', ')} WHERE id = ?`, ...params, q.id);
    res.json(get(`${Q_SELECT} WHERE q.id = ?`, q.id));
  });
});

salesRouter.post('/quotations/:id/convert', (req, res) => {
  const q = get('SELECT * FROM quotations WHERE id = ?', req.params.id);
  if (!q) throw new HttpError(404, 'عرض السعر غير موجود');
  if (q.status === 'invoiced') throw new HttpError(400, 'تم تحويل عرض السعر إلى فاتورة مسبقاً');
  const lines = all('SELECT * FROM quotation_lines WHERE quotation_id = ?', q.id);
  if (!lines.length) throw new HttpError(400, 'لا يمكن تحويل عرض سعر بدون بنود');
  return tx(() => {
    const number = nextDocNumber('INV', 'invoices');
    const id = Number(run(
      `INSERT INTO invoices (number, customer_id, project_id, quotation_id, date, due_date, status, subtotal, tax, total, amount_paid, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, 0, ?, ?)`,
      number, q.customer_id, q.project_id, q.id, iso(), addDaysSafe(iso(), 30),
      q.subtotal, q.tax, q.total, q.notes, req.user.id
    ).lastInsertRowid);
    lines.forEach((l) => run(
      `INSERT INTO invoice_lines (invoice_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, ?)`,
      id, l.product_id, l.description, l.qty, l.unit_price, l.tax_rate
    ));
    run(`UPDATE quotations SET status = 'invoiced' WHERE id = ?`, q.id);
    postInvoiceJournal(id, req.user.id);
    logActivity(req.user.id, 'invoice', id, 'create', `حوّل عرض السعر ${q.number} إلى فاتورة ${number}`);
    res.status(201).json(get('SELECT * FROM invoices WHERE id = ?', id));
  });
});

const addDaysSafe = (date, days) => {
  const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
};

/* ----------------------------- invoices --------------------------- */

const I_SELECT = `SELECT i.*, p.name AS customer_name, pr.name AS project_name,
    CASE WHEN i.status NOT IN ('paid','draft','cancelled') AND i.due_date < date('now') THEN 1 ELSE 0 END AS is_overdue,
    (i.total - i.amount_paid) AS balance
  FROM invoices i LEFT JOIN partners p ON p.id = i.customer_id LEFT JOIN projects pr ON pr.id = i.project_id`;

function postInvoiceJournal(invoiceId, userId) {
  const inv = get('SELECT * FROM invoices WHERE id = ?', invoiceId);
  if (!inv) return;
  run(`DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source = 'invoice' AND reference = ?)`, inv.number);
  run(`DELETE FROM journal_entries WHERE source = 'invoice' AND reference = ?`, inv.number);
  if (['draft', 'cancelled'].includes(inv.status)) return;
  const entryId = Number(run(
    `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
     VALUES (?, ?, ?, ?, 'posted', 'invoice', ?)`,
    nextDocNumber('JV', 'journal_entries', { width: 4 }), inv.date, inv.number,
    `إثبات إيراد فاتورة ${inv.number}`, userId
  ).lastInsertRowid);
  run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, project_id, memo) VALUES (?, ?, ?, 0, ?, ?, ?)',
    entryId, accId('1300'), inv.total, inv.customer_id, inv.project_id, 'ذمم مدينة');
  run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, project_id, memo) VALUES (?, ?, 0, ?, ?, ?, ?)',
    entryId, accId('4100'), inv.subtotal, inv.customer_id, inv.project_id, 'إيرادات');
  if (inv.tax > 0) {
    run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
      entryId, accId('2200'), inv.tax, inv.customer_id, 'ضريبة القيمة المضافة');
  }
}

salesRouter.get('/invoices', (req, res) => {
  const { q, status, customerId, projectId, from, to, overdue } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(i.number LIKE ? OR p.name LIKE ?)'); params.push(like(q), like(q)); }
  if (status && status !== 'all') { where.push('i.status = ?'); params.push(status); }
  if (customerId) { where.push('i.customer_id = ?'); params.push(customerId); }
  if (projectId) { where.push('i.project_id = ?'); params.push(projectId); }
  if (from) { where.push('i.date >= ?'); params.push(from); }
  if (to) { where.push('i.date <= ?'); params.push(to); }
  if (overdue === 'true') where.push("i.status NOT IN ('paid','draft','cancelled') AND i.due_date < date('now')");
  const items = all(`${I_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.date DESC, i.id DESC`, ...params);
  const stats = {
    count: items.length,
    total: items.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0),
    paid: items.reduce((s, i) => s + i.amount_paid, 0),
    outstanding: items.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + (i.total - i.amount_paid), 0),
    overdue: items.filter((i) => i.is_overdue).length,
  };
  res.json({ items, stats });
});

salesRouter.get('/invoices/:id', (req, res) => {
  const invoice = get(`${I_SELECT} WHERE i.id = ?`, req.params.id);
  if (!invoice) throw new HttpError(404, 'الفاتورة غير موجودة');
  const lines = all('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id', invoice.id);
  const payments = all('SELECT * FROM payments WHERE invoice_id = ? ORDER BY date', invoice.id);
  const customer = invoice.customer_id ? get('SELECT * FROM partners WHERE id = ?', invoice.customer_id) : null;
  res.json({ invoice, lines, payments, customer });
});

salesRouter.post('/invoices', (req, res) => {
  const b = req.body || {};
  if (!b.customerId) throw new HttpError(400, 'يجب اختيار العميل');
  if (!Array.isArray(b.lines) || !b.lines.length) throw new HttpError(400, 'يجب إضافة بند واحد على الأقل');
  return tx(() => {
    const { subtotal, tax, total, normalized } = calcLines(b.lines);
    const number = nextDocNumber('INV', 'invoices');
    const id = Number(run(
      `INSERT INTO invoices (number, customer_id, project_id, quotation_id, date, due_date, status, subtotal, tax, total, amount_paid, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      number, b.customerId, b.projectId || null, b.quotationId || null, b.date || iso(),
      b.dueDate || addDaysSafe(b.date || iso(), 30), b.status || 'draft',
      subtotal, tax, total, b.notes || null, req.user.id
    ).lastInsertRowid);
    normalized.forEach((l) => run(
      `INSERT INTO invoice_lines (invoice_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, ?)`,
      id, l.productId || null, l.description || '', l.qty, l.price, l.rate
    ));
    postInvoiceJournal(id, req.user.id);
    logActivity(req.user.id, 'invoice', id, 'create', `أصدر فاتورة ${number} بقيمة ${total.toLocaleString('en-US')} د.ع`);
    res.status(201).json(get(`${I_SELECT} WHERE i.id = ?`, id));
  });
});

salesRouter.patch('/invoices/:id', (req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ?', req.params.id);
  if (!inv) throw new HttpError(404, 'الفاتورة غير موجودة');
  const b = req.body || {};
  return tx(() => {
    let totals = null;
    if (Array.isArray(b.lines)) {
      totals = calcLines(b.lines);
      run('DELETE FROM invoice_lines WHERE invoice_id = ?', inv.id);
      totals.normalized.forEach((l) => run(
        `INSERT INTO invoice_lines (invoice_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, ?)`,
        inv.id, l.productId || null, l.description || '', l.qty, l.price, l.rate
      ));
    }
    const map = {
      customerId: 'customer_id', projectId: 'project_id', date: 'date', dueDate: 'due_date',
      status: 'status', notes: 'notes',
    };
    const sets = []; const params = [];
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { sets.push(`${col} = ?`); params.push(b[k] === '' ? null : b[k]); }
    }
    if (totals) { sets.push('subtotal = ?', 'tax = ?', 'total = ?'); params.push(totals.subtotal, totals.tax, totals.total); }
    if (b.status === 'paid') {
      const newTotal = totals ? totals.total : inv.total;
      const remaining = money(newTotal - inv.amount_paid);
      if (remaining > 0.01) {
        run(`INSERT INTO payments (invoice_id, date, amount, method, reference, note)
             VALUES (?, ?, ?, 'تسوية', 'SETTLE', 'تسوية كاملة عند تعليم الفاتورة كمدفوعة')`,
          inv.id, iso(), remaining);
        const entryId = Number(run(
          `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
           VALUES (?, ?, ?, ?, 'posted', 'payment', ?)`,
          nextDocNumber('RV', 'journal_entries', { width: 4 }), iso(), inv.number,
          `تحصيل كامل للفاتورة ${inv.number}`, req.user.id
        ).lastInsertRowid);
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
          entryId, accId('1200'), remaining, inv.customer_id, 'تحصيل');
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
          entryId, accId('1300'), remaining, inv.customer_id, 'إقفال ذمم');
      }
      sets.push('amount_paid = ?');
      params.push(newTotal);
    }
    if (sets.length) run(`UPDATE invoices SET ${sets.join(', ')} WHERE id = ?`, ...params, inv.id);
    if (b.status || totals) postInvoiceJournal(inv.id, req.user.id);
    logActivity(req.user.id, 'invoice', inv.id, 'update', `حدّث الفاتورة ${inv.number}${b.status ? ' - الحالة: ' + b.status : ''}`);
    res.json(get(`${I_SELECT} WHERE i.id = ?`, inv.id));
  });
});

salesRouter.delete('/invoices/:id', (req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ?', req.params.id);
  if (!inv) throw new HttpError(404, 'الفاتورة غير موجودة');
  if (!['admin', 'manager', 'accountant'].includes(req.user.role)) throw new HttpError(403, 'لا تملك صلاحية حذف الفواتير');
  return tx(() => {
    run(`DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE reference = ? AND source IN ('invoice','payment'))`, inv.number);
    run(`DELETE FROM journal_entries WHERE reference = ? AND source IN ('invoice','payment')`, inv.number);
    run('DELETE FROM invoices WHERE id = ?', inv.id);
    res.json({ ok: true });
  });
});

salesRouter.post('/invoices/:id/payments', (req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ?', req.params.id);
  if (!inv) throw new HttpError(404, 'الفاتورة غير موجودة');
  const b = req.body || {};
  const amount = num(b.amount);
  if (amount <= 0) throw new HttpError(400, 'قيمة الدفعة يجب أن تكون أكبر من صفر');
  const balance = inv.total - inv.amount_paid;
  if (amount > balance + 0.01) throw new HttpError(400, `قيمة الدفعة تتجاوز الرصيد المتبقي (${balance.toLocaleString('en-US')} د.ع)`);
  return tx(() => {
    const id = Number(run(
      `INSERT INTO payments (invoice_id, date, amount, method, reference, note) VALUES (?, ?, ?, ?, ?, ?)`,
      inv.id, b.date || iso(), amount, b.method || 'تحويل بنكي', b.reference || null, b.note || null
    ).lastInsertRowid);
    const paid = money(inv.amount_paid + amount);
    const status = paid >= inv.total - 0.01 ? 'paid' : 'partial';
    run('UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?', paid, status, inv.id);
    const entryId = Number(run(
      `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
       VALUES (?, ?, ?, ?, 'posted', 'payment', ?)`,
      nextDocNumber('RV', 'journal_entries', { width: 4 }), b.date || iso(), inv.number,
      `تحصيل دفعة على الفاتورة ${inv.number}`, req.user.id
    ).lastInsertRowid);
    run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
      entryId, accId('1200'), amount, inv.customer_id, 'تحصيل نقدي');
    run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
      entryId, accId('1300'), amount, inv.customer_id, 'إقفال ذمم مدينة');
    logActivity(req.user.id, 'invoice', inv.id, 'payment', `سجّل دفعة بمبلغ ${amount.toLocaleString('en-US')} د.ع على الفاتورة ${inv.number}`);
    res.status(201).json({ payment: get('SELECT * FROM payments WHERE id = ?', id), invoice: get(`${I_SELECT} WHERE i.id = ?`, inv.id) });
  });
});

salesRouter.delete('/payments/:id', (req, res) => {
  const pay = get('SELECT * FROM payments WHERE id = ?', req.params.id);
  if (!pay) throw new HttpError(404, 'الدفعة غير موجودة');
  return tx(() => {
    run('DELETE FROM payments WHERE id = ?', pay.id);
    const inv = get('SELECT * FROM invoices WHERE id = ?', pay.invoice_id);
    if (inv) {
      const paid = Math.max(0, money(inv.amount_paid - pay.amount));
      const status = paid >= inv.total - 0.01 ? 'paid' : paid > 0 ? 'partial' : 'sent';
      run('UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?', paid, status, inv.id);
    }
    res.json({ ok: true });
  });
});

/* --------------------------- sales stats -------------------------- */

salesRouter.get('/sales/overview', (req, res) => {
  const monthly = all(`
    SELECT substr(date, 1, 7) AS month, SUM(total) AS total, SUM(amount_paid) AS paid, COUNT(*) AS count
      FROM invoices WHERE status NOT IN ('draft','cancelled') AND date >= date('now', '-11 months')
     GROUP BY month ORDER BY month`);
  const topCustomers = all(`
    SELECT p.id, p.name, COALESCE(SUM(i.total), 0) AS revenue, COUNT(i.id) AS invoices
      FROM partners p JOIN invoices i ON i.customer_id = p.id AND i.status NOT IN ('draft','cancelled')
     GROUP BY p.id ORDER BY revenue DESC LIMIT 6`);
  const byStatus = all(`SELECT status, COUNT(*) count, SUM(total) total FROM invoices GROUP BY status`);
  res.json({ monthly, topCustomers, byStatus });
});

export { postInvoiceJournal };
