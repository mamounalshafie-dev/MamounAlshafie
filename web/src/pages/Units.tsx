import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Bath, BedDouble, Building2, Download, FileSignature, Layers, LayoutGrid, Search, Wallet,
} from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useDebounced, useToast } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, PageHead, PageSkeleton, Pagination, SearchBox, Select, exportCsv } from '../components/ui';
import { KpiTile, MoneyCell, UnitPill } from '../components/re-ui';
import { cx, formatCompact, formatMoney } from '../lib/format';

const TABS = [
  { id: '', label: 'الكل' },
  { id: 'available', label: 'متاحة' },
  { id: 'reserved', label: 'محجوزة' },
  { id: 'sold', label: 'مباعة' },
  { id: 'rented', label: 'مؤجرة' },
];

export default function Units() {
  const { code, setCode, projects } = useRe();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState(params.get('status') || '');
  const [building, setBuilding] = useState(params.get('building') || '');
  const [q, setQ] = useState(params.get('q') || '');
  const debounced = useDebounced(q, 350);
  const [page, setPage] = useState(1);
  const [unit, setUnit] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, reload } = useApi<any>(
    `/re/units${qs({ project: code, status, building, q: debounced, page, pageSize: 20 })}`,
    [code, status, building, debounced, page],
  );

  useEffect(() => { setPage(1); }, [code, status, building, debounced]);

  const items = data?.items || [];
  const stats = data?.stats || {};
  const buildings = data?.buildings || [];

  const reserve = async (u: any) => {
    setBusy(true);
    try {
      await api.post(`/re/units/${u.id}/reserve`, { days: 7 });
      toast.push(`تم حجز الوحدة ${u.code}`);
      setUnit(null);
      reload();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحجز', 'error'); }
    finally { setBusy(false); }
  };

  const createContract = (u: any) => {
    const projectCode = projects.find((p: any) => p.id === u.project_id)?.code || code;
    navigate(`/re/contracts?new=1&project=${encodeURIComponent(projectCode)}&unit=${u.id}`);
  };

  const doExport = () => {
    exportCsv('units', items.map((u: any) => ({
      code: u.code, building: u.building_code, floor: u.floor, type: u.unit_type,
      area: u.area, price: u.price, status: u.status, owner: u.owner_name,
    })), [
      { key: 'code', label: 'الوحدة' }, { key: 'building', label: 'المبنى' }, { key: 'floor', label: 'الطابق' },
      { key: 'type', label: 'النوع' }, { key: 'area', label: 'المساحة' }, { key: 'price', label: 'السعر' },
      { key: 'status', label: 'الحالة' }, { key: 'owner', label: 'المالك' },
    ]);
  };

  return (
    <div className="page">
      <PageHead
        title="الوحدات"
        icon={<LayoutGrid size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المشاريع' }, { label: 'الوحدات' }]}
        sub="سجل كامل للوحدات مع المساحات والأسعار وحالة البيع والحجز، وربط مباشر بالعقد والتحصيل."
        actions={(
          <div className="row gap-8">
            <Btn variant="ghost" icon={<Download size={15} />} onClick={doExport}>تصدير</Btn>
            <Btn icon={<Layers size={15} />} onClick={() => navigate('/re/plan')}>مخطط الموقع</Btn>
          </div>
        )}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي الوحدات" value={stats.total || 0} icon={<Building2 size={19} />} foot={`${formatCompact(stats.area)} م²`} />
        <KpiTile label="متاحة" value={stats.available || 0} icon={<LayoutGrid size={19} />} foot="جاهزة للبيع الآن" />
        <KpiTile label="محجوزة" value={stats.reserved || 0} icon={<FileSignature size={19} />} foot="بانتظار توقيع العقد" />
        <KpiTile label="مباعة / مؤجرة" value={(stats.sold || 0) + (stats.rented || 0)} icon={<Wallet size={19} />} foot={`قيمة ${formatCompact(stats.value)}`} gold />
      </div>

      <div className="card">
        <div className="row-between" style={{ padding: '14px 16px', gap: 12, flexWrap: 'wrap' }}>
          <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button
                key={t.id || 'all'}
                onClick={() => setStatus(t.id)}
                className="tiny"
                style={{
                  padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 600,
                  border: `1px solid ${status === t.id ? 'var(--brand-600)' : 'var(--border)'}`,
                  background: status === t.id ? 'var(--brand-600)' : 'var(--surface)',
                  color: status === t.id ? '#fff' : 'var(--text-2)',
                }}
              >{t.label}</button>
            ))}
          </div>
          <div className="row gap-8">
            <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 170 }}>
              <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
            <Select value={building} onChange={(e: any) => setBuilding(e.target.value)} style={{ minWidth: 130 }}>
              <option value="">كل المباني</option>
              {buildings.map((b: any) => <option key={b.code} value={b.code}>مبنى {b.code}</option>)}
            </Select>
            <SearchBox value={q} onChange={setQ} placeholder="رقم الوحدة أو الإطلالة…" />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الوحدة</th><th>المبنى / الطابق</th><th>النوع</th><th>المساحة</th><th>السعر</th>
                <th>الحالة</th><th>المالك</th><th>العقود</th><th />
              </tr>
            </thead>
            <tbody>
              {loading && !items.length && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">جارٍ التحميل…</td></tr>
              )}
              {items.map((u: any) => (
                <tr key={u.id} onClick={() => navigate(`/re/units/${u.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="row gap-8">
                      <div className="mc-tile" style={{ padding: 0, border: 'none', background: 'none' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11 }}>{u.building_code}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800 }} className="num">{u.code}</div>
                        <div className="tiny muted">{u.view}</div>
                      </div>
                    </div>
                  </td>
                  <td><div className="small">مبنى {u.building_code}</div><div className="tiny muted">طابق {u.floor}</div></td>
                  <td>
                    <div className="small">{u.unit_type === 'shop' ? 'محل' : u.unit_type === 'office' ? 'مكتب' : u.unit_type === 'duplex' ? 'دوبلكس' : 'شقة'}</div>
                    <div className="tiny muted">
                      {u.bedrooms ? <><BedDouble size={11} style={{ verticalAlign: -1 }} /> {u.bedrooms} · <Bath size={11} style={{ verticalAlign: -1 }} /> {u.bathrooms}</> : '—'}
                    </div>
                  </td>
                  <td className="num">{u.area} م²</td>
                  <td><MoneyCell value={u.price} strong /></td>
                  <td><UnitPill status={u.status} /></td>
                  <td className="small">{u.owner_name || <span className="muted">—</span>}</td>
                  <td>{u.active_contracts ? <Badge tone="gold">{u.active_contracts}</Badge> : <span className="muted small">—</span>}</td>
                  <td>
                    <div className="row gap-4">
                      <Btn size="sm" variant="ghost" onClick={(e: any) => { e.stopPropagation(); navigate(`/re/units/${u.id}`); }}>عرض</Btn>
                      {u.status === 'available' && (
                        <Btn size="sm" variant="ghost" onClick={(e: any) => { e.stopPropagation(); setUnit(u); }}>حجز</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد وحدات مطابقة</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="tiny muted">عرض {items.length} من {stats.total || 0} وحدة</span>
          <Pagination page={page} pageSize={20} total={stats.total || 0} onChange={setPage} />
        </div>
      </div>

      {unit && (
        <div className="drawer-overlay" onClick={() => setUnit(null)} style={{ zIndex: 70 }}>
          <div className="card card-pad" style={{ position: 'fixed', insetInlineEnd: 0, top: 0, bottom: 0, width: 380, borderRadius: 0, zIndex: 71 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h3 className="num">{unit.code}</h3>
              <button className="icon-btn" onClick={() => setUnit(null)}>✕</button>
            </div>
            <UnitPill status={unit.status} />
            <div className="col gap-8 mt-14 small">
              <div className="row-between"><span className="muted">المبنى</span><b>مبنى {unit.building_code}</b></div>
              <div className="row-between"><span className="muted">الطابق</span><b>{unit.floor}</b></div>
              <div className="row-between"><span className="muted">المساحة</span><b>{unit.area} م²</b></div>
              <div className="row-between"><span className="muted">السعر</span><b className="num">{formatMoney(unit.price)}</b></div>
            </div>
            <div className="mt-16">
              <div className="tiny muted mb-6">مدة الحجز</div>
              <Select defaultValue="7">
                <option value="3">3 أيام</option>
                <option value="7">7 أيام</option>
                <option value="15">15 يوم</option>
                <option value="30">30 يوم</option>
              </Select>
            </div>
            <Btn className="mt-14" onClick={() => reserve(unit)} loading={busy} icon={<FileSignature size={15} />}>تأكيد الحجز</Btn>
            <Btn className="mt-8" variant="ghost" onClick={() => createContract(unit)}>إنشاء عقد مباشرة</Btn>
            <div className="tiny muted mt-12" style={{ lineHeight: 1.9 }}>
              سيتم تحويل حالة الوحدة إلى «محجوزة» وتحديد تاريخ انتهاء الحجز، ويمكن متابعتها من مخطط الموقع.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
