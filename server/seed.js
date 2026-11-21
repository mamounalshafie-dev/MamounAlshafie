import { db, run, get, all, tx, setSetting, logActivity } from './db.js';
import { hashPassword } from './auth.js';
import { rng } from './util.js';
import { seedRealEstate } from './re-seed.js';

const rand = rng(20261121);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => Math.round(a + rand() * (b - a));
const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const money = (n) => Math.round(n * 100) / 100;
const maybe = (p = 0.5) => rand() < p;

/* ------------------------------------------------------------------ */
/*  Reference data                                                     */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = [
  ['الإدارة العامة', 'CC-100'],
  ['إدارة المشاريع', 'CC-200'],
  ['المبيعات والتسويق', 'CC-300'],
  ['المالية والمحاسبة', 'CC-400'],
  ['تقنية المعلومات', 'CC-500'],
  ['الموارد البشرية', 'CC-600'],
  ['المشتريات واللوجستيات', 'CC-700'],
  ['الدعم الفني', 'CC-800'],
];

const USERS = [
  ['م. مؤمن الشافعي', 'admin@noor.iq', 'admin', 'المدير التنفيذي', 'الإدارة العامة', '#4f46e5'],
  ['سارة الحسيني', 'sara@noor.iq', 'manager', 'مديرة المشاريع', 'إدارة المشاريع', '#0ea5e9'],
  ['علي كريم', 'ali@noor.iq', 'manager', 'مدير المبيعات', 'المبيعات والتسويق', '#f59e0b'],
  ['زينب عبد الله', 'zainab@noor.iq', 'accountant', 'المحاسب الرئيسي', 'المالية والمحاسبة', '#10b981'],
  ['حسين الجبوري', 'hussein@noor.iq', 'sales', 'مسؤول علاقات العملاء', 'المبيعات والتسويق', '#ec4899'],
  ['نورة العتيبي', 'noura@noor.iq', 'employee', 'مهندسة برمجيات أولى', 'تقنية المعلومات', '#8b5cf6'],
  ['محمد الصادق', 'mohammed@noor.iq', 'employee', 'مهندس شبكات', 'تقنية المعلومات', '#14b8a6'],
  ['رنا القيسي', 'rana@noor.iq', 'employee', 'مصممة تجربة مستخدم', 'تقنية المعلومات', '#f43f5e'],
  ['يوسف الحمداني', 'yousef@noor.iq', 'employee', 'مطور تطبيقات', 'تقنية المعلومات', '#6366f1'],
  ['ليلى عبد الرحمن', 'layla@noor.iq', 'employee', 'مسؤولة الموارد البشرية', 'الموارد البشرية', '#d946ef'],
  ['أحمد الشمري', 'ahmed@noor.iq', 'manager', 'مدير المشتريات', 'المشتريات واللوجستيات', '#0891b2'],
  ['فاطمة الزهراء', 'fatima@noor.iq', 'accountant', 'محاسبة رواتب', 'المالية والمحاسبة', '#22c55e'],
  ['كرار الموسوي', 'karrar@noor.iq', 'employee', 'مهندس دعم فني', 'الدعم الفني', '#eab308'],
  ['دنيا العبيدي', 'dunya@noor.iq', 'employee', 'محللة أعمال', 'إدارة المشاريع', '#a855f7'],
];

const CUSTOMERS = [
  ['وزارة الاتصالات', 'قسم تقنية المعلومات', 'it@mc.iq', '+964 790 111 2233', 'بغداد', 'الكرادة'],
  ['مصرف الرافدين', 'إدارة الأنظمة', 'systems@rafidain.iq', '+964 781 222 4455', 'بغداد', 'الرصافة'],
  ['شركة النفط الوطنية', 'إدارة المشاريع', 'projects@oil.iq', '+964 770 333 6677', 'البصرة', 'الجزائر'],
  ['جامعة بغداد', 'مركز الحاسوب', 'it@uobaghdad.edu.iq', '+964 790 444 8899', 'بغداد', 'الجادرية'],
  ['شركة آسيا للاتصالات', 'الشؤون التجارية', 'b2b@asiacell.iq', '+964 780 555 1122', 'بغداد', 'المنصور'],
  ['مجموعة الفيحاء التجارية', 'الإدارة المالية', 'finance@fayha.iq', '+964 751 666 3344', 'أربيل', 'عنكاوا'],
  ['مستشفى الكندي', 'الإدارة الطبية', 'admin@kindi.iq', '+964 790 777 5566', 'بغداد', 'النعيرية'],
  ['شركة زين العراق', 'قسم المشتريات', 'procurement@zain.iq', '+964 770 888 7788', 'بغداد', 'الكرادة'],
  ['هيئة الاستثمار الوطنية', 'مكتب المشاريع', 'invest@nia.iq', '+964 781 999 8899', 'بغداد', 'المنطقة الخضراء'],
  ['شركة بابل للتقنية', 'إدارة العمليات', 'ops@babylon.tech', '+964 750 121 3344', 'بابل', 'الحلة'],
  ['مصرف بغداد', 'تقنية المعلومات', 'it@baghdadbank.iq', '+964 790 232 5566', 'بغداد', 'الوزيرية'],
  ['شركة دجلة للمقاولات', 'إدارة العقود', 'contracts@tigris.iq', '+964 771 343 7788', 'بغداد', 'الكرخ'],
  ['الخطوط الجوية العراقية', 'قسم الأنظمة', 'systems@iraqia.iq', '+964 780 454 9900', 'بغداد', 'المطار'],
  ['شركة أور للبترول', 'إدارة المشاريع', 'projects@ur.oil', '+964 760 565 1122', 'البصرة', 'شط العرب'],
];

const VENDORS = [
  ['شركة التقنية المتقدمة', 'مبيعات', 'sales@advanced.iq', '+964 790 100 2000', 'بغداد'],
  ['مؤسسة النخبة للحواسيب', 'الإدارة', 'info@nokhba.iq', '+964 781 200 3000', 'بغداد'],
  ['شركة سيسكو الشرق الأوسط', 'الحسابات', 'me@cisco-partner.com', '+971 4 300 4000', 'دبي'],
  ['مكتبة الجامعة التقنية', 'المبيعات', 'books@utlib.iq', '+964 770 400 5000', 'بغداد'],
  ['شركة الخليج للكابلات', 'التجارة', 'trade@gulfcables.ae', '+971 6 500 6000', 'الشارقة'],
  ['مؤسسة الأمان للخدمات', 'العمليات', 'ops@aman.iq', '+964 751 600 7000', 'أربيل'],
  ['شركة مايكروسوفت الشرق الأوسط', 'التراخيص', 'licensing@ms-me.com', '+971 4 700 8000', 'دبي'],
];

