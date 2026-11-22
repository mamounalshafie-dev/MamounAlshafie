import { Router } from 'express';
import { all, get, run, tx, logActivity } from '../db.js';
import { HttpError, iso, money, num } from '../util.js';

export const reCostControlRouter = Router();

const ACTIVE_DOC_STATUSES = ['submitted', 'approved', 'paid'];
const APPROVED_DOC_STATUSES = ['approved', 'paid'];
const dateValue = (value, fallback = iso()) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : fallback;
const projectByCode = (code) => get('SELECT * FROM re_projects WHERE code = ?', code);
const amountFor = (qty, rate) => money(num(qty) * num(rate));

function costProject(req) {
  const code = req.query.project;
  if (!code || code === 'all') return null;
  const project = projectByCode(code);
  if (!project) throw new HttpError(404, 'المشروع غير موجود');
  return project;
}

function validateLines(lines, projectId) {
  if (!Array.isArray(lines) || !lines.length) throw new HttpError(400, 'أضف بنداً واحداً على الأقل');
  return lines.map((line, index) => {
    const boqItem = get('SELECT * FROM re_boq_items WHERE id = ? AND project_id = ?', num(line.boqItemId), projectId);
    if (!boqItem) throw new HttpError(400, `بند جدول الكميات رقم ${index + 1} غير تابع للمشروع المختار`);
    const quantity = num(line.quantity, -1);
    const unitRate = line.unitRate === undefined || line.unitRate === '' ? boqItem.planned_rate : num(line.unitRate, -1);
    if (quantity <= 0) throw new HttpError(400, `الكمية في البند ${index + 1} يجب أن تكون أكبر من صفر`);
    if (unitRate < 0) throw new HttpError(400, `السعر في البند ${index + 1} غير صحيح`);
    return {
      boqItem,
      description: String(line.description || boqItem.description).trim().slice(0, 500),
      quantity: money(quantity),
      unitRate: money(unitRate),
      amount: amountFor(quantity, unitRate),
    };
  });
}

function writeLines(kind, documentId, lines) {
  const table = kind === 'invoice' ? 're_supplier_invoice_lines' : 're_payment_certificate_lines';
  const fk = kind === 'invoice' ? 'invoice_id' : 'certificate_id';
  for (const line of lines) {
    run(
      `INSERT INTO ${table} (${fk}, boq_item_id, description, quantity, unit_rate, amount) VALUES (?, ?, ?, ?, ?, ?)`,
      documentId, line.boqItem.id, line.description, line.quantity, line.unitRate, line.amount,
    );
  }
}

function documentLines(kind, documentId) {
  const table = kind === 'invoice' ? 're_supplier_invoice_lines' : 're_payment_certificate_lines';
  const fk = kind === 'invoice' ? 'invoice_id' : 'certificate_id';
  return all(
    `SELECT l.*, b.item_code, b.category, b.unit, b.planned_qty, b.planned_rate,
            b.description AS boq_description
       FROM ${table} l JOIN re_boq_items b ON b.id = l.boq_item_id
      WHERE l.${fk} = ? ORDER BY l.id`, documentId,
  );
}

function documentWarnings(kind, documentId) {
  const isInvoice = kind === 'invoice';
  const lineTable = isInvoice ? 're_supplier_invoice_lines' : 're_payment_certificate_lines';
  const headerTable = isInvoice ? 're_supplier_invoices' : 're_payment_certificates';
  const fk = isInvoice ? 'invoice_id' : 'certificate_id';
  const current = get(`SELECT * FROM ${headerTable} WHERE id = ?`, documentId);
  if (!current) throw new HttpError(404, 'المستند غير موجود');
  const lines = documentLines(kind, documentId);
  const warnings = [];
  for (const line of lines) {
    const cumulative = get(
      `SELECT COALESCE(SUM(l.quantity), 0) qty, COALESCE(SUM(l.amount), 0) amount
         FROM ${lineTable} l JOIN ${headerTable} h ON h.id = l.${fk}
        WHERE l.boq_item_id = ? AND h.project_id = ? AND h.status IN ('submitted', 'approved', 'paid')`,
      line.boq_item_id, current.project_id,
    );
    if (cumulative.qty > line.planned_qty + 0.0001) {
      warnings.push(`الكمية التراكمية للبند ${line.item_code} (${money(cumulative.qty)} ${line.unit}) تتجاوز كمية BOQ (${money(line.planned_qty)} ${line.unit})`);
    }
    const plannedAmount = amountFor(line.planned_qty, line.planned_rate);
    if (cumulative.amount > plannedAmount + 0.01) {
      warnings.push(`القيمة التراكمية للبند ${line.item_code} تتجاوز قيمة BOQ`);
    }
    if (line.planned_rate > 0 && Math.abs(line.unit_rate - line.planned_rate) / line.planned_rate > 0.05) {
      warnings.push(`سعر المستند للبند ${line.item_code} يختلف عن سعر BOQ بأكثر من 5%`);
    }
  }
  return [...new Set(warnings)];
}

