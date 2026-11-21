/* End-to-end API mutation tests against an isolated database. */
const BASE = process.env.API || 'http://127.0.0.1:4100';
let token = '';
let passed = 0; let failed = 0;

async function req(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-session-token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✖ ${name} ${extra ? '— ' + extra : ''}`); }
}

const run = async () => {
  console.log('\nAuth');
  const bad = await req('POST', '/auth/login', { email: 'admin@noor.iq', password: 'wrong' });
  check('reject wrong password', bad.status === 401);
  const login = await req('POST', '/auth/login', { email: 'admin@noor.iq', password: 'admin123' });
  token = login.data?.token;
  check('login as admin', login.status === 200 && !!token);
  const me = await req('GET', '/auth/me');
  check('session resolves user', me.data?.user?.role === 'admin');
  const unauth = await fetch(`${BASE}/api/projects`);
  check('reject unauthenticated requests', unauth.status === 401);

  console.log('\nMeta & dashboard');
  const meta = await req('GET', '/meta');
  check('meta lookups', meta.data?.customers?.length > 0 && meta.data?.products?.length > 0);
  const dash = await req('GET', '/dashboard');
  check('dashboard kpis', dash.data?.kpis?.projects?.total > 0);
  check('dashboard balanced-ish', Number.isFinite(dash.data?.kpis?.profitYtd));
  const search = await req('GET', '/search?q=' + encodeURIComponent('مشروع'));
  check('global search', Array.isArray(search.data?.results));

  console.log('\nProjects & tasks');
  const created = await req('POST', '/projects', {
    name: 'مشروع اختبار آلي', customerId: 1, managerId: 2, budget: 50000000,
    startDate: '2026-01-01', endDate: '2026-12-31', priority: 'high', stage: 'planning',
    description: 'مشروع للاختبار الآلي',
  });
  const projectId = created.data?.id;
  check('create project', created.status === 201 && !!projectId, JSON.stringify(created.data).slice(0, 120));
  const patched = await req('PATCH', `/projects/${projectId}`, { stage: 'in_progress', progress: 20 });
  check('patch project', patched.data?.stage === 'in_progress');

  const task = await req('POST', '/tasks', {
    projectId, title: 'مهمة اختبار', assigneeId: 6, stage: 'todo', priority: 'high',
    dueDate: '2026-12-01', estimatedHours: 12,
  });
  const taskId = task.data?.id;
  check('create task', task.status === 201 && !!taskId);
  const moved = await req('PATCH', `/tasks/${taskId}`, { stage: 'done' });
  check('move task to done', moved.data?.stage === 'done' && !!moved.data?.done_at);
  const detail = await req('GET', `/projects/${projectId}`);
  check('project progress recalculated', detail.data?.project?.progress === 100, String(detail.data?.project?.progress));

  const ts = await req('POST', '/timesheets', { projectId, taskId, hours: 3, date: '2026-11-20', description: 'اختبار' });
  check('log timesheet', ts.status === 201);
  const member = await req('POST', `/projects/${projectId}/members`, { userId: 8, role: 'مصمم' });
  check('add project member', member.status === 201);

  console.log('\nCRM & sales');
  const partner = await req('POST', '/partners', {
    type: 'customer', name: 'عميل اختبار آلي', city: 'بغداد', phone: '+964 700 000 0000', paymentTerms: 30,
  });
  const partnerId = partner.data?.id;
  check('create customer', partner.status === 201 && !!partnerId);

  const quote = await req('POST', '/quotations', {
    customerId: partnerId, lines: [
      { productId: 1, description: 'خادم', qty: 2, unitPrice: 1000000, taxRate: 15 },
      { productId: 18, description: 'استشارات', qty: 10, unitPrice: 250000, taxRate: 15 },
    ],
  });
  const quoteId = quote.data?.id;
  check('create quotation', quote.status === 201 && quote.data?.total === 5175000, String(quote.data?.total));

  const converted = await req('POST', `/quotations/${quoteId}/convert`);
  const invoiceId = converted.data?.id;
  check('convert quotation → invoice', converted.status === 201 && converted.data?.status === 'sent');
  check('invoice journal posted', (await req('GET', '/journal-entries?q=' + converted.data?.number)).data?.items?.length > 0);

  const pay = await req('POST', `/invoices/${invoiceId}/payments`, { amount: 2000000, method: 'تحويل بنكي' });
  check('record partial payment', pay.status === 201 && pay.data?.invoice?.status === 'partial');
  const overpay = await req('POST', `/invoices/${invoiceId}/payments`, { amount: 999999999 });
  check('reject overpayment', overpay.status === 400);
  const payRest = await req('POST', `/invoices/${invoiceId}/payments`, { amount: 3175000 });
  check('invoice paid in full', payRest.data?.invoice?.status === 'paid');

  const inv = await req('GET', `/invoices/${invoiceId}`);
  check('invoice detail with lines', inv.data?.lines?.length === 2 && inv.data?.payments?.length === 2);
  check('invoice returns customer', inv.data?.customer?.id === partnerId);

  const direct = await req('POST', '/invoices', {
    customerId: partnerId, status: 'sent',
    lines: [{ productId: 1, description: 'خدمة', qty: 1, unitPrice: 1000000, taxRate: 15 }],
  });
  check('create invoice directly', direct.status === 201 && direct.data?.total === 1150000);
  const settled = await req('PATCH', `/invoices/${direct.data.id}`, { status: 'paid' });
  check('settle invoice records payment', settled.data?.amount_paid === 1150000, JSON.stringify(settled.data).slice(0, 150));
  const settleDetail = await req('GET', `/invoices/${direct.data.id}`);
  check('settlement creates payment row', settleDetail.data?.payments?.length === 1);

  console.log('\nPurchases & inventory');
  const po = await req('POST', '/purchase-orders', {
    vendorId: 101, lines: [{ productId: 1, description: 'خادم', qty: 3, unitPrice: 7000000, taxRate: 15 }],
  });
  const poId = po.data?.id;
  check('create purchase order', po.status === 201);
  const before = (await req('GET', '/products/1')).data?.product?.stock_qty;
  const received = await req('PATCH', `/purchase-orders/${poId}`, { status: 'received' });
  check('receive PO', received.data?.status === 'received');
  const after = (await req('GET', '/products/1')).data?.product?.stock_qty;
  check('stock increased on receipt', after === before + 3, `${before} → ${after}`);

  const product = await req('POST', '/products', {
    sku: 'TEST-SKU-001', name: 'منتج اختبار', category: 'اختبار', salePrice: 500000, costPrice: 300000,
    stockQty: 10, reorderLevel: 2, uom: 'قطعة',
  });
  check('create product', product.status === 201);
  const dupSku = await req('POST', '/products', { sku: 'TEST-SKU-001', name: 'مكرر' });
  check('reject duplicate SKU', dupSku.status === 400);
  const move = await req('POST', '/stock-moves', { productId: product.data.id, type: 'out', qty: 4 });
  check('stock out move', move.status === 201 && move.data?.product?.stock_qty === 6);
  const tooMuch = await req('POST', '/stock-moves', { productId: product.data.id, type: 'out', qty: 999 });
  check('reject stock over-issue', tooMuch.status === 400);

  console.log('\nAccounting');
  const unbalanced = await req('POST', '/journal-entries', {
    memo: 'قيد غير متوازن', lines: [
      { accountId: 2, debit: 1000, credit: 0 }, { accountId: 13, debit: 0, credit: 500 },
    ],
  });
  check('reject unbalanced journal', unbalanced.status === 400);
  const je = await req('POST', '/journal-entries', {
    date: '2026-11-20', memo: 'قيد اختبار', reference: 'TEST',
    lines: [{ accountId: 2, debit: 1000000, credit: 0 }, { accountId: 3, debit: 0, credit: 1000000 }],
  });
  check('create balanced journal', je.status === 201);
  const tb = await req('GET', '/reports/trial-balance');
  check('trial balance balanced', tb.data?.balanced === true);
  const pl = await req('GET', '/reports/profit-loss');
  check('profit & loss totals', Number.isFinite(pl.data?.totals?.net));
  const bs = await req('GET', '/reports/balance-sheet');
  check('balance sheet balances',
    Math.abs(bs.data.totals.assets - bs.data.totals.liabilitiesAndEquity) < 1,
    JSON.stringify(bs.data.totals));
  const aging = await req('GET', '/reports/ar-aging');
  check('AR aging report', Array.isArray(aging.data?.summary));

  console.log('\nHR');
  const emp = await req('POST', '/employees', {
    name: 'موظف اختبار', departmentId: 5, jobTitle: 'مطور', salary: 3000000, allowances: 500000, hireDate: '2025-01-01',
  });
  check('create employee', emp.status === 201);
  const leave = await req('POST', '/leaves', { employeeId: emp.data.id, type: 'annual', startDate: '2026-12-01', endDate: '2026-12-05' });
  check('create leave request', leave.status === 201 && leave.data?.days === 5, String(leave.data?.days));
  const approved = await req('PATCH', `/leaves/${leave.data.id}`, { status: 'approved' });
  check('approve leave', approved.data?.status === 'approved');
  const period = '2027-03';
  const gen = await req('POST', '/payslips/generate', { period });
  check('generate payslips', gen.status === 200 && gen.data?.period === period && gen.data?.created >= 1, JSON.stringify(gen.data));
  const slips = await req('GET', `/payslips?period=${period}`);
  const testSlip = (slips.data?.rows || []).find((r) => r.employee_name === 'موظف اختبار');
  check('payslip amounts', testSlip?.net === 3350000, JSON.stringify(testSlip || slips.data?.rows?.[0]));

  console.log('\nAdmin & settings');
  const user = await req('POST', '/users', {
    name: 'مستخدم اختبار', email: 'tester@noor.iq', password: 'secret123', role: 'accountant',
  });
  check('create user', user.status === 201);
  const dupe = await req('POST', '/users', { name: 'x', email: 'tester@noor.iq', password: 'secret123' });
  check('reject duplicate email', dupe.status === 400);
  const settings = await req('PATCH', '/settings', { company: { phone: '+964 770 000 1111' } });
  check('update company settings', settings.data?.company?.phone === '+964 770 000 1111');
  const nav = await req('GET', '/nav-counts');
  check('nav counts', typeof nav.data?.counts?.projects === 'number');

  // clean-up (best effort)
  await req('DELETE', `/projects/${projectId}`);
  await req('DELETE', `/partners/${partnerId}`);
  await req('DELETE', `/products/${product.data.id}`);
  await req('DELETE', `/employees/${emp.data.id}`);
  await req('DELETE', `/users/${user.data.id}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
};

run().catch((e) => { console.error(e); process.exit(1); });