const PRODUCTS = [
  ['HW-SRV-001', 'خادم Dell PowerEdge R750', 'خوادم', 'قطعة', 8_750_000, 7_100_000, 12, 4],
  ['HW-SRV-002', 'خادم HPE ProLiant DL380', 'خوادم', 'قطعة', 9_200_000, 7_600_000, 8, 3],
  ['HW-NET-101', 'سويتش Cisco Catalyst 9300', 'شبكات', 'قطعة', 3_450_000, 2_780_000, 24, 8],
  ['HW-NET-102', 'جارف Cisco ASA 5506-X', 'شبكات', 'قطعة', 2_100_000, 1_720_000, 15, 5],
  ['HW-NET-103', 'نقطة وصول Ubiquiti UniFi Pro', 'شبكات', 'قطعة', 385_000, 290_000, 68, 20],
  ['HW-RCK-201', 'خزانة شبكات 42U', 'مراكز بيانات', 'قطعة', 1_150_000, 890_000, 9, 3],
  ['HW-PWR-301', 'مزود طاقة UPS 10KVA', 'مراكز بيانات', 'قطعة', 2_650_000, 2_100_000, 11, 4],
  ['HW-END-401', 'حاسوب مكتبي Dell OptiPlex 7010', 'أجهزة طرفية', 'قطعة', 1_250_000, 980_000, 56, 15],
  ['HW-END-402', 'حاسوب محمول Lenovo ThinkPad T14', 'أجهزة طرفية', 'قطعة', 1_850_000, 1_500_000, 34, 10],
  ['HW-END-403', 'شاشة Dell UltraSharp 27"', 'أجهزة طرفية', 'قطعة', 480_000, 375_000, 42, 12],
  ['HW-PRN-404', 'طابعة ليزر HP LaserJet Pro', 'أجهزة طرفية', 'قطعة', 520_000, 410_000, 18, 6],
  ['HW-CAM-405', 'كاميرا مراقبة IP 4K', 'أنظمة أمنية', 'قطعة', 295_000, 215_000, 88, 25],
  ['HW-CAM-406', 'مسجل شبكي NVR 32 قناة', 'أنظمة أمنية', 'قطعة', 1_080_000, 830_000, 14, 5],
  ['SW-LIC-501', 'ترخيص Microsoft 365 E3 - سنوي', 'تراخيص برمجيات', 'ترخيص', 285_000, 210_000, 240, 40],
  ['SW-LIC-502', 'ترخيص Windows Server Datacenter', 'تراخيص برمجيات', 'ترخيص', 8_400_000, 7_150_000, 6, 2],
  ['SW-LIC-503', 'اشتراك شهادة SSL Wildcard', 'تراخيص برمجيات', 'اشتراك', 720_000, 540_000, 30, 10],
  ['SW-SEC-504', 'حل حماية نهاية الطرف Kaspersky', 'أمن سيبراني', 'ترخيص', 175_000, 128_000, 420, 80],
  ['SV-CON-601', 'خدمات استشارات معمارية المؤسسة', 'خدمات', 'ساعة', 250_000, 120_000, 0, 0],
  ['SV-DEV-602', 'تطوير برمجي مخصص', 'خدمات', 'ساعة', 185_000, 95_000, 0, 0],
  ['SV-IMP-603', 'تنفيذ وتركيب أنظمة شبكية', 'خدمات', 'مشروع', 4_500_000, 2_600_000, 0, 0],
  ['SV-SUP-604', 'عقد دعم فني وصيانة سنوي', 'خدمات', 'عقد', 6_800_000, 3_400_000, 0, 0],
  ['SV-TRN-605', 'تدريب فرق تقنية المعلومات', 'خدمات', 'يوم', 950_000, 450_000, 0, 0],
  ['SV-AUD-606', 'تدقيق أمني واختبار اختراق', 'أمن سيبراني', 'مشروع', 5_750_000, 3_100_000, 0, 0],
  ['SV-CLD-607', 'استشارات الحوسبة السحابية', 'خدمات', 'ساعة', 220_000, 110_000, 0, 0],
  ['HW-MOB-407', 'جهاز لوحي Samsung Tab A9', 'أجهزة طرفية', 'قطعة', 640_000, 495_000, 27, 8],
  ['HW-PRJ-408', 'بروجكتر Epson EB-X51', 'أجهزة طرفية', 'قطعة', 890_000, 690_000, 7, 3],
];

