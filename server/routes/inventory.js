import { Router } from 'express';
import { all, get, run, tx, logActivity } from '../db.js';
import { HttpError, iso, num } from '../util.js';
import { like } from './common.js';

export const inventoryRouter = Router();

inventoryRouter.get('/products', (req, res) => {
  const { q, category, lowStock, warehouse } = req.query;
  const where = []; const params = [];
  if (q) { where.push('(name LIKE ? OR sku LIKE ? OR description LIKE ?)'); params.push(like(q), like(q), like(q)); }
  if (category && category !== 'all') { where.push('category = ?'); params.push(category); }
  if (warehouse) { where.push('warehouse = ?'); params.push(warehouse); }
  if (lowStock === 'true') where.push('stock_qty <= reorder_level');
  const items = all(
    `SELECT *, (stock_qty * cost_price) AS stock_value,
       CASE WHEN stock_qty <= 0 THEN 'out' WHEN stock_qty <= reorder_level THEN 'low' ELSE 'ok' END AS stock_status
     FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name`, ...params
  );
  const categories = all('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category').map((r) => r.category);
  const stats = {
    count: items.length,
    stockValue: items.reduce((s, p) => s + p.stock_qty * p.cost_price, 0),
    retailValue: items.reduce((s, p) => s + p.stock_qty * p.sale_price, 0),
    lowStock: items.filter((p) => p.stock_status !== 'ok').length,
  };
  res.json({ items, categories, stats });
});

inventoryRouter.get('/products/:id', (req, res) => {
  const product = get('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!product) throw new HttpError(404, 'المنتج غير موجود');
  const moves = all(
    `SELECT sm.*, u.name AS user_name FROM stock_moves sm LEFT JOIN users u ON u.id = sm.user_id
      WHERE sm.product_id = ? ORDER BY sm.date DESC, sm.id DESC LIMIT 50`, product.id
  );
  const sales = all(
    `SELECT i.number, i.date, il.qty, il.unit_price, p.name AS customer_name
       FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
       LEFT JOIN partners p ON p.id = i.customer_id
      WHERE il.product_id = ? AND i.status NOT IN ('draft','cancelled') ORDER BY i.date DESC LIMIT 20`, product.id
  );
  res.json({ product, moves, sales });
});

const PRODUCT_FIELDS = ['sku', 'name', 'category', 'uom', 'sale_price', 'cost_price', 'reorder_level', 'warehouse', 'description'];
const productPayload = (b) => {
  const map = {
    sku: 'sku', name: 'name', category: 'category', uom: 'uom', salePrice: 'sale_price',
    costPrice: 'cost_price', reorderLevel: 'reorder_level', warehouse: 'warehouse',
    description: 'description', taxable: 'taxable', active: 'active',
  };
  const out = {};
  for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) out[col] = b[k];
  return out;
};

