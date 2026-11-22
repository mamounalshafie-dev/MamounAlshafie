import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = path.join(DATA_DIR, 'noor.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  job_title TEXT,
  department TEXT,
  phone TEXT,
  avatar_color TEXT DEFAULT '#4f46e5',
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity TEXT,
  entity_id INTEGER,
  action TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  country TEXT DEFAULT 'العراق',
  tax_id TEXT,
  address TEXT,
  credit_limit REAL DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  rating INTEGER DEFAULT 4,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  uom TEXT DEFAULT 'قطعة',
  sale_price REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  reorder_level REAL DEFAULT 0,
  warehouse TEXT DEFAULT 'المستودع الرئيسي',
  taxable INTEGER DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  description TEXT
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_cost REAL DEFAULT 0,
  reference TEXT,
  note TEXT,
  date TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  customer_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'planning',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date TEXT,
  end_date TEXT,
  budget REAL DEFAULT 0,
  spent REAL DEFAULT 0,
  progress INTEGER DEFAULT 0,
  description TEXT,
  tags TEXT,
  health TEXT DEFAULT 'good',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date TEXT,
  due_date TEXT,
  estimated_hours REAL DEFAULT 0,
  spent_hours REAL DEFAULT 0,
  tags TEXT,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  description TEXT,
  billable INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL DEFAULT 15
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL DEFAULT 15
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'تحويل بنكي',
  reference TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  vendor_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  expected_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS po_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL DEFAULT 15
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  reference TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  source TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  re_project_id INTEGER REFERENCES re_projects(id) ON DELETE SET NULL,
  memo TEXT
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manager_id INTEGER,
  cost_center TEXT
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  hire_date TEXT,
  salary REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  manager_id INTEGER,
  national_id TEXT,
  birth_date TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'annual',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT DEFAULT 'present',
  UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS payslips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  basic REAL NOT NULL DEFAULT 0,
  allowances REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  net REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  date TEXT,
  UNIQUE (employee_id, period)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_id);