function getDocument(kind, id) {
  const isInvoice = kind === 'invoice';
  const table = isInvoice ? 're_supplier_invoices' : 're_payment_certificates';
  const item = get(
    `SELECT d.*, p.code AS project_code, p.name AS project_name, u.name AS created_by_name,
            reviewer.name AS reviewed_by_name
       FROM ${table} d JOIN re_projects p ON p.id = d.project_id
       LEFT JOIN users u ON u.id = d.created_by
       LEFT JOIN users reviewer ON reviewer.id = d.reviewed_by
      WHERE d.id = ?`, id,
  );
  if (!item) return null;
  return { ...item, lines: documentLines(kind, id), warnings: documentWarnings(kind, id) };
}

function documentList(projectId, kind) {
  const isInvoice = kind === 'invoice';
  const table = isInvoice ? 're_supplier_invoices' : 're_payment_certificates';
  const projectWhere = projectId ? 'WHERE d.project_id = ?' : '';
  const params = projectId ? [projectId] : [];
  return all(
    `SELECT d.*, p.code AS project_code, p.name AS project_name,
            (SELECT COUNT(*) FROM ${isInvoice ? 're_supplier_invoice_lines' : 're_payment_certificate_lines'} l
              WHERE l.${isInvoice ? 'invoice_id' : 'certificate_id'} = d.id) AS line_count
       FROM ${table} d JOIN re_projects p ON p.id = d.project_id
       ${projectWhere} ORDER BY d.created_at DESC, d.id DESC LIMIT 100`, ...params,
  ).map((document) => ({
    ...document,
    warnings: document.status === 'submitted' ? documentWarnings(kind, document.id) : [],
  }));
}

function statusUpdate(kind, req, res) {
  const isInvoice = kind === 'invoice';
  const table = isInvoice ? 're_supplier_invoices' : 're_payment_certificates';
  const typeName = isInvoice ? 'فاتورة المورد' : 'المستخلص';
  const document = get(`SELECT * FROM ${table} WHERE id = ?`, req.params.id);
  if (!document) throw new HttpError(404, 'المستند غير موجود');
  const next = String(req.body?.status || '');
  const transitions = {
    draft: ['submitted'],
    submitted: ['approved', 'rejected'],
    approved: ['paid'],
    rejected: ['draft'],
    paid: [],
  };
  if (!transitions[document.status]?.includes(next)) throw new HttpError(400, 'انتقال الحالة غير مسموح');
  const reason = String(req.body?.reason || '').trim().slice(0, 1000);
  if (next === 'approved') {
    const warnings = documentWarnings(kind, document.id);
    if (warnings.length && reason.length < 8) {
      throw new HttpError(400, 'توجد فروقات رقابية؛ أدخل مبرراً لا يقل عن 8 أحرف قبل الاعتماد');
    }
  }
  if (next === 'rejected' && reason.length < 3) throw new HttpError(400, 'أدخل سبب رفض المستند');
  return tx(() => {
    run(
      `UPDATE ${table} SET status = ?,
         variance_reason = CASE WHEN ? = 'approved' AND ? <> '' THEN ? ELSE variance_reason END,
         rejection_reason = CASE WHEN ? = 'rejected' THEN ? ELSE rejection_reason END,
         reviewed_by = CASE WHEN ? IN ('approved', 'rejected') THEN ? ELSE reviewed_by END,
         reviewed_at = CASE WHEN ? IN ('approved', 'rejected') THEN ? ELSE reviewed_at END,
         paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END
       WHERE id = ?`,
      next, next, reason, reason, next, reason, next, req.user.id, next, iso(), next, iso(), document.id,
    );
    logActivity(req.user.id, `re_cost_control_${kind}`, document.id, next, `${typeName} ${document[isInvoice ? 'invoice_no' : 'certificate_no']}: ${next}`);
    res.json(getDocument(kind, document.id));
  });
}

