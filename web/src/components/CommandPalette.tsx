import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, FolderKanban, ListChecks, Users, Receipt, Package, UserCog, LayoutDashboard,
  ArrowLeft, CornerDownLeft, Building2, ShoppingCart, Landmark, BarChart3, Settings, FileText, Clock3,
} from 'lucide-react';
import { api } from '../lib/api';
import { useDebounced } from '../lib/app-context';
import { cx } from '../lib/format';

const QUICK = [
  { title: 'لوحة التحكم', sub: 'نظرة عامة على الأداء', url: '/', icon: LayoutDashboard },
  { title: 'المشاريع', sub: 'إدارة ومتابعة المشاريع', url: '/projects', icon: FolderKanban },
  { title: 'المهام', sub: 'لوحة المهام (Kanban)', url: '/tasks', icon: ListChecks },
  { title: 'الفواتير', sub: 'الإصدار والتحصيل', url: '/invoices', icon: Receipt },
  { title: 'عروض الأسعار', sub: 'عروض العملاء', url: '/quotations', icon: FileText },
  { title: 'العملاء', sub: 'سجل العملاء', url: '/customers', icon: Users },
  { title: 'الموردون', sub: 'سجل الموردين', url: '/vendors', icon: Building2 },
  { title: 'المخزون', sub: 'المنتجات والحركات', url: '/inventory', icon: Package },
  { title: 'المحاسبة', sub: 'دليل الحسابات والقيود', url: '/accounting', icon: Landmark },
  { title: 'الموظفون', sub: 'الموارد البشرية', url: '/hr/employees', icon: UserCog },
  { title: 'سجل الأوقات', sub: 'تسجيل ساعات العمل', url: '/timesheets', icon: Clock3 },
  { title: 'الإعدادات', sub: 'إعدادات النظام', url: '/settings', icon: Settings },
];

const TYPE_ICONS: Record<string, any> = {
  project: FolderKanban, task: ListChecks, customer: Users, vendor: Building2,
  invoice: Receipt, product: Package, employee: UserCog,
};
const TYPE_LABEL: Record<string, string> = {
  project: 'مشروع', task: 'مهمة', customer: 'عميل', vendor: 'مورد',
  invoice: 'فاتورة', product: 'منتج', employee: 'موظف',
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounced = useDebounced(query, 220);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounced.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(debounced)}`)
      .then((d) => { setResults(d.results || []); setActive(0); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debounced, open]);

  const quickFiltered = useMemo(() => {
    if (!query.trim()) return QUICK.slice(0, 8);
    return QUICK.filter((q) => q.title.includes(query) || q.sub.includes(query)).slice(0, 5);
  }, [query]);

  const items = useMemo(() => [
    ...quickFiltered.map((q) => ({ kind: 'nav', title: q.title, sub: q.sub, url: q.url, icon: q.icon })),
    ...results.map((r) => ({ kind: r.type, title: r.title, sub: r.subtitle, url: r.url, icon: TYPE_ICONS[r.type] || Search, badge: TYPE_LABEL[r.type] })),
  ], [quickFiltered, results]);

  const go = (item: any) => {
    if (!item) return;
    navigate(item.url);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
    else if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" onKeyDown={onKeyDown}>
        <div className="cmdk-input">
          <Search size={19} color="var(--muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن مشروع، مهمة، عميل، فاتورة، منتج…"
          />
          {loading && <span className="small muted">جارٍ البحث…</span>}
          <kbd style={{ fontSize: 10, color: 'var(--muted-2)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 5 }}>ESC</kbd>
        </div>
        <div className="cmdk-results">
          {quickFiltered.length > 0 && <div className="cmdk-group">{query ? 'انتقال سريع' : 'اختصارات سريعة'}</div>}
          {quickFiltered.map((q, i) => (
            <div key={q.url} className={cx('cmdk-item', active === i && 'active')} onMouseEnter={() => setActive(i)} onClick={() => go({ url: q.url })}>
              <span className="ci-icon"><q.icon size={15} /></span>
              <div className="grow"><b>{q.title}</b><span>{q.sub}</span></div>
              <ArrowLeft size={14} color="var(--muted-2)" />
            </div>
          ))}
          {results.length > 0 && <div className="cmdk-group">نتائج البحث</div>}
          {results.map((r, i) => {
            const idx = i + quickFiltered.length;
            const Icon = TYPE_ICONS[r.type] || Search;
            return (
              <div key={`${r.type}-${r.id}`} className={cx('cmdk-item', active === idx && 'active')} onMouseEnter={() => setActive(idx)} onClick={() => go({ url: r.url })}>
                <span className="ci-icon"><Icon size={15} /></span>
                <div className="grow"><b>{r.title}</b><span>{r.subtitle}</span></div>
                <span className="badge badge-slate">{TYPE_LABEL[r.type] || r.type}</span>
              </div>
            );
          })}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="empty" style={{ padding: 32 }}>
              <b>لا توجد نتائج لـ «{query}»</b>
              <p className="small">جرّب كلمة أخرى أو ابحث بالرقم المرجعي.</p>
            </div>
          )}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> تنقل</span>
          <span><kbd>↵</kbd> فتح</span>
          <span><kbd>ESC</kbd> إغلاق</span>
          <span style={{ marginInlineStart: 'auto' }}>نور ERP · بحث موحّد</span>
        </div>
      </div>
    </div>
  );
}
