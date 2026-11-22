import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, ListChecks, Clock3, Users, FileText, Receipt, ShoppingCart,
  Building2, Package, Landmark, BarChart3, UserCog, CalendarDays, Wallet, Settings, Activity,
  Search, Bell, Sun, Moon, Menu, X, LogOut, Plus, ChevronDown, BookOpen, ShieldCheck, Sparkles,
  CircleDollarSign, ClipboardList, ArrowLeftRight, HandCoins, Map as MapIcon, Home, Wifi, Wrench,
  HardHat, FileSignature, CalendarClock, Building, ClipboardCheck,
} from 'lucide-react';
import { useAuth, useApi, useToast } from '../lib/app-context';
import { api, ApiError } from '../lib/api';
import { Avatar, Badge, Spinner } from './ui';
import { cx, formatDateTime, relativeTime } from '../lib/format';
import { CommandPalette } from './CommandPalette';
import { useRe } from '../lib/re-context';

const NAV = [
  {
    label: 'الرئيسية',
    items: [
      { to: '/', label: 'لوحة القيادة', icon: LayoutDashboard, exact: true },
      { to: '/re/reports', label: 'التقارير والتحليلات', icon: BarChart3 },
    ],
  },
  {
    label: 'المشاريع والوحدات',
    items: [
      { to: '/re/plan', label: 'مخطط الموقع', icon: MapIcon },
      { to: '/re/units', label: 'الوحدات', icon: Home },
      { to: '/re/partners', label: 'العملاء والمستثمرون', icon: Users },
    ],
  },
  {
    label: 'العقود والتحصيل',
    items: [
      { to: '/re/contracts', label: 'العقود', icon: FileSignature },
      { to: '/re/installments', label: 'الأقساط', icon: CalendarClock },
      { to: '/re/collections', label: 'التحصيل', icon: HandCoins },
    ],
  },
  {
    label: 'الخدمات والصيانة',
    items: [
      { to: '/re/services', label: 'الخدمات', icon: Wifi },
      { to: '/re/maintenance', label: 'الصيانة', icon: Wrench },
    ],
  },
  {
    label: 'المالية',
    items: [
      { to: '/re/costs', label: 'التكاليف', icon: HardHat },
      { to: '/re/cost-control', label: 'رقابة تكاليف المشاريع', icon: ClipboardCheck },
      { to: '/re/treasury', label: 'الصندوق والبنوك', icon: Landmark },
      { to: '/re/accounts', label: 'ربط الحسابات العقارية', icon: ArrowLeftRight },
      { to: '/accounting', label: 'دليل الحسابات', icon: BookOpen },
      { to: '/accounting/journal', label: 'قيود اليومية', icon: ClipboardList },
      { to: '/accounting/reports', label: 'القوائم المالية', icon: FileText },
    ],
  },
  {
    label: 'الموارد البشرية',
    items: [
      { to: '/hr/employees', label: 'الموظفون', icon: UserCog },
      { to: '/hr/attendance', label: 'الحضور والانصراف', icon: CalendarDays },
      { to: '/hr/payroll', label: 'الرواتب', icon: Wallet },
      { to: '/hr/leaves', label: 'الإجازات', icon: HandCoins, badge: 'pendingLeaves', warn: true },
    ],
  },
  {
    label: 'وحدات إضافية',
    items: [
      { to: '/projects', label: 'المشاريع التشغيلية', icon: FolderKanban },
      { to: '/tasks', label: 'المهام', icon: ListChecks },
      { to: '/invoices', label: 'الفواتير', icon: Receipt },
      { to: '/inventory', label: 'المخزون', icon: Package },
      { to: '/customers', label: 'سجل العملاء', icon: Building },
    ],
  },
  {
    label: 'النظام',
    items: [
      { to: '/activity', label: 'سجل النشاطات', icon: Activity },
      { to: '/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('noor_sidebar') === 'collapsed');
  const [theme, setTheme] = useState(() => localStorage.getItem('noor_theme') || 'light');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const { data: nav } = useApi<any>('/nav-counts', [location.pathname]);
  const { projects: reProjects, code: reCode, setCode: setReProject } = useRe();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('noor_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('noor_sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  useEffect(() => {
    const items = NAV.flatMap((g) => g.items as { to: string; label: string; exact?: boolean }[]);
    const match = items
      .filter((i) => (i.exact || i.to === '/' ? location.pathname === i.to : location.pathname.startsWith(i.to)))
      .sort((a, b) => b.to.length - a.to.length)[0];
    const label = match?.label
      || (location.pathname.startsWith('/re/plan') ? 'مخطط الموقع' : '')
      || (location.pathname.startsWith('/re/units') ? 'الوحدات' : '')
      || (location.pathname === '/profile' ? 'الملف الشخصي' : '')
      || (location.pathname.startsWith('/projects/') ? 'تفاصيل المشروع' : '')
      || (location.pathname.startsWith('/invoices/') ? 'تفاصيل الفاتورة' : '')
      || (location.pathname.startsWith('/customers/') ? 'ملف العميل' : '')
      || (location.pathname.startsWith('/inventory/') ? 'تفاصيل المنتج' : '')
      || (location.pathname.startsWith('/hr/employees/') ? 'ملف الموظف' : '');
    document.title = label ? `${label} · المدن الحديثة` : 'المدن الحديثة | نظام إدارة المشاريع العقارية';
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const alerts = nav?.alerts || [];
  const counts = nav?.counts || {};

  const handleLogout = async () => {
    await logout();
    toast.push('تم تسجيل الخروج بنجاح', 'info');
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="drawer-overlay" style={{ zIndex: 55 }} onClick={() => setSidebarOpen(false)} />}
      <aside className={cx('sidebar', sidebarOpen && 'open')} style={collapsed ? { width: 'var(--sidebar-collapsed)' } : undefined}>
        <div className="sidebar-brand">
          <Link to="/" className="brand-mark" aria-label="المدن الحديثة">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 21V8l8-5 8 5v13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 21v-6h6v6M8 11h2M14 11h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          {!collapsed && (
            <div className="brand-text">
              <b>المدن الحديثة</b>
              <span>Modern Cities ERP</span>
            </div>
          )}
        </div>

        <div className="sidebar-scroll">
          {NAV.map((group) => (
            <div key={group.label}>
              {!collapsed && <div className="nav-group-label">{group.label}</div>}
              {group.items.map((item) => {
                const Icon = item.icon as any;
                const badgeVal = item.badge ? counts[item.badge] : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={(item as any).exact}
                    className={({ isActive }) => cx('nav-item', isActive && 'active')}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={17} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && badgeVal > 0 && (
                      <span className={cx('nav-badge', (item as any).warn && 'warn')}>{badgeVal}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-foot">
          {!collapsed ? (
            <div className="plan-card">
              <div className="row-between">
                <b>المدن الحديثة</b>
                <Sparkles size={13} color="#e3c27c" />
              </div>
              <span>{(reProjects || []).length} مشاريع عقارية · نظام متكامل</span>
              <div className="plan-bar"><i style={{ width: '86%' }} /></div>
            </div>
          ) : (
            <button className="icon-btn" style={{ margin: '0 auto', display: 'grid' }} onClick={() => setCollapsed(false)} title="توسيع القائمة">
              <ArrowLeftRight size={16} />
            </button>
          )}
        </div>
      </aside>

      <div className="main-area" style={{ marginInlineStart: collapsed ? 'var(--sidebar-collapsed)' : undefined }}>
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(true)} aria-label="القائمة">
            <Menu size={19} />
          </button>
          <button className="icon-btn no-mobile" onClick={() => setCollapsed((c) => !c)} aria-label="طي القائمة" style={{ flexShrink: 0 }}>
            <Menu size={18} />
          </button>

          <button className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <Search size={16} />
            <span>بحث شامل في النظام…</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="topbar-actions">
            <div className="re-project-select" style={{ position: 'relative' }}>
              <Building2 size={15} style={{ position: 'absolute', insetInlineStart: 10, top: 11, color: 'var(--gold)', pointerEvents: 'none' }} />
              <select
                value={reCode}
                onChange={(e) => setReProject(e.target.value)}
                aria-label="اختيار المشروع"
                style={{
                  height: 38, borderRadius: 10, border: '1px solid rgba(200,162,74,.45)',
                  background: 'var(--gold-soft)', paddingInlineStart: 32, paddingInlineEnd: 10,
                  fontWeight: 700, fontSize: 12.5, color: 'var(--text)', maxWidth: 220,
                }}
              >
                <option value="all">كل المشاريع</option>
                {(reProjects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>
            <Link to="/re/contracts?new=1" className="btn btn-primary btn-sm" style={{ height: 38 }}>
              <Plus size={15} /> عقد جديد
            </Link>

            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); }} aria-label="التنبيهات">
                <Bell size={18} />
                {alerts.length > 0 && <span className="dot" />}
              </button>
              {notifOpen && (
                <div className="card" style={{ position: 'absolute', insetInlineEnd: 0, top: 46, width: 360, zIndex: 80, boxShadow: 'var(--shadow-xl)' }} onClick={(e) => e.stopPropagation()}>
                  <div className="card-head" style={{ padding: '13px 16px' }}>
                    <h3 style={{ fontSize: 13.5 }}>التنبيهات <Badge tone="red">{alerts.length}</Badge></h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setNotifOpen(false)}><X size={14} /></button>
                  </div>
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    {alerts.length === 0 && <div className="empty" style={{ padding: 30 }}><b>لا توجد تنبيهات</b><p className="small">كل شيء تحت السيطرة ✨</p></div>}
                    {alerts.map((a: any) => (
                      <Link key={a.id} to={a.url} className="cmdk-item" style={{ borderRadius: 0, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span className={cx('badge', `badge-${a.tone}`)} style={{ width: 8, height: 8, padding: 0, borderRadius: '50%' }} />
                        <div className="grow">
                          <b style={{ fontSize: 12.5 }}>{a.title}</b>
                          <span>{a.sub}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="card-foot text-center">
                    <Link to="/activity" className="btn btn-ghost btn-sm">عرض سجل النشاطات</Link>
                  </div>
                </div>
              )}
            </div>

            <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="تبديل المظهر">
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>

            <div style={{ position: 'relative' }}>
              <button className="user-chip" onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); }}>
                <Avatar name={user?.name} color={user?.avatarColor} size="sm" />
                <div className="meta">
                  <b>{user?.name}</b>
                  <span>{user?.jobTitle || 'مستخدم'}</span>
                </div>
                <ChevronDown size={14} color="var(--muted)" />
              </button>
              {userOpen && (
                <div className="card" style={{ position: 'absolute', insetInlineEnd: 0, top: 50, width: 240, zIndex: 80, boxShadow: 'var(--shadow-xl)' }}>
                  <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <div className="row gap-12">
                      <Avatar name={user?.name} color={user?.avatarColor} size="lg" />
                      <div style={{ minWidth: 0 }}>
                        <b style={{ fontSize: 13.5, display: 'block' }} className="truncate">{user?.name}</b>
                        <span className="tiny muted truncate" style={{ display: 'block' }}>{user?.email}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: 6 }}>
                    <Link to="/profile" className="cmdk-item"><UserCog size={15} /> <b style={{ fontWeight: 500 }}>الملف الشخصي</b></Link>
                    <Link to="/settings" className="cmdk-item"><Settings size={15} /> <b style={{ fontWeight: 500 }}>الإعدادات</b></Link>
                    <Link to="/activity" className="cmdk-item"><Activity size={15} /> <b style={{ fontWeight: 500 }}>سجل النشاطات</b></Link>
                  </div>
                  <div style={{ padding: 6, borderTop: '1px solid var(--border)' }}>
                    <button className="cmdk-item" style={{ width: '100%', color: 'var(--red-500)' }} onClick={handleLogout}>
                      <LogOut size={15} /> <b style={{ fontWeight: 500 }}>تسجيل الخروج</b>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