reCostControlRouter.get('/re/cost-control', (req, res) => {
  const project = costProject(req);
  const where = project ? 'WHERE b.project_id = ?' : '';
  const params = project ? [project.id] : [];
  const items = all(
    `SELECT b.*, p.code AS project_code, p.name AS project_name,
            COALESCE((SELECT SUM(l.quantity) FROM re_supplier_invoice_lines l
              JOIN re_supplier_invoices d ON d.id = l.invoice_id
              WHERE l.boq_item_id = b.id AND d.status IN ('submitted', 'approved', 'paid')), 0) AS invoiced_qty,
            COALESCE((SELECT SUM(l.amount) FROM re_supplier_invoice_lines l
              JOIN re_supplier_invoices d ON d.id = l.invoice_id
              WHERE l.boq_item_id = b.id AND d.status IN ('submitted', 'approved', 'paid')), 0) AS invoiced_amount,
            COALESCE((SELECT SUM(l.amount) FROM re_supplier_invoice_lines l
              JOIN re_supplier_invoices d ON d.id = l.invoice_id
              WHERE l.boq_item_id = b.id AND d.status IN ('approved', 'paid')), 0) AS approved_invoice_amount,
            COALESCE((SELECT SUM(l.quantity) FROM re_payment_certificate_lines l
              JOIN re_payment_certificates d ON d.id = l.certificate_id
              WHERE l.boq_item_id = b.id AND d.status IN ('submitted', 'approved', 'paid')), 0) AS certified_qty,
            COALESCE((SELECT SUM(l.amount) FROM re_payment_certificate_lines l
              JOIN re_payment_certificates d ON d.id = l.certificate_id
              WHERE l.boq_item_id = b.id AND d.status IN ('submitted', 'approved', 'paid')), 0) AS certified_amount,
            COALESCE((SELECT SUM(l.amount) FROM re_payment_certificate_lines l
              JOIN re_payment_certificates d ON d.id = l.certificate_id
              WHERE l.boq_item_id = b.id AND d.status IN ('approved', 'paid')), 0) AS approved_certificate_amount
       FROM re_boq_items b JOIN re_projects p ON p.id = b.project_id
       ${where} ORDER BY p.code, b.item_code`, ...params,
  ).map((item) => {
    const plannedAmount = amountFor(item.planned_qty, item.planned_rate);
    const invoiceRate = item.invoiced_qty ? item.invoiced_amount / item.invoiced_qty : 0;
    const certificateRate = item.certified_qty ? item.certified_amount / item.certified_qty : 0;
    const flags = [];
    if (item.invoiced_qty > item.planned_qty + 0.0001) flags.push('تجاوز كمية الفواتير');
    if (item.certified_qty > item.planned_qty + 0.0001) flags.push('تجاوز كمية المستخلصات');
    if (item.approved_invoice_amount > plannedAmount + 0.01) flags.push('الفواتير المعتمدة تجاوزت قيمة BOQ');
    if (item.approved_certificate_amount > plannedAmount + 0.01) flags.push('المستخلصات المعتمدة تجاوزت قيمة BOQ');
    if (item.invoiced_qty && item.planned_rate > 0 && Math.abs(invoiceRate - item.planned_rate) / item.planned_rate > 0.05) flags.push('انحراف سعر التوريد أكبر من 5%');
    if (item.certified_qty && item.planned_rate > 0 && Math.abs(certificateRate - item.planned_rate) / item.planned_rate > 0.05) flags.push('انحراف سعر التنفيذ أكبر من 5%');
    return { ...item, planned_amount: plannedAmount, invoice_avg_rate: money(invoiceRate), certificate_avg_rate: money(certificateRate), flags };
  });
  const sum = (key) => money(items.reduce((total, item) => total + num(item[key]), 0));
  const invoices = documentList(project?.id || null, 'invoice');
  const certificates = documentList(project?.id || null, 'certificate');
  const summary = {
    boqItems: items.length,
    budget: sum('planned_amount'),
    invoiceExposure: sum('invoiced_amount'),
    approvedInvoices: sum('approved_invoice_amount'),
    certificateExposure: sum('certified_amount'),
    approvedCertificates: sum('approved_certificate_amount'),
    pendingInvoices: invoices.filter((item) => item.status === 'submitted').length,
    pendingCertificates: certificates.filter((item) => item.status === 'submitted').length,
    flaggedItems: items.filter((item) => item.flags.length).length,
    invoiceVariance: money(sum('approved_invoice_amount') - sum('planned_amount')),
    certificateVariance: money(sum('approved_certificate_amount') - sum('planned_amount')),
  };
  const projects = all('SELECT id, code, name, budget FROM re_projects ORDER BY code');
  res.json({ project: project ? { id: project.id, code: project.code, name: project.name, budget: project.budget } : null, projects, summary, items, invoices, certificates });
});

