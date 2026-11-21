import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { UNIT_COLOR, UNIT_STATUS } from '../lib/re-context';
import { cx, formatMoney } from '../lib/format';

export function UnitPill({ status, small = false }: { status: string; small?: boolean }) {
  const color = UNIT_COLOR[status] || '#64748b';
  return (
    <span
      className={cx('badge', small && 'tiny')}
      style={{
        background: `${color}18`, color, border: `1px solid ${color}35`, fontWeight: 700,
        padding: small ? '1px 7px' : '2px 9px', borderRadius: 999, whiteSpace: 'nowrap',
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: 99, background: color, display: 'inline-block', marginInlineEnd: 5 }} />
      {UNIT_STATUS[status] || status}
    </span>
  );
}

export function KpiTile({ label, value, icon, delta, foot, gold = false, onClick }: any) {
  return (
    <div className={cx('mc-tile', gold && 'gold')} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="ico" style={gold ? { background: 'rgba(200,162,74,.16)', color: '#8a6a1f' } : undefined}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="lbl">{label}</div>
        <div className="row gap-8" style={{ alignItems: 'baseline' }}>
          <div className="val">{value}</div>
          {delta !== undefined && delta !== null && (
            <span className={cx('tiny', delta >= 0 ? 'text-green' : 'text-red')} style={{ fontWeight: 700 }}>
              {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(delta)}%
            </span>
          )}
        </div>
        {foot && <div className="tiny muted">{foot}</div>}
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 84, stroke = 9, color = '#c8a24a', label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${(v / 100) * c} ${c}`} strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="num" style={{ fontWeight: 800, fontSize: size > 70 ? 18 : 13 }}>{Math.round(v)}%</div>
          {label && <div className="tiny muted">{label}</div>}
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, icon, right, children, className = '', pad = true }: any) {
  return (
    <div className={cx('card', className)}>
      {title && (
        <div className="card-head" style={{ paddingBottom: 10 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{title}</h3>
          {right}
        </div>
      )}
      <div className={pad ? 'card-pad' : undefined} style={pad ? { paddingTop: 0 } : undefined}>{children}</div>
    </div>
  );
}

export function SectionHead({ title, icon, right }: any) {
  return (
    <div className="sec-head">
      <h3>{icon}{title}</h3>
      {right}
    </div>
  );
}

export function DueCell({ due, status }: { due: string; status: string }) {
  if (!due) return <span className="muted">—</span>;
  const d = new Date(`${due}T12:00:00`);
  const diff = Math.round((d.getTime() - Date.now()) / 864e5);
  const late = diff < 0 && status !== 'paid';
  return (
    <span style={{ color: late ? 'var(--red-600)' : undefined, fontWeight: late ? 700 : 500, whiteSpace: 'nowrap' }}>
      {new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)}
      {late && <span className="tiny" style={{ marginInlineStart: 5 }}>({Math.abs(diff)} يوم)</span>}
    </span>
  );
}

export function MoneyCell({ value, strong = false, tone }: { value: number; strong?: boolean; tone?: string }) {
  return (
    <span className="num" style={{ fontWeight: strong ? 800 : 600, color: tone, whiteSpace: 'nowrap' }}>
      {formatMoney(value)}
    </span>
  );
}

export function LegendItem({ color, label, value }: { color: string; label: string; value?: React.ReactNode }) {
  return (
    <span>
      <i className="mc-dot" style={{ background: color }} />
      {label}
      {value !== undefined && <b className="num" style={{ marginInlineStart: 4 }}>{value}</b>}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, [string, string]> = {
    urgent: ['عاجل', '#dc2626'],
    high: ['عالية', '#ea580c'],
    normal: ['عادية', '#2563eb'],
    low: ['منخفضة', '#64748b'],
  };
  const [label, color] = map[priority] || map.normal;
  return (
    <span className="badge" style={{ background: `${color}15`, color, border: `1px solid ${color}30`, fontWeight: 700 }}>
      {label}
    </span>
  );
}