inventoryRouter.post('/products', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.sku) throw new HttpError(400, 'الاسم ورمز المنتج مطلوبان');
  if (get('SELECT id FROM products WHERE sku = ?', b.sku)) throw new HttpError(400, 'رمز المنتج مستخدم مسبقاً');
  const id = Number(run(
    `INSERT INTO products (sku, name, category, uom, sale_price, cost_price, stock_qty, reorder_level, warehouse, taxable, active, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    b.sku, b.name, b.category || null, b.uom || 'قطعة', num(b.salePrice), num(b.costPrice),
    num(b.stockQty), num(b.reorderLevel), b.warehouse || 'المستودع الرئيسي', b.taxable === false ? 0 : 1,
    b.description || null
  ).lastInsertRowid);
  if (num(b.stockQty) > 0) {
    run(`INSERT INTO stock_moves (product_id, type, qty, unit_cost, reference, note, date, user_id)
         VALUES (?, 'in', ?, ?, 'OPEN', 'رصيد افتتاحي', ?, ?)`, id, num(b.stockQty), num(b.costPrice), iso(), req.user.id);
  }
  logActivity(req.user.id, 'product', id, 'create', `أضاف منتجاً جديداً: ${b.name}`);
  res.status(201).json(get('SELECT * FROM products WHERE id = ?', id));
});

inventoryRouter.patch('/products/:id', (req, res) => {
  const p = get('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) throw new HttpError(404, 'المنتج غير موجود');
  const data = productPayload(req.body || {});
  const sets = Object.keys(data).map((k) => `${k} = ?`);
  if (!sets.length) return res.json(p);
  run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, ...Object.values(data), p.id);
  res.json(get('SELECT * FROM products WHERE id = ?', p.id));
});

inventoryRouter.delete('/products/:id', (req, res) => {
  const p = get('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) throw new HttpError(404, 'المنتج غير موجود');
  const used = get('SELECT COUNT(*) c FROM invoice_lines WHERE product_id = ?', p.id);
  if (used.c) throw new HttpError(400, 'المنتج مرتبط بفواتير، يمكن تعطيله بدلاً من حذفه');
  run('DELETE FROM products WHERE id = ?', p.id);
  res.json({ ok: true });
});

inventoryRouter.get('/stock-moves', (req, res) => {
  const { productId, type, from, to } = req.query;
  const where = []; const params = [];
  if (productId) { where.push('sm.product_id = ?'); params.push(productId); }
  if (type && type !== 'all') { where.push('sm.type = ?'); params.push(type); }
  if (from) { where.push('sm.date >= ?'); params.push(from); }
  if (to) { where.push('sm.date <= ?'); params.push(to); }
  res.json(all(
    `SELECT sm.*, p.name AS product_name, p.sku, p.uom, u.name AS user_name
       FROM stock_moves sm JOIN products p ON p.id = sm.product_id
       LEFT JOIN users u ON u.id = sm.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY sm.date DESC, sm.id DESC LIMIT 300`, ...params
  ));
});

inventoryRouter.post('/stock-moves', (req, res) => {
  const b = req.body || {};
  const product = get('SELECT * FROM products WHERE id = ?', b.productId);
  if (!product) throw new HttpError(400, 'المنتج غير موجود');
  const qty = num(b.qty);
  if (qty <= 0) throw new HttpError(400, 'الكمية يجب أن تكون أكبر من صفر');
  const type = b.type === 'out' ? 'out' : b.type === 'adjust' ? 'adjust' : 'in';
  return tx(() => {
    const delta = type === 'out' ? -qty : type === 'in' ? qty : qty - product.stock_qty;
    if (type === 'out' && product.stock_qty < qty) throw new HttpError(400, `الكمية المتوفرة ${product.stock_qty} فقط`);
    run('UPDATE products SET stock_qty = MAX(0, stock_qty + ?) WHERE id = ?', delta, product.id);
    const id = Number(run(
      `INSERT INTO stock_moves (product_id, type, qty, unit_cost, reference, note, date, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      product.id, type, qty, num(b.unitCost, product.cost_price), b.reference || null, b.note || null,
      b.date || iso(), req.user.id
    ).lastInsertRowid);
    logActivity(req.user.id, 'stock', product.id, type, `حركة مخزون (${type}) للمنتج ${product.name} بكمية ${qty}`);
    res.status(201).json({ move: get('SELECT * FROM stock_moves WHERE id = ?', id), product: get('SELECT * FROM products WHERE id = ?', product.id) });
  });
});

inventoryRouter.get('/inventory/overview', (req, res) => {
  const byCategory = all(`
    SELECT category, COUNT(*) count, SUM(stock_qty * cost_price) value, SUM(stock_qty) units
      FROM products GROUP BY category ORDER BY value DESC`);
  const lowStock = all(`
    SELECT id, sku, name, stock_qty, reorder_level, uom FROM products
     WHERE stock_qty <= reorder_level ORDER BY (stock_qty - reorder_level) LIMIT 10`);
  const recentMoves = all(`
    SELECT sm.*, p.name product_name, p.uom FROM stock_moves sm JOIN products p ON p.id = sm.product_id
     ORDER BY sm.date DESC, sm.id DESC LIMIT 8`);
  res.json({ byCategory, lowStock, recentMoves });
});
