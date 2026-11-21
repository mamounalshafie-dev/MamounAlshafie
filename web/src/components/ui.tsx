import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Search, X } from 'lucide-react';
import { colorFor, cx, formatMoney, initials } from '../lib/format';

/* ------------------------------- Card ----------------------------- */
export function Card({ children, className = '', pad = false, ...rest }: any) {
  return (
    <div className={cx('card', pad && 'card-pad', className)} {...rest}>{children}</div>
  );
}

export function CardHead({ title, sub, right, icon }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <h3>{icon}{title}</h3>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function SectionTitle({ title, sub, right }: any) {
  return (
    <div className="row-between mb-12">
      <div>
        <h3 style={{ fontSize: 15 }}>{title}</h3>
        {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ------------------------------ Badge ----------------------------- */
export function Badge({ tone = 'slate', children, dot = false, className = '' }: any) {
  return <span className={cx('badge', `badge-${tone}`, className)}>{dot && <span className="dot" />}{children}</span>;
}

export function StatusBadge({ status, labels, tones }: { status: string; labels: Record<string, string>; tones: Record<string, string> }) {
  return <Badge tone={tones[status] || 'slate'} dot>{labels[status] || status}</Badge>;
}

/* ----------------------------- Avatar ----------------------------- */
export function Avatar({ name, color, size = 'md', src }: { name?: string; color?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; src?: string }) {
  const cls = size === 'sm' ? 'avatar avatar-sm' : size === 'lg' ? 'avatar avatar-lg' : size === 'xl' ? 'avatar avatar-xl' : 'avatar';
  return (
    <div className={cls} style={{ background: color || colorFor(name) }} title={name}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials(name)}
    </div>
  );
}

export function AvatarStack({ users, max = 4 }: { users: { name: string; avatar_color?: string }[]; max?: number }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="avatar-stack">
      {shown.map((u, i) => <Avatar key={i} name={u.name} color={u.avatar_color} size="sm" />)}
      {rest > 0 && (
        <div className="avatar avatar-sm" style={{ background: 'var(--surface-3)', color: 'var(--muted)', fontWeight: 700 }}>
          +{rest}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Progress ---------------------------- */
export function Progress({ value, tone, className = '' }: { value: number; tone?: 'green' | 'amber' | 'red' | ''; className?: string }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cx('progress', tone, className)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------ Stat ------------------------------ */
export function Stat({ label, value, suffix, icon, accent = '#4f46e5', foot, trend }: any) {
  return (
    <div className="stat" style={{ ['--accent' as any]: accent }}>
      <div className="top">
        <div>
          <div className="label">{label}</div>
          <div className="value">{value}{suffix && <span>{suffix}</span>}</div>
        </div>
        {icon && <div className="icon-wrap">{icon}</div>}
      </div>
      {(foot || trend) && (
        <div className="foot">
          {trend !== undefined && (
            <span className={cx('trend', trend >= 0 ? 'up' : 'down')}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
            </span>
          )}
          {foot}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Empty ------------------------------ */
export function Empty({ title = 'لا توجد بيانات', message, icon, action }: any) {
  return (
    <div className="empty">
      <div className="icon-wrap">{icon || <Inbox size={24} />}</div>
      <b>{title}</b>
      {message && <p>{message}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

/* ---------------------------- Skeleton ---------------------------- */
export function Skeleton({ height = 16, width = '100%', radius = 8, className = '' }: any) {
  return <div className={cx('skeleton', className)} style={{ height, width, borderRadius: radius }} />;
}

export function PageSkeleton() {
  return (
    <div className="page">
      <Skeleton height={28} width={260} className="mb-16" />
      <div className="grid grid-4 mb-20">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={112} radius={16} />)}
      </div>
      <Skeleton height={320} radius={16} />
    </div>
  );
}

/* ---------------------------- Page head --------------------------- */
export function PageHead({ title, sub, actions, breadcrumb, icon }: any) {
  return (
    <div className="page-head">
      <div>
        {breadcrumb && (
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link>
            {breadcrumb.map((b: any, i: number) => (
              <React.Fragment key={i}>
                <ChevronLeft size={12} />
                {b.to ? <Link to={b.to}>{b.label}</Link> : <span>{b.label}</span>}
              </React.Fragment>
            ))}
          </div>
        )}
        <h1>{icon}{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ----------------------------- Buttons ---------------------------- */
export function Btn({ children, variant = '', size = '', icon, loading, className = '', ...rest }: any) {
  return (
    <button
      className={cx('btn', variant && `btn-${variant}`, size && `btn-${size}`, className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Spinner size={15} /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ size = 18, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite', color }} aria-hidden>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function IconBtn({ children, label, ...rest }: any) {
  return <button className="btn btn-icon" title={label} aria-label={label} {...rest}>{children}</button>;
}

/* ----------------------------- Fields ----------------------------- */
export function Field({ label, children, hint, error, required, className = '', style }: any) {
  return (
    <div className={cx('field', className)} style={style}>
      {label && <label>{label}{required && <span style={{ color: 'var(--red-500)' }}> *</span>}</label>}
      {children}
      {error ? <div className="error">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function TextInput(props: any) {
  return <input className={cx('input', props.className)} {...props} />;
}

export function Textarea(props: any) {
  return <textarea className={cx('textarea', props.className)} {...props} />;
}

export function Select({ options, placeholder, ...rest }: any) {
  return (
    <select className="select" {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function SearchBox({ value, onChange, placeholder = 'بحث…', className = '' }: any) {
  return (
    <div className={cx('search-input', className)}>
      <Search size={15} />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ------------------------------- Tabs ----------------------------- */
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number; icon?: React.ReactNode }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={cx('tab', value === t.id && 'active')} onClick={() => onChange(t.id)}>
          {t.icon}{t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Modal ----------------------------- */
export function Modal({ open, onClose, title, sub, children, footer, size = '', closeOnOverlay = true }: any) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (closeOnOverlay && e.target === e.currentTarget) onClose?.(); }}>
      <div className={cx('modal', size)} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, children, footer }: any) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>
  );
}

/* --------------------------- Confirm ------------------------------ */
type ConfirmState = { open: boolean; title: string; message: string; danger?: boolean; confirmLabel?: string; onConfirm?: () => void | Promise<void> };
const ConfirmContext = createContext<{ confirm: (opts: Omit<ConfirmState, 'open'>) => void }>({ confirm: () => {} });
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false, title: '', message: '' });
  const [busy, setBusy] = useState(false);
  const confirm = (opts: Omit<ConfirmState, 'open'>) => setState({ ...opts, open: true });
  const close = () => setState((s) => ({ ...s, open: false }));

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={state.open}
        onClose={close}
        title={state.title}
        footer={(
          <>
            <Btn onClick={close} disabled={busy}>إلغاء</Btn>
            <Btn
              variant={state.danger ? 'danger' : 'primary'}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try { await state.onConfirm?.(); close(); } finally { setBusy(false); }
              }}
            >
              {state.confirmLabel || 'تأكيد'}
            </Btn>
          </>
        )}
      >
        <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: state.danger ? '#fee2e2' : '#eef2ff', color: state.danger ? '#dc2626' : '#4f46e5', flexShrink: 0 }}>
            <AlertTriangle size={20} />
          </div>
          <p style={{ lineHeight: 1.8, color: 'var(--text-2)' }}>{state.message}</p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/* --------------------------- Money -------------------------------- */
export function Money({ value, compact, className = '', currency = true }: any) {
  return <span className={cx('num', className)}>{compact ? formatMoney(value, { currency, digits: 0 }) : formatMoney(value, { currency })}</span>;
}

/* ------------------------- Pagination ----------------------------- */
export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const list = useMemo(() => {
    const out: number[] = [];
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    for (let i = start; i < start + 5 && i <= pages; i++) out.push(i);
    return out;
  }, [page, pages]);
  if (total <= pageSize) return null;
  return (
    <div className="pagination">
      <span>عرض {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} من {total}</span>
      <div className="pages">
        <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>›</button>
        {list.map((p) => (
          <button key={p} className={cx('page-btn', p === page && 'active')} onClick={() => onChange(p)}>{p}</button>
        ))}
        <button className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>‹</button>
      </div>
    </div>
  );
}

/* --------------------------- CSV export --------------------------- */
export function exportCsv(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows.length) return;
  const cols = headers || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [cols.map((c) => escape(c.label)).join(','), ...rows.map((r) => cols.map((c) => escape(r[c.key])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
