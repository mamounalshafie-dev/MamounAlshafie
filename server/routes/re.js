import { Router } from 'express';
import { all, get, run, tx, logActivity, setting } from '../db.js';
import { HttpError, iso, money, num } from '../util.js';
import { like, nextDocNumber, paginate } from './common.js';

export const reRouter = Router();

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

const accId = (code) => get('SELECT id FROM accounts WHERE code = ?', code)?.id;
const today = () => iso();
const monthKeys = (count = 12) => {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

const DEFAULT_ACCOUNT_MAP = {
  receivable: '1300',
  revenue: '4200',
  cash: '1100',
  bank: '1200',
  downPaymentLiability: '2500',
  maintenanceExpense: '5400',
  costOfSales: '5300',
};
const ACCOUNT_ROLE_TYPES = {
  receivable: 'asset', revenue: 'income', cash: 'asset', bank: 'asset',
  downPaymentLiability: 'liability', maintenanceExpense: 'expense', costOfSales: 'expense',
};

const accountMaps = () => {
  const saved = setting('re_accounts', {}) || {};
  if (saved && typeof saved === 'object' && ('global' in saved || 'projects' in saved)) {
    return {
      global: { ...DEFAULT_ACCOUNT_MAP, ...(saved.global || {}) },
      projects: saved.projects && typeof saved.projects === 'object' ? saved.projects : {},
    };
  }
  // Backwards-compatible with the original flat map stored by the seed.
  return { global: { ...DEFAULT_ACCOUNT_MAP, ...(saved || {}) }, projects: {} };
};

const accountMap = (projectId = null) => {
  const { global, projects } = accountMaps();
  const code = typeof projectId === 'string'
    ? projectId
    : projectId ? get('SELECT code FROM re_projects WHERE id = ?', projectId)?.code : null;
  return { ...global, ...(code ? (projects[code] || projects[String(projectId)] || {}) : {}) };
};

const postEntry = ({ date, reference, memo, lines, source = 'manual', userId = 1 }) => {
  const id = Number(run(
    `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
     VALUES (?, ?, ?, ?, 'posted', ?, ?)`,
    nextDocNumber('JV', 'journal_entries', { width: 4 }), date || today(), reference || null, memo, source, userId
  ).lastInsertRowid);
  for (const l of lines) {
    run(`INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, re_project_id, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, l.accountId, money(l.debit || 0), money(l.credit || 0), l.partnerId ?? null, l.projectId ?? null, l.memo || memo);
  }
  return id;
};

const projectOf = (code) => (code && code !== 'all' ? get('SELECT * FROM re_projects WHERE code = ?', code) : null);

const unitStatusLabels = { available: 'متاحة', reserved: 'محجوزة', sold: 'مباعة', rented: 'مؤجرة', blocked: 'موقوفة' };

/* ------------------------------------------------------------------ */
/*  meta / projects                                                    */
/* ------------------------------------------------------------------ */

reRouter.get('/re/meta', (req, res) => {
  const projects = all(`SELECT p.*, u.units, u.sold, u.available, u.reserved, u.rented
                          FROM re_projects p
                          LEFT JOIN (SELECT project_id, COUNT(*) units,
                                            SUM(status = 'sold') sold, SUM(status = 'available') available,
                                            SUM(status = 'reserved') reserved, SUM(status = 'rented') rented
                                       FROM re_units GROUP BY project_id) u ON u.project_id = p.id
                         ORDER BY p.id`);
  const accounts = all("SELECT id, code, name, type FROM accounts WHERE active = 1 ORDER BY code");
  const buildings = all('SELECT id, project_id, code, name FROM re_buildings ORDER BY project_id, code');
  res.json({ projects, accounts, buildings, accountsMap: accountMap() });
});

reRouter.get('/re/projects', (req, res) => {
  const rows = all(`SELECT p.*,
         (SELECT COUNT(*) FROM re_units WHERE project_id = p.id) AS units,
         (SELECT COUNT(*) FROM re_units WHERE project_id = p.id AND status = 'sold') AS sold,
         (SELECT COUNT(*) FROM re_units WHERE project_id = p.id AND status = 'available') AS available,
         (SELECT COUNT(*) FROM re_units WHERE project_id = p.id AND status = 'reserved') AS reserved,
         (SELECT COUNT(*) FROM re_units WHERE project_id = p.id AND status = 'rented') AS rented,
         (SELECT COALESCE(SUM(price), 0) FROM re_units WHERE project_id = p.id AND status = 'sold') AS sold_value,
         (SELECT COALESCE(SUM(price), 0) FROM re_units WHERE project_id = p.id AND status = 'available') AS available_value,
         (SELECT COUNT(*) FROM re_contracts WHERE project_id = p.id AND status = 'active') AS active_contracts,
         (SELECT COALESCE(SUM(amount), 0) FROM re_installments i JOIN re_contracts c ON c.id = i.contract_id
            WHERE c.project_id = p.id AND i.status = 'overdue') AS overdue_amount,
         (SELECT COALESCE(SUM(amount), 0) FROM re_collections rc JOIN re_contracts c ON c.id = rc.contract_id
            WHERE c.project_id = p.id) AS collected
       FROM re_projects p ORDER BY p.id`);
  res.json({ items: rows });
});

const AMENITIES = [
  { code: 'PARK', name: 'الحديقة المركزية', kind: 'green', x: 1215, y: 120, w: 265, h: 290 },
  { code: 'POOL', name: 'المسبح والنادي', kind: 'water', x: 1215, y: 435, w: 265, h: 165 },
  { code: 'MOSQ', name: 'المسجد', kind: 'building', x: 1215, y: 630, w: 120, h: 115 },
  { code: 'MALL', name: 'المركز التجاري', kind: 'retail', x: 1360, y: 630, w: 120, h: 115 },
  { code: 'PARK2', name: 'ملاعب ومساحات خضراء', kind: 'green', x: 90, y: 845, w: 1080, h: 38 },
];

reRouter.get('/re/projects/:code/plan', (req, res) => {
  const project = projectOf(req.params.code);
  if (!project) throw new HttpError(404, 'المشروع غير موجود');
  const buildings = all(
    `SELECT b.*, s.total, s.sold, s.available, s.reserved, s.rented, s.value, s.area
       FROM re_buildings b
       LEFT JOIN (SELECT building_id, COUNT(*) total, SUM(status = 'sold') sold, SUM(status = 'available') available,
                         SUM(status = 'reserved') reserved, SUM(status = 'rented') rented, SUM(price) value, SUM(area) area
                    FROM re_units GROUP BY building_id) s ON s.building_id = b.id
      WHERE b.project_id = ? ORDER BY b.code`, project.id);
  const units = all(
    `SELECT id, code, building_id, floor, unit_no, unit_type, area, price, status, bedrooms, view
       FROM re_units WHERE project_id = ? ORDER BY building_id, floor, unit_no`, project.id);
  const stats = get(
    `SELECT COUNT(*) total, SUM(status = 'sold') sold, SUM(status = 'available') available,
            SUM(status = 'reserved') reserved, SUM(status = 'rented') rented,
            COALESCE(SUM(price), 0) value, COALESCE(SUM(area), 0) area,
            COALESCE(SUM(CASE WHEN status = 'sold' THEN price ELSE 0 END), 0) sold_value,
            COALESCE(SUM(CASE WHEN status = 'available' THEN price ELSE 0 END), 0) available_value,
            COALESCE(SUM(CASE WHEN status = 'reserved' THEN price ELSE 0 END), 0) reserved_value
       FROM re_units WHERE project_id = ?`, project.id);
  res.json({
    project, buildings, units, stats,
    amenities: project.code === 'MC-A' ? AMENITIES : [],
    labels: unitStatusLabels,
  });
});

/* ------------------------------------------------------------------ */
/*  executive overview                                                 */
/* ------------------------------------------------------------------ */

reRouter.get('/re/overview', (req, res) => {
  const project = projectOf(req.query.project);
  const pid = project?.id || null;
  const uWhere = pid ? 'AND project_id = ?' : '';
  const up = pid ? [pid] : [];

  const units = get(
    `SELECT COUNT(*) total, SUM(status = 'sold') sold, SUM(status = 'available') available,
            SUM(status = 'reserved') reserved, SUM(status = 'rented') rented,
            COALESCE(SUM(price), 0) value,
            COALESCE(SUM(CASE WHEN status = 'sold' THEN price ELSE 0 END), 0) sold_value,
            COALESCE(SUM(CASE WHEN status = 'available' THEN price ELSE 0 END), 0) available_value,
            COALESCE(SUM(CASE WHEN status = 'reserved' THEN price ELSE 0 END), 0) reserved_value,
            COALESCE(SUM(CASE WHEN status = 'rented' THEN price ELSE 0 END), 0) rented_value,
            COALESCE(SUM(area), 0) area
       FROM re_units WHERE 1 = 1 ${uWhere}`, ...up);

  const contractWhere = pid ? 'AND c.project_id = ?' : '';
  const contracts = get(
    `SELECT COUNT(*) total, SUM(c.status = 'active') active, SUM(c.status = 'completed') completed,
            SUM(c.type = 'sale') sales, SUM(c.type = 'rent') rents,
            COALESCE(SUM(c.price), 0) value, COALESCE(SUM(c.down_payment), 0) down_payments
       FROM re_contracts c WHERE 1 = 1 ${contractWhere}`, ...up);

  const inst = get(
    `SELECT COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.paid_amount ELSE 0 END), 0) paid,
            COALESCE(SUM(CASE WHEN i.status <> 'paid' THEN i.amount - i.paid_amount ELSE 0 END), 0) outstanding,
            COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.amount - i.paid_amount ELSE 0 END), 0) overdue_amount,
            SUM(i.status = 'overdue') overdue_count,
            SUM(i.status = 'paid') paid_count
       FROM re_installments i JOIN re_contracts c ON c.id = i.contract_id WHERE 1 = 1 ${contractWhere}`, ...up);

  const collected = get(
    `SELECT COALESCE(SUM(rc.amount), 0) total FROM re_collections rc
       JOIN re_contracts c ON c.id = rc.contract_id WHERE 1 = 1 ${contractWhere}`, ...up).total;

  const thisMonth = get(
    `SELECT COALESCE(SUM(rc.amount), 0) total FROM re_collections rc
       JOIN re_contracts c ON c.id = rc.contract_id
      WHERE substr(rc.date, 1, 7) = substr(date('now'), 1, 7) ${contractWhere}`, ...up).total;

  // 12-month trend
  const months = monthKeys(12);
  const since = `${months[0]}-01`;
  const collRows = all(
    `SELECT substr(rc.date, 1, 7) k, COALESCE(SUM(rc.amount), 0) v, COUNT(*) c
       FROM re_collections rc JOIN re_contracts c ON c.id = rc.contract_id
      WHERE rc.date >= ? ${contractWhere} GROUP BY k`, since, ...up);
  const salesRows = all(
    `SELECT substr(date, 1, 7) k, COALESCE(SUM(price), 0) v, COUNT(*) c
       FROM re_contracts c WHERE date >= ? ${contractWhere} GROUP BY k`, since, ...up);
  const collMap = Object.fromEntries(collRows.map((r) => [r.k, r]));
  const salesMap = Object.fromEntries(salesRows.map((r) => [r.k, r]));
  const trend = months.map((m) => ({
    month: m,
    collected: collMap[m]?.v || 0,
    collections: collMap[m]?.c || 0,
    sales: salesMap[m]?.v || 0,
    contracts: salesMap[m]?.c || 0,
  }));

  const buildings = all(
    `SELECT b.code, b.name, b.units_count, s.total, s.sold, s.available, s.reserved, s.rented, s.value,
            pr.code project_code
       FROM re_buildings b JOIN re_projects pr ON pr.id = b.project_id
       LEFT JOIN (SELECT building_id, COUNT(*) total, SUM(status = 'sold') sold,
                         SUM(status = 'available') available, SUM(status = 'reserved') reserved,
                         SUM(status = 'rented') rented, SUM(price) value
                    FROM re_units GROUP BY building_id) s ON s.building_id = b.id
      ${pid ? 'WHERE b.project_id = ?' : ''} ORDER BY b.code`, ...(pid ? [pid] : []));

  const upcoming = all(
    `SELECT i.id, i.seq, i.due_date, i.amount, i.status, c.number contract_number, c.type,
            u.code unit_code, p.name partner_name, b.code building_code
       FROM re_installments i
       JOIN re_contracts c ON c.id = i.contract_id
       JOIN re_units u ON u.id = c.unit_id
       JOIN partners p ON p.id = c.partner_id
       LEFT JOIN re_buildings b ON b.id = u.building_id
      WHERE i.status <> 'paid' AND i.due_date BETWEEN date('now') AND date('now', '+45 day') ${contractWhere}
      ORDER BY i.due_date LIMIT 8`, ...up);

  const overdue = all(
    `SELECT i.id, i.seq, i.due_date, i.amount, i.paid_amount, c.number contract_number,
            u.code unit_code, p.name partner_name, p.phone, julianday('now') - julianday(i.due_date) days_late
       FROM re_installments i
       JOIN re_contracts c ON c.id = i.contract_id
       JOIN re_units u ON u.id = c.unit_id
       JOIN partners p ON p.id = c.partner_id
      WHERE i.status = 'overdue' ${contractWhere}
      ORDER BY i.due_date LIMIT 10`, ...up);

  const recent = all(
    `SELECT rc.id, rc.number, rc.date, rc.amount, rc.method, p.name partner_name, u.code unit_code, c.number contract_number
       FROM re_collections rc
       JOIN re_contracts c ON c.id = rc.contract_id
       JOIN re_units u ON u.id = rc.unit_id
       JOIN partners p ON p.id = rc.partner_id
      WHERE 1 = 1 ${contractWhere} ORDER BY rc.date DESC, rc.id DESC LIMIT 8`, ...up);

  const maintenance = get(
    `SELECT COUNT(*) total, SUM(status = 'new') new, SUM(status = 'in_progress') in_progress,
            SUM(status = 'done') done, SUM(status = 'new' AND priority IN ('high','urgent')) urgent
       FROM re_maintenance WHERE 1 = 1 ${pid ? 'AND project_id = ?' : ''}`, ...up);

  const topBuyers = all(
    `SELECT p.id, p.name, COUNT(c.id) contracts, COALESCE(SUM(c.price), 0) value,
            (SELECT COALESCE(SUM(rc.amount), 0) FROM re_collections rc WHERE rc.partner_id = p.id) collected
       FROM partners p JOIN re_contracts c ON c.partner_id = p.id
      WHERE p.type IN ('customer','investor') ${pid ? 'AND c.project_id = ?' : ''}
      GROUP BY p.id ORDER BY value DESC LIMIT 5`, ...up);

  const reservations = all(
    `SELECT u.id, u.code, u.reserved_until, u.price, b.code building_code, p.name agent
       FROM re_units u LEFT JOIN re_buildings b ON b.id = u.building_id
       LEFT JOIN re_contracts c ON c.unit_id = u.id AND c.status = 'active'
       LEFT JOIN partners p ON p.id = c.partner_id
      WHERE u.status = 'reserved' ${pid ? 'AND u.project_id = ?' : ''}
      ORDER BY u.reserved_until LIMIT 6`, ...up);

  const projects = all(
    `SELECT p.code, p.name, p.phase,
            (SELECT COUNT(*) FROM re_units WHERE project_id = p.id) units,
            (SELECT COUNT(*) FROM re_units WHERE project_id = p.id AND status = 'sold') sold,
            (SELECT COALESCE(SUM(price), 0) FROM re_units WHERE project_id = p.id AND status = 'sold') sold_value,
            (SELECT COALESCE(SUM(rc.amount), 0) FROM re_collections rc JOIN re_contracts c ON c.id = rc.contract_id WHERE c.project_id = p.id) collected,
            (SELECT COALESCE(SUM(amount), 0) FROM re_installments i JOIN re_contracts c ON c.id = i.contract_id WHERE c.project_id = p.id AND i.status = 'overdue') overdue
       FROM re_projects p ORDER BY p.id`);

  res.json({
    project: project || null,
    projects,
    kpis: {
      units: units.total || 0, sold: units.sold || 0, available: units.available || 0,
      reserved: units.reserved || 0, rented: units.rented || 0,
      value: units.value || 0, soldValue: units.sold_value || 0, availableValue: units.available_value || 0,
      reservedValue: units.reserved_value || 0, rentedValue: units.rented_value || 0,
      area: units.area || 0,
      occupancy: units.total ? Math.round(((units.sold + units.rented) / units.total) * 100) : 0,
      contracts: contracts.total || 0, activeContracts: contracts.active || 0,
      salesContracts: contracts.sales || 0, rentContracts: contracts.rents || 0,
      contractValue: contracts.value || 0, downPayments: contracts.down_payments || 0,
      collected, outstanding: inst.outstanding || 0, overdue: inst.overdue_amount || 0,
      overdueCount: inst.overdue_count || 0, paidCount: inst.paid_count || 0,
      collectionRate: contracts.value ? Math.round((collected / contracts.value) * 100) : 0,
      thisMonth,
    },
    trend,
    buildings,
    upcoming,
    overdue,
    recent,
    maintenance,
    topBuyers,
    reservations,
    labels: unitStatusLabels,
  });
});

/* ------------------------------------------------------------------ */
/*  units                                                              */
/* ------------------------------------------------------------------ */

reRouter.get('/re/units', (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  const project = projectOf(req.query.project);
  if (project) { where.push('u.project_id = ?'); params.push(project.id); }
  if (req.query.building) { where.push('b.code = ?'); params.push(req.query.building); }
  if (req.query.status) { where.push('u.status = ?'); params.push(req.query.status); }
  if (req.query.type) { where.push('u.unit_type = ?'); params.push(req.query.type); }
  if (req.query.q) {
    where.push('(u.code LIKE ? OR b.name LIKE ? OR u.view LIKE ?)');
    params.push(like(req.query.q), like(req.query.q), like(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const stats = get(
    `SELECT COUNT(*) total, SUM(u.status = 'sold') sold, SUM(u.status = 'available') available,
            SUM(u.status = 'reserved') reserved, SUM(u.status = 'rented') rented,
            COALESCE(SUM(u.price), 0) value, COALESCE(AVG(u.price), 0) avg_price,
            COALESCE(SUM(u.area), 0) area
       FROM re_units u LEFT JOIN re_buildings b ON b.id = u.building_id ${w}`, ...params);

  const items = all(
    `SELECT u.*, b.code building_code, b.name building_name, p.name owner_name, p.phone owner_phone,
            (SELECT COUNT(*) FROM re_contracts c WHERE c.unit_id = u.id AND c.status = 'active') active_contracts
       FROM re_units u LEFT JOIN re_buildings b ON b.id = u.building_id
       LEFT JOIN partners p ON p.id = u.owner_partner_id
       ${w} ORDER BY b.code, u.floor, u.unit_no LIMIT ? OFFSET ?`, ...params, pageSize, offset);

  const buildings = project
    ? all('SELECT code, name FROM re_buildings WHERE project_id = ? ORDER BY code', project.id)
    : all('SELECT DISTINCT b.code, b.name FROM re_buildings b ORDER BY b.code');

  res.json({ items, stats, buildings, page, pageSize, total: stats.total });
});

reRouter.get('/re/units/:id', (req, res) => {
  const unit = get(
    `SELECT u.*, b.code building_code, b.name building_name, b.floors, pr.code project_code, pr.name project_name, pr.phase,
            p.name owner_name, p.phone owner_phone, p.email owner_email, p.type owner_type, p.address owner_address
       FROM re_units u
       LEFT JOIN re_buildings b ON b.id = u.building_id
       LEFT JOIN re_projects pr ON pr.id = u.project_id
       LEFT JOIN partners p ON p.id = u.owner_partner_id
      WHERE u.id = ?`, req.params.id);
  if (!unit) throw new HttpError(404, 'الوحدة غير موجودة');

  const media = all('SELECT * FROM re_unit_media WHERE unit_id = ? ORDER BY sort, id', unit.id);
  const contract = get(
    `SELECT c.*, p.name partner_name, p.phone partner_phone, p.email partner_email
       FROM re_contracts c JOIN partners p ON p.id = c.partner_id
      WHERE c.unit_id = ? ORDER BY c.id DESC LIMIT 1`, unit.id);
  const installments = contract
    ? all('SELECT * FROM re_installments WHERE contract_id = ? ORDER BY seq', contract.id)
    : [];
  const collections = contract
    ? all('SELECT * FROM re_collections WHERE contract_id = ? ORDER BY date DESC, id DESC LIMIT 12', contract.id)
    : [];
  const services = all(
    `SELECT s.*, b.code building_code FROM re_services s LEFT JOIN re_buildings b ON b.id = s.building_id
      WHERE s.unit_id = ? ORDER BY s.id`, unit.id);
  const maintenance = all(
    `SELECT * FROM re_maintenance WHERE unit_id = ? ORDER BY reported_at DESC LIMIT 10`, unit.id);
  const journal = contract
    ? all(`SELECT je.id, je.number, je.date, je.memo, je.source, je.reference,
                  COALESCE(SUM(jl.debit), 0) debit, COALESCE(SUM(jl.credit), 0) credit,
                  GROUP_CONCAT(a.code || ' ' || a.name, ' | ') accounts
             FROM journal_entries je JOIN journal_lines jl ON jl.entry_id = je.id
             JOIN accounts a ON a.id = jl.account_id
            WHERE je.reference = ? OR je.reference LIKE ?
               OR je.id IN (SELECT journal_entry_id FROM re_collections WHERE contract_id = ? AND journal_entry_id IS NOT NULL)
            GROUP BY je.id ORDER BY je.date DESC LIMIT 12`, contract.number, `%${contract.number}%`, contract.id)
    : [];

  const paid = installments.reduce((s, i) => s + i.paid_amount, 0);
  const due = installments.filter((i) => i.status !== 'paid');
  const nextDue = due.find((i) => i.due_date >= today()) || due[0] || null;
  const overdue = due.filter((i) => i.due_date < today());

  const similar = all(
    `SELECT id, code, floor, area, price, status FROM re_units
      WHERE building_id = ? AND id <> ? ORDER BY status = 'available' DESC, price LIMIT 6`,
    unit.building_id, unit.id);

  res.json({
    unit, media, contract: contract || null, installments, collections, services, maintenance, journal, similar,
    finance: {
      paid, remaining: installments.reduce((s, i) => s + (i.amount - i.paid_amount), 0),
      overdueAmount: overdue.reduce((s, i) => s + (i.amount - i.paid_amount), 0),
      overdueCount: overdue.length, nextDue,
      progress: installments.length ? Math.round((paid / installments.reduce((s, i) => s + i.amount, 0)) * 100) : 0,
      pricePerMeter: unit.area ? Math.round(unit.price / unit.area) : 0,
      projectCollected: 0,
    },
    labels: unitStatusLabels,
  });
});

reRouter.patch('/re/units/:id', (req, res) => {
  const unit = get('SELECT * FROM re_units WHERE id = ?', req.params.id);
  if (!unit) throw new HttpError(404, 'الوحدة غير موجودة');
  const b = req.body || {};
  const sets = [];
  const params = [];
  for (const field of ['status', 'price', 'reserved_until', 'description', 'view', 'handover_date']) {
    if (b[field] !== undefined) { sets.push(`${field} = ?`); params.push(b[field]); }
  }
  if (b.status && !unitStatusLabels[b.status]) throw new HttpError(400, 'حالة الوحدة غير صحيحة');
  if (!sets.length) throw new HttpError(400, 'لا توجد بيانات للتحديث');
  run(`UPDATE re_units SET ${sets.join(', ')} WHERE id = ?`, ...params, unit.id);
  logActivity(req.user.id, 're_unit', unit.id, 'update', `حدّث بيانات الوحدة ${unit.code}`);
  res.json(get('SELECT * FROM re_units WHERE id = ?', unit.id));
});

reRouter.post('/re/units/:id/reserve', (req, res) => {
  const unit = get('SELECT * FROM re_units WHERE id = ?', req.params.id);
  if (!unit) throw new HttpError(404, 'الوحدة غير موجودة');
  if (unit.status !== 'available') throw new HttpError(400, 'لا يمكن حجز وحدة غير متاحة');
  const days = num(req.body?.days) || 7;
  const until = new Date();
  until.setDate(until.getDate() + days);
  run("UPDATE re_units SET status = 'reserved', reserved_until = ? WHERE id = ?", until.toISOString().slice(0, 10), unit.id);
  logActivity(req.user.id, 're_unit', unit.id, 'reserve', `حجز الوحدة ${unit.code} لمدة ${days} يوم`);
  res.json(get('SELECT * FROM re_units WHERE id = ?', unit.id));
});

/* ------------------------------------------------------------------ */
/*  contracts                                                          */
/* ------------------------------------------------------------------ */

reRouter.get('/re/contracts', (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  const project = projectOf(req.query.project);
  if (project) { where.push('c.project_id = ?'); params.push(project.id); }
  if (req.query.status) { where.push('c.status = ?'); params.push(req.query.status); }
  if (req.query.type) { where.push("c.type = ?"); params.push(req.query.type); }
  if (req.query.q) {
    where.push('(c.number LIKE ? OR p.name LIKE ? OR u.code LIKE ?)');
    params.push(like(req.query.q), like(req.query.q), like(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const stats = get(
    `SELECT COUNT(*) total, SUM(c.status = 'active') active, SUM(c.status = 'completed') completed,
            SUM(c.type = 'sale') sales, SUM(c.type = 'rent') rents,
            COALESCE(SUM(c.price), 0) value, COALESCE(SUM(c.down_payment), 0) down
       FROM re_contracts c JOIN partners p ON p.id = c.partner_id JOIN re_units u ON u.id = c.unit_id ${w}`, ...params);
  stats.collected = get(
    `SELECT COALESCE(SUM(rc.amount), 0) v FROM re_collections rc
       JOIN re_contracts c ON c.id = rc.contract_id
       JOIN partners p ON p.id = c.partner_id JOIN re_units u ON u.id = c.unit_id ${w}`, ...params).v;
  const items = all(
    `SELECT c.*, p.name partner_name, p.phone partner_phone, u.code unit_code, u.area unit_area,
            b.code building_code, pr.code project_code,
            (SELECT COUNT(*) FROM re_installments i WHERE i.contract_id = c.id) installments_total,
            (SELECT COUNT(*) FROM re_installments i WHERE i.contract_id = c.id AND i.status = 'paid') paid_count,
            (SELECT COALESCE(SUM(rc.amount), 0) FROM re_collections rc WHERE rc.contract_id = c.id) collected,
            (SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) FROM re_installments i WHERE i.contract_id = c.id AND i.status <> 'paid') outstanding
       FROM re_contracts c
       JOIN partners p ON p.id = c.partner_id
       JOIN re_units u ON u.id = c.unit_id
       LEFT JOIN re_buildings b ON b.id = u.building_id
       JOIN re_projects pr ON pr.id = c.project_id
       ${w} ORDER BY c.date DESC, c.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
  res.json({ items, stats, page, pageSize, total: stats.total });
});

