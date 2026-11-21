/* Real-estate demo data for Modern Cities (runs inside the main seed transaction). */
import { get, run, all } from './db.js';
import { rng } from './util.js';

const rand = rng(770411);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => Math.round(a + rand() * (b - a));
const maybe = (p = 0.5) => rand() < p;

const day = (offset) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonths = (isoDate, months) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const targetDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(targetDay, last));
  return d.toISOString().slice(0, 10);
};
const money = (n) => Math.round(n);
const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const BUYER_NAMES = [
  'أحمد سامي العزاوي', 'محمد علي حسن', 'سارة عبد الرحمن', 'حسين كريم الجبوري', 'نور الدين الحسيني',
  'علي عبد الحسين', 'زينب محمود الشمري', 'مصطفى خليل الإبراهيمي', 'ليلى كاظم الساعدي', 'كرار فاضل الموسوي',
  'حيدر جواد العامري', 'أمير صباح التميمي', 'دنيا عادل القيسي', 'ريم هاني البياتي', 'يوسف ناصر الخفاجي',
  'عبد الله رعد الدليمي', 'فاطمة حسين الربيعي', 'مروان سعد الزبيدي', 'شهد وليد الجنابي', 'بشار قاسم العبيدي',
  'شركة الرافدين للاستثمار العقاري', 'مجموعة بابل القابضة', 'بنك بغداد للتمويل العقاري', 'شركة دجلة للتطوير',
  'صندوق الزيتون العقاري', 'شركة آشور للتجارة العامة', 'مؤسسة النخبة للاستثمار', 'شركة سومر القابضة',
  'مصرف النهرين - إدارة الأصول', 'شركة أور للاستثمار',
];

const TENANT_NAMES = [
  'عمر خالد السامرائي', 'هدى إبراهيم النعيمي', 'سلام ماجد الحلي', 'طيبة وليد الأزيرجاوي',
  'رياض عبد الأمير', 'غادة نبيل الكناني', 'سيف الدين عبد الستار', 'منى صلاح الشويلي',
  'شركة ميزوبوتاميا للخدمات', 'معهد بغداد التقني', 'شركة الفرات لتقنية المعلومات', 'مكتب الهدى للمحاماة',
];

const SERVICES = [
  ['إنترنت ألياف بصرية', 'شركة ميزوبوتاميا', 45000],
  ['كهرباء احتياطية (مولدة)', 'المدن الحديثة - الطاقة', 120000],
  ['ماء شرب وتصفية', 'هيئة ماء بغداد', 25000],
  ['صيانة دورية للمبنى', 'إدارة المرافق - المدن الحديثة', 75000],
  ['أمن ومراقبة', 'شركة الحراسة العراقية', 60000],
  ['تنظيف وإدارة نفايات', 'المدن الحديثة - النظافة', 30000],
];

const MAINTENANCE_ITEMS = [
  ['سباكة', 'تسرب ماء في دورة المياه الرئيسية'],
  ['كهرباء', 'انقطاع التيار في غرفة النوم الثانية'],
  ['تكييف', 'ضعف التبريد في وحدة التكييف بالصالة'],
  ['نجارة', 'صيانة باب الشقة الأمامي'],
  ['مصعد', 'صوت غير طبيعي في مصعد المبنى'],
  ['دهان', 'تقشير دهان في واجهة الشقة'],
];

