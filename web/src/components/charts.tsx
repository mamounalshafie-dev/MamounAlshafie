import React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCompact, formatMoney, monthLabel } from '../lib/format';

const AXIS = { fontSize: 10.5, fill: '#8b9ab6', fontFamily: 'IBM Plex Sans Arabic, sans-serif' };

export function ChartTooltip({ active, payload, label, money = true, labelFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <b>{labelFormatter ? labelFormatter(label) : (typeof label === 'string' && /^\d{4}-\d{2}$/.test(label) ? monthLabel(label) : label)}</b>
      {payload.map((p: any, i: number) => (
        <div key={i} className="row gap-6" style={{ justifyContent: 'space-between', minWidth: 140 }}>
          <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>
            <i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: p.color || p.fill, marginInlineEnd: 5 }} />
            {p.name}
          </span>
          <span className="num" style={{ fontWeight: 700, fontSize: 12 }}>{money ? formatMoney(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueTrend({ data, height = 280 }: { data: any[]; height?: number }) {
  return (
    <div style={{ direction: 'ltr', width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="#e6eaf3" vertical={false} />
          <XAxis dataKey="month" tick={AXIS} tickFormatter={(m) => monthLabel(m)} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} tickFormatter={(v) => formatCompact(v)} axisLine={false} tickLine={false} width={62} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#6366f1" strokeWidth={2.4} fill="url(#gRev)" dot={false} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="expense" name="المصروفات" stroke="#f59e0b" strokeWidth={2} fill="url(#gExp)" dot={false} activeDot={{ r: 4 }} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11.5, paddingTop: 8 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProfitBars({ data, height = 260 }: { data: any[]; height?: number }) {
  return (
    <div style={{ direction: 'ltr', width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#e6eaf3" vertical={false} />
          <XAxis dataKey="month" tick={AXIS} tickFormatter={(m) => monthLabel(m)} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} tickFormatter={(v) => formatCompact(v)} axisLine={false} tickLine={false} width={58} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
          <Bar dataKey="profit" name="صافي الربح" radius={[5, 5, 0, 0]} maxBarSize={34}>
            {data.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? '#6366f1' : '#ef4444'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, height = 220, centerLabel, centerValue }: { data: { name: string; value: number; color: string }[]; height?: number; centerLabel?: string; centerValue?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div style={{ direction: 'ltr', width: '100%', height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2.5} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>{centerValue ?? total.toLocaleString('en-US')}</div>
          <div className="tiny muted">{centerLabel || 'الإجمالي'}</div>
        </div>
      </div>
    </div>
  );
}

export function HBar({ data, height = 250, color = '#6366f1', valueName = 'القيمة' }: { data: any[]; height?: number; color?: string; valueName?: string }) {
  return (
    <div style={{ direction: 'ltr', width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#e6eaf3" horizontal={false} />
          <XAxis type="number" tick={AXIS} tickFormatter={(v) => formatCompact(v)} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 11 }} width={130} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
          <Bar dataKey="value" name={valueName} fill={color} radius={[0, 5, 5, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniLine({ data, dataKey = 'value', color = '#10b981', height = 40 }: any) {
  return (
    <div style={{ direction: 'ltr', width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
