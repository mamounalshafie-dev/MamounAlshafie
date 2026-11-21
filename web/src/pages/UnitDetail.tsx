import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bath, BedDouble, Building2, CalendarClock, ChevronLeft, Compass,
  FileSignature, HandCoins, Home, Layers, MapPin, Maximize, Pause, Play, Ruler, ShieldCheck, Wallet, Wrench,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import { Badge, Btn, Card, PageHead, PageSkeleton, Spinner, Tabs } from '../components/ui';
import { DueCell, KpiTile, MoneyCell, Panel, PriorityPill, ProgressRing, UnitPill } from '../components/re-ui';
import { CollectionModal } from '../components/CollectionModal';
import { UNIT_STATUS } from '../lib/re-context';
import { cx, formatCompact, formatDate, formatMoney } from '../lib/format';

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'contract', label: 'العقد والأقساط' },
  { id: 'collections', label: 'التحصيلات' },
  { id: 'journal', label: 'الأثر المحاسبي' },
  { id: 'maintenance', label: 'الصيانة' },
];

export default function UnitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, reload } = useApi<any>(`/re/units/${id}`, [id]);
  const [tab, setTab] = useState('overview');
  const [mode, setMode] = useState<'tour' | 'video'>('tour');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [pay, setPay] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const media = data?.media || [];
  const images = useMemo(() => media.filter((m: any) => m.kind === 'image'), [media]);
  const video = useMemo(() => media.find((m: any) => m.kind === 'video'), [media]);

  useEffect(() => {
    if (!playing || mode !== 'tour' || images.length < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 4600);
    return () => clearInterval(t);
  }, [playing, mode, images.length]);

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <Spinner />;

  const { unit, contract, installments, collections, services, maintenance, journal, similar, finance } = data;
  const features: string[] = (() => { try { return JSON.parse(unit.features || '[]'); } catch { return []; } })();

  const reserve = async () => {
    setBusy(true);
    try {
      await api.post(`/re/units/${unit.id}/reserve`, { days: 7 });
      toast.push('تم حجز الوحدة لمدة 7 أيام');
      reload();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحجز', 'error'); }
    finally { setBusy(false); }
  };

  const nextDue = finance.nextDue;

  return (
    <div className="page">
      <PageHead
        title={`الوحدة ${unit.code}`}
        icon={<Home size={22} color="#8a6a1f" />}
        breadcrumb={[
          { label: 'المشاريع' },
          { label: 'مخطط الموقع', onClick: () => navigate('/re/plan') } as any,
          { label: unit.building_code || 'مبنى', onClick: () => navigate(`/re/units?building=${unit.building_code}`) } as any,
          { label: unit.code },
        ]}
        sub={`${unit.project_name} · ${unit.phase} · مبنى ${unit.building_code} · طابق ${unit.floor}`}
        actions={(
          <div className="row gap-8">
            <UnitPill status={unit.status} />
            {unit.status === 'available' && <Btn variant="ghost" onClick={reserve} loading={busy} icon={<CalendarClock size={15} />}>حجز 7 أيام</Btn>}
            {['available', 'reserved'].includes(unit.status) && (
              <Btn icon={<FileSignature size={15} />} onClick={() => navigate(`/re/contracts?new=1&project=${unit.project_code}&unit=${unit.id}`)}>إنشاء عقد</Btn>
            )}
            {contract && <Btn variant="gold" icon={<HandCoins size={15} />} onClick={() => setPay(nextDue || true)}>تسجيل تحصيل</Btn>}
          </div>
        )}
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.55fr) minmax(360px,1fr)', gap: 16 }}>
        {/* ---------- media ---------- */}
        <div>
          <div className="row-between mb-10">
            <div className="row gap-6">
              <button className={cx('tour-chapter', mode === 'tour' && 'on')} onClick={() => setMode('tour')} style={mode !== 'tour' ? { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' } : undefined}>جولة تفاعلية</button>
              {video && <button className={cx('tour-chapter', mode === 'video' && 'on')} onClick={() => setMode('video')} style={mode !== 'video' ? { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' } : undefined}>فيديو الوحدة</button>}
            </div>
            <span className="tiny muted">{images.length} صورة · جولة 360°</span>
          </div>

          {mode === 'tour' ? (
            <div className="tour-stage">
              {images.map((m: any, i: number) => (
                <img key={m.id} src={m.url} alt={m.caption || unit.code} className={cx(i === idx && 'on')} />
              ))}
              {!images.length && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }} className="muted">لا توجد صور</div>}
              <div className="tour-overlay" />
              <div style={{ position: 'absolute', top: 14, insetInlineStart: 16, zIndex: 3 }}>
                <div className="row gap-8">
                  <Badge tone="gold">جولة الوحدة</Badge>
                  <Badge tone="slate">{unit.area} م² · {unit.bedrooms ? `${unit.bedrooms} غرف` : 'تجاري'}</Badge>
                </div>
                <div style={{ color: '#fff', fontWeight: 700, marginTop: 8, textShadow: '0 2px 8px rgba(0,0,0,.45)' }}>
                  {images[idx]?.caption || unit.project_name}
                </div>
              </div>
              <div className="tour-chapters">
                {images.map((m: any, i: number) => (
                  <button key={m.id} className={cx('tour-chapter', i === idx && 'on')} onClick={() => { setIdx(i); setPlaying(false); }}>
                    {m.caption}
                  </button>
                ))}
              </div>
              <div className="tour-controls">
                <button className="tour-btn" onClick={() => setPlaying((p) => !p)} title={playing ? 'إيقاف' : 'تشغيل'}>
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button className="tour-btn" onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} title="السابق"><ChevronLeft size={16} /></button>
                <button className="tour-btn" onClick={() => setIdx((i) => (i + 1) % images.length)} title="التالي"><ArrowRight size={16} /></button>
                <div style={{ flex: 1, display: 'flex', gap: 5 }}>
                  {images.map((m: any, i: number) => (
                    <div key={m.id} style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
                      <div style={{ width: i < idx ? '100%' : i === idx ? '100%' : '0%', height: '100%', background: '#e3c27c', transition: 'width .4s ease' }} />
                    </div>
                  ))}
                </div>
                <span className="tiny" style={{ color: 'rgba(255,255,255,.8)' }}>{idx + 1}/{images.length || 1}</span>
              </div>
            </div>
          ) : (
            <div className="tour-stage" style={{ background: '#08182b' }}>
              <video
                key={video?.id}
                src={video?.url}
                poster={images[0]?.url}
                controls
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label={`جولة فيديو للوحدة ${unit.code} من الواجهة إلى الداخل`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#08182b' }}
              />
              <div style={{ position: 'absolute', top: 12, insetInlineStart: 14, zIndex: 3, pointerEvents: 'none' }}>
                <Badge tone="gold">جولة خارجية وداخلية</Badge>
              </div>
              <div style={{ position: 'absolute', bottom: 54, insetInlineStart: 14, zIndex: 3, color: '#fff', pointerEvents: 'none', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
                <div className="small">{video?.caption}</div>
              </div>
            </div>
          )}

          <div className="row gap-8 mt-10" style={{ overflowX: 'auto' }}>
            {images.map((m: any, i: number) => (
              <button key={m.id} className={cx('gallery-thumb', i === idx && 'on')} onClick={() => { setMode('tour'); setIdx(i); setPlaying(false); }} style={{ width: 96, flexShrink: 0 }}>
                <img src={m.url} alt={m.caption} />
              </button>
            ))}
            {video && (
              <button className="gallery-thumb" onClick={() => setMode('video')} style={{ width: 96, flexShrink: 0, position: 'relative' }} title="تشغيل الجولة المرئية">
                <img src={images[0]?.url || video.url} alt="video" />
                <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(8,24,43,.45)', color: '#fff' }}><Play size={18} /></span>
              </button>
            )}
          </div>

          {/* specs */}
          <div className="grid grid-4 mt-16" style={{ gap: 10 }}>
            <KpiTile label="المساحة" value={`${unit.area}`} icon={<Ruler size={18} />} foot="متر مربع" />
            <KpiTile label="غرف النوم" value={unit.bedrooms || '—'} icon={<BedDouble size={18} />} foot={unit.unit_type === 'shop' ? 'محل تجاري' : unit.unit_type === 'office' ? 'مكتب إداري' : 'شقة سكنية'} />
            <KpiTile label="دورات المياه" value={unit.bathrooms || '—'} icon={<Bath size={18} />} foot="حمام" />
            <KpiTile label="الطابق" value={unit.floor} icon={<Layers size={18} />} foot={`مبنى ${unit.building_code}`} />
          </div>
        </div>

        {/* ---------- price / finance ---------- */}
        <div className="col gap-14">
          <Card className="card-pad">
            <div className="row-between">
              <div>
                <div className="tiny muted">سعر الوحدة</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand-700)' }}>{formatMoney(unit.price)}</div>
                <div className="tiny muted">سعر المتر {formatMoney(finance.pricePerMeter)}</div>
              </div>
              <ProgressRing value={finance.progress} size={78} label="سداد" />
            </div>

            <div className="grid grid-3 mt-14" style={{ gap: 8 }}>
              <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 10px' }}>
                <div className="tiny muted">المسدد</div>
                <div className="num small" style={{ fontWeight: 800, color: 'var(--green-600)' }}>{formatCompact(finance.paid)}</div>
              </div>
              <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 10px' }}>
                <div className="tiny muted">المتبقي</div>
                <div className="num small" style={{ fontWeight: 800 }}>{formatCompact(finance.remaining)}</div>
              </div>
              <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 10px' }}>
                <div className="tiny muted">متأخر</div>
                <div className="num small" style={{ fontWeight: 800, color: finance.overdueAmount ? 'var(--red-600)' : 'var(--text)' }}>{formatCompact(finance.overdueAmount)}</div>
              </div>
            </div>

            {unit.status === 'available' && (
              <div className="mt-14 small muted" style={{ lineHeight: 1.9 }}>
                الوحدة متاحة للبيع. يمكنك حجزها مؤقتاً أو إنشاء عقد بيع مباشرة، وسيقوم النظام بتوليد جدول الأقساط وترحيل الإيراد إلى الحسابات.
              </div>
            )}
            {contract && (
              <div className="mt-14">
                <div className="row-between small">
                  <span className="muted">العقد الحالي</span>
                  <b>{contract.number}</b>
                </div>
                <div className="row-between small mt-4">
                  <span className="muted">نوع العقد</span>
                  <span>{contract.type === 'sale' ? 'بيع بالتقسيط' : 'إيجار سنوي'}</span>
                </div>
                <div className="row-between small mt-4">
                  <span className="muted">القسط القادم</span>
                  <span>{nextDue ? `${formatMoney(nextDue.amount - nextDue.paid_amount)} · ${formatDate(nextDue.due_date)}` : '—'}</span>
                </div>
                <div className="row gap-8 mt-12">
                  <Btn size="sm" variant="gold" icon={<HandCoins size={14} />} onClick={() => setPay(nextDue || true)}>تحصيل قسط</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setTab('contract')}>جدول الأقساط</Btn>
                </div>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <div className="row-between">
              <div className="tiny muted">المالك / المستأجر</div>
              {unit.owner_type && <Badge tone="slate">{unit.owner_type === 'investor' ? 'مستثمر' : unit.owner_type === 'tenant' ? 'مستأجر' : 'عميل'}</Badge>}
            </div>
            {unit.owner_name ? (
              <>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{unit.owner_name}</div>
                <div className="small muted" style={{ direction: 'ltr', textAlign: 'start', marginTop: 2 }}>{unit.owner_phone}</div>
                <div className="small muted">{unit.owner_email}</div>
                <div className="row gap-8 mt-10">
                  <Btn size="sm" variant="ghost" icon={<Wallet size={14} />} onClick={() => setPay(nextDue || true)} disabled={!contract}>كشف الحساب</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => navigate(`/re/contracts?q=${contract?.number || ''}`)} disabled={!contract}>العقد</Btn>
                </div>
              </>
            ) : (
              <div className="small muted mt-6">لا يوجد مالك مسجل — الوحدة {UNIT_STATUS[unit.status]}.</div>
            )}
          </Card>

          <Card className="card-pad">
            <div className="tiny muted mb-8">بيانات الوحدة</div>
            <div className="col gap-6 small">
              {[
                ['المشروع', unit.project_name],
                ['المبنى', `مبنى ${unit.building_code} (${unit.building_name})`],
                ['نوع الوحدة', unit.unit_type === 'shop' ? 'محل تجاري' : unit.unit_type === 'office' ? 'مكتب إداري' : unit.unit_type === 'duplex' ? 'دوبلكس' : 'شقة سكنية'],
                ['الإطلالة', unit.view],
                ['الاتجاه', unit.orientation],
                ['تاريخ التسليم', unit.handover_date ? formatDate(unit.handover_date) : '—'],
                ['حجز حتى', unit.reserved_until ? formatDate(unit.reserved_until) : '—'],
              ].map(([label, value]) => (
                <div key={String(label)} className="row-between">
                  <span className="muted">{label}</span>
                  <span style={{ fontWeight: 600 }}>{value || '—'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ---------- tabs ---------- */}
      <div className="mt-18">
        <Tabs tabs={TABS.map((t) => ({ ...t }))} value={tab} onChange={setTab} />

        {tab === 'overview' && (
          <div className="grid mt-14" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14 }}>
            <Panel title="مميزات الوحدة" icon={<ShieldCheck size={16} color="var(--gold)" />}>
              <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                {(features.length ? features : ['مطبخ مجهز', 'تكييف مركزي', 'موقف سيارة']).map((f: string) => (
                  <span key={f} className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text-2)', padding: '6px 12px' }}>{f}</span>
                ))}
              </div>
              <p className="small muted mt-12" style={{ lineHeight: 2 }}>
                {unit.description || 'وحدة ضمن مجمع المدن الحديثة، تشطيبات عالية الجودة وخدمات متكاملة وإدارة مرافق على مدار الساعة.'}
              </p>
              <div className="grid grid-2 mt-12" style={{ gap: 10 }}>
                <div className="mc-tile"><div className="ico"><Building2 size={18} /></div><div><div className="val" style={{ fontSize: 15 }}>{unit.project_code}</div><div className="lbl">{unit.phase}</div></div></div>
                <div className="mc-tile"><div className="ico"><MapPin size={18} /></div><div><div className="val" style={{ fontSize: 15 }}>مبنى {unit.building_code}</div><div className="lbl">{unit.view}</div></div></div>
              </div>
            </Panel>

            <Panel title="خدمات الوحدة" icon={<Wrench size={16} color="var(--gold)" />} right={<Badge tone="gold">{formatMoney(services.reduce((s: number, x: any) => s + x.monthly_fee, 0))} / شهرياً</Badge>} pad>
              <table className="mini-table">
                <tbody>
                  {services.length === 0 && <tr><td className="muted small">لا توجد خدمات مسجلة</td></tr>}
                  {services.map((s: any) => (
                    <tr key={s.id}>
                      <td><div className="small" style={{ fontWeight: 700 }}>{s.name}</div><div className="tiny muted">{s.provider}</div></td>
                      <td style={{ textAlign: 'end' }}><MoneyCell value={s.monthly_fee} /><div className="tiny muted">شهرياً</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        )}

        {tab === 'contract' && (
          <div className="grid mt-14" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14 }}>
            <Panel title="جدول الأقساط" icon={<CalendarClock size={16} color="var(--gold)" />} right={contract && <Badge tone="slate">{installments.length} قسط</Badge>} pad>
              <div className="table-wrap">
                <table className="mini-table">
                  <thead><tr><th>#</th><th>الاستحقاق</th><th>المبلغ</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th><th /></tr></thead>
                  <tbody>
                    {installments.map((i: any) => (
                      <tr key={i.id}>
                        <td className="num">{i.seq}</td>
                        <td><DueCell due={i.due_date} status={i.status} /></td>
                        <td><MoneyCell value={i.amount} /></td>
                        <td><MoneyCell value={i.paid_amount} /></td>
                        <td><MoneyCell value={i.amount - i.paid_amount} /></td>
                        <td>
                          <span className="badge" style={{
                            background: i.status === 'paid' ? '#dcfce7' : i.status === 'overdue' ? '#fee2e2' : i.status === 'partial' ? '#fef3c7' : 'var(--surface-3)',
                            color: i.status === 'paid' ? '#166534' : i.status === 'overdue' ? '#b91c1c' : i.status === 'partial' ? '#92400e' : 'var(--text-2)',
                          }}>
                            {i.status === 'paid' ? 'مسدد' : i.status === 'overdue' ? 'متأخر' : i.status === 'partial' ? 'جزئي' : 'مستحق'}
                          </span>
                        </td>
                        <td>{i.status !== 'paid' && <Btn size="sm" variant="ghost" onClick={() => setPay(i)}>تحصيل</Btn>}</td>
                      </tr>
                    ))}
                    {!installments.length && <tr><td colSpan={7} className="muted small">لا يوجد جدول أقساط — لا يوجد عقد على هذه الوحدة بعد.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="col gap-12">
              <Card className="card-pad">
                <div className="tiny muted">بيانات العقد</div>
                {contract ? (
                  <div className="col gap-6 small mt-8">
                    {[
                      ['رقم العقد', contract.number],
                      ['النوع', contract.type === 'sale' ? 'عقد بيع' : 'عقد إيجار'],
                      ['التاريخ', formatDate(contract.date)],
                      ['القيمة', formatMoney(contract.price)],
                      ['الدفعة الأولى', formatMoney(contract.down_payment)],
                      ['عدد الأقساط', String(contract.installments_count)],
                      ['القسط', formatMoney(contract.installment_amount)],
                      ['الحالة', contract.status === 'active' ? 'نشط' : contract.status === 'completed' ? 'مكتمل' : contract.status],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="row-between"><span className="muted">{l}</span><span style={{ fontWeight: 700 }}>{v}</span></div>
                    ))}
                  </div>
                ) : <div className="small muted mt-6">لا يوجد عقد مرتبط بهذه الوحدة.</div>}
              </Card>
              <Card className="card-pad">
                <div className="tiny muted mb-6">العميل</div>
                <div style={{ fontWeight: 800 }}>{contract?.partner_name || unit.owner_name || '—'}</div>
                {contract?.partner_phone && <div className="small muted" style={{ direction: 'ltr' }}>{contract.partner_phone}</div>}
                {contract && <Btn size="sm" className="mt-10" variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => navigate(`/re/installments?q=${encodeURIComponent(contract.number)}`)}>كل الأقساط</Btn>}
              </Card>
            </div>
          </div>
        )}

        {tab === 'collections' && (
          <Panel title="سجل التحصيلات" icon={<Wallet size={16} color="var(--gold)" />} right={<Badge tone="gold">{collections.length} عملية</Badge>} pad className="mt-14">
            <div className="table-wrap">
              <table className="mini-table">
                <thead><tr><th>رقم الإيصال</th><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th></tr></thead>
                <tbody>
                  {collections.map((c: any) => (
                    <tr key={c.id}>
                      <td className="num">{c.number}</td>
                      <td>{formatDate(c.date)}</td>
                      <td><MoneyCell value={c.amount} strong /></td>
                      <td>{c.method}</td>
                      <td className="small muted">{c.reference || '—'}</td>
                    </tr>
                  ))}
                  {!collections.length && <tr><td colSpan={5} className="muted small">لا توجد تحصيلات بعد.</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'journal' && (
          <Panel title="القيود المحاسبية المرتبطة" icon={<Layers size={16} color="var(--gold)" />} right={<span className="tiny muted">مُرحّلة إلى دليل الحسابات</span>} pad className="mt-14">
            <div className="table-wrap">
              <table className="mini-table">
                <thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th>الحسابات</th><th>مدين</th><th>دائن</th></tr></thead>
                <tbody>
                  {journal.map((j: any) => (
                    <tr key={j.id}>
                      <td className="num">{j.number}</td>
                      <td>{formatDate(j.date)}</td>
                      <td className="small">{j.memo}</td>
                      <td className="tiny muted" style={{ maxWidth: 220 }}>{j.accounts}</td>
                      <td><MoneyCell value={j.debit} /></td>
                      <td><MoneyCell value={j.credit} /></td>
                    </tr>
                  ))}
                  {!journal.length && <tr><td colSpan={6} className="muted small">لا توجد قيود مرتبطة.</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'maintenance' && (
          <Panel title="طلبات الصيانة" icon={<Wrench size={16} color="var(--gold)" />} pad className="mt-14">
            <div className="table-wrap">
              <table className="mini-table">
                <thead><tr><th>الرقم</th><th>التصنيف</th><th>الوصف</th><th>الأولوية</th><th>الحالة</th><th>التكلفة</th><th>التاريخ</th></tr></thead>
                <tbody>
                  {maintenance.map((m: any) => (
                    <tr key={m.id}>
                      <td className="num">{m.number}</td>
                      <td>{m.category}</td>
                      <td className="small">{m.description}</td>
                      <td><PriorityPill priority={m.priority} /></td>
                      <td>{m.status === 'done' ? 'منجز' : m.status === 'in_progress' ? 'قيد التنفيذ' : m.status === 'new' ? 'جديد' : 'ملغي'}</td>
                      <td><MoneyCell value={m.cost} /></td>
                      <td>{formatDate(m.reported_at)}</td>
                    </tr>
                  ))}
                  {!maintenance.length && <tr><td colSpan={7} className="muted small">لا توجد طلبات صيانة.</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      {/* similar */}
      <Panel title="وحدات مشابهة في نفس المبنى" icon={<Home size={16} color="var(--gold)" />} className="mt-14" pad>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {similar.map((s: any) => (
            <button key={s.id} className="card card-pad" style={{ textAlign: 'start', cursor: 'pointer' }} onClick={() => navigate(`/re/units/${s.id}`)}>
              <div className="row-between"><b className="num">{s.code}</b><UnitPill status={s.status} small /></div>
              <div className="tiny muted mt-6">{s.area} م² · طابق {s.floor}</div>
              <div className="small num mt-4" style={{ fontWeight: 700 }}>{formatCompact(s.price)} د.ع</div>
            </button>
          ))}
          {!similar.length && <div className="muted small">لا توجد وحدات مشابهة.</div>}
        </div>
      </Panel>

      <CollectionModal
        open={!!pay}
        onClose={() => setPay(null)}
        unit={unit}
        contract={contract}
        installments={installments}
        projectCode={unit.project_code}
        preset={pay && pay !== true ? pay : nextDue}
        onDone={reload}
      />
    </div>
  );
}