export function seedRealEstate() {
  const now = new Date();
  const year = now.getFullYear();
  const todayStr = day(0);

  const acc = (code) => get('SELECT id FROM accounts WHERE code = ?', code)?.id;
  const accAR = acc('1300');
  const accBank = acc('1200');
  const accCash = acc('1100');
  const accRevenue = acc('4200') || acc('4100');
  const accExpense = acc('5300');
  const accPayable = acc('2100');

  let jvSeq = all("SELECT number FROM journal_entries WHERE number LIKE ?", `JV-${year}-%`)
    .reduce((m, r) => Math.max(m, parseInt(String(r.number).split('-').pop(), 10) || 0), 0);
  const nextJV = () => `JV-${year}-${String(++jvSeq).padStart(4, '0')}`;

  const postJournal = ({ number, date, reference, memo, lines, source = 'manual', userId = 4 }) => {
    const id = Number(run(
      `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
       VALUES (?, ?, ?, ?, 'posted', ?, ?)`,
      number, date, reference, memo, source, userId
    ).lastInsertRowid);
    for (const l of lines) {
      run(`INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, re_project_id, memo)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id, l.accountId, l.debit || 0, l.credit || 0, l.partnerId ?? null, l.projectId ?? null, l.memo || memo);
    }
    return id;
  };

  /* ---------------- partners (buyers / investors / tenants) ---------------- */
  const buyerIds = [];
  BUYER_NAMES.forEach((name, i) => {
    const isCompany = name.includes('شركة') || name.includes('مصرف') || name.includes('مجموعة') || name.includes('صندوق') || name.includes('مؤسسة');
    const id = Number(run(
      `INSERT INTO partners (type, name, contact_name, email, phone, city, country, tax_id, address, credit_limit, payment_terms, rating, active, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'العراق', ?, ?, 0, 30, ?, 1, ?)`,
      i < BUYER_NAMES.length - 4 ? 'customer' : 'investor',
      name,
      isCompany ? 'إدارة العقارات' : name,
      `buyer${i + 1}@moderncities.iq`,
      `+964 7${between(70, 91)} ${between(100, 999)} ${between(1000, 9999)}`,
      pick(['بغداد', 'بغداد', 'بغداد', 'أربيل', 'البصرة', 'النجف']),
      `IQ-TAX-${between(10000, 99999)}`,
      pick(['زيونة', 'المنصور', 'الكرادة', 'الجادرية', 'الحارثية', 'اليرموك']),
      between(3, 5),
      isCompany ? 'مستثمر مؤسسي - شراء وحدات متعددة' : `رقم الهوية الوطنية ${between(19000000, 20000000)}`
    ).lastInsertRowid);
    buyerIds.push(id);
  });

  const tenantIds = [];
  TENANT_NAMES.forEach((name, i) => {
    const id = Number(run(
      `INSERT INTO partners (type, name, contact_name, email, phone, city, country, tax_id, address, credit_limit, payment_terms, rating, active, notes)
       VALUES ('tenant', ?, ?, ?, ?, 'بغداد', 'العراق', ?, ?, 0, 30, ?, 1, 'مستأجر وحدات سكنية/تجارية')`,
      name, name, `tenant${i + 1}@moderncities.iq`,
      `+964 7${between(70, 91)} ${between(100, 999)} ${between(1000, 9999)}`,
      `IQ-TAX-${between(10000, 99999)}`,
      pick(['زيونة', 'الكرادة', 'المنصور']), between(3, 5)
    ).lastInsertRowid);
    tenantIds.push(id);
  });

  /* ---------------- projects ---------------- */
  const PROJECTS = [
    {
      code: 'MC-A', name: 'المدن الحديثة — المرحلة الأولى', phase: 'المرحلة A',
      district: 'بغداد - زيونة', buildings: 16, perBuilding: 53, type: 'apartment',
      land: 126000, budget: 92_000_000_000, start: -900, end: 320,
      desc: 'مجمع سكني متكامل يضم 16 مبنى سكنياً و848 وحدة بمساحات متنوعة، مع حدائق ومسابح ومركز خدمات ومسجد.',
      sold: 320, reserved: 98, rented: 150,
    },
    {
      code: 'MC-B', name: 'المدن الحديثة — المرحلة الثانية', phase: 'المرحلة B',
      district: 'بغداد - زيونة', buildings: 8, perBuilding: 40, type: 'apartment',
      land: 62000, budget: 41_000_000_000, start: -420, end: 640,
      desc: 'المرحلة الثانية من المشروع، 8 مبانٍ و320 وحدة سكنية بإطلالات على الحديقة المركزية، تسليم متدرج.',
      sold: 120, reserved: 40, rented: 20,
    },
    {
      code: 'MC-C', name: 'مجمع المدن التجاري', phase: 'المرحلة C',
      district: 'بغداد - المنصور', buildings: 4, perBuilding: 30, type: 'commercial',
      land: 18000, budget: 26_000_000_000, start: -240, end: 480,
      desc: 'مجمع تجاري يضم 120 وحدة بين محلات تجارية ومكاتب إدارية على شارع رئيسي، مناسب للاستثمار والتأجير.',
      sold: 40, reserved: 10, rented: 10,
    },
  ];

  const UNIT_IMAGES = [
    ['/media/unit-exterior.jpg', 'المبنى من الخارج'],
    ['/media/unit-living.jpg', 'الصالة الرئيسية'],
    ['/media/unit-kitchen.jpg', 'المطبخ'],
    ['/media/unit-bedroom.jpg', 'غرفة النوم الرئيسية'],
  ];

  const projects = [];
  for (const p of PROJECTS) {
    const projectId = Number(run(
      `INSERT INTO re_projects (code, name, city, district, phase, status, start_date, end_date,
         land_area, total_area, buildings_count, units_count, budget, spent, description, cover, map_width, map_height)
       VALUES (?, ?, 'بغداد', ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, '/media/unit-exterior.jpg', 1600, 900)`,
      p.code, p.name, p.district, p.phase, day(p.start), day(p.end),
      p.land, p.land * 0.42, p.buildings, p.buildings * p.perBuilding, p.budget, Math.round(p.budget * between(38, 72) / 100), p.desc
    ).lastInsertRowid);

    const cols = p.buildings === 16 ? 4 : p.buildings === 8 ? 4 : 2;
    const rows = Math.ceil(p.buildings / cols);
    const cellW = 300;
    const cellH = 195;
    const originX = 90;
    const originY = 120;

    const buildings = [];
    for (let b = 0; b < p.buildings; b += 1) {
      const code = String.fromCharCode(65 + b);
      const col = b % cols;
      const row = Math.floor(b / cols);
      const w = p.type === 'commercial' ? 210 : 168;
      const h = p.type === 'commercial' ? 150 : 128;
      const x = originX + col * cellW + (p.type === 'commercial' ? 30 : 0);
      const y = originY + row * cellH;
      const area = p.type === 'commercial' ? between(2200, 3400) : between(5200, 6800);
      const buildingId = Number(run(
        `INSERT INTO re_buildings (project_id, code, name, floors, units_count, area, status, map_x, map_y, map_w, map_h)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        projectId, code, `مبنى ${code}`, p.type === 'commercial' ? 4 : 6, p.perBuilding, area, x, y, w, h
      ).lastInsertRowid);
      buildings.push({ id: buildingId, code, x, y, w, h, perBuilding: p.perBuilding });
    }

    // Units
    const units = [];
    for (const b of buildings) {
      const floors = p.type === 'commercial' ? 4 : 6;
      let counter = 0;
      for (let f = 1; f <= floors; f += 1) {
        const perFloor = Math.ceil(p.perBuilding / floors);
        for (let i = 1; i <= perFloor && counter < p.perBuilding; i += 1) {
          counter += 1;
          const unitNo = `${f}${String(i).length === 1 ? `0${i}` : i}`;
          const code = `${b.code}-${unitNo}`;
          let unitType = p.type === 'commercial'
            ? (f === 1 ? 'shop' : 'office')
            : (f === 1 && i === 1 ? 'duplex' : between(0, 9) > 6 ? 'apartment' : 'apartment');
          const area = unitType === 'shop' ? between(60, 140)
            : unitType === 'office' ? between(80, 160)
              : pick([95, 105, 112, 120, 128, 135, 145, 155, 168]);
          const ppm = unitType === 'shop' ? between(3200000, 5200000)
            : unitType === 'office' ? between(2200000, 3400000)
              : between(1050000, 1350000);
          const price = Math.round((area * ppm) / 1_000_000) * 1_000_000;
          const bedrooms = unitType === 'shop' || unitType === 'office' ? 0 : pick([2, 2, 3, 3, 3, 4]);
          const bathrooms = bedrooms === 0 ? 1 : Math.max(2, Math.min(3, bedrooms - 1));
          units.push({
            buildingId: b.id, code, floor: f, unitNo, unitType, area, price, bedrooms, bathrooms,
            view: pick(['الحديقة المركزية', 'الشارع الرئيسي', 'المسبح', 'الساحة الداخلية', 'الحديقة المركزية']),
            orientation: pick(['شمالي شرقي', 'جنوبي غربي', 'شمالي غربي', 'جنوبي شرقي']),
            id: null,
          });
        }
      }
    }

    const shuffled = shuffle(units);
    const soldSet = new Set(shuffled.slice(0, Math.min(p.sold, units.length)).map((u) => u.code));
    const reservedSet = new Set(shuffled.slice(p.sold, p.sold + p.reserved).map((u) => u.code));
    const rentedSet = new Set(shuffled.slice(p.sold + p.reserved, p.sold + p.reserved + p.rented).map((u) => u.code));

    const handoverBase = day(p.end);
    for (const u of units) {
      const status = soldSet.has(u.code) ? 'sold'
        : reservedSet.has(u.code) ? 'reserved'
          : rentedSet.has(u.code) ? 'rented' : 'available';
      const owner = status === 'sold' ? pick(buyerIds.slice(0, 24)) : status === 'rented' ? pick(tenantIds) : null;
      const id = Number(run(
        `INSERT INTO re_units (project_id, building_id, code, floor, unit_no, unit_type, bedrooms, bathrooms,
           area, price, status, view, orientation, handover_date, reserved_until, owner_partner_id, features, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        projectId, u.buildingId, u.code, u.floor, u.unitNo, u.unitType, u.bedrooms, u.bathrooms,
        u.area, u.price, status, u.view, u.orientation, handoverBase,
        status === 'reserved' ? day(between(3, 25)) : null, owner,
        JSON.stringify(['مطبخ مجهز', 'تكييف مركزي', 'أرضيات بورسلان', 'نظام أمني ذكي', 'موقف سيارة خاص']),
        `${u.unitType === 'shop' ? 'محل تجاري' : u.unitType === 'office' ? 'مكتب إداري' : 'شقة سكنية'} بمساحة ${u.area} م² في مبنى ${u.code.split('-')[0]}`
      ).lastInsertRowid);
      u.id = id;

      if (projectId <= 3) {
        UNIT_IMAGES.forEach(([url, caption], idx) => {
          run('INSERT INTO re_unit_media (unit_id, kind, url, caption, sort) VALUES (?, ?, ?, ?, ?)',
            id, 'image', url, caption, idx);
        });
        run('INSERT INTO re_unit_media (unit_id, kind, url, caption, sort) VALUES (?, ?, ?, ?, ?)',
          id, 'video', '/media/unit-tour.mp4', 'جولة مرئية — الواجهة الخارجية والداخلية', 10);
      }
      if (status === 'sold' || status === 'rented') {
        SERVICES.slice(0, between(3, 5)).forEach(([name, provider, fee]) => {
          run(`INSERT INTO re_services (project_id, building_id, unit_id, name, provider, monthly_fee, status, start_date)
               VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
            projectId, u.buildingId, id, name, provider, fee, addMonths(handoverBase, -between(1, 10)));
        });
      }
    }

    // Projects' building_stats computed later
    projects.push({ ...p, id: projectId, buildings, units });
  }

  /* ---------------- contracts / installments / collections ---------------- */
  let contractSeq = 0;
  let collectionSeq = 0;
  const collectionTotals = new Map();

  for (const project of projects) {
    for (const u of project.units) {
      const unitRow = get('SELECT * FROM re_units WHERE id = ?', u.id);
      if (unitRow.status !== 'sold' && unitRow.status !== 'rented') continue;

      const isRent = unitRow.status === 'rented';
      const partnerId = unitRow.owner_partner_id;
      const signedOffset = isRent ? -between(20, 420) : -between(5, 300);
      const date = day(signedOffset);
      const count = isRent ? 12 : 24;
      const price = isRent ? between(12, 30) * 1_000_000 : unitRow.price;
      const downPayment = isRent ? 0 : Math.round(price * 0.2);
      const installmentAmount = money((price - downPayment) / count);
      const startDate = isRent ? date : addDays(date, 30);
      contractSeq += 1;
      const number = `C-2${String(contractSeq).padStart(3, '0')}`;
      const contractId = Number(run(
        `INSERT INTO re_contracts (number, project_id, building_id, unit_id, partner_id, type, date, price,
           down_payment, installments_count, installment_amount, start_date, end_date, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 3)`,
        number, project.id, unitRow.building_id, unitRow.id, partnerId, isRent ? 'rent' : 'sale', date,
        price, downPayment, count, installmentAmount, startDate, addMonths(startDate, count - 1),
        isRent ? 'عقد إيجار سنوي قابل للتجديد' : 'عقد بيع بالتقسيط مع دفعة أولى'
      ).lastInsertRowid);

      // Revenue recognition for sales (accrual)
      if (!isRent) {
        postJournal({
          number: nextJV(), date, reference: number,
          memo: `إثبات إيراد بيع الوحدة ${unitRow.code} — عقد ${number}`,
          source: 'revenue', userId: 3,
          lines: [
            { accountId: accAR, debit: price, partnerId, projectId: project.id, memo: 'ذمم عقود البيع' },
            { accountId: accRevenue, credit: price, partnerId, projectId: project.id, memo: 'إيرادات بيع الوحدات' },
          ],
        });
      }

      // Down payment collection at signing
      if (downPayment > 0) {
        collectionSeq += 1;
        const colDate = date;
        run(
          `INSERT INTO re_collections (number, contract_id, installment_id, unit_id, partner_id, date, amount, method, account_id, reference, received_by, notes)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 5, 'دفعة مقدمة عند توقيع العقد')`,
          `RCV-${year}-${String(collectionSeq).padStart(5, '0')}`, contractId, unitRow.id, partnerId,
          colDate, downPayment, pick(['تحويل بنكي', 'صك مصرفي']), accBank, `DP-${number}`
        );
        const month = colDate.slice(0, 7);
        const key = `${project.id}|${month}`;
        const bucket = collectionTotals.get(key) || { projectId: project.id, month, total: 0 };
        bucket.total += downPayment;
        collectionTotals.set(key, bucket);
      }

      const firstDue = startDate;
      const monthsElapsed = Math.max(0, Math.floor((new Date(`${todayStr}T12:00:00Z`) - new Date(`${firstDue}T12:00:00Z`)) / (30.44 * 864e5)) + 1);
      const late = maybe(0.12);
      const paidTarget = Math.max(0, Math.min(count, late ? monthsElapsed - between(1, 3) : monthsElapsed));
      let outstandingWritten = 0;

      for (let i = 1; i <= count; i += 1) {
        const due = addMonths(firstDue, i - 1);
        const isPast = due < todayStr;
        const pay = i <= paidTarget && isPast;
        const paidDate = pay ? (addDays(due, between(0, 6)) > todayStr ? todayStr : addDays(due, between(0, 6))) : null;
        const status = pay ? 'paid' : isPast ? 'overdue' : 'pending';
        const instId = Number(run(
          `INSERT INTO re_installments (contract_id, seq, due_date, amount, paid_amount, paid_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          contractId, i, due, installmentAmount, pay ? installmentAmount : 0, paidDate, status
        ).lastInsertRowid);

        if (pay) {
          collectionSeq += 1;
          const method = pick(['نقدي', 'تحويل بنكي', 'شيك', 'بطاقة']);
          const accountId = method === 'نقدي' ? accCash : accBank;
          run(
            `INSERT INTO re_collections (number, contract_id, installment_id, unit_id, partner_id, date, amount, method, account_id, reference, received_by, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            `RCV-${year}-${String(collectionSeq).padStart(5, '0')}`, contractId, instId, unitRow.id, partnerId,
            paidDate, installmentAmount, method, accountId, `INS-${number}-${i}`, pick([5, 4, 3]), null
          );
          const month = paidDate.slice(0, 7);
          const key = `${project.id}|${month}`;
          const bucket = collectionTotals.get(key) || { projectId: project.id, month, total: 0 };
          bucket.total += installmentAmount;
          collectionTotals.set(key, bucket);
        } else if (status === 'overdue') {
          outstandingWritten += installmentAmount;
        }
      }

      const paidCount = get("SELECT COUNT(*) c FROM re_installments WHERE contract_id = ? AND status = 'paid'", contractId).c;
      const contractStatus = paidCount >= count ? 'completed' : 'active';
      if (contractStatus !== 'active') run('UPDATE re_contracts SET status = ? WHERE id = ?', contractStatus, contractId);
    }
  }

  /* ---------------- collections journal (monthly summary) ---------------- */
  let rcSeq = 0;
  for (const { projectId, month, total } of collectionTotals.values()) {
    rcSeq += 1;
    const bankCollections = Math.round(total * 0.7);
    const cashCollections = total - bankCollections;
    const project = projects.find((item) => item.id === projectId);
    const entryId = postJournal({
      number: `RC-${year}-${String(rcSeq).padStart(3, '0')}`,
      date: `${month}-28` > todayStr ? todayStr : `${month}-28`,
      reference: `COLL-${project.code}-${month}`,
      memo: `تحصيلات عقود البيع والإيجار لشهر ${month} — ${project.name}`,
      source: 'collection', userId: 5,
      lines: [
        { accountId: accBank, debit: bankCollections, projectId, memo: 'تحصيلات بنكية' },
        { accountId: accCash, debit: cashCollections, projectId, memo: 'تحصيلات نقدية' },
        { accountId: accAR, credit: total, projectId, memo: 'إقفال ذمم التحصيل' },
      ],
    });
    run(
      `UPDATE re_collections SET journal_entry_id = ?
        WHERE contract_id IN (SELECT id FROM re_contracts WHERE project_id = ?)
          AND substr(date, 1, 7) = ?`,
      entryId, projectId, month
    );
  }

  /* ---------------- project costs ---------------- */
  const COST_CATS = [
    ['أعمال إنشائية', 'أعمال الهيكل الخرساني والأساسات'],
    ['مواد بناء', 'حديد وخرسانة وطابوق ومواد عزل'],
    ['تشطيبات', 'أرضيات وأبواب ونوافذ ودهان'],
    ['بنى تحتية', 'طرق وكهرباء وماء ومجاري'],
    ['استشارات هندسية', 'إشراف وتصاميم وإدارة مشروع'],
    ['أمن وحراسة', 'خدمات الحراسة للموقع'],
    ['تسويق وبيع', 'حملات تسويق وبيع الوحدات'],
  ];

  for (const project of projects) {
    const target = Math.round(project.budget * 0.72);
    let allocated = 0;
    COST_CATS.forEach(([category, description], i) => {
      const amount = i === COST_CATS.length - 1 ? target - allocated : Math.round(target * (0.18 + rand() * 0.06));
      allocated += amount;
      const date = day(-between(15, 300));
      const entryId = postJournal({
        number: nextJV(), date, reference: `COST-${project.code}-${i + 1}`,
        memo: `${category} — ${project.name}`,
        source: 'expense', userId: 4,
        lines: [
          { accountId: accExpense, debit: amount, projectId: project.id, memo: category },
          { accountId: accPayable, credit: amount, projectId: project.id, memo: `مستحق مقاولي ${category}` },
        ],
      });
      run(
        `INSERT INTO re_costs (project_id, building_id, category, description, amount, date, vendor, journal_entry_id)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
        project.id, category, description, amount, date, pick(['شركة الرشيد للمقاولات', 'مقاولات الفرات', 'شركة بابل للإنشاءات', 'مؤسسة النور للتجهيزات']), entryId
      );
    });
    run('UPDATE re_projects SET spent = ? WHERE id = ?', target, project.id);
  }

  /* ---------------- maintenance requests ---------------- */
  let mtnSeq = 0;
  for (let i = 0; i < 90; i += 1) {
    const project = pick(projects);
    const unit = pick(project.units);
    const [category, description] = pick(MAINTENANCE_ITEMS);
    mtnSeq += 1;
    const reported = day(-between(0, 120));
    const status = pick(['new', 'new', 'in_progress', 'in_progress', 'done', 'done', 'done', 'cancelled']);
    const cost = status === 'done' ? between(25, 450) * 1000 : 0;
    run(
      `INSERT INTO re_maintenance (number, project_id, building_id, unit_id, category, description, priority,
         status, cost, charged_to, technician, reported_at, due_date, closed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      `MR-${year}-${String(mtnSeq).padStart(4, '0')}`, project.id, unit.buildingId, unit.id, category, description,
      pick(['low', 'normal', 'normal', 'high', 'urgent']), status, cost,
      pick(['owner', 'tenant', 'company']), pick(['م. ليث الربيعي', 'م. حسام العامري', 'فريق الصيانة الداخلية']),
      reported, addDays(reported, between(1, 10)),
      status === 'done' ? addDays(reported, between(1, 9)) : null,
      status === 'done' ? 'تم إنجاز الأعمال واختبارها' : null
    );
  }

  /* ---------------- activity feed entries ---------------- */
  const ACTS = [
    [3, 're_contract', null, 'create', 'أنشأ عقد بيع جديد للوحدة A-305 بقيمة 150,000,000 د.ع'],
    [5, 're_collection', null, 'payment', 'سجّل تحصيل قسط بقيمة 5,000,000 د.ع من العميل أحمد سامي العزاوي'],
    [4, 're_unit', null, 'update', 'حدّثت حالة الوحدة B-204 من متاحة إلى محجوزة'],
    [6, 're_maintenance', null, 'create', 'فتحت طلب صيانة جديد للمبنى C في المرحلة الأولى'],
    [2, 're_project', null, 'update', 'اعتمدت مخطط الموقع الجديد للمرحلة الثانية'],
  ];
  ACTS.forEach(([uid, entity, eid, action, message]) => {
    run('INSERT INTO activities (user_id, entity, entity_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      uid, entity, eid, action, message, day(-between(0, 4)));
  });

  /* ---------------- building aggregates ---------------- */
  for (const project of projects) {
    for (const b of project.buildings) {
      const stats = get(
        `SELECT COUNT(*) total, SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) sold,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) available,
                SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) reserved,
                SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) rented,
                COALESCE(SUM(area), 0) area
           FROM re_units WHERE building_id = ?`, b.id
      );
      run('UPDATE re_buildings SET units_count = ?, area = ? WHERE id = ?', stats.total, stats.area, b.id);
    }
  }

  // Account mapping used by the real-estate screens
  run(
    `INSERT INTO settings (key, value) VALUES ('re_accounts', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    JSON.stringify({
      receivable: '1300', revenue: '4200', cash: '1100', bank: '1200',
      downPaymentLiability: '2500', maintenanceExpense: '5400', costOfSales: '5300',
    })
  );
}