const PROJECTS = [
  ['PRJ-2026-001', 'منصة الحكومة الإلكترونية - المرحلة الثانية', 0, 1, 'in_progress', 'high', -210, 60, 780_000_000, 486_500_000, 68, 'تطوير بوابة خدمات حكومية موحدة تخدم 14 وزارة مع تكامل مع قاعدة البيانات الوطنية والدفع الإلكتروني.', 'حكومي,تحول رقمي'],
  ['PRJ-2026-002', 'تطوير تطبيق مصرف الرافدين للهواتف', 1, 1, 'in_progress', 'critical', -150, 25, 520_000_000, 371_400_000, 74, 'تطبيق iOS/Android تتيح العملاء إدارة الحسابات والتحويلات مع مصادقة بيومترية.', 'مصارف,تطبيقات'],
  ['PRJ-2026-003', 'تحديث مركز بيانات شركة النفط الوطنية', 2, 1, 'in_progress', 'high', -120, 45, 920_000_000, 512_000_000, 56, 'استبدال البنية التحتية للخوادم وتنفيذ حلول التخزين الموزع وأنظمة التبريد.', 'بنية تحتية,مراكز بيانات'],
  ['PRJ-2026-004', 'نظام إدارة الطلاب - جامعة بغداد', 3, 1, 'review', 'medium', -260, 12, 340_000_000, 298_000_000, 92, 'نظام متكامل لإدارة شؤون الطلبة والدرجات والتسجيل الإلكتروني.', 'تعليم,أنظمة'],
  ['PRJ-2026-005', 'توسعة شبكة الفروع - شركة آسيا', 4, 6, 'in_progress', 'medium', -85, 70, 265_000_000, 118_500_000, 45, 'توسعة الشبكة في 18 فرعاً وتحديث أنظمة الأمان والمراقبة.', 'شبكات,اتصالات'],
  ['PRJ-2026-006', 'منصة التجارة الإلكترونية B2B', 5, 1, 'in_progress', 'high', -95, 55, 410_000_000, 204_000_000, 52, 'منصة B2B متعددة المستأجرين مع إدارة مخازن وفواتير إلكترونية.', 'تجارة إلكترونية'],
  ['PRJ-2026-007', 'نظام معلوماتي لمستشفى الكندي', 6, 8, 'planning', 'high', 15, 180, 625_000_000, 0, 0, 'نظام إدارة المستشفى (HIS) يشمل الملف الطبي الإلكتروني والمختبر والصيدلية.', 'صحي'],
  ['PRJ-2026-008', 'مركز الاتصال الذكي - زين العراق', 7, 1, 'in_progress', 'critical', -60, 30, 380_000_000, 241_000_000, 63, 'بناء مركز اتصال مدعوم بالذكاء الاصطناعي لخدمة 2 مليون مشترك.', 'اتصالات,ذكاء اصطناعي'],
  ['PRJ-2026-009', 'بوابة الخدمات الاستثمارية', 8, 1, 'on_hold', 'medium', -180, 20, 195_000_000, 96_000_000, 38, 'بوابة إلكترونية لتقديم طلبات الاستثمار ومتابعتها إلكترونياً.', 'حكومي'],
  ['PRJ-2026-010', 'تأمين البنية التحتية السيبرانية', 9, 6, 'in_progress', 'high', -40, 90, 245_000_000, 78_000_000, 31, 'تقييم وتحصين البنية التحتية وتنفيذ مركز عمليات أمنية (SOC).', 'أمن سيبراني'],
  ['PRJ-2026-011', 'تطبيق الخدمات المصرفية - مصرف بغداد', 10, 1, 'done', 'medium', -300, -20, 465_000_000, 442_000_000, 100, 'تطبيق مصرفي متكامل مع المحفظة الرقمية والتحويلات الفورية.', 'مصارف,تطبيقات'],
  ['PRJ-2026-012', 'نظام إدارة المشاريع الإنشائية', 11, 6, 'in_progress', 'medium', -70, 65, 185_000_000, 84_000_000, 41, 'نظام تتبع المشاريع الإنشائية والمستخلصات والمواد.', 'إنشاءات'],
  ['PRJ-2026-013', 'تحديث أنظمة الخطوط الجوية - حجز', 12, 1, 'review', 'high', -230, 8, 715_000_000, 651_000_000, 95, 'تحديث نظام الحجز والتذاكر والتكامل مع الأنظمة العالمية Amadeus.', 'طيران,أنظمة'],
  ['PRJ-2026-014', 'منصة تحليلات الإنتاج النفطي', 13, 1, 'planning', 'high', 30, 200, 880_000_000, 0, 0, 'منصة تحليلات زمن حقيقي لبيانات الإنتاج في 6 حقول نفطية.', 'نفط,تحليلات'],
  ['PRJ-2026-015', 'صيانة أنظمة الدعم الفني', 4, 12, 'in_progress', 'low', -320, 15, 145_000_000, 128_000_000, 88, 'عقد صيانة سنوي لأنظمة الدعم الفني والبنية التحتية.', 'دعم فني'],
  ['PRJ-2026-016', 'تدقيق أمني لبوابة الدفع الوطنية', 8, 9, 'cancelled', 'low', -400, -100, 95_000_000, 12_500_000, 15, 'مشروع تدقيق أمني أُلغي لإعادة هيكلة البوابة الوطنية.', 'أمن سيبراني'],
];

const TASK_TEMPLATES = {
  planning: ['تحليل المتطلبات الوظيفية', 'إعداد وثيقة نطاق العمل', 'دراسة الجدوى الفنية', 'تصميم الهيكل العام للنظام', 'تحديد الموارد والجدول الزمني', 'اعتماد الميزانية التقديرية'],
  in_progress: [
    'تطوير واجهات المستخدم الرئيسية', 'بناء واجهات API للخدمات', 'تصميم قاعدة البيانات', 'تنفيذ وحدة المصادقة والصلاحيات',
    'تكامل نظام الدفع الإلكتروني', 'اختبار الأداء وتحسين الاستجابة', 'إعداد بيئة الاختبار UAT', 'توثيق الوحدات البرمجية',
    'مراجعة كود أمني', 'التحضير لنشر النسخة التجريبية', 'تدريب فريق العميل', 'إعداد خطة الهجرة',
  ],
  review: ['اختبار القبول النهائي', 'مراجعة أداء النظام', 'إصلاح الملاحظات الحرجة', 'تجهيز حزمة التسليم'],
  done: ['نشر النظام في بيئة الإنتاج', 'تسليم الوثائق النهائية', 'توقيع محضر الاستلام', 'إغلاق المشروع وتسليم الدعم'],
  backlog: ['دراسة تحسينات مستقبلية', 'البحث عن تقنيات بديلة'],
  on_hold: ['مراجعة نطاق المشروع', 'انتظار موافقة العميل'],
  cancelled: ['توثيق أسباب الإلغاء'],
};

const TASK_TAGS = ['تطوير', 'تصميم', 'اختبار', 'بنية تحتية', 'أمان', 'توثيق', 'تحليل', 'نشر'];

const EXPENSES = [
  ['إيجار المقر الرئيسي - الكرادة', 2, 5200, 8_500_000],
  ['رواتب الموظفين', 5100, 0, 0],
  ['فاتورة الكهرباء والمولدات', 2, 5200, 3_200_000],
  ['خدمات الاتصالات والإنترنت', 2, 5200, 2_750_000],
  ['مصروفات تسويق وإعلانات', 2, 5500, 6_400_000],
  ['صيانة أجهزة ومعدات', 2, 5300, 1_850_000],
  ['قرطاسية ومستلزمات مكتبية', 2, 5400, 640_000],
  ['اشتراكات برمجيات داخلية', 2, 5400, 4_100_000],
  ['تأمين المقر والمعدات', 2, 5400, 1_200_000],
  ['استهلاك أصول ثابتة', 2, 5600, 2_300_000],
];

/* ------------------------------------------------------------------ */
/*  Seeding                                                            */
/* ------------------------------------------------------------------ */

export function isSeeded() {
  return (get('SELECT COUNT(*) AS c FROM users')?.c ?? 0) > 0;
}

