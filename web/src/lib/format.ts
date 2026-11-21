export const CURRENCY = 'د.ع';

export function formatNumber(n: number | null | undefined, digits = 0) {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatMoney(n: number | null | undefined, opts: { currency?: boolean; digits?: number } = {}) {
  const { currency = true, digits = 0 } = opts;
  const v = Number(n || 0);
  const sign = v < 0 ? '-' : '';
  return `${sign}${formatNumber(Math.abs(v), digits)}${currency ? ' ' + CURRENCY : ''}`;
}

export function formatCompact(n: number | null | undefined) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 1 : 2)} مليار`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)} مليون`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)} ألف`;
  return `${sign}${formatNumber(abs)}`;
}

export function formatMoneyShort(n: number | null | undefined) {
  return `${formatCompact(n)} د.ع`;
}

export function formatPercent(n: number | null | undefined, digits = 0) {
  return `${formatNumber(Number(n || 0), digits)}%`;
}

const AR_DATE = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
const AR_DATE_TIME = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return AR_DATE.format(d);
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return AR_DATE_TIME.format(d);
}

export function relativeTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  const months = Math.round(days / 30);
  if (months < 12) return `قبل ${months} شهر`;
  return `قبل ${Math.round(months / 12)} سنة`;
}

export function daysUntil(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 864e5);
}

export function dueLabel(value?: string | null) {
  const days = daysUntil(value);
  if (days === null) return '—';
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days > 1) return `بعد ${days} يوم`;
  return `متأخر ${Math.abs(days)} يوم`;
}

export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTHS_AR[Number(m) - 1] || m} ${y?.slice(2)}`;
}

export function initials(name?: string) {
  if (!name) return '؟';
  const clean = name.replace(/^(م\.|د\.|أ\.|ا\.)\s*/, '').trim();
  return clean.split(/\s+/).slice(0, 2).map((w) => w.replace(/^ال(?=.{2,})/, '')[0]).join(' ');
}

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1', '#22c55e'];
export function colorFor(name?: string) {
  if (!name) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return PALETTE[hash % PALETTE.length];
}

export const STAGE_LABELS: Record<string, string> = {
  planning: 'تخطيط', in_progress: 'قيد التنفيذ', on_hold: 'متوقف مؤقتاً',
  review: 'مراجعة', done: 'مكتمل', cancelled: 'ملغى',
  backlog: 'قائمة الانتظار', todo: 'قائمة المهام',
};
export const STAGE_TONE: Record<string, string> = {
  planning: 'slate', in_progress: 'blue', on_hold: 'amber', review: 'purple',
  done: 'green', cancelled: 'red', backlog: 'slate', todo: 'slate',
};
export const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة',
};
export const PRIORITY_TONE: Record<string, string> = {
  low: 'slate', medium: 'blue', high: 'amber', critical: 'red',
};
export const INVOICE_STATUS: Record<string, string> = {
  draft: 'مسودة', sent: 'مرسلة', partial: 'مدفوعة جزئياً', paid: 'مدفوعة',
  overdue: 'متأخرة', cancelled: 'ملغاة',
};
export const INVOICE_TONE: Record<string, string> = {
  draft: 'slate', sent: 'blue', partial: 'amber', paid: 'green', overdue: 'red', cancelled: 'slate',
};
export const QUOTE_STATUS: Record<string, string> = {
  draft: 'مسودة', sent: 'مرسلة', accepted: 'مقبولة', rejected: 'مرفوضة',
  expired: 'منتهية الصلاحية', invoiced: 'تم الفوترة',
};
export const PO_STATUS: Record<string, string> = {
  draft: 'مسودة', confirmed: 'مؤكد', received: 'مستلم', billed: 'مفوتر', cancelled: 'ملغى',
};
export const PO_TONE: Record<string, string> = {
  draft: 'slate', confirmed: 'blue', received: 'green', billed: 'purple', cancelled: 'red',
};
export const HEALTH_LABELS: Record<string, string> = {
  good: 'سليم', at_risk: 'في خطر', critical: 'حرج',
};
export const HEALTH_TONE: Record<string, string> = {
  good: 'green', at_risk: 'amber', critical: 'red',
};
export const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير النظام', manager: 'مدير', accountant: 'محاسب', sales: 'مبيعات', employee: 'موظف',
};
export const LEAVE_LABELS: Record<string, string> = {
  annual: 'سنوية', sick: 'مرضية', unpaid: 'بدون راتب', maternity: 'أمومة', emergency: 'طارئة',
};
export const LEAVE_TONE: Record<string, string> = {
  approved: 'green', pending: 'amber', rejected: 'red',
};
export const ACCOUNT_TYPES: Record<string, string> = {
  asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', income: 'إيرادات', expense: 'مصروفات',
};
export const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'حاضر', late: 'متأخر', absent: 'غائب', leave: 'إجازة',
};
export const SOURCE_LABELS: Record<string, string> = {
  manual: 'يدوي', invoice: 'فاتورة', payment: 'تحصيل', purchase: 'شراء',
  payroll: 'رواتب', expense: 'مصروف', project_cost: 'تكلفة مشروع',
};

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function cx(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(' ');
}
