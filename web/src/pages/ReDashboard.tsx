import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Building2, CalendarClock, CheckCircle2, FileSignature, HandCoins,
  Home, KeyRound, Layers, Map as MapIcon, OctagonAlert, TrendingUp, Users, Wallet, Wrench,
} from 'lucide-react';
import { useApi } from '../lib/app-context';
import { useRe, UNIT_COLOR, UNIT_STATUS } from '../lib/re-context';
import { Badge, Btn, Card, PageSkeleton, Spinner } from '../components/ui';
import { CollectionsTrend, StatusDonut, BarList } from '../components/re-charts';
import { DueCell, KpiTile, LegendItem, MoneyCell, Panel, ProgressRing, UnitPill } from '../components/re-ui';
import { cx, formatCompact, formatMoney, relativeTime } from '../lib/format';

export default function ReDashboard() {
  const { code, setCode, projects } = useRe();
  const { data, loading } = useApi<any>(`/re/overview?project=${encodeURIComponent(code)}`, [code]);
  const navigate = useNavigate();

  const k = data?.kpis;
  const statusMix = useMemo(() => ([
    { name: 'متاحة', value: k?.available || 0, color: UNIT_COLOR.available },
    { name: 'محجوزة', value: k?.reserved || 0, color: UNIT_COLOR.reserved },
    { name: 'مباعة', value: k?.sold || 0, color: UNIT_COLOR.sold },
    { name: 'مؤجرة', value: k?.rented || 0, color: UNIT_COLOR.rented },
  ]), [k]);

  const buildingBars = useMemo(() => (data?.buildings || []).slice(0, 8).map((b: any) => ({
    label: `مبنى ${b.code} · ${b.sold || 0}/${b.total || 0} مباع`,
    amount: b.sold || 0,
  })), [data]);

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <Spinner />;

  const trend = data.trend || [];
  const bookings = data.reservations || [];
  const target = data.project ? data.project.units_count : k.units;

  return (
    <div className="page">
      {/* ---------- hero ---------- */}
      <div className="mc-hero">
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="row gap-8 tiny" style={{ color: 'rgba(227,194,124,.85)', letterSpacing: 1 }}>
              <span>MODERN CITIES · EXECUTIVE OVERVIEW</span>
            </div>
            <h1 style={{ fontSize: 25, marginTop: 4 }}>
              لوحة القيادة التنفيذية
            </h1>
            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              {data.project ? `${data.project.name} — ${data.project.district}` : 'نظرة شاملة على جميع المشاريع والوحدات والعقود والتحصيل'}
            </div>
            <div className="row gap-6 mt-12" style={{ flexWrap: 'wrap' }}>
              <button
                className={cx('tour-chapter', code === 'all' && 'on')}
                onClick={() => setCode('all')}
              >كل المشاريع</button>
              {(projects || []).map((p: any) => (
                <button key={p.code} className={cx('tour-chapter', code === p.code && 'on')} onClick={() => setCode(p.code)}>
                  {p.name.replace('المدن الحديثة — ', '')}
                </button>
              ))}
            </div>
          </div>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <Btn variant="gold" icon={<MapIcon size={15} />} onClick={() => navigate('/re/plan')}>مخطط الموقع</Btn>
            <Btn variant="ghost" icon={<FileSignature size={15} />} onClick={() => navigate('/re/contracts?new=1')} style={{ color: '#fff', background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.18)' }}>عقد جديد</Btn>
            <Btn variant="ghost" icon={<HandCoins size={15} />} onClick={() => navigate('/re/installments')} style={{ color: '#fff', background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.18)' }}>تسجيل تحصيل</Btn>
          </div>
        </div>

        <div className="mc-kpi-grid mt-20">
          <div className="mc-kpi gold">
            <div className="lbl"><Home size={13} /> إجمالي الوحدات</div>
            <div className="val">{k.units}<small>وحدة</small></div>
          </div>
          <div className="mc-kpi">
            <div className="lbl"><CheckCircle2 size={13} /> الوحدات المباعة</div>
            <div className="val">{k.sold}<small>وحدة</small></div>
          </div>
          <div className="mc-kpi">
            <div className="lbl"><Layers size={13} /> المتاحة للبيع</div>
            <div className="val">{k.available}<small>وحدة</small></div>
          </div>
          <div className="mc-kpi">
            <div className="lbl"><CalendarClock size={13} /> المحجوزة</div>
            <div className="val">{k.reserved}<small>وحدة</small></div>
          </div>
          <div className="mc-kpi">
            <div className="lbl"><KeyRound size={13} /> المؤجرة</div>
            <div className="val">{k.rented}<small>وحدة</small></div>
          </div>
          <div className="mc-kpi">
            <div className="lbl"><TrendingUp size={13} /> نسبة الإشغال</div>
            <div className="val">{k.occupancy}<small>%</small></div>
          </div>
        </div>
      </div>

      {/* ---------- money strip ---------- */}
      <div className="grid grid-4 mt-16" style={{ gap: 12 }}>
        <KpiTile label="قيمة العقود الموقعة" value={formatCompact(k.contractValue)} icon={<FileSignature size={20} />} foot={`${k.contracts} عقد · ${k.activeContracts} نشط`} />
        <KpiTile label="إجمالي التحصيلات" value={formatCompact(k.collected)} icon={<Wallet size={20} />} foot={`نسبة التحصيل ${k.collectionRate}%`} gold />
        <KpiTile label="المتبقي على العملاء" value={formatCompact(k.outstanding)} icon={<HandCoins size={20} />} foot={`${k.paidCount} قسط مسدد`} />
        <KpiTile label="الأقساط المتأخرة" value={formatCompact(k.overdue)} icon={<OctagonAlert size={20} />} foot={`${k.overdueCount} قسط متأخر`} />
      </div>

      {/* ---------- charts ---------- */}
      <div className="grid mt-16" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 14 }}>
        <Panel
          title="التحصيلات مقابل المبيعات"
          icon={<TrendingUp size={16} color="var(--gold)" />}
          right={<span className="tiny muted">آخر 12 شهراً</span>}
        >
          <div className="row gap-12 mb-8">
            <LegendItem color="#153a63" label="قيمة العقود" />
            <LegendItem color="#c8a24a" label="التحصيلات" />
          </div>
          <CollectionsTrend data={trend} height={262} />
        </Panel>

        <Panel title="توزيع الوحدات" icon={<Layers size={16} color="var(--gold)" />} right={<span className="tiny muted">{k.units} وحدة</span>}>
          <StatusDonut data={statusMix} centerValue={String(k.units)} centerLabel="وحدة" height={196} />
          <div className="col gap-8 mt-8">
            {statusMix.map((s) => (
              <div key={s.name} className="row-between small">
                <LegendItem color={s.color} label={s.name} />
                <span className="num" style={{ fontWeight: 700 }}>{s.value} <span className="muted tiny">({k.units ? Math.round((s.value / k.units) * 100) : 0}%)</span></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid mt-14" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 14 }}>
        <Panel title="مبيعات المباني" icon={<Building2 size={16} color="var(--gold)" />} right={<span className="link tiny" onClick={() => navigate('/re/plan')} style={{ cursor: 'pointer' }}>مخطط الموقع <ArrowLeft size={12} /></span>}>
          {buildingBars.length ? <BarList data={buildingBars} color="#153a63" money={false} /> : <div className="muted small">لا توجد مباني</div>}
          <div className="row-between mt-14 tiny muted">
            <span>إجمالي الوحدات في المشروع</span>
            <b className="num">{target}</b>
          </div>
        </Panel>

        <Panel title="تنبيهات تحتاج إجراءً" icon={<AlertTriangle size={16} color="#dc2626" />}>
          <div className="col gap-8">
            <button className="mc-tile" style={{ width: '100%', textAlign: 'start' }} onClick={() => navigate('/re/installments?status=overdue')}>
              <div className="ico" style={{ background: '#fee2e2', color: '#dc2626' }}><OctagonAlert size={19} /></div>
              <div style={{ flex: 1 }}>
                <div className="val" style={{ fontSize: 17 }}>{k.overdueCount}</div>
                <div className="lbl">قسط متأخر بقيمة {formatCompact(k.overdue)} د.ع</div>
              </div>
              <ArrowLeft size={15} className="muted" />
            </button>
            <button className="mc-tile" style={{ width: '100%', textAlign: 'start' }} onClick={() => navigate('/re/maintenance')}>
              <div className="ico" style={{ background: '#fef3c7', color: '#b45309' }}><Wrench size={19} /></div>
              <div style={{ flex: 1 }}>
                <div className="val" style={{ fontSize: 17 }}>{data.maintenance?.new || 0}</div>
                <div className="lbl">طلب صيانة جديد · {data.maintenance?.urgent || 0} عاجل</div>
              </div>
              <ArrowLeft size={15} className="muted" />
            </button>
            <button className="mc-tile" style={{ width: '100%', textAlign: 'start' }} onClick={() => navigate('/re/units?status=reserved')}>
              <div className="ico" style={{ background: '#fef3c7', color: '#b45309' }}><CalendarClock size={19} /></div>
              <div style={{ flex: 1 }}>
                <div className="val" style={{ fontSize: 17 }}>{k.reserved}</div>
                <div className="lbl">وحدة محجوزة تحتاج متابعة</div>
              </div>
              <ArrowLeft size={15} className="muted" />
            </button>
            <div className="row-between" style={{ padding: '10px 4px', borderTop: '1px dashed var(--border)' }}>
              <span className="small muted">نسبة الإشغال</span>
              <div className="row gap-10">
                <div style={{ width: 120 }}><div style={{ height: 7, borderRadius: 99, background: 'var(--surface-3)' }}><div style={{ width: `${k.occupancy}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#c8a24a,#e3c27c)' }} /></div></div>
                <b className="num">{k.occupancy}%</b>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* ---------- tables ---------- */}
      <div className="grid mt-14" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14 }}>
        <Panel
          title="أقساط مستحقة قريباً"
          icon={<CalendarClock size={16} color="var(--gold)" />}
          right={<span className="link tiny" style={{ cursor: 'pointer' }} onClick={() => navigate('/re/installments')}>عرض الكل <ArrowLeft size={12} /></span>}
          pad
        >
          <div className="table-wrap">
            <table className="mini-table">
              <thead>
                <tr><th>العميل</th><th>الوحدة</th><th>الاستحقاق</th><th>المبلغ</th></tr>
              </thead>
              <tbody>
                {(data.upcoming || []).length === 0 && <tr><td colSpan={4} className="muted small">لا توجد أقساط قادمة</td></tr>}
                {(data.upcoming || []).map((i: any) => (
                  <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/re/installments?q=${encodeURIComponent(i.contract_number)}`)}>
                    <td style={{ fontWeight: 600 }}>{i.partner_name}</td>
                    <td className="num">{i.unit_code}</td>
                    <td><DueCell due={i.due_date} status={i.status} /></td>
                    <td><MoneyCell value={i.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="حجوزات تنتهي قريباً" icon={<CalendarClock size={16} color="#b45309" />} pad>
          <div className="col gap-10">
            {bookings.length === 0 && <div className="muted small">لا توجد حجوزات</div>}
            {bookings.map((b: any) => {
              const days = b.reserved_until ? Math.round((new Date(`${b.reserved_until}T12:00:00`).getTime() - Date.now()) / 864e5) : null;
              return (
                <div key={b.id} className="row-between" style={{ gap: 8 }}>
                  <div>
                    <div className="small" style={{ fontWeight: 700 }}>وحدة {b.code}</div>
                    <div className="tiny muted">مبنى {b.building_code} · {formatCompact(b.price)} د.ع</div>
                  </div>
                  <Badge tone={days !== null && days <= 3 ? 'red' : 'amber'}>
                    {days === null ? 'محجوزة' : days < 0 ? 'انتهى الحجز' : `متبقي ${days} يوم`}
                  </Badge>
                </div>
              );
            })}
            <div className="row gap-6 mt-6">
              <ProgressRing value={k.occupancy} size={54} stroke={6} label="إشغال" />
              <div className="small muted">يُحسب الإشغال كنسبة الوحدات المباعة والمؤجرة من إجمالي الوحدات.</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid mt-14" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,0.9fr)', gap: 14 }}>
        <Panel title="أحدث التحصيلات" icon={<Wallet size={16} color="var(--gold)" />} pad>
          <table className="mini-table">
            <tbody>
              {(data.recent || []).map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <div className="small" style={{ fontWeight: 700 }}>{r.partner_name}</div>
                    <div className="tiny muted">وحدة {r.unit_code} · {r.method}</div>
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <MoneyCell value={r.amount} strong />
                    <div className="tiny muted">{relativeTime(r.date)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="أكبر المشترين" icon={<Users size={16} color="var(--gold)" />} pad>
          <table className="mini-table">
            <tbody>
              {(data.topBuyers || []).map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <div className="small" style={{ fontWeight: 700 }}>{b.name}</div>
                    <div className="tiny muted">{b.contracts} عقد</div>
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <MoneyCell value={b.value} />
                    <div className="tiny muted">محصل {formatCompact(b.collected)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="ملخص الصيانة" icon={<Wrench size={16} color="#b45309" />} pad>
          <div className="col gap-10">
            {[
              ['جديدة', data.maintenance?.new || 0, '#d97706'],
              ['قيد التنفيذ', data.maintenance?.in_progress || 0, '#2563eb'],
              ['منجزة', data.maintenance?.done || 0, '#16a34a'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="row-between">
                <LegendItem color={String(color)} label={String(label)} />
                <b className="num">{value}</b>
              </div>
            ))}
            <div className="tiny muted">إجمالي الطلبات {data.maintenance?.total || 0} — تُرحّل تكاليف الإنجاز تلقائياً إلى الحسابات.</div>
            <Btn size="sm" icon={<Wrench size={13} />} onClick={() => navigate('/re/maintenance')}>إدارة الصيانة</Btn>
          </div>
        </Panel>
      </div>
    </div>
  );
}
