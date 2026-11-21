import { Router } from 'express';
import { all, get, run, tx, logActivity } from '../db.js';
import { HttpError, iso, money, num } from '../util.js';
import { like, nextDocNumber } from './common.js';

export const purchasesRouter = Router();
const accId = (code) => get('SELECT id FROM accounts WHERE code = ?', code)?.id;

const PO_SELECT = `SELECT po.*, p.name AS vendor_name, p.email AS vendor_email,
    (SELECT COUNT(*) FROM po_lines l WHERE l.po_id = po.id) AS line_count
  FROM purchase_orders po LEFT JOIN partners p ON p.id = po.vendor_id`;

function calc(lines, taxRate = 15) {
  let subtotal = 0; let tax = 0;
  const normalized = lines.map((l) => {
    const qty = num(l.qty, 1); const price = num(l.unitPrice, 0);
    const rate = l.taxRate === undefined || l.taxRate === '' ? taxRate : num(l.taxRate);
    subtotal += qty * price; tax += qty * price * rate / 100;
    return { ...l, qty, price, rate };
  });
  return { subtotal: money(subtotal), tax: money(tax), total: money(subtotal + tax), normalized };
}

purchasesRouter.get('/purchase-orders', (req, res) => {
  const { q, status, vendorId } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(po.number LIKE ? OR p.name LIKE ?)'); params.push(like(q), like(q)); }
  if (status && status !== 'all') { where.push('po.status = ?'); params.push(status); }
  if (vendorId) { where.push('po.vendor_id = ?'); params.push(vendorId); }
  const items = all(`${PO_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY po.date DESC, po.id DESC`, ...params);
  const stats = {
    count: items.length,
    total: items.reduce((s, i) => s + i.total, 0),
    pending: items.filter((i) => ['draft', 'confirmed'].includes(i.status)).length,
    received: items.filter((i) => ['received', 'billed'].includes(i.status)).length,
  };
  res.json({ items, stats });
});

purchasesRouter.get('/purchase-orders/:id', (req, res) => {
  const po = get(`${PO_SELECT} WHERE po.id = ?`, req.params.id);
  if (!po) throw new HttpError(404, 'أمر الشراء غير موجود');
  const lines = all('SELECT * FROM po_lines WHERE po_id = ? ORDER BY id', po.id);
  const vendor = po.vendor_id ? get('SELECT * FROM partners WHERE id = ?', po.vendor_id) : null;
  res.json({ purchaseOrder: po, lines, vendor });
});

purchasesRouter.post('/purchase-orders', (req, res) => {
  const b = req.body || {};
  if (!b.vendorId) throw new HttpError(400, 'يجب اختيار المورد');
  if (!Array.isArray(b.lines) || !b.lines.length) throw new HttpError(400, 'يجب إضافة بند واحد على الأقل');
  return tx(() => {
    const { subtotal, tax, total, normalized } = calc(b.lines);
    const number = nextDocNumber('PO', 'purchase_orders');
    const id = Number(run(
      `INSERT INTO purchase_orders (number, vendor_id, date, expected_date, status, subtotal, tax, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      number, b.vendorId, b.date || iso(), b.expectedDate || null, b.status || 'draft',
      subtotal, tax, total, b.notes || null
    ).lastInsertRowid);
    normalized.forEach((l) => run(
      'INSERT INTO po_lines (po_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, ?)',
      id, l.productId || null, l.description || '', l.qty, l.price, l.rate
    ));
    logActivity(req.user.id, 'purchase_order', id, 'create', `أنشأ أمر شراء ${number} بقيمة ${total.toLocaleString('en-US')} د.ع`);
    res.status(201).json(get(`${PO_SELECT} WHERE po.id = ?`, id));
  });
});

purchasesRouter.patch('/purchase-orders/:id', (req, res) => {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', req.params.id);
  if (!po) throw new HttpError(404, 'أمر الشراء غير موجود');
  const b = req.body || {};
  return tx(() => {
    let totals = null;
    if (Array.isArray(b.lines)) {
      totals = calc(b.lines);
      run('DELETE FROM po_lines WHERE po_id = ?', po.id);
      totals.normalized.forEach((l) => run(
        'INSERT INTO po_lines (po_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, ?)',
        po.id, l.productId || null, l.description || '', l.qty, l.price, l.rate
      ));
    }
    const map = { vendorId: 'vendor_id', date: 'date', expectedDate: 'expected_date', status: 'status', notes: 'notes' };
    const sets = []; const params = [];
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { sets.push(`${col} = ?`); params.push(b[k] === '' ? null : b[k]); }
    }
    if (totals) { sets.push('subtotal = ?', 'tax = ?', 'total = ?'); params.push(totals.subtotal, totals.tax, totals.total); }
    if (sets.length) run(`UPDATE purchase_orders SET ${sets.join(', ')} WHERE id = ?`, ...params, po.id);

    if (b.status === 'received' && po.status !== 'received') {
      const lines = all('SELECT * FROM po_lines WHERE po_id = ?', po.id);
      lines.forEach((l) => {
        if (!l.product_id) return;
        run('UPDATE products SET stock_qty = stock_qty + ?, cost_price = ? WHERE id = ?', l.qty, l.unit_price, l.product_id);
        run(`INSERT INTO stock_moves (product_id, type, qty, unit_cost, reference, note, date, user_id)
             VALUES (?, 'in', ?, ?, ?, 'استلام أمر شراء', ?, ?)`,
          l.product_id, l.qty, l.unit_price, po.number, iso(), req.user.id);
      });
      const entryId = Number(run(
        `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
         VALUES (?, ?, ?, ?, 'posted', 'purchase', ?)`,
        nextDocNumber('PV', 'journal_entries', { width: 4 }), iso(), po.number,
        `استلام أمر شراء ${po.number}`, req.user.id
      ).lastInsertRowid);
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
        entryId, accId('1400'), po.subtotal, po.vendor_id, 'مخزون');
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
        entryId, accId('2200'), po.tax, po.vendor_id, 'ضريبة مدخلات');
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
        entryId, accId('2100'), po.total, po.vendor_id, 'دائنون');
      logActivity(req.user.id, 'purchase_order', po.id, 'receive', `استلم أمر الشراء ${po.number} وأضاف الكميات للمخزون`);
    }
    res.json(get(`${PO_SELECT} WHERE po.id = ?`, po.id));
  });
});

purchasesRouter.delete('/purchase-orders/:id', (req, res) => {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', req.params.id);
  if (!po) throw new HttpError(404, 'أمر الشراء غير موجود');
  if (!['admin', 'manager'].includes(req.user.role)) throw new HttpError(403, 'لا تملك صلاحية حذف أوامر الشراء');
  run('DELETE FROM purchase_orders WHERE id = ?', po.id);
  res.json({ ok: true });
});

purchasesRouter.get('/purchases/overview', (req, res) => {
  const byVendor = all(`
    SELECT p.id, p.name, COALESCE(SUM(po.total), 0) AS spend, COUNT(po.id) AS orders
      FROM partners p JOIN purchase_orders po ON po.vendor_id = p.id AND po.status <> 'cancelled'
     GROUP BY p.id ORDER BY spend DESC LIMIT 8`);
  const monthly = all(`
    SELECT substr(date, 1, 7) month, SUM(total) total FROM purchase_orders
     WHERE status <> 'cancelled' AND date >= date('now', '-11 months') GROUP BY month ORDER BY month`);
  res.json({ byVendor, monthly });
});