/* ------------------------------------------------------------------ */
/*  Real-estate suite (Modern Cities)                                  */
/* ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS re_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  district TEXT,
  phase TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT,
  end_date TEXT,
  land_area REAL DEFAULT 0,
  total_area REAL DEFAULT 0,
  buildings_count INTEGER DEFAULT 0,
  units_count INTEGER DEFAULT 0,
  budget REAL DEFAULT 0,
  spent REAL DEFAULT 0,
  description TEXT,
  cover TEXT,
  map_width REAL DEFAULT 1600,
  map_height REAL DEFAULT 900,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS re_buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES re_projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT,
  floors INTEGER DEFAULT 6,
  units_count INTEGER DEFAULT 0,
  area REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  map_x REAL DEFAULT 0,
  map_y REAL DEFAULT 0,
  map_w REAL DEFAULT 120,
  map_h REAL DEFAULT 90,
  rotation REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS re_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES re_projects(id) ON DELETE CASCADE,
  building_id INTEGER REFERENCES re_buildings(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  floor INTEGER DEFAULT 1,
  unit_no TEXT,
  unit_type TEXT DEFAULT 'apartment',
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  area REAL DEFAULT 0,
  price REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  view TEXT,
  orientation TEXT,
  handover_date TEXT,
  reserved_until TEXT,
  owner_partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  features TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS re_unit_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES re_units(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'image',
  url TEXT NOT NULL,
  caption TEXT,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS re_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL REFERENCES re_projects(id) ON DELETE CASCADE,
  building_id INTEGER,
  unit_id INTEGER NOT NULL REFERENCES re_units(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'sale',
  date TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  down_payment REAL NOT NULL DEFAULT 0,
  installments_count INTEGER NOT NULL DEFAULT 0,
  installment_amount REAL NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS re_installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES re_contracts(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL DEFAULT 1,
  due_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS re_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  contract_id INTEGER REFERENCES re_contracts(id) ON DELETE SET NULL,
  installment_id INTEGER REFERENCES re_installments(id) ON DELETE SET NULL,
  unit_id INTEGER,
  partner_id INTEGER,
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'نقدي',
  account_id INTEGER,
  reference TEXT,
  received_by INTEGER,
  notes TEXT,
  journal_entry_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS re_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  building_id INTEGER,
  unit_id INTEGER,
  name TEXT NOT NULL,
  provider TEXT,
  monthly_fee REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  start_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS re_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  project_id INTEGER,
  building_id INTEGER,
  unit_id INTEGER,
  category TEXT,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'new',
  cost REAL DEFAULT 0,
  charged_to TEXT DEFAULT 'company',
  technician TEXT,
  reported_at TEXT,
  due_date TEXT,
  closed_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS re_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  building_id INTEGER,
  category TEXT,
  description TEXT,
  amount REAL DEFAULT 0,
  date TEXT,
  vendor TEXT,
  journal_entry_id INTEGER
);

CREATE TABLE IF NOT EXISTS re_boq_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES re_projects(id) ON DELETE CASCADE,
  building_id INTEGER REFERENCES re_buildings(id) ON DELETE SET NULL,
  item_code TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام',
  description TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'عدد',
  planned_qty REAL NOT NULL DEFAULT 0,
  planned_rate REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, item_code)
);

CREATE TABLE IF NOT EXISTS re_supplier_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES re_projects(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  supplier TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  total_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  variance_reason TEXT,
  rejection_reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS re_supplier_invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES re_supplier_invoices(id) ON DELETE CASCADE,
  boq_item_id INTEGER NOT NULL REFERENCES re_boq_items(id) ON DELETE RESTRICT,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit_rate REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS re_payment_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES re_projects(id) ON DELETE CASCADE,
  certificate_no TEXT NOT NULL,
  contractor TEXT NOT NULL,
  certificate_date TEXT NOT NULL,
  period_from TEXT,
  period_to TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  total_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  variance_reason TEXT,
  rejection_reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, certificate_no)
);

CREATE TABLE IF NOT EXISTS re_payment_certificate_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER NOT NULL REFERENCES re_payment_certificates(id) ON DELETE CASCADE,
  boq_item_id INTEGER NOT NULL REFERENCES re_boq_items(id) ON DELETE RESTRICT,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit_rate REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_re_units_project ON re_units(project_id, status);
CREATE INDEX IF NOT EXISTS idx_re_units_building ON re_units(building_id);
CREATE INDEX IF NOT EXISTS idx_re_installments_contract ON re_installments(contract_id);
CREATE INDEX IF NOT EXISTS idx_re_installments_due ON re_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_re_contracts_unit ON re_contracts(unit_id);
CREATE INDEX IF NOT EXISTS idx_re_collections_date ON re_collections(date);
CREATE INDEX IF NOT EXISTS idx_re_boq_project ON re_boq_items(project_id, item_code);
CREATE INDEX IF NOT EXISTS idx_re_invoice_project_status ON re_supplier_invoices(project_id, status, invoice_date);
CREATE INDEX IF NOT EXISTS idx_re_invoice_line_boq ON re_supplier_invoice_lines(boq_item_id);
CREATE INDEX IF NOT EXISTS idx_re_certificate_project_status ON re_payment_certificates(project_id, status, certificate_date);
CREATE INDEX IF NOT EXISTS idx_re_certificate_line_boq ON re_payment_certificate_lines(boq_item_id);

`;

db.exec(SCHEMA);

/* Migrate databases created before the real-estate journal dimension was added. */
const journalLineColumns = db.prepare('PRAGMA table_info(journal_lines)').all().map((column) => column.name);
if (!journalLineColumns.includes('re_project_id')) {
  db.exec('ALTER TABLE journal_lines ADD COLUMN re_project_id INTEGER REFERENCES re_projects(id) ON DELETE SET NULL');
}

/* ---------- helpers ---------- */
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export const tx = (fn) => {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

export const setting = (key, fallback = null) => {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
};

export const setSetting = (key, value) => {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value)
  );
};

export const logActivity = (userId, entity, entityId, action, message) => {
  run(
    'INSERT INTO activities (user_id, entity, entity_id, action, message) VALUES (?, ?, ?, ?, ?)',
    userId ?? null, entity ?? null, entityId ?? null, action ?? null, message ?? null
  );
};
