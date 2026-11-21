import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Compass, Layers, Map as MapIcon, Maximize2, Minus, Plus, Search, Trees, Waves,
} from 'lucide-react';
import { useApi } from '../lib/app-context';
import { useRe, UNIT_COLOR, UNIT_STATUS } from '../lib/re-context';
import { Badge, Btn, PageHead, PageSkeleton, SearchBox, Spinner } from '../components/ui';
import { KpiTile, LegendItem, MoneyCell, ProgressRing, UnitPill } from '../components/re-ui';
import { cx, formatCompact, formatMoney } from '../lib/format';

const STATUS_FILTERS = [
  { id: 'all', label: 'كل الوحدات' },
  { id: 'available', label: 'متاحة' },
  { id: 'reserved', label: 'محجوزة' },
  { id: 'sold', label: 'مباعة' },
  { id: 'rented', label: 'مؤجرة' },
];

export default function SitePlan() {
  const { code, setCode, projects } = useRe();
  const { data, loading } = useApi<any>(code === 'all' ? null : `/re/projects/${encodeURIComponent(code)}/plan`, [code]);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<any>(null);

  useEffect(() => {
    setSelected(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [code]);

  const project = data?.project;
  const stats = data?.stats || {};
  const buildings = data?.buildings || [];
  const units = data?.units || [];
  const amenities = data?.amenities || [];

  const byBuilding = useMemo(() => {
    const map: Record<string, any[]> = {};
    units.forEach((u: any) => { (map[u.building_id] = map[u.building_id] || []).push(u); });
    return map;
  }, [units]);

  const selectedBuilding = buildings.find((b: any) => b.id === selected) || null;
  const selectedUnits = selected ? (byBuilding[selected] || []) : [];
  const floors = useMemo(() => {
    const set = [...new Set(selectedUnits.map((u: any) => u.floor))].sort((a, b) => b - a);
    return set;
  }, [selectedUnits]);

  const searchResults = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return units.filter((u: any) => u.code.toLowerCase().includes(term)).slice(0, 8);
  }, [q, units]);

  if (loading && !data) return <PageSkeleton />;
  if (code === 'all') {
    return (
      <div className="page">
        <PageHead title="مخطط الموقع العام" icon={<MapIcon size={22} color="#8a6a1f" />} sub="اختر مشروعاً لعرض مخططه التفاعلي وحالات وحداته." />
        <div className="grid grid-3" style={{ gap: 14 }}>
          {(projects || []).map((p: any) => (
            <button key={p.code} className="card card-pad" onClick={() => setCode(p.code)} style={{ textAlign: 'start', cursor: 'pointer' }}>
              <div className="row-between"><Badge tone="gold">{p.code}</Badge><MapIcon size={20} color="var(--gold)" /></div>
              <h3 className="mt-10">{p.name}</h3>
              <div className="small muted mt-4">{p.phase} · {p.district}</div>
              <div className="row gap-8 mt-14">
                <Badge tone="slate">{p.units || 0} وحدة</Badge>
                <Badge tone="green">{p.available || 0} متاحة</Badge>
                <Badge tone="red">{p.sold || 0} مباعة</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!data) return <Spinner />;

  const matchFilter = (u: any) => filter === 'all' || u.status === filter;
  const dimmed = (b: any) => filter !== 'all' && !(byBuilding[b.id] || []).some(matchFilter);

  const barSegments = (b: any) => {
    const list = byBuilding[b.id] || [];
    const total = list.length || 1;
    return (['sold', 'rented', 'reserved', 'available'] as const)
      .map((s) => ({ s, n: list.filter((u) => u.status === s).length }))
      .map(({ s, n }) => ({ s, w: (n / total) * 100, n }));
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(2.6, z - e.deltaY * 0.0012)));
  };

  return (
    <div className="page">
      <PageHead
        title="مخطط الموقع العام"
        icon={<MapIcon size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المشاريع' }, { label: 'مخطط الموقع' }]}
        sub="اضغط على أي مبنى لعرض طوابقه ووحداته، ثم اضغط على الوحدة للانتقال إلى صفحتها مع الجولة المرئية والعقد والأقساط."
        actions={(
          <div className="row gap-8">
            <SearchBox value={q} onChange={setQ} placeholder="ابحث عن رقم وحدة (A-101)…" />
            <Btn variant="ghost" icon={<Layers size={15} />} onClick={() => navigate('/re/units')}>جدول الوحدات</Btn>
          </div>
        )}
      />

      <div className="row gap-8 mb-14" style={{ flexWrap: 'wrap' }}>
        {(projects || []).map((p: any) => (
          <button
            key={p.code}
            onClick={() => { setCode(p.code); setSelected(null); setZoom(1); setPan({ x: 0, y: 0 }); }}
            className={cx('tour-chapter', code === p.code && 'on')}
            style={code === p.code ? undefined : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }}
          >
            {p.name} · {p.units_count} وحدة
          </button>
        ))}
        {project && (
          <div className="row gap-8" style={{ marginInlineStart: 'auto' }}>
            <Badge tone="gold">مرحلة {project.phase?.replace('المرحلة ', '')}</Badge>
            <Badge tone="slate">{project.district}</Badge>
          </div>
        )}
      </div>

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي الوحدات" value={stats.total || 0} icon={<Building2 size={19} />} foot={`${buildings.length} مبنى · ${formatCompact(stats.area)} م²`} />
        <KpiTile label="مباعة" value={stats.sold || 0} icon={<CheckIcon color="#dc2626" />} foot={formatCompact(stats.sold_value)} />
        <KpiTile label="متاحة للبيع" value={stats.available || 0} icon={<Layers size={19} />} foot={formatCompact(stats.available_value)} gold />
        <KpiTile label="محجوزة" value={stats.reserved || 0} icon={<Compass size={19} />} foot={formatCompact(stats.reserved_value)} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: selected ? 'minmax(0,1.55fr) minmax(340px,1fr)' : '1fr', gap: 14 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-head" style={{ paddingBottom: 8 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapIcon size={16} color="var(--gold)" /> مخطط {project?.code}
              <span className="tiny muted">— {project?.name}</span>
            </h3>
            <div className="row gap-6">
              <button className="icon-btn" onClick={() => setZoom((z) => Math.max(1, z - 0.2))} title="تصغير"><Minus size={14} /></button>
              <span className="tiny num" style={{ minWidth: 34, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button className="icon-btn" onClick={() => setZoom((z) => Math.min(2.6, z + 0.2))} title="تكبير"><Plus size={14} /></button>
              <button className="icon-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="إعادة تعيين"><Maximize2 size={14} /></button>
            </div>
          </div>

          <div className="row gap-8" style={{ padding: '0 18px 10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="tiny"
                style={{
                  padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${filter === f.id ? 'var(--brand-600)' : 'var(--border)'}`,
                  background: filter === f.id ? 'var(--brand-600)' : 'var(--surface)',
                  color: filter === f.id ? '#fff' : 'var(--text-2)', fontWeight: 600,
                }}
              >{f.label}</button>
            ))}
            <div className="mc-legend" style={{ marginInlineStart: 'auto' }}>
              <LegendItem color={UNIT_COLOR.available} label="متاحة" />
              <LegendItem color={UNIT_COLOR.reserved} label="محجوزة" />
              <LegendItem color={UNIT_COLOR.sold} label="مباعة" />
              <LegendItem color={UNIT_COLOR.rented} label="مؤجرة" />
            </div>
          </div>

          <div
            className="plan-stage"
            onWheel={onWheel}
            onPointerDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => {
              if (!dragRef.current) return;
              setPan({ x: dragRef.current.px + (e.clientX - dragRef.current.x), y: dragRef.current.py + (e.clientY - dragRef.current.y) });
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerLeave={() => { dragRef.current = null; }}
            style={{ cursor: zoom > 1 ? 'grab' : 'default', borderRadius: 0 }}
          >
            <svg viewBox="0 0 1600 900" className="plan-svg" style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: 'center', transition: dragRef.current ? 'none' : 'transform .18s ease' }}>
              <defs>
                <linearGradient id="bldgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#eef2f8" />
                </linearGradient>
                <linearGradient id="greenFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e7f0e0" />
                  <stop offset="100%" stopColor="#d6e6ca" />
                </linearGradient>
                <linearGradient id="waterFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#d8ecf7" />
                  <stop offset="100%" stopColor="#bfe0f2" />
                </linearGradient>
                <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#0a1c33" floodOpacity="0.16" />
                </filter>
              </defs>

              {/* site ground */}
              <rect x="0" y="0" width="1600" height="900" fill="transparent" />
              <rect x="40" y="40" width="1520" height="820" rx="26" fill="rgba(255,255,255,.35)" stroke="#dcd6c6" strokeWidth="2" />

              {/* roads */}
              {[196, 391, 586].map((y) => (
                <g key={`h${y}`}>
                  <rect x="70" y={y - 10} width="1120" height="22" fill="#e9e6dd" />
                  <line x1="80" y1={y + 1} x2="1180" y2={y + 1} stroke="#cfc9b8" strokeWidth="1.5" strokeDasharray="14 12" />
                </g>
              ))}
              {[311, 611, 911].map((x) => (
                <g key={`v${x}`}>
                  <rect x={x - 10} y="80" width="22" height="800" fill="#e9e6dd" />
                  <line x1={x + 1} y1="90" x2={x + 1} y2="870" stroke="#cfc9b8" strokeWidth="1.5" strokeDasharray="14 12" />
                </g>
              ))}

              {/* amenities */}
              {amenities.map((a: any) => {
                if (a.kind === 'water') {
                  return (
                    <g key={a.code} className="plan-amenity">
                      <rect x={a.x} y={a.y} width={a.w} height={a.h} rx="16" fill="url(#waterFill)" stroke="#a9cfe6" />
                      <path d={`M${a.x + 20} ${a.y + a.h / 2} q 30 -22 60 0 t 60 0 t 60 0`} stroke="#8fc0dd" strokeWidth="3" fill="none" />
                      <text x={a.x + a.w / 2} y={a.y + a.h - 16} textAnchor="middle" fill="#3d6d8c" fontSize="13" fontWeight="700">{a.name}</text>
                    </g>
                  );
                }
                if (a.kind === 'green') {
                  return (
                    <g key={a.code} className="plan-amenity">
                      <rect x={a.x} y={a.y} width={a.w} height={a.h} rx="18" fill="url(#greenFill)" stroke="#c2d8b2" />
                      {Array.from({ length: Math.max(4, Math.floor(a.w / 55)) }).map((_, i) => (
                        <circle key={i} cx={a.x + 24 + i * (a.w - 40) / Math.max(4, Math.floor(a.w / 55) - 1)} cy={a.y + (i % 2 ? a.h * 0.32 : a.h * 0.62)} r="8" fill="#9dc183" opacity="0.9" />
                      ))}
                      <text x={a.x + a.w / 2} y={a.y + a.h - 14} textAnchor="middle" fill="#4e6b3f" fontSize="13" fontWeight="700">{a.name}</text>
                    </g>
                  );
                }
                return (
                  <g key={a.code} className="plan-amenity">
                    <rect x={a.x} y={a.y} width={a.w} height={a.h} rx="12" fill={a.kind === 'retail' ? '#f7ecdc' : '#eef1f6'} stroke={a.kind === 'retail' ? '#e3cba5' : '#d3dae5'} />
                    <text x={a.x + a.w / 2} y={a.y + a.h / 2 + 4} textAnchor="middle" fill="#4a5568" fontSize="12.5" fontWeight="700">{a.name}</text>
                  </g>
                );
              })}

              {/* buildings */}
              {buildings.map((b: any) => {
                const isSel = selected === b.id;
                return (
                  <g
                    key={b.id}
                    className="plan-bldg"
                    onClick={() => setSelected(isSel ? null : b.id)}
                    opacity={dimmed(b) ? 0.42 : 1}
                  >
                    <rect
                      x={b.map_x} y={b.map_y} width={b.map_w} height={b.map_h} rx="14"
                      fill="url(#bldgFill)" stroke={isSel ? '#c8a24a' : '#ccd6e2'} strokeWidth={isSel ? 3.5 : 1.5}
                      filter="url(#soft)"
                    />
                    <rect x={b.map_x} y={b.map_y} width={b.map_w} height="26" rx="14" fill={isSel ? '#c8a24a' : '#153a63'} />
                    <rect x={b.map_x} y={b.map_y + 14} width={b.map_w} height="12" fill={isSel ? '#c8a24a' : '#153a63'} />
                    <text x={b.map_x + 12} y={b.map_y + 18} fill="#fff" fontSize="13" fontWeight="800">مبنى {b.code}</text>
                    <text x={b.map_x + b.map_w - 12} y={b.map_y + 18} fill="rgba(255,255,255,.75)" fontSize="10.5" textAnchor="end">{b.floors} طوابق</text>

                    <text x={b.map_x + 12} y={b.map_y + 52} fill="#12233a" fontSize="11.5" fontWeight="700">{b.total || 0} وحدة</text>
                    <text x={b.map_x + b.map_w - 12} y={b.map_y + 52} fill="#7a8699" fontSize="10" textAnchor="end">{formatCompact(b.value)} د.ع</text>

                    {barSegments(b).map((seg, i, arr) => {
                      const prev = arr.slice(0, i).reduce((s, x) => s + x.w, 0);
                      return (
                        <rect
                          key={seg.s}
                          x={b.map_x + 12 + ((b.map_w - 24) * prev) / 100}
                          y={b.map_y + 62}
                          width={((b.map_w - 24) * seg.w) / 100}
                          height="7"
                          fill={UNIT_COLOR[seg.s]}
                          rx="3"
                        />
                      );
                    })}

                    <g transform={`translate(${b.map_x + 12}, ${b.map_y + 80})`}>
                      {(['available', 'reserved', 'sold'] as const).map((s, i) => (
                        <text key={s} x={i * 52} y="0" fill={UNIT_COLOR[s]} fontSize="9.5" fontWeight="700">
                          {(byBuilding[b.id] || []).filter((u) => u.status === s).length} {s === 'available' ? 'متاح' : s === 'reserved' ? 'حجز' : 'مباع'}
                        </text>
                      ))}
                    </g>
                  </g>
                );
              })}

              {/* compass + scale */}
              <g transform="translate(1470, 795)">
                <circle r="30" fill="rgba(255,255,255,.75)" stroke="#cfc7b5" />
                <path d="M0 -20 L7 8 L0 2 L-7 8 Z" fill="#c8a24a" />
                <text y="-29" textAnchor="middle" fontSize="10" fill="#6b7a90" fontWeight="700">N</text>
              </g>
              <g transform="translate(70, 800)">
                <rect x="0" y="0" width="120" height="6" fill="#153a63" opacity="0.55" />
                <text x="0" y="-6" fontSize="10" fill="#6b7a90">50 م</text>
              </g>
            </svg>

            {searchResults.length > 0 && (
              <div className="card" style={{ position: 'absolute', top: 12, insetInlineEnd: 12, width: 250, zIndex: 5, padding: 10 }}>
                <div className="tiny muted mb-6">نتائج البحث ({searchResults.length})</div>
                <div className="col gap-4">
                  {searchResults.map((u: any) => (
                    <button key={u.id} className="row-between" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 2px' }} onClick={() => navigate(`/re/units/${u.id}`)}>
                      <span className="small" style={{ fontWeight: 700 }}>{u.code}</span>
                      <UnitPill status={u.status} small />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {selected && selectedBuilding && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 780 }}>
            <div className="card-head">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} color="var(--gold)" /> مبنى {selectedBuilding.code}
                  <Badge tone="slate">{selectedUnits.length} وحدة</Badge>
                </h3>
                <div className="tiny muted mt-4">
                  {selectedBuilding.floors} طوابق · {formatCompact(selectedBuilding.area)} م² · قيمة {formatCompact(selectedBuilding.value)} د.ع
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)} title="إغلاق">✕</button>
            </div>

            <div style={{ padding: '0 16px 8px' }}>
              <div className="row gap-10" style={{ alignItems: 'center' }}>
                <ProgressRing value={selectedUnits.length ? Math.round((selectedUnits.filter((u) => u.status === 'sold').length / selectedUnits.length) * 100) : 0} size={58} stroke={6} label="مباع" />
                <div className="col gap-4" style={{ flex: 1 }}>
                  {(['available', 'reserved', 'sold', 'rented'] as const).map((s) => (
                    <div key={s} className="row-between tiny">
                      <LegendItem color={UNIT_COLOR[s]} label={UNIT_STATUS[s]} />
                      <b className="num">{selectedUnits.filter((u) => u.status === s).length}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: '4px 16px 18px' }}>
              {floors.map((floor) => (
                <div key={floor} className="floor-row">
                  <div className="floor-label">طابق {floor}</div>
                  <div className="floor-units">
                    {selectedUnits
                      .filter((u) => u.floor === floor)
                      .sort((a, b) => String(a.unit_no).localeCompare(String(b.unit_no)))
                      .map((u) => (
                        <button
                          key={u.id}
                          className={cx('unit-chip', u.status)}
                          onClick={() => navigate(`/re/units/${u.id}`)}
                          title={`${u.code} · ${u.area} م² · ${formatMoney(u.price)}`}
                          style={{ opacity: matchFilter(u) ? 1 : 0.32 }}
                        >
                          {u.unit_no}
                          <small>{u.area} م²</small>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
              <div className="row gap-6 mt-12">
                <Btn size="sm" variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => setSelected(null)}>رجوع للمخطط</Btn>
                <Btn size="sm" icon={<Layers size={13} />} onClick={() => navigate(`/re/units?building=${selectedBuilding.code}`)}>قائمة وحدات المبنى</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      {!selected && (
        <div className="grid mt-14" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {buildings.map((b: any) => (
            <button key={b.id} className="card card-pad" style={{ textAlign: 'start', cursor: 'pointer' }} onClick={() => setSelected(b.id)}>
              <div className="row-between">
                <b>مبنى {b.code}</b>
                <Badge tone="slate">{b.total} وحدة</Badge>
              </div>
              <div className="row gap-8 mt-10" style={{ flexWrap: 'wrap' }}>
                {(['available', 'reserved', 'sold', 'rented'] as const).map((s) => {
                  const n = (byBuilding[b.id] || []).filter((u) => u.status === s).length;
                  return n ? <span key={s} className="tiny"><LegendItem color={UNIT_COLOR[s]} label={`${n}`} /></span> : null;
                })}
              </div>
              <div className="mt-10"><MoneyCell value={b.value} /></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return <span style={{ width: 19, height: 19, borderRadius: 6, background: `${color}22`, display: 'grid', placeItems: 'center', color, fontWeight: 900, fontSize: 11 }}>✓</span>;
}