export function seed() {
  tx(() => {
    const tables = [
      'journal_lines', 'journal_entries', 'payslips', 'attendance', 'leaves', 'invoice_lines', 'payments',
      'invoices', 'quotation_lines', 'quotations', 'po_lines', 'purchase_orders', 'timesheets', 'tasks',
      'project_members', 'projects', 'stock_moves', 'products', 'partners', 'employees', 'departments',
      'accounts', 'activities', 'sessions', 'settings', 'users',
      're_unit_media', 're_collections', 're_installments', 're_contracts', 're_maintenance',
      're_services', 're_costs', 're_units', 're_buildings', 're_projects',
    ];
    db.exec('PRAGMA foreign_keys = OFF;');
    for (const t of tables) db.exec(`DELETE FROM ${t};`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN (" + tables.map((t) => `'${t}'`).join(',') + ');');
    db.exec('PRAGMA foreign_keys = ON;');

    /* ----- settings ----- */
    setSetting('company', {
      name: 'شركة المدن الحديثة للتطوير العقاري',
      nameEn: 'Modern Cities Real Estate Development',
      taxId: 'IQ-2014-88213',
      cr: 'بغداد - 21884',
      address: 'بغداد، زيونة، شارع الربيعي، برج المدن الحديثة - الطابق 12',
      phone: '+964 781 555 9000',
      email: 'info@moderncities.iq',
      website: 'www.moderncities.iq',
      currency: 'IQD',
      currencySymbol: 'د.ع',
      taxRate: 15,
      fiscalYear: '2026',
      bankName: 'مصرف بغداد - فرع زيونة',
      bankAccount: 'IQ98 BAGD 0001 8821 4455 0099',
    });
    setSetting('modules', {
      projects: true, sales: true, purchases: true, inventory: true,
      accounting: true, hr: true, reports: true, realestate: true, collection: true, maintenance: true,
    });

    /* ----- departments ----- */
    DEPARTMENTS.forEach(([name, cc], i) => {
      run('INSERT INTO departments (id, name, cost_center, manager_id) VALUES (?, ?, ?, ?)', i + 1, name, cc, null);
    });

    /* ----- users ----- */
    const userIds = [];
    USERS.forEach(([name, email, role, title, dept, color], i) => {
      const uid = i + 1;
      userIds.push(uid);
      run(
        `INSERT INTO users (id, name, email, password_hash, role, job_title, department, phone, avatar_color, active, last_login)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        uid, name, email, hashPassword(role === 'admin' ? 'admin123' : 'noor123'), role, title, dept,
        `+964 7${between(70, 81)} ${between(100, 999)} ${between(1000, 9999)}`, color, iso(-between(0, 6))
      );
    });
    run('UPDATE departments SET manager_id = 2 WHERE id = 2');
    run('UPDATE departments SET manager_id = 3 WHERE id = 3');
    run('UPDATE departments SET manager_id = 4 WHERE id = 4');
    run('UPDATE departments SET manager_id = 11 WHERE id = 7');
    run('UPDATE departments SET manager_id = 10 WHERE id = 6');

    /* ----- partners ----- */
    const customerIds = [];
    CUSTOMERS.forEach(([name, contact, email, phone, city, area], i) => {
      const id = i + 1;
      customerIds.push(id);
      run(
        `INSERT INTO partners (id, type, name, contact_name, email, phone, city, country, tax_id, address,
          credit_limit, payment_terms, rating, active, notes)
         VALUES (?, 'customer', ?, ?, ?, ?, ?, 'العراق', ?, ?, ?, ?, ?, 1, ?)`,
        id, name, contact, email, phone, city, `IQ-${between(2010, 2024)}-${between(10000, 99999)}`,
        `${city} - ${area}`, between(100, 900) * 1_000_000, pick([30, 45, 60, 90]), between(3, 5),
        i % 3 === 0 ? 'عميل استراتيجي - أولوية عالية في الاستجابة' : null
      );
    });
    const vendorIds = [];
    VENDORS.forEach(([name, contact, email, phone, city], i) => {
      const id = 100 + i + 1;
      vendorIds.push(id);
      run(
        `INSERT INTO partners (id, type, name, contact_name, email, phone, city, country, tax_id, address,
          credit_limit, payment_terms, rating, active, notes)
         VALUES (?, 'vendor', ?, ?, ?, ?, ?, ?, ?, ?, 0, 30, ?, 1, NULL)`,
        id, name, contact, email, phone, city, city === 'دبي' || city === 'الشارقة' ? 'الإمارات' : 'العراق',
        `VAT-${between(100000, 999999)}`, city, between(4, 5)
      );
    });

    /* ----- products & stock ----- */
    PRODUCTS.forEach(([sku, name, category, uom, sale, cost, stock, reorder], i) => {
      run(
        `INSERT INTO products (id, sku, name, category, uom, sale_price, cost_price, stock_qty, reorder_level,
          warehouse, taxable, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        i + 1, sku, name, category, uom, sale, cost, stock, reorder,
        category === 'خدمات' || category === 'تراخيص برمجيات' ? 'المستودع الرقمي' : 'المستودع الرئيسي'
      );
      if (stock > 0) {
        run(
          `INSERT INTO stock_moves (product_id, type, qty, unit_cost, reference, note, date, user_id)
           VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`,
          i + 1, stock, cost, `OPEN-${String(i + 1).padStart(4, '0')}`, 'رصيد افتتاحي', iso(-300), 11
        );
      }
    });
    // a few outbound moves to simulate movement
    for (let k = 0; k < 22; k++) {
      const pid = between(1, 12);
      const p = get('SELECT * FROM products WHERE id = ?', pid);
      if (!p) continue;
      const qty = between(1, Math.max(1, Math.floor(p.stock_qty / 12)));
      run(`INSERT INTO stock_moves (product_id, type, qty, unit_cost, reference, note, date, user_id)
           VALUES (?, 'out', ?, ?, ?, 'صرف لأمر بيع', ?, ?)`,
        pid, qty, p.cost_price, `SO-2026-${String(between(100, 199))}`, iso(-between(1, 120)), 11);
    }

    /* ----- projects ----- */
    PROJECTS.forEach(([code, name, custIdx, mgr, stage, priority, startOff, endOff, budget, spent, progress, desc, tags], i) => {
      const id = i + 1;
      let health = 'good';
      if (stage === 'done') health = 'good';
      else if (stage === 'cancelled') health = 'critical';
      else if (stage === 'on_hold') health = 'at_risk';
      else if (stage !== 'planning') {
        const span = Math.max(1, endOff - startOff);
        const expected = Math.max(0, Math.min(100, Math.round(((0 - startOff) / span) * 100)));
        const spendRatio = budget ? (spent / budget) * 100 : 0;
        if (progress < expected - 35 || spendRatio > progress + 40) health = 'critical';
        else if (progress < expected - 15 || spendRatio > progress + 20) health = 'at_risk';
      }
      run(
        `INSERT INTO projects (id, code, name, customer_id, manager_id, stage, priority, start_date, end_date,
          budget, spent, progress, description, tags, health, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, code, name, customerIds[custIdx] ?? null, mgr, stage, priority, iso(startOff), iso(endOff),
        budget, spent, progress, desc, tags, health, iso(startOff - 5)
      );
      const team = new Set([mgr]);
      while (team.size < between(3, 5)) team.add(between(1, 14));
      [...team].forEach((uid, idx) => {
        run('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
          id, uid, idx === 0 ? 'مدير المشروع' : pick(['مطور', 'محلل', 'مصمم', 'مهندس', 'مختبر']));
      });

      const template = TASK_TEMPLATES[stage] || TASK_TEMPLATES.in_progress;
      const count = between(6, 11);
      const stages = stage === 'done' ? ['done'] : stage === 'cancelled' ? ['done', 'backlog'] : ['done', 'in_progress', 'todo', 'review', 'backlog'];
      for (let t = 0; t < count; t++) {
        const title = t < template.length ? template[t] : `${pick(TASK_TEMPLATES.in_progress)} - حزمة ${t + 1}`;
        const tStage = stage === 'planning' ? pick(['todo', 'todo', 'in_progress', 'backlog'])
          : t < Math.max(1, Math.round(count * (progress / 100))) ? 'done'
            : pick(stages);
        const assignee = [...team][between(0, team.size - 1)];
        const due = iso(between(startOff + 5, Math.max(startOff + 6, endOff)));
        const est = between(8, 80);
        const taskId = Number(run(
          `INSERT INTO tasks (project_id, title, description, stage, priority, assignee_id, start_date, due_date,
            estimated_hours, spent_hours, tags, position, done_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id, title, pick([
            'تتضمن المهمة إعداد المخرجات المطلوبة ومراجعتها مع فريق الجودة قبل التسليم.',
            'تنفيذ الأعمال وفق معايير الجودة المعتمدة وتوثيق النتائج في نظام إدارة المشاريع.',
            'التنسيق مع بقية الفرق لضمان تكامل المخرجات والالتزام بالجدول الزمني.',
            'مراجعة المتطلبات مع صاحب المصلحة وتحديث وثائق التصميم.',
          ]),
          tStage, pick(['low', 'medium', 'medium', 'high', 'critical']), assignee,
          iso(startOff + between(0, 10)), due, est,
          tStage === 'done' ? Math.round(est * (0.6 + rand() * 0.7)) : Math.round(est * rand() * 0.6),
          pick(TASK_TAGS), t, tStage === 'done' ? iso(between(startOff, 0)) : null
        ).lastInsertRowid);
        if (tStage === 'done' && maybe(0.75)) {
          run(`INSERT INTO timesheets (task_id, project_id, user_id, date, hours, description, billable)
               VALUES (?, ?, ?, ?, ?, ?, 1)`,
            taskId, id, assignee, iso(between(startOff, 0)), between(3, 14), 'ساعات عمل مسجلة على المهمة');
        }
      }
    });

    /* ----- chart of accounts ----- */
    const ACCOUNTS = [
      [1, '1000', 'الأصول', 'asset', null],
      [2, '1100', 'النقدية بالصندوق', 'asset', 1],
      [3, '1200', 'النقدية في البنك', 'asset', 1],
      [4, '1300', 'المدينون - العملاء', 'asset', 1],
      [5, '1400', 'المخزون', 'asset', 1],
      [6, '1500', 'الأصول الثابتة', 'asset', 1],
      [7, '2100', 'الدائنون - الموردون', 'liability', null],
      [8, '2200', 'ضريبة القيمة المضافة المستحقة', 'liability', 7],
      [9, '2300', 'الرواتب المستحقة', 'liability', 7],
      [10, '2400', 'قروض والتزامات طويلة الأجل', 'liability', 7],
      [11, '3100', 'رأس المال', 'equity', null],
      [12, '3200', 'الأرباح المحتجزة', 'equity', 11],
      [13, '4100', 'إيرادات المشاريع', 'income', null],
      [14, '4200', 'إيرادات المبيعات', 'income', 13],
      [15, '4900', 'إيرادات أخرى', 'income', 13],
      [16, '5100', 'الرواتب والأجور', 'expense', null],
      [17, '5200', 'مصروفات إدارية وعمومية', 'expense', 16],
      [18, '5300', 'تكلفة المشاريع المنفذة', 'expense', 16],
      [19, '5400', 'مصروفات تشغيلية', 'expense', 16],
      [20, '5500', 'مصروفات تسويق وبيع', 'expense', 16],
      [21, '5600', 'استهلاك وإطفاء', 'expense', 16],
      [22, '2500', 'دفعات مقدمة من العملاء', 'liability', 7],
    ];
    ACCOUNTS.forEach(([id, code, name, type, parent]) => {
      run('INSERT INTO accounts (id, code, name, type, parent_id, active) VALUES (?, ?, ?, ?, ?, 1)',
        id, code, name, type, parent);
    });
    const acc = (code) => get('SELECT id FROM accounts WHERE code = ?', code).id;

    /* ----- opening balances ----- */
    const openingId = Number(run(
      `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
       VALUES ('JV-2026-0001', ?, 'OPENING', 'القيد الافتتاحي للسنة المالية 2026', 'posted', 'manual', 4)`,
      iso(-330)
    ).lastInsertRowid);
    const opening = [
      [acc('1200'), 1_200_000_000, 0], [acc('1300'), 320_000_000, 0], [acc('1400'), 265_000_000, 0],
      [acc('1500'), 1_400_000_000, 0], [acc('2100'), 0, 210_000_000], [acc('2400'), 0, 350_000_000],
      [acc('3100'), 0, 2_150_000_000], [acc('3200'), 0, 475_000_000],
    ];
    opening.forEach(([a, d, c]) => {
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?)',
        openingId, a, d, c, 'رصيد افتتاحي');
    });

    /* ----- quotations ----- */
    const Q_STATUS = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'invoiced'];
    for (let i = 0; i < 14; i++) {
      const date = iso(-between(10, 260));
      const id = i + 1;
      const cust = customerIds[between(0, customerIds.length - 1)];
      const status = pick(Q_STATUS);
      let subtotal = 0;
      let tax = 0;
      const lines = [];
      const lineCount = between(1, 4);
      for (let l = 0; l < lineCount; l++) {
        const p = get('SELECT * FROM products WHERE id = ?', between(1, PRODUCTS.length));
        const qty = p.category === 'خدمات' ? between(20, 160) : between(1, 20);
        const price = p.sale_price;
        const lineTax = 15;
        subtotal += qty * price;
        tax += qty * price * lineTax / 100;
        lines.push([p.id, p.name, qty, price, lineTax]);
      }
      subtotal = money(subtotal); tax = money(tax);
      const qValid = new Date(date); qValid.setDate(qValid.getDate() + 30);
      run(
        `INSERT INTO quotations (id, number, customer_id, project_id, date, valid_until, status, subtotal, tax, total, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, `QT-2026-${String(i + 1).padStart(4, '0')}`, cust, maybe(0.5) ? between(1, 16) : null,
        date, qValid.toISOString().slice(0, 10), status, subtotal, tax, money(subtotal + tax),
        'الأسعار لا تشمل تكاليف النقل والتركيب ما لم يُذكر خلاف ذلك. صلاحية العرض 30 يوماً.', 5
      );
      lines.forEach(([pid, desc, qty, price, rate]) => {
        run(`INSERT INTO quotation_lines (quotation_id, product_id, description, qty, unit_price, tax_rate)
             VALUES (?, ?, ?, ?, ?, ?)`, id, pid, desc, qty, price, rate);
      });
    }

    /* ----- invoices + payments + journal ----- */
    let invNo = 0;
    const invStatuses = ['paid', 'paid', 'paid', 'partial', 'sent', 'overdue', 'draft', 'cancelled'];
    for (let i = 0; i < 42; i++) {
      invNo++;
      const daysIntoYear = Math.round((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 864e5);
      const age = between(2, Math.max(20, Math.min(300, daysIntoYear - 5)));
      const date = iso(-age);
      const customer = customerIds[between(0, customerIds.length - 1)];
      let status;
      if (age > 45) status = pick(['paid', 'paid', 'paid', 'paid', 'paid', 'partial', 'overdue', 'cancelled']);
      else if (age > 20) status = pick(['paid', 'paid', 'paid', 'partial', 'sent', 'overdue', 'draft']);
      else status = pick(['paid', 'sent', 'sent', 'draft', 'draft', 'partial']);
      const due = new Date(date); due.setDate(due.getDate() + 30);
      const dueDate = due.toISOString().slice(0, 10);
      const isPastDue = dueDate < iso();
      if (isPastDue && ['sent', 'partial', 'overdue'].includes(status)) status = 'overdue';
      if (!isPastDue && status === 'overdue') status = 'sent';
      let subtotal = 0; let tax = 0;
      const lines = [];
      const lineCount = between(1, 5);
      for (let l = 0; l < lineCount; l++) {
        const p = get('SELECT * FROM products WHERE id = ?', between(1, PRODUCTS.length));
        const qty = p.category === 'خدمات' ? between(10, 120) : between(1, 15);
        const price = p.sale_price;
        const rate = 15;
        subtotal += qty * price;
        tax += qty * price * rate / 100;
        lines.push([p.id, p.name, qty, price, rate]);
      }
      subtotal = money(subtotal); tax = money(tax);
      const total = money(subtotal + tax);
      const id = Number(run(
        `INSERT INTO invoices (number, customer_id, project_id, quotation_id, date, due_date, status, subtotal, tax, total, amount_paid, notes, created_by)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        `INV-2026-${String(invNo).padStart(4, '0')}`, customer, maybe(0.7) ? between(1, 16) : null,
        date, dueDate, status, subtotal, tax, total,
        status === 'draft' ? null : 'يرجى تحويل المبلغ إلى حساب الشركة خلال المدة المحددة.', 3
      ).lastInsertRowid);
      lines.forEach(([pid, desc, qty, price, rate]) => {
        run(`INSERT INTO invoice_lines (invoice_id, product_id, description, qty, unit_price, tax_rate)
             VALUES (?, ?, ?, ?, ?, ?)`, id, pid, desc, qty, price, rate);
      });

      let paid = 0;
      if (status === 'paid') paid = total;
      else if (status === 'partial') paid = money(total * (0.25 + rand() * 0.4));
      if (status === 'overdue' && maybe(0.4)) paid = money(total * 0.2);
      if (status === 'cancelled' || status === 'draft') paid = 0;
      if (paid > 0) {
        const payDate = new Date(date);
        payDate.setDate(payDate.getDate() + between(3, 25));
        const payIso = payDate > new Date() ? iso() : payDate.toISOString().slice(0, 10);
        run(`INSERT INTO payments (invoice_id, date, amount, method, reference, note)
             VALUES (?, ?, ?, ?, ?, 'دفعة مستلمة')`,
          id, payIso, paid, pick(['تحويل بنكي', 'شيك', 'نقداً']), `PAY-${between(10000, 99999)}`);
        run(`UPDATE invoices SET amount_paid = ? WHERE id = ?`, paid, id);
        if (status !== 'cancelled') {
          const entryId = Number(run(
            `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
             VALUES (?, ?, ?, ?, 'posted', 'payment', 4)`,
            `RV-2026-${String(invNo).padStart(4, '0')}`, date, `INV-${invNo}`, `تحصيل من العميل - فاتورة ${invNo}`
          ).lastInsertRowid);
          run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
            entryId, acc('1200'), paid, customer, 'تحصيل');
          run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
            entryId, acc('1300'), paid, customer, 'إقفال ذمم');
        }
      }
      if (status !== 'draft' && status !== 'cancelled') {
        const jeId = Number(run(
          `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
           VALUES (?, ?, ?, ?, 'posted', 'invoice', 4)`,
          `JV-2026-${String(1 + invNo).padStart(4, '0')}`, date, `INV-${invNo}`, `إثبات إيراد فاتورة رقم ${invNo}`
        ).lastInsertRowid);
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
          jeId, acc('1300'), total, customer, 'ذمم مدينة');
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
          jeId, acc('4100'), subtotal, customer, 'إيراد خدمات');
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
          jeId, acc('2200'), tax, customer, 'ضريبة مستحقة');
      }
    }

    /* ----- purchase orders ----- */
    let poNo = 0;
    for (let i = 0; i < 12; i++) {
      poNo++;
      const date = iso(-between(5, 200));
      const vendor = vendorIds[between(0, vendorIds.length - 1)];
      const status = pick(['draft', 'confirmed', 'received', 'received', 'billed', 'cancelled']);
      let subtotal = 0; let tax = 0;
      const lines = [];
      for (let l = 0; l < between(1, 4); l++) {
        const p = get('SELECT * FROM products WHERE id = ?', between(1, PRODUCTS.length));
        const qty = between(2, 25);
        subtotal += qty * p.cost_price;
        tax += qty * p.cost_price * 0.15;
        lines.push([p.id, p.name, qty, p.cost_price]);
      }
      subtotal = money(subtotal); tax = money(tax); const total = money(subtotal + tax);
      const id = Number(run(
        `INSERT INTO purchase_orders (number, vendor_id, date, expected_date, status, subtotal, tax, total, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        `PO-2026-${String(poNo).padStart(4, '0')}`, vendor, date,
        (() => { const d = new Date(date); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); })(),
        status, subtotal, tax, total,
        'شروط الدفع: 30 يوماً من تاريخ الاستلام.'
      ).lastInsertRowid);
      lines.forEach(([pid, desc, qty, price]) => {
        run(`INSERT INTO po_lines (po_id, product_id, description, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?, 15)`,
          id, pid, desc, qty, price);
      });
      if (status === 'received' || status === 'billed') {
        const jeId = Number(run(
          `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
           VALUES (?, ?, ?, ?, 'posted', 'purchase', 4)`,
          `PV-2026-${String(poNo).padStart(4, '0')}`, date, `PO-${poNo}`, `شراء مواد وخدمات - أمر شراء ${poNo}`
        ).lastInsertRowid);
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
          jeId, acc('1400'), subtotal, vendor, 'مخزون');
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
          jeId, acc('2200'), tax, vendor, 'ضريبة مدخلات');
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, partner_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
          jeId, acc('2100'), total, vendor, 'دائنون');
      }
    }

    /* ----- operating expenses ----- */
    let expNo = 0;
    for (let m = 1; m <= 9; m++) {
      const monthDate = iso(-m * 30);
      EXPENSES.slice(0, m > 4 ? EXPENSES.length : 6).forEach(([label, , , amount]) => {
        if (!amount) return;
        expNo++;
        const jeId = Number(run(
          `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
           VALUES (?, ?, ?, ?, 'posted', 'expense', 4)`,
          `EX-2026-${String(expNo).padStart(4, '0')}`, monthDate, 'EXP', label
        ).lastInsertRowid);
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)',
          jeId, acc('5400'), amount, label);
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)',
          jeId, acc('1200'), amount, label);
      });
    }
    // payroll journal for last 3 months
    for (let m = 1; m <= 3; m++) {
      const totalPayroll = 48_500_000;
      const jeId = Number(run(
        `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
         VALUES (?, ?, 'PAYROLL', ?, 'posted', 'payroll', 12)`,
        `PR-2026-${String(m).padStart(4, '0')}`, iso(-m * 30), `رواتب الموظفين لشهر ${m}`
      ).lastInsertRowid);
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)',
        jeId, acc('5100'), totalPayroll, 'مصروف رواتب');
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)',
        jeId, acc('1200'), totalPayroll, 'صرف رواتب');
    }

    /* ----- project cost postings (realistic P&L) ----- */
    let pcNo = 0;
    for (const p of all('SELECT * FROM projects WHERE spent > 0')) {
      pcNo++;
      const start = new Date(p.start_date || iso(-180));
      const end = new Date(Math.min(Date.now(), new Date(p.end_date || iso()).getTime()));
      const spanDays = Math.max(30, Math.round((end - start) / 864e5));
      const splits = Math.min(6, Math.max(1, Math.round(spanDays / 45)));
      const per = Math.round((p.spent * 0.83) / splits);
      for (let s = 0; s < splits; s++) {
        const d = new Date(start.getTime() + (spanDays / splits) * s * 864e5);
        const jeId = Number(run(
          `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
           VALUES (?, ?, 'PROJECT', ?, 'posted', 'project_cost', 4)`,
          `PC-2026-${String(pcNo).padStart(3, '0')}-${s + 1}`, d.toISOString().slice(0, 10),
          `تكلفة تنفيذ ${p.code} - ${p.name}`
        ).lastInsertRowid);
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, project_id, memo) VALUES (?, ?, ?, 0, ?, ?)',
          jeId, acc('5300'), per, p.id, 'تكلفة مشروع');
        const cashPart = Math.round(per * 0.7);
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, project_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
          jeId, acc('1200'), cashPart, p.id, 'مدفوعات مشروع');
        run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, project_id, memo) VALUES (?, ?, 0, ?, ?, ?)',
          jeId, acc('2100'), per - cashPart, p.id, 'مستحقات مقاولين');
      }
    }
    // remaining payroll months
    for (let m = 4; m <= 12; m++) {
      const totalPayroll = 48_500_000;
      const jeId = Number(run(
        `INSERT INTO journal_entries (number, date, reference, memo, status, source, created_by)
         VALUES (?, ?, 'PAYROLL', ?, 'posted', 'payroll', 12)`,
        `PR-2026-${String(m).padStart(4, '0')}`, iso(-m * 30), `رواتب الموظفين لشهر ${m}`
      ).lastInsertRowid);
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)',
        jeId, acc('5100'), totalPayroll, 'مصروف رواتب');
      run('INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)',
        jeId, acc('1200'), totalPayroll, 'صرف رواتب');
    }

    /* ----- employees ----- */
    const EMPLOYEES = [
      ['EMP-001', 'م. مؤمن الشافعي', 1, 1, 'المدير التنفيذي', 12_500_000, 3_500_000, -1900],
      ['EMP-002', 'سارة الحسيني', 2, 2, 'مديرة المشاريع', 6_800_000, 1_800_000, -1500],
      ['EMP-003', 'علي كريم', 3, 3, 'مدير المبيعات', 6_200_000, 2_400_000, -1400],
      ['EMP-004', 'زينب عبد الله', 4, 4, 'المحاسب الرئيسي', 4_900_000, 900_000, -1300],
      ['EMP-005', 'حسين الجبوري', 5, 3, 'مسؤول علاقات العملاء', 3_400_000, 700_000, -900],
      ['EMP-006', 'نورة العتيبي', 6, 5, 'مهندسة برمجيات أولى', 5_600_000, 1_100_000, -1200],
      ['EMP-007', 'محمد الصادق', 7, 5, 'مهندس شبكات', 4_300_000, 800_000, -1000],
      ['EMP-008', 'رنا القيسي', 8, 5, 'مصممة تجربة مستخدم', 3_900_000, 600_000, -800],
      ['EMP-009', 'يوسف الحمداني', 9, 5, 'مطور تطبيقات', 4_100_000, 700_000, -650],
      ['EMP-010', 'ليلى عبد الرحمن', 10, 6, 'مسؤولة الموارد البشرية', 3_600_000, 600_000, -1100],
      ['EMP-011', 'أحمد الشمري', 11, 7, 'مدير المشتريات', 5_200_000, 1_000_000, -1350],
      ['EMP-012', 'فاطمة الزهراء', 12, 4, 'محاسبة رواتب', 3_300_000, 500_000, -700],
      ['EMP-013', 'كرار الموسوي', 13, 7, 'مهندس دعم فني', 2_900_000, 600_000, -520],
      ['EMP-014', 'دنيا العبيدي', 9, 2, 'محللة أعمال', 4_000_000, 700_000, -430],
      ['EMP-015', 'مصطفى الجابري', null, 5, 'مطور واجهات أمامية', 3_500_000, 500_000, -310],
      ['EMP-016', 'هدى الربيعي', null, 8, 'فنية دعم فني', 2_400_000, 400_000, -260],
      ['EMP-017', 'سيف الدين حسن', null, 7, 'أمين مخزن', 2_100_000, 300_000, -600],
      ['EMP-018', 'آية محمود', null, 3, 'منسقة مبيعات', 2_300_000, 450_000, -180],
    ];
    EMPLOYEES.forEach(([code, name, uid, dept, title, salary, allow, hireOff], i) => {
      run(
        `INSERT INTO employees (id, code, name, user_id, department_id, job_title, email, phone, hire_date,
          salary, allowances, status, manager_id, national_id, address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        i + 1, code, name, uid, dept, title,
        uid ? get('SELECT email FROM users WHERE id = ?', uid)?.email : `emp${i + 1}@noor.iq`,
        `+964 7${between(70, 81)} ${between(100, 999)} ${between(1000, 9999)}`,
        iso(hireOff), salary, allow, i === 16 ? 'leave' : 'active',
        `IQ-${between(100000, 999999)}`, 'بغداد'
      );
    });

    /* ----- leaves ----- */
    const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'maternity', 'emergency'];
    for (let i = 0; i < 16; i++) {
      const emp = between(1, EMPLOYEES.length);
      const start = iso(between(-90, 20));
      const days = between(1, 10);
      run(`INSERT INTO leaves (employee_id, type, start_date, end_date, days, status, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        emp, pick(LEAVE_TYPES), start, iso(between(-90, 30) + days), days,
        pick(['approved', 'approved', 'pending', 'rejected', 'approved']),
        pick(['إجازة سنوية اعتيادية', 'ظروف صحية', 'ظروف عائلية طارئة', 'إجازة زواج', 'مراجعة طبية']));
    }

    /* ----- attendance (last 18 working days) ----- */
    for (let d = 1; d <= 18; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      if (date.getDay() === 5 || date.getDay() === 6) continue; // Friday/Saturday weekend
      const day = date.toISOString().slice(0, 10);
      for (let e = 1; e <= EMPLOYEES.length; e++) {
        const r = rand();
        const status = r < 0.88 ? 'present' : r < 0.94 ? 'late' : r < 0.97 ? 'leave' : 'absent';
        const checkIn = status === 'present' ? `0${between(8, 8)}:${String(between(0, 55)).padStart(2, '0')}` : status === 'late' ? `09:${between(5, 59)}` : null;
        const checkOut = status === 'present' || status === 'late' ? `1${between(6, 9)}:${String(between(0, 59)).padStart(2, '0')}` : null;
        run(`INSERT OR IGNORE INTO attendance (employee_id, date, check_in, check_out, status)
             VALUES (?, ?, ?, ?, ?)`, e, day, checkIn, checkOut, status);
      }
    }

    /* ----- payslips (3 months) ----- */
    const months = [0, -30, -60];
    months.forEach((off) => {
      const d = new Date(); d.setDate(d.getDate() + off);
      const period = d.toISOString().slice(0, 7);
      EMPLOYEES.forEach(([code, name, , , , salary, allow, ], idx) => {
        if (idx === 16) return;
        const deductions = Math.round(salary * 0.05);
        run(`INSERT OR IGNORE INTO payslips (employee_id, period, basic, allowances, deductions, net, status, date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          idx + 1, period, salary, allow, deductions, salary + allow - deductions,
          off === 0 ? 'draft' : 'paid', iso(off + 5));
      });
    });

    /* ----- real-estate suite ----- */
    seedRealEstate();

    /* ----- activity feed ----- */
    const ACTS = [
      [2, 'project', 1, 'update', 'حدّثت نسبة إنجاز مشروع منصة الحكومة الإلكترونية إلى 68%'],
      [4, 'invoice', 5, 'payment', 'سجّلت دفعة مستلمة على الفاتورة INV-2026-0005'],
      [3, 'quotation', 3, 'create', 'أنشأ عرض سعر جديد بقيمة 42,500,000 د.ع'],
      [6, 'task', 12, 'done', 'أنجزت مهمة "بناء واجهات API للخدمات"'],
      [1, 'project', 7, 'create', 'أنشأ مشروع نظام معلوماتي لمستشفى الكندي بميزانية 625,000,000 د.ع'],
      [9, 'task', 35, 'comment', 'أضاف ملاحظة على مهمة اختبار الأداء وتحسين الاستجابة'],
      [11, 'purchase_order', 4, 'approve', 'اعتمد أمر شراء PO-2026-0004 من شركة سيسكو الشرق الأوسط'],
      [10, 'employee', 15, 'create', 'أضافت الموظف مصطفى الجابري إلى قسم تقنية المعلومات'],
      [2, 'project', 3, 'risk', 'رفعت تنبيهاً بشأن مخاطر الجدول الزمني لمشروع مركز البيانات'],
      [4, 'journal_entry', 12, 'post', 'رحّلت قيد رواتب الشهر إلى دفتر اليومية'],
    ];
    ACTS.forEach(([uid, entity, eid, action, msg], i) => {
      run('INSERT INTO activities (user_id, entity, entity_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        uid, entity, eid, action, msg, new Date(Date.now() - i * 3600_000 * between(2, 9)).toISOString());
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  if (process.env.NODE_ENV === 'production') {
    console.error('SEED BLOCKED: demo data may never be seeded in production.');
    process.exitCode = 2;
  } else if (force && process.env.ALLOW_DESTRUCTIVE_SEED !== 'I_ACKNOWLEDGE_DELETION') {
    console.error('SEED BLOCKED: --force requires ALLOW_DESTRUCTIVE_SEED=I_ACKNOWLEDGE_DELETION on an isolated disposable database.');
    process.exitCode = 2;
  } else if (isSeeded() && !force) {
    console.log('Database already initialized. No changes made.');
  } else {
    seed();
    console.log('✔ Seed completed');
    console.log('   users:', get('SELECT COUNT(*) c FROM users').c);
    console.log('   projects:', get('SELECT COUNT(*) c FROM projects').c);
    console.log('   tasks:', get('SELECT COUNT(*) c FROM tasks').c);
    console.log('   invoices:', get('SELECT COUNT(*) c FROM invoices').c);
  }
}
