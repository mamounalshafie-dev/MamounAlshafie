import React from 'react';
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCompact, formatMoney, monthLabel } from '../lib/format';

const AXIS = { fontSize: 10.5, fill: '#8b9ab6', fontFamily: 'IBM Plex Sans Arabic, sans-serif' };

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <b>{typeof label === 'string' && /^\d{4}-\d{2}$/.test(label) ? monthLabel(label) : label}</b>
      {payload.map((p: any, i: number) => (
        <div key={i} className="row gap-6" style={{ justifyContent: 'space-between', minWidth: 160 }}>
          <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>
            <i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: p.color || p.fill, marginInlineEnd: 5 }} />
            {p.name}
          </span>
          <span className="num" style={{ fontWeight: 700, fontSize: 12 }}>{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function CollectionsTrend({ data, height = 270 }: { data: any[]; height?: number }) {
  return (
    <div style={{ direction: 'ltr', width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="mcColl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8a24a" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#c8a24a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={AXIS} tickFormatter={(m) => monthLabel(m).split(' ')[0]} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} tickFormatter={(v) => formatCompact(v)} axisLine={false} tickLine={false} width={54} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="sales" name="قيمة العقود" fill="#153a63" radius={[6, 6, 0, 0]} maxBarSize={22} />
          <Area dataKey="collected" name="التحصيلات" stroke="#c8a24a" strokeWidth={2.4} fill="url(#mcColl)" />
          <Line dataKey="collected" name="التحصيلات" stroke="#c8a24a" strokeWidth={2.4} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesTrend({ data, height = 240 }: { data: any[]; height?: number }) {
  return (
    <div style={{ direction: 'ltr', width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={AXIS} tickFormatter={(m) => monthLabel(m).split(' ')[0]} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} tickFormatter={(v) => formatCompact(v)} axisLine={false} tickLine={false} width={54} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="collected" name="التحصيل" fill="#c8a24a" radius={[6, 6, 0, 0]} maxBarSize={20} />
          <Bar dataKey="sales" name="المبيعات" fill="#153a63" radius={[6, 6, 0, 0]} maxBarSize={20} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ data, height = 220, centerLabel = 'وحدة', centerValue }: { data: any[]; height?: number; centerLabel?: string; centerValue?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const p = payload[0];
            return (
              <div className="chart-tip">
                <b>{p.name}</b>
                <div className="num">{p.value} {centerLabel} · {total ? Math.round((p.value / total) * 100) : 0}%</div>
              </div>
            );
          }} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{centerValue ?? total}</div>
          <div className="tiny muted">{centerLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function MiniArea({ data, color = '#c8a24a', height = 34 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${100 - ((v - min) / span) * 88 - 6}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function BarList({ data, valueKey = 'amount', labelKey = 'label', color = '#153a63', money = true }: {
  data: any[]; valueKey?: string; labelKey?: string; color?: string; money?: boolean;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="col gap-10">
      {data.map((d, i) => {
        const value = Number(d[valueKey]) || 0;
        return (
          <div key={i}>
            <div className="row-between" style={{ marginBottom: 4 }}>
              <span className="small" style={{ fontWeight: 600 }}>{d[labelKey]}</span>
              <span className="small num muted">{money ? formatMoney(value) : value}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, (value / max) * 100)}%`, height: '100%', borderRadius: 99, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