reRouter.get('/re/contracts/:id', (req, res) => {
  const contract = get(
    `SELECT c.*, p.name partner_name, p.phone partner_phone, p.email partner_email,
            u.code unit_code, u.area unit_area, u.unit_type, b.code building_code,
            pr.name project_name, pr.code project_code
       FROM re_contracts c JOIN partners p ON p.id = c.partner_id
       JOIN re_units u ON u.id = c.unit_id
       LEFT JOIN re_buildings b ON b.id = u.building_id
       JOIN re_projects pr ON pr.id = c.project_id WHERE c.id = ?`, req.params.id);
  if (!contract) throw new HttpError(404, 'العقد غير موجود');
  const installments = all('SELECT * FROM re_installments WHERE contract_id = ? ORDER BY seq', contract.id);
  const collections = all('SELECT * FROM re_collections WHERE contract_id = ? ORDER BY date DESC, id DESC', contract.id);
  res.json({ contract, installments, collections });
});

reRouter.post('/re/contracts', (req, res) => {
  const b = req.body || {};
  const unit = get('SELECT * FROM re_units WHERE id = ?', b.unitId);
  if (!unit) throw new HttpError(400, 'يرجى اختيار الوحدة');
  if (unit.status === 'sold' || unit.status === 'rented') throw new HttpError(400, 'الوحدة مباعة أو مؤجرة مسبقاً');
  const partner = get('SELECT * FROM partners WHERE id = ?', b.partnerId);
  if (!partner) throw new HttpError(400, 'يرجى اختيار العميل');
  const type = b.type === 'rent' ? 'rent' : 'sale';
  const price = money(num(b.price) || unit.price);
  const count = Math.max(1, Math.min(120, num(b.installmentsCount) || (type === 'rent' ? 12 : 24)));
  const down = money(num(b.downPayment) ?? 0);
  if (down >= price) throw new HttpError(400, 'الدفعة الأولى يجب أن تكون أقل من قيمة العقد');
  const date = b.date || today();
  const startDate = b.startDate || date;
  const installmentAmount = money((price - down) / count);
  const map = accountMap(unit.project_id);

  return tx(() => {
    const number = nextDocNumber('C', 're_contracts', { width: 4 });
    const id = Number(run(
      `INSERT INTO re_contracts (number, project_id, building_id, unit_id, partner_id, type, date, price,
         down_payment, installments_count, installment_amount, start_date, end_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      number, unit.project_id, unit.building_id, unit.id, partner.id, type, date, price, down, count,
      installmentAmount, startDate, b.endDate || startDate, b.notes || null, req.user.id
    ).lastInsertRowid);

    const base = new Date(`${startDate}T12:00:00Z`);
    for (let i = 1; i <= count; i += 1) {
      const d = new Date(base);
      d.setUTCMonth(d.getUTCMonth() + (i - 1));
      run(
        `INSERT INTO re_installments (contract_id, seq, due_date, amount, paid_amount, status)
         VALUES (?, ?, ?, ?, 0, 'pending')`,
        id, i, d.toISOString().slice(0, 10), installmentAmount
      );
    }

    if (type === 'sale') {
      postEntry({
        date, reference: number, source: 'revenue', userId: req.user.id,
        memo: `إثبات إيراد بيع الوحدة ${unit.code} — عقد ${number}`,
        lines: [
          { accountId: accId(map.receivable), debit: price, partnerId: partner.id, projectId: unit.project_id, memo: 'ذمم عقود البيع' },
          { accountId: accId(map.revenue), credit: price, partnerId: partner.id, projectId: unit.project_id, memo: 'إيرادات بيع الوحدات' },
        ],
      });
      run("UPDATE re_units SET status = 'sold', owner_partner_id = ?, reserved_until = NULL WHERE id = ?", partner.id, unit.id);
    } else {
      run("UPDATE re_units SET status = 'rented', owner_partner_id = ?, reserved_until = NULL WHERE id = ?", partner.id, unit.id);
    }

    if (down > 0) {
      const accountId = accId(b.method === 'نقدي' ? map.cash : map.bank);
      const colId = Number(run(
        `INSERT INTO re_collections (number, contract_id, installment_id, unit_id, partner_id, date, amount, method, account_id, reference, received_by, notes)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'دفعة مقدمة عند توقيع العقد')`,
        nextDocNumber('RCV', 're_collections', { width: 5 }), id, unit.id, partner.id, date, down,
        b.method || 'تحويل بنكي', accountId, `DP-${number}`, req.user.id
      ).lastInsertRowid);
      const jeId = postEntry({
        date, reference: `DP-${number}`, source: 'collection', userId: req.user.id,
        memo: `دفعة مقدمة على العقد ${number}`,
        lines: [
          { accountId, debit: down, partnerId: partner.id, projectId: unit.project_id, memo: 'تحصيل دفعة مقدمة' },
          { accountId: accId(map.receivable), credit: down, partnerId: partner.id, projectId: unit.project_id, memo: 'إقفال ذمم' },
        ],
      });
      run('UPDATE re_collections SET journal_entry_id = ? WHERE id = ?', jeId, colId);
    }

    logActivity(req.user.id, 're_contract', id, 'create', `أنشأ عقد ${type === 'sale' ? 'بيع' : 'إيجار'} ${number} للوحدة ${unit.code}`);
    res.status(201).json({ id, number });
  });
});

/* ------------------------------------------------------------------ */
/*  installments & collections                                         */
/* ------------------------------------------------------------------ */

reRouter.get('/re/installments', (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  const project = projectOf(req.query.project);
  if (project) { where.push('c.project_id = ?'); params.push(project.id); }
  if (req.query.status === 'overdue') { where.push("i.status = 'overdue'"); }
  else if (req.query.status) { where.push('i.status = ?'); params.push(req.query.status); }
  if (req.query.month) { where.push('substr(i.due_date, 1, 7) = ?'); params.push(req.query.month); }
  if (req.query.q) {
    where.push('(p.name LIKE ? OR u.code LIKE ? OR c.number LIKE ?)');
    params.push(like(req.query.q), like(req.query.q), like(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `FROM re_installments i JOIN re_contracts c ON c.id = i.contract_id
                JOIN partners p ON p.id = c.partner_id JOIN re_units u ON u.id = c.unit_id
                JOIN re_projects pr ON pr.id = c.project_id
                LEFT JOIN re_buildings b ON b.id = u.building_id ${w}`;
  const stats = get(
    `SELECT COUNT(*) total, SUM(i.status = 'paid') paid, SUM(i.status = 'pending') pending,
            SUM(i.status = 'overdue') overdue, SUM(i.status = 'partial') partial,
            COALESCE(SUM(i.amount), 0) amount, COALESCE(SUM(i.paid_amount), 0) collected,
            COALESCE(SUM(CASE WHEN i.status <> 'paid' THEN i.amount - i.paid_amount ELSE 0 END), 0) remaining,
            COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.amount - i.paid_amount ELSE 0 END), 0) overdue_amount,
            COALESCE(SUM(CASE WHEN i.status <> 'paid' AND substr(i.due_date,1,7) = substr(date('now'),1,7) THEN i.amount - i.paid_amount ELSE 0 END), 0) due_this_month
       ${base}`, ...params);
  const items = all(
    `SELECT i.*, p.name partner_name, p.phone, u.code unit_code, b.code building_code,
            c.number contract_number, c.type contract_type, pr.code project_code
       ${base} ORDER BY CASE WHEN i.status = 'overdue' THEN 0 ELSE 1 END, i.due_date LIMIT ? OFFSET ?`,
    ...params, pageSize, offset);
  const months = all(
    `SELECT substr(i.due_date, 1, 7) month, COALESCE(SUM(i.amount), 0) amount,
            COALESCE(SUM(i.paid_amount), 0) collected, COUNT(*) count
       ${base} GROUP BY month ORDER BY month DESC LIMIT 12`, ...params);
  res.json({ items, stats, months, page, pageSize, total: stats.total });
});

reRouter.get('/re/collections', (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  const project = projectOf(req.query.project);
  if (project) { where.push('c.project_id = ?'); params.push(project.id); }
  if (req.query.method) { where.push('rc.method = ?'); params.push(req.query.method); }
  if (req.query.month) { where.push('substr(rc.date, 1, 7) = ?'); params.push(req.query.month); }
  if (req.query.q) {
    where.push('(p.name LIKE ? OR rc.number LIKE ? OR u.code LIKE ? OR rc.reference LIKE ?)');
    params.push(like(req.query.q), like(req.query.q), like(req.query.q), like(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `FROM re_collections rc JOIN partners p ON p.id = rc.partner_id
                JOIN re_units u ON u.id = rc.unit_id JOIN re_contracts c ON c.id = rc.contract_id ${w}`;
  const stats = get(
    `SELECT COUNT(*) total, COALESCE(SUM(rc.amount), 0) amount,
            COALESCE(SUM(CASE WHEN rc.date = date('now') THEN rc.amount ELSE 0 END), 0) today,
            COALESCE(SUM(CASE WHEN substr(rc.date,1,7) = substr(date('now'),1,7) THEN rc.amount ELSE 0 END), 0) this_month,
            COALESCE(AVG(rc.amount), 0) avg_amount
       ${base}`, ...params);
  const items = all(
    `SELECT rc.*, p.name partner_name, u.code unit_code, u.floor, b.code building_code,
            c.number contract_number, c.type
       FROM re_collections rc
       JOIN partners p ON p.id = rc.partner_id
       JOIN re_units u ON u.id = rc.unit_id
       JOIN re_contracts c ON c.id = rc.contract_id
       LEFT JOIN re_buildings b ON b.id = u.building_id
       ${w} ORDER BY rc.date DESC, rc.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
  const byMethod = all(
    `SELECT rc.method, COUNT(*) count, COALESCE(SUM(rc.amount), 0) amount
       ${base} GROUP BY rc.method ORDER BY amount DESC`, ...params);
  const monthly = all(
    `SELECT substr(rc.date,1,7) month, COALESCE(SUM(rc.amount),0) amount, COUNT(*) count
       ${base} GROUP BY month ORDER BY month DESC LIMIT 12`, ...params);
  res.json({ items, stats, byMethod, monthly, page, pageSize, total: stats.total });
});

reRouter.post('/re/collections', (req, res) => {
  const b = req.body || {};
  const installment = get('SELECT * FROM re_installments WHERE id = ?', b.installmentId);
  if (!installment) throw new HttpError(400, 'يرجى اختيار القسط');
  if (installment.status === 'paid') throw new HttpError(400, 'هذا القسط مسدد بالكامل');
  const contract = get('SELECT * FROM re_contracts WHERE id = ?', installment.contract_id);
  const unit = get('SELECT * FROM re_units WHERE id = ?', contract.unit_id);
  const remaining = money(installment.amount - installment.paid_amount);
  const amount = money(num(b.amount) || remaining);
  if (amount <= 0) throw new HttpError(400, 'المبلغ يجب أن يكون أكبر من صفر');
  if (amount > remaining + 0.01) throw new HttpError(400, 'المبلغ المدخل أكبر من المتبقي على القسط');
  const map = accountMap(contract.project_id);
  const method = b.method || 'نقدي';
  const accountId = accId(b.accountCode || (method === 'نقدي' ? map.cash : map.bank));
  const date = b.date || today();

  return tx(() => {
    const paid = money(installment.paid_amount + amount);
    const status = paid >= installment.amount - 0.01 ? 'paid' : 'partial';
    run("UPDATE re_installments SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?", paid, date, status, installment.id);
    const colId = Number(run(
      `INSERT INTO re_collections (number, contract_id, installment_id, unit_id, partner_id, date, amount, method, account_id, reference, received_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      nextDocNumber('RCV', 're_collections', { width: 5 }), contract.id, installment.id, contract.unit_id,
      contract.partner_id, date, amount, method, accountId, b.reference || null, req.user.id, b.notes || null
    ).lastInsertRowid);
    const jeId = postEntry({
      date, reference: `INS-${contract.number}-${installment.seq}`, source: 'collection', userId: req.user.id,
      memo: `تحصيل القسط ${installment.seq} من العقد ${contract.number} — الوحدة ${unit.code}`,
      lines: [
        { accountId, debit: amount, partnerId: contract.partner_id, projectId: contract.project_id, memo: `تحصيل ${method}` },
        { accountId: accId(map.receivable), credit: amount, partnerId: contract.partner_id, projectId: contract.project_id, memo: 'إقفال ذمم' },
      ],
    });
    run('UPDATE re_collections SET journal_entry_id = ? WHERE id = ?', jeId, colId);

    const left = get("SELECT COUNT(*) c FROM re_installments WHERE contract_id = ? AND status <> 'paid'", contract.id).c;
    if (!left) run("UPDATE re_contracts SET status = 'completed' WHERE id = ?", contract.id);
    logActivity(req.user.id, 're_collection', colId, 'payment', `تحصيل ${amount.toLocaleString('en-US')} د.ع للوحدة ${unit.code}`);
    res.status(201).json({
      id: colId, status, remaining: money(installment.amount - paid), journalEntryId: jeId,
      preview: [
        { account: get('SELECT name FROM accounts WHERE id = ?', accountId)?.name, debit: amount, credit: 0 },
        { account: get('SELECT name FROM accounts WHERE id = ?', accId(map.receivable))?.name, debit: 0, credit: amount },
      ],
    });
  });
});

/* ------------------------------------------------------------------ */
/*  services & maintenance                                             */
/* ------------------------------------------------------------------ */

reRouter.get('/re/services', (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  const project = projectOf(req.query.project);
  if (project) { where.push('s.project_id = ?'); params.push(project.id); }
  if (req.query.q) { where.push('(s.name LIKE ? OR s.provider LIKE ? OR u.code LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `FROM re_services s JOIN re_units u ON u.id = s.unit_id LEFT JOIN re_buildings b ON b.id = s.building_id ${w}`;
  const stats = get(
    `SELECT COUNT(*) total, SUM(s.status = 'active') active,
            COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.unit_id END) units,
            COALESCE(SUM(CASE WHEN s.status = 'active' THEN s.monthly_fee ELSE 0 END), 0) monthly
       FROM re_services s JOIN re_units u ON u.id = s.unit_id ${w}`, ...params);
  const items = all(
    `SELECT s.*, u.code unit_code, u.status unit_status, b.code building_code ${base}
      ORDER BY s.monthly_fee DESC, s.id LIMIT ? OFFSET ?`, ...params, pageSize, offset);
  const byName = all(
    `SELECT s.name, s.provider,
            COUNT(CASE WHEN s.status = 'active' THEN 1 END) units,
            COALESCE(SUM(CASE WHEN s.status = 'active' THEN s.monthly_fee ELSE 0 END), 0) monthly
       ${base} GROUP BY s.name ORDER BY monthly DESC`, ...params);
  res.json({ items, stats, byName, page, pageSize, total: stats.total });
});

reRouter.post('/re/services', (req, res) => {
  const b = req.body || {};
  const unit = get('SELECT * FROM re_units WHERE id = ?', b.unitId);
  if (!unit) throw new HttpError(400, 'يرجى اختيار الوحدة');
  if (!b.name) throw new HttpError(400, 'يرجى إدخال اسم الخدمة');
  const id = Number(run(
    `INSERT INTO re_services (project_id, building_id, unit_id, name, provider, monthly_fee, status, start_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    unit.project_id, unit.building_id, unit.id, b.name, b.provider || null, money(num(b.monthlyFee)), b.startDate || today(), b.notes || null
  ).lastInsertRowid);
  logActivity(req.user.id, 're_service', id, 'create', `أضاف خدمة ${b.name} للوحدة ${unit.code}`);
  res.status(201).json(get('SELECT * FROM re_services WHERE id = ?', id));
});

reRouter.patch('/re/services/:id', (req, res) => {
  const service = get('SELECT * FROM re_services WHERE id = ?', req.params.id);
  if (!service) throw new HttpError(404, 'الخدمة غير موجودة');
  const b = req.body || {};
  run('UPDATE re_services SET status = COALESCE(?, status), monthly_fee = COALESCE(?, monthly_fee) WHERE id = ?',
    b.status || null, b.monthlyFee ?? null, service.id);
  res.json(get('SELECT * FROM re_services WHERE id = ?', service.id));
});

reRouter.get('/re/maintenance', (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  const project = projectOf(req.query.project);
  if (project) { where.push('m.project_id = ?'); params.push(project.id); }
  if (req.query.status) { where.push('m.status = ?'); params.push(req.query.status); }
  if (req.query.priority) { where.push('m.priority = ?'); params.push(req.query.priority); }
  if (req.query.q) { where.push('(m.number LIKE ? OR m.description LIKE ? OR u.code LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `FROM re_maintenance m LEFT JOIN re_units u ON u.id = m.unit_id
                LEFT JOIN re_buildings b ON b.id = m.building_id ${w}`;
  const stats = get(
    `SELECT COUNT(*) total, SUM(m.status = 'new') new, SUM(m.status = 'in_progress') in_progress,
            SUM(m.status = 'done') done, SUM(m.status = 'cancelled') cancelled,
            COALESCE(SUM(m.cost), 0) cost, SUM(m.priority = 'urgent') urgent
       FROM re_maintenance m ${w}`, ...params);
  const items = all(
    `SELECT m.*, u.code unit_code, b.code building_code ${base}
      ORDER BY CASE m.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, m.reported_at DESC
      LIMIT ? OFFSET ?`, ...params, pageSize, offset);
  res.json({ items, stats, page, pageSize, total: stats.total });
});

reRouter.post('/re/maintenance', (req, res) => {
  const b = req.body || {};
  const unit = get('SELECT * FROM re_units WHERE id = ?', b.unitId);
  const projectId = unit?.project_id || projectOf(b.project)?.id;
  if (!projectId) throw new HttpError(400, 'يرجى اختيار الوحدة');
  if (!b.description) throw new HttpError(400, 'يرجى إدخال وصف المشكلة');
  const number = nextDocNumber('MR', 're_maintenance', { width: 4 });
  const id = Number(run(
    `INSERT INTO re_maintenance (number, project_id, building_id, unit_id, category, description, priority, status, cost, charged_to, technician, reported_at, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 0, ?, ?, ?, ?)`,
    number, projectId, unit?.building_id || null, unit?.id || null, b.category || 'عام', b.description,
    b.priority || 'normal', b.chargedTo || 'company', b.technician || null, today(), b.dueDate || null
  ).lastInsertRowid);
  logActivity(req.user.id, 're_maintenance', id, 'create', `أنشأ طلب صيانة ${number}`);
  res.status(201).json(get('SELECT * FROM re_maintenance WHERE id = ?', id));
});

reRouter.patch('/re/maintenance/:id', (req, res) => {
  const item = get('SELECT * FROM re_maintenance WHERE id = ?', req.params.id);
  if (!item) throw new HttpError(404, 'طلب الصيانة غير موجود');
  const b = req.body || {};
  return tx(() => {
    const cost = b.cost !== undefined ? money(num(b.cost)) : item.cost;
    run(`UPDATE re_maintenance SET status = COALESCE(?, status), cost = ?, technician = COALESCE(?, technician),
           closed_at = CASE WHEN ? = 'done' THEN ? ELSE closed_at END, notes = COALESCE(?, notes) WHERE id = ?`,
      b.status || null, cost, b.technician || null, b.status || '', today(), b.notes || null, item.id);
    if (b.status === 'done' && cost > 0 && !get("SELECT id FROM journal_entries WHERE reference = ?", `MR-${item.number}`)) {
      const map = accountMap(item.project_id);
      const jeId = postEntry({
        date: today(), reference: `MR-${item.number}`, source: 'expense', userId: req.user.id,
        memo: `تكلفة صيانة ${item.number}`,
        lines: [
          { accountId: accId(map.maintenanceExpense), debit: cost, projectId: item.project_id, memo: item.category },
          { accountId: accId(map.bank), credit: cost, projectId: item.project_id, memo: 'سداد صيانة' },
        ],
      });
      run('UPDATE re_maintenance SET notes = COALESCE(notes, ?) WHERE id = ?', `قيد محاسبي ${jeId}`, item.id);
    }
    logActivity(req.user.id, 're_maintenance', item.id, 'update', `حدّث طلب الصيانة ${item.number}`);
    res.json(get('SELECT * FROM re_maintenance WHERE id = ?', item.id));
  });
});

/* ------------------------------------------------------------------ */
/*  costs, treasury, reports, accounts mapping                         */
/* ------------------------------------------------------------------ */

reRouter.get('/re/costs', (req, res) => {
  const project = projectOf(req.query.project);
  const w = project ? 'WHERE rc.project_id = ?' : '';
  const params = project ? [project.id] : [];
  const items = all(
    `SELECT rc.*, p.name project_name, p.code project_code, b.code building_code
       FROM re_costs rc JOIN re_projects p ON p.id = rc.project_id
       LEFT JOIN re_buildings b ON b.id = rc.building_id ${w} ORDER BY rc.date DESC`, ...params);
  const byCategory = all(
    `SELECT rc.category, COALESCE(SUM(rc.amount), 0) amount, COUNT(*) count
       FROM re_costs rc ${w} GROUP BY rc.category ORDER BY amount DESC`, ...params);
  const stats = get(
    `SELECT COALESCE(SUM(rc.amount), 0) total, COUNT(*) count FROM re_costs rc ${w}`, ...params);
  res.json({ items, byCategory, stats });
});

reRouter.post('/re/costs', (req, res) => {
  const b = req.body || {};
  const project = projectOf(b.project) || get('SELECT * FROM re_projects WHERE id = ?', num(b.projectId));
  if (!project) throw new HttpError(400, 'يرجى اختيار المشروع');
  const amount = money(num(b.amount));
  if (amount <= 0) throw new HttpError(400, 'المبلغ غير صحيح');
  return tx(() => {
    const map = accountMap(project.id);
    const jeId = postEntry({
      date: b.date || today(), reference: `COST-${Date.now()}`, source: 'expense', userId: req.user.id,
      memo: `${b.category || 'تكلفة'} — ${project.name}`,
      lines: [
        { accountId: accId(map.costOfSales), debit: amount, projectId: project.id, memo: b.description || b.category },
        { accountId: accId(map.bank), credit: amount, projectId: project.id, memo: 'سداد تكلفة' },
      ],
    });
    const id = Number(run(
      `INSERT INTO re_costs (project_id, building_id, category, description, amount, date, vendor, journal_entry_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      project.id, num(b.buildingId) || null, b.category || 'عام', b.description || null, amount,
      b.date || today(), b.vendor || null, jeId
    ).lastInsertRowid);
    logActivity(req.user.id, 're_cost', id, 'create', `سجّل تكلفة ${amount.toLocaleString('en-US')} د.ع على ${project.code}`);
    res.status(201).json(get('SELECT * FROM re_costs WHERE id = ?', id));
  });
});

reRouter.get('/re/treasury', (req, res) => {
  const project = projectOf(req.query.project);
  const map = accountMap(project?.id);
  const codes = [...new Set([map.cash, map.bank])];
  const placeholders = codes.map(() => '?').join(', ');
  const projectJoin = project ? 'AND jl.re_project_id = ?' : '';
  const projectFilter = project ? 'AND jl.re_project_id = ?' : '';
  const projectParams = project ? [project.id] : [];

  const accounts = all(
    `SELECT a.id, a.code, a.name, a.type,
            COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.debit - jl.credit ELSE 0 END), 0) balance
       FROM accounts a
       LEFT JOIN journal_lines jl ON jl.account_id = a.id ${projectJoin}
       LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.status = 'posted'
      WHERE a.code IN (${placeholders}) GROUP BY a.id ORDER BY a.code`,
    ...projectParams, ...codes);
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const movements = all(
    `SELECT je.id, je.number, je.date, je.memo, je.reference,
            COALESCE(SUM(jl.debit), 0) inflow, COALESCE(SUM(jl.credit), 0) outflow
       FROM journal_entries je JOIN journal_lines jl ON jl.entry_id = je.id
       JOIN accounts a ON a.id = jl.account_id
      WHERE a.code IN (${placeholders}) AND je.status = 'posted' ${projectFilter}
      GROUP BY je.id ORDER BY je.date DESC, je.id DESC LIMIT 20`,
    ...codes, ...projectParams);

  const months = monthKeys(6);
  const monthly = months.map((month) => {
    const row = get(
      `SELECT COALESCE(SUM(jl.debit), 0) inflow, COALESCE(SUM(jl.credit), 0) outflow
         FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
         JOIN accounts a ON a.id = jl.account_id
        WHERE a.code IN (${placeholders}) AND je.status = 'posted'
          AND substr(je.date,1,7) = ? ${projectFilter}`,
      ...codes, month, ...projectParams);
    return { month, inflow: row.inflow, outflow: row.outflow };
  });
  res.json({ accounts, total, movements, monthly, project: project || null, map });
});

reRouter.get('/re/reports', (req, res) => {
  const project = projectOf(req.query.project);
  const pid = project?.id;
  const cw = pid ? 'AND c.project_id = ?' : '';
  const cp = pid ? [pid] : [];

  const months = monthKeys(12);
  const trend = months.map((m) => {
    const collected = get(
      `SELECT COALESCE(SUM(rc.amount), 0) v FROM re_collections rc JOIN re_contracts c ON c.id = rc.contract_id
        WHERE substr(rc.date,1,7) = ? ${cw}`, m, ...cp).v;
    const sales = get(
      `SELECT COALESCE(SUM(c.price), 0) v, COUNT(*) n FROM re_contracts c WHERE substr(c.date,1,7) = ? ${cw}`, m, ...cp);
    return { month: m, collected, sales: sales.v, contracts: sales.n };
  });

  const byProject = all(
    `SELECT p.code, p.name,
            (SELECT COUNT(*) FROM re_units u WHERE u.project_id = p.id) units,
            (SELECT COUNT(*) FROM re_units u WHERE u.project_id = p.id AND u.status = 'sold') sold,
            (SELECT COALESCE(SUM(u.price), 0) FROM re_units u WHERE u.project_id = p.id AND u.status = 'sold') sold_value,
            (SELECT COALESCE(SUM(c.price), 0) FROM re_contracts c WHERE c.project_id = p.id) contract_value,
            (SELECT COALESCE(SUM(rc.amount), 0) FROM re_collections rc JOIN re_contracts c ON c.id = rc.contract_id WHERE c.project_id = p.id) collected,
            (SELECT COALESCE(SUM(rco.amount), 0) FROM re_costs rco WHERE rco.project_id = p.id) cost,
            p.budget, p.spent
       FROM re_projects p ORDER BY p.id`);

  const byBuilding = all(
    `SELECT b.code, b.name, p.code project_code, COUNT(u.id) units,
            SUM(u.status = 'sold') sold, SUM(u.status = 'available') available,
            SUM(u.status = 'reserved') reserved, SUM(u.status = 'rented') rented,
            COALESCE(SUM(u.price), 0) value
       FROM re_buildings b LEFT JOIN re_units u ON u.building_id = b.id
       JOIN re_projects p ON p.id = b.project_id
      WHERE 1 = 1 ${pid ? 'AND b.project_id = ?' : ''}
      GROUP BY b.id ORDER BY b.code`, ...cp);

  const aging = [
    { label: 'مستحق الآن', min: -99999, max: 0 },
    { label: '1 - 30 يوم', min: 1, max: 30 },
    { label: '31 - 60 يوم', min: 31, max: 60 },
    { label: '61 - 90 يوم', min: 61, max: 90 },
    { label: 'أكثر من 90 يوم', min: 91, max: 99999 },
  ].map((b) => {
    const row = get(
      `SELECT COUNT(*) count, COALESCE(SUM(i.amount - i.paid_amount), 0) amount
         FROM re_installments i JOIN re_contracts c ON c.id = i.contract_id
        WHERE i.status <> 'paid' AND (julianday('now') - julianday(i.due_date)) BETWEEN ? AND ? ${cw}`,
      b.min, b.max, ...cp);
    return { ...b, count: row.count, amount: row.amount };
  });

  const topBuyers = all(
    `SELECT p.id, p.name, p.type, COUNT(c.id) contracts, COALESCE(SUM(c.price), 0) value,
            (SELECT COALESCE(SUM(rc.amount), 0) FROM re_collections rc WHERE rc.partner_id = p.id) collected
       FROM partners p JOIN re_contracts c ON c.partner_id = p.id
      WHERE 1 = 1 ${cw} GROUP BY p.id ORDER BY value DESC LIMIT 10`, ...cp);

  const unitMix = all(
    `SELECT unit_type, COUNT(*) count, COALESCE(SUM(price), 0) value,
            COALESCE(AVG(area), 0) avg_area FROM re_units ${pid ? 'WHERE project_id = ?' : ''}
      GROUP BY unit_type`, ...cp);

  const finance = get(
    `SELECT COALESCE(SUM(CASE WHEN a.type = 'income' THEN jl.credit - jl.debit ELSE 0 END), 0) revenue,
            COALESCE(SUM(CASE WHEN a.type = 'expense' THEN jl.debit - jl.credit ELSE 0 END), 0) expense
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
       JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted' AND je.date >= date('now','start of year')
        AND (a.type = 'income' OR a.type = 'expense') ${pid ? 'AND jl.re_project_id = ?' : ''}`, ...cp);

  res.json({ trend, byProject, byBuilding, aging, topBuyers, unitMix, finance, project: project || null });
});

reRouter.get('/re/partners', (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const project = projectOf(req.query.project);
  const where = ["p.type IN ('customer','investor','tenant')"];
  const params = [];
  if (req.query.type) { where.push('p.type = ?'); params.push(req.query.type); }
  if (req.query.q) { where.push('(p.name LIKE ? OR p.phone LIKE ?)'); params.push(like(req.query.q), like(req.query.q)); }
  if (project) {
    where.push('EXISTS (SELECT 1 FROM re_contracts pc WHERE pc.partner_id = p.id AND pc.project_id = ?)');
    params.push(project.id);
  }
  const w = `WHERE ${where.join(' AND ')}`;
  const stats = get(
    `SELECT COUNT(*) total, SUM(p.type = 'customer') buyers, SUM(p.type = 'investor') investors,
            SUM(p.type = 'tenant') tenants FROM partners p ${w}`, ...params);
  const scoped = project ? 'AND c.project_id = ?' : '';
  const collectedScoped = project ? 'AND c.project_id = ?' : '';
  const unitScoped = project ? 'AND u.project_id = ?' : '';
  const scopeParams = project ? [project.id] : [];
  const items = all(
    `SELECT p.*,
            (SELECT COUNT(*) FROM re_contracts c WHERE c.partner_id = p.id ${scoped}) contracts,
            (SELECT COALESCE(SUM(c.price), 0) FROM re_contracts c WHERE c.partner_id = p.id ${scoped}) contract_value,
            (SELECT COALESCE(SUM(rc.amount), 0) FROM re_collections rc
              JOIN re_contracts c ON c.id = rc.contract_id WHERE rc.partner_id = p.id ${collectedScoped}) collected,
            (SELECT COUNT(*) FROM re_units u WHERE u.owner_partner_id = p.id ${unitScoped}) units
       FROM partners p ${w} ORDER BY contract_value DESC, p.name LIMIT ? OFFSET ?`,
    ...scopeParams, ...scopeParams, ...scopeParams, ...scopeParams, ...params, pageSize, offset);
  res.json({ items, stats, page, pageSize, total: stats.total, project: project || null });
});

reRouter.get('/re/accounts', (req, res) => {
  const project = projectOf(req.query.project);
  const accounts = all('SELECT id, code, name, type FROM accounts WHERE active = 1 ORDER BY code');
  const maps = accountMaps();
  res.json({
    map: accountMap(project?.id),
    globalMap: maps.global,
    projectOverrides: project ? (maps.projects[project.code] || null) : null,
    project: project || null,
    accounts,
  });
});

reRouter.patch('/re/accounts', (req, res) => {
  const body = req.body || {};
  const projectCode = String(body.project || body.projectCode || 'all');
  const project = projectCode === 'all' ? null : projectOf(projectCode);
  if (projectCode !== 'all' && !project) throw new HttpError(400, 'المشروع المحدد غير موجود');

  const incoming = body.map && typeof body.map === 'object' ? body.map : body;
  const map = { ...accountMap(project?.id) };
  for (const key of Object.keys(DEFAULT_ACCOUNT_MAP)) {
    if (incoming[key] !== undefined && incoming[key] !== null && String(incoming[key]).trim()) {
      map[key] = String(incoming[key]).trim();
    }
  }
  for (const [key, code] of Object.entries(map)) {
    const account = get('SELECT id, type FROM accounts WHERE code = ? AND active = 1', String(code));
    if (!account) throw new HttpError(400, `الحساب ${code} المرتبط بـ ${key} غير موجود أو غير نشط`);
    if (account.type !== ACCOUNT_ROLE_TYPES[key]) {
      throw new HttpError(400, `يجب ربط ${key} بحساب من نوع ${ACCOUNT_ROLE_TYPES[key]}`);
    }
  }

  const maps = accountMaps();
  if (project) maps.projects[project.code] = map;
  else maps.global = map;
  run(`INSERT INTO settings (key, value) VALUES ('re_accounts', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`, JSON.stringify(maps));
  logActivity(req.user.id, 'settings', null, 'update', `حدّث ربط الحسابات العقارية ${project ? `للمشروع ${project.code}` : 'الافتراضي'}`);
  res.json({ map, project: project || null, globalMap: maps.global });
});