reCostControlRouter.post('/re/cost-control/boq', (req, res) => {
  const body = req.body || {};
  const project = projectByCode(String(body.project || ''));
  if (!project) throw new HttpError(400, 'اختر مشروعاً صحيحاً');
  const itemCode = String(body.itemCode || '').trim().slice(0, 40);
  const description = String(body.description || '').trim().slice(0, 500);
  const plannedQty = num(body.plannedQty, -1);
  const plannedRate = num(body.plannedRate, -1);
  if (!itemCode || !description) throw new HttpError(400, 'رمز البند ووصفه مطلوبان');
  if (plannedQty <= 0 || plannedRate < 0) throw new HttpError(400, 'الكمية يجب أن تكون موجبة والسعر لا يقل عن صفر');
  if (get('SELECT id FROM re_boq_items WHERE project_id = ? AND item_code = ?', project.id, itemCode)) throw new HttpError(400, 'رمز البند مستخدم في هذا المشروع');
  const buildingId = num(body.buildingId) || null;
  if (buildingId && !get('SELECT id FROM re_buildings WHERE id = ? AND project_id = ?', buildingId, project.id)) throw new HttpError(400, 'المبنى لا يتبع المشروع المختار');
  const id = Number(run(
    `INSERT INTO re_boq_items (project_id, building_id, item_code, category, description, unit, planned_qty, planned_rate, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    project.id, buildingId, itemCode, String(body.category || 'عام').slice(0, 80), description,
    String(body.unit || 'عدد').slice(0, 24), money(plannedQty), money(plannedRate), String(body.notes || '').slice(0, 1000) || null, req.user.id,
  ).lastInsertRowid);
  logActivity(req.user.id, 're_boq_item', id, 'create', `أضاف بند BOQ ${itemCode} إلى ${project.code}`);
  res.status(201).json(get('SELECT * FROM re_boq_items WHERE id = ?', id));
});

reCostControlRouter.patch('/re/cost-control/boq/:id', (req, res) => {
  const item = get('SELECT * FROM re_boq_items WHERE id = ?', req.params.id);
  if (!item) throw new HttpError(404, 'بند BOQ غير موجود');
  const hasDocuments = get(
    `SELECT (SELECT COUNT(*) FROM re_supplier_invoice_lines WHERE boq_item_id = ?) +
            (SELECT COUNT(*) FROM re_payment_certificate_lines WHERE boq_item_id = ?) AS count`, item.id, item.id,
  ).count;
  if (hasDocuments) throw new HttpError(409, 'تم استخدام البند في مستندات؛ لا يمكن تغيير خط الأساس. أضف بنداً جديداً للتغييرات المعتمدة');
  const b = req.body || {};
  const itemCode = String(b.itemCode ?? item.item_code).trim().slice(0, 40);
  const description = String(b.description ?? item.description).trim().slice(0, 500);
  const plannedQty = b.plannedQty === undefined ? item.planned_qty : num(b.plannedQty, -1);
  const plannedRate = b.plannedRate === undefined ? item.planned_rate : num(b.plannedRate, -1);
  if (!itemCode || !description || plannedQty <= 0 || plannedRate < 0) throw new HttpError(400, 'بيانات بند BOQ غير صحيحة');
  if (get('SELECT id FROM re_boq_items WHERE project_id = ? AND item_code = ? AND id <> ?', item.project_id, itemCode, item.id)) throw new HttpError(400, 'رمز البند مستخدم في هذا المشروع');
  run(
    `UPDATE re_boq_items SET item_code = ?, category = ?, description = ?, unit = ?, planned_qty = ?, planned_rate = ?, notes = ? WHERE id = ?`,
    itemCode, String(b.category ?? item.category).slice(0, 80), description, String(b.unit ?? item.unit).slice(0, 24),
    money(plannedQty), money(plannedRate), String(b.notes ?? item.notes ?? '').slice(0, 1000) || null, item.id,
  );
  logActivity(req.user.id, 're_boq_item', item.id, 'update', `عدّل بند BOQ ${itemCode}`);
  res.json(get('SELECT * FROM re_boq_items WHERE id = ?', item.id));
});

reCostControlRouter.delete('/re/cost-control/boq/:id', (req, res) => {
  const item = get('SELECT * FROM re_boq_items WHERE id = ?', req.params.id);
  if (!item) throw new HttpError(404, 'بند BOQ غير موجود');
  const linked = get(
    `SELECT (SELECT COUNT(*) FROM re_supplier_invoice_lines WHERE boq_item_id = ?) +
            (SELECT COUNT(*) FROM re_payment_certificate_lines WHERE boq_item_id = ?) AS count`, item.id, item.id,
  ).count;
  if (linked) throw new HttpError(409, 'لا يمكن حذف بند مرتبط بفواتير أو مستخلصات');
  run('DELETE FROM re_boq_items WHERE id = ?', item.id);
  logActivity(req.user.id, 're_boq_item', item.id, 'delete', `حذف بند BOQ ${item.item_code}`);
  res.json({ ok: true });
});

function createDocument(kind, req, res) {
  const isInvoice = kind === 'invoice';
  const headerTable = isInvoice ? 're_supplier_invoices' : 're_payment_certificates';
  const numberField = isInvoice ? 'invoiceNo' : 'certificateNo';
  const dbNumberField = isInvoice ? 'invoice_no' : 'certificate_no';
  const partyField = isInvoice ? 'supplier' : 'contractor';
  const number = String(req.body?.[numberField] || '').trim().slice(0, 80);
  const party = String(req.body?.[partyField] || '').trim().slice(0, 200);
  const project = projectByCode(String(req.body?.project || ''));
  if (!project) throw new HttpError(400, 'اختر مشروعاً صحيحاً');
  if (!number || !party) throw new HttpError(400, 'رقم المستند واسم المورد أو المقاول مطلوبان');
  if (get(`SELECT id FROM ${headerTable} WHERE project_id = ? AND ${dbNumberField} = ?`, project.id, number)) throw new HttpError(400, 'رقم المستند مستخدم في هذا المشروع');
  const lines = validateLines(req.body?.lines, project.id);
  const total = money(lines.reduce((sum, line) => sum + line.amount, 0));
  return tx(() => {
    const date = isInvoice ? dateValue(req.body?.invoiceDate) : dateValue(req.body?.certificateDate);
    const id = Number(run(
      isInvoice
        ? `INSERT INTO re_supplier_invoices (project_id, invoice_no, supplier, invoice_date, due_date, total_amount, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        : `INSERT INTO re_payment_certificates (project_id, certificate_no, contractor, certificate_date, period_from, period_to, total_amount, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...(isInvoice
        ? [project.id, number, party, date, req.body?.dueDate ? dateValue(req.body.dueDate) : null, total, String(req.body?.notes || '').slice(0, 1000) || null, req.user.id]
        : [project.id, number, party, date, req.body?.periodFrom ? dateValue(req.body.periodFrom) : null, req.body?.periodTo ? dateValue(req.body.periodTo) : null, total, String(req.body?.notes || '').slice(0, 1000) || null, req.user.id]),
    ).lastInsertRowid);
    writeLines(kind, id, lines);
    logActivity(req.user.id, `re_cost_control_${kind}`, id, 'create', `أنشأ ${isInvoice ? 'فاتورة مورد' : 'مستخلص'} ${number} بقيمة ${total.toLocaleString('en-US')} د.ع للمشروع ${project.code}`);
    res.status(201).json(getDocument(kind, id));
  });
}

reCostControlRouter.post('/re/cost-control/invoices', (req, res) => createDocument('invoice', req, res));
reCostControlRouter.post('/re/cost-control/certificates', (req, res) => createDocument('certificate', req, res));
reCostControlRouter.get('/re/cost-control/invoices/:id', (req, res) => {
  const document = getDocument('invoice', req.params.id);
  if (!document) throw new HttpError(404, 'فاتورة المورد غير موجودة');
  res.json(document);
});
reCostControlRouter.get('/re/cost-control/certificates/:id', (req, res) => {
  const document = getDocument('certificate', req.params.id);
  if (!document) throw new HttpError(404, 'المستخلص غير موجود');
  res.json(document);
});
reCostControlRouter.patch('/re/cost-control/invoices/:id/status', (req, res) => statusUpdate('invoice', req, res));
reCostControlRouter.patch('/re/cost-control/certificates/:id/status', (req, res) => statusUpdate('certificate', req, res));
