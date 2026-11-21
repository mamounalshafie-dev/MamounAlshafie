import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Download, FileSignature, HandCoins, Search, Users, Wallet,
} from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useDebounced, useToast } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, Field, Modal, PageHead, PageSkeleton, Pagination, SearchBox, Select, TextInput, Textarea, exportCsv } from '../components/ui';
import { DueCell, KpiTile, MoneyCell, Panel, ProgressRing, UnitPill } from '../components/re-ui';
import { CollectionModal } from '../components/CollectionModal';
import { formatCompact, formatDate, formatMoney } from '../lib/format';

export default function Contracts() {
  const { code, setCode, projects } = useRe();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState(params.get('status') || '');
  const [type, setType] = useState(params.get('type') || '');
  const [q, setQ] = useState(params.get('q') || '');
  const debounced = useDebounced(q, 350);
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<any>(null);
  const [pay, setPay] = useState<any>(null);

  const { data, loading, reload } = useApi<any>(
    `/re/contracts${qs({ project: code, status, type, q: debounced, page, pageSize: 20 })}`,
    [code, status, type, debounced, page],
  );
  const { data: detail, reload: reloadDetail } = useApi<any>(detailId ? `/re/contracts/${detailId}` : null, [detailId]);

  useEffect(() => {
    if (params.get('new')) { setNewOpen(true); params.delete('new'); setParams(params, { replace: true }); }
  }, [params]);
  useEffect(() => { setPage(1); }, [code, status, type, debounced]);

  const items = data?.items || [];
  const stats = data?.stats || {};

  const doExport = () => exportCsv('contracts', items.map((c: any) => ({
    number: c.number, partner: c.partner_name, unit: c.unit_code, type: c.type,
    date: c.date, price: c.price, collected: c.collected, status: c.status,
  })), [
    { key: 'number', label: 'رقم العقد' }, { key: 'partner', label: 'العميل' }, { key: 'unit', label: 'الوحدة' },
    { key: 'type', label: 'النوع' }, { key: 'date', label: 'التاريخ' }, { key: 'price', label: 'القيمة' },
    { key: 'collected', label: 'المحصل' }, { key: 'status', label: 'الحالة' },
  ]);

  return (
    <div className="page">
      <PageHead
        title="العقود"
        icon={<FileSignature size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المبيعات' }, { label: 'العقود' }]}
        sub="عقود البيع والإيجار، مع جدول الأقساط والتحصيلات والأثر المحاسبي لكل عقد."
        actions={(
          <div className="row gap-8">
            <Btn variant="ghost" icon={<Download size={15} />} onClick={doExport}>تصدير</Btn>
            <Btn icon={<FileSignature size={15} />} onClick={() => setNewOpen(true)}>عقد جديد</Btn>
          </div>
        )}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي العقود" value={stats.total || 0} icon={<FileSignature size={19} />} foot={`${stats.active || 0} نشط · ${stats.completed || 0} مكتمل`} />
        <KpiTile label="عقود البيع" value={stats.sales || 0} icon={<Wallet size={19} />} foot={formatCompact(stats.value)} />
        <KpiTile label="عقود الإيجار" value={stats.rents || 0} icon={<Users size={19} />} foot="إيراد متكرر" />
        <KpiTile label="المحصل من العقود" value={formatCompact(stats.collected)} icon={<HandCoins size={19} />} foot={`دفعات مقدمة ${formatCompact(stats.down)}`} gold />
      </div>

      <div className="card">
        <div className="row-between" style={{ padding: '14px 16px', gap: 12, flexWrap: 'wrap' }}>
          <div className="row gap-8">
            <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 170 }}>
              <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
            <Select value={type} onChange={(e: any) => setType(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">كل الأنواع</option>
              <option value="sale">بيع</option>
              <option value="rent">إيجار</option>
            </Select>
            <Select value={status} onChange={(e: any) => setStatus(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="completed">مكتمل</option>
              <option value="cancelled">ملغي</option>
            </Select>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="رقم العقد أو العميل أو الوحدة…" />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>رقم العقد</th><th>العميل</th><th>الوحدة</th><th>النوع</th><th>التاريخ</th><th>القيمة</th><th>المحصل</th><th>التقدم</th><th>الحالة</th><th /></tr>
            </thead>
            <tbody>
              {items.map((c: any) => {
                const progress = c.installments_total ? Math.round((c.paid_count / c.installments_total) * 100) : 0;
                return (
                  <tr key={c.id} onClick={() => setDetailId(c.id)} style={{ cursor: 'pointer' }}>
                    <td><div style={{ fontWeight: 800 }} className="num">{c.number}</div><div className="tiny muted">{c.project_code}</div></td>
                    <td><div className="small" style={{ fontWeight: 600 }}>{c.partner_name}</div><div className="tiny muted" style={{ direction: 'ltr' }}>{c.partner_phone}</div></td>
                    <td><div className="num small">{c.unit_code}</div><div className="tiny muted">مبنى {c.building_code}</div></td>
                    <td><Badge tone={c.type === 'sale' ? 'indigo' : 'blue'}>{c.type === 'sale' ? 'بيع' : 'إيجار'}</Badge></td>
                    <td className="small">{formatDate(c.date)}</td>
                    <td><MoneyCell value={c.price} strong /></td>
                    <td><MoneyCell value={c.collected} /></td>
                    <td>
                      <div className="row gap-6">
                        <div style={{ width: 62, height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--gold)' }} />
                        </div>
                        <span className="tiny muted num">{progress}%</span>
                      </div>
                    </td>
                    <td><Badge tone={c.status === 'active' ? 'green' : c.status === 'completed' ? 'slate' : 'red'}>{c.status === 'active' ? 'نشط' : c.status === 'completed' ? 'مكتمل' : 'ملغي'}</Badge></td>
                    <td><Btn size="sm" variant="ghost" onClick={(e: any) => { e.stopPropagation(); setDetailId(c.id); }}>تفاصيل</Btn></td>
                  </tr>
                );
              })}
              {!loading && !items.length && <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد عقود مطابقة</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="tiny muted">عرض {items.length} من {stats.total || 0} عقد</span>
          <Pagination page={page} pageSize={20} total={stats.total || 0} onChange={setPage} />
        </div>
      </div>

      <NewContractModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        projects={projects}
        defaultProject={params.get('project') || code}
        defaultUnit={params.get('unit')}
        onSaved={() => { setNewOpen(false); reload(); toast.push('تم إنشاء العقد وتوليد جدول الأقساط'); }}
      />

      {detailId && (
        <div className="drawer-overlay" onClick={() => setDetailId(null)} style={{ zIndex: 70 }}>
          <div className="card" style={{ position: 'fixed', insetInlineEnd: 0, top: 0, bottom: 0, width: 'min(560px, 96vw)', borderRadius: 0, zIndex: 71, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-head" style={{ padding: 16 }}>
              <div>
                <h3 className="num">{detail?.contract?.number || '…'}</h3>
                <div className="tiny muted">{detail?.contract?.project_name} · وحدة {detail?.contract?.unit_code}</div>
              </div>
              <div className="row gap-8">
                <Btn size="sm" variant="gold" icon={<HandCoins size={13} />} onClick={() => setPay(detail?.installments?.find((i: any) => i.status !== 'paid') || true)} disabled={!detail}>تحصيل</Btn>
                <button className="icon-btn" onClick={() => setDetailId(null)}>✕</button>
              </div>
            </div>
            {detail ? (
              <div style={{ padding: '0 16px 20px' }}>
                <div className="grid grid-2" style={{ gap: 10 }}>
                  <div className="mc-tile"><div className="ico"><Users size={17} /></div><div><div className="lbl">العميل</div><div className="val" style={{ fontSize: 14 }}>{detail.contract.partner_name}</div></div></div>
                  <div className="mc-tile"><div className="ico"><Wallet size={17} /></div><div><div className="lbl">قيمة العقد</div><div className="val" style={{ fontSize: 14 }}>{formatCompact(detail.contract.price)}</div></div></div>
                </div>
                <div className="col gap-6 small mt-14">
                  {[
                    ['نوع العقد', detail.contract.type === 'sale' ? 'بيع بالتقسيط' : 'إيجار سنوي'],
                    ['تاريخ العقد', formatDate(detail.contract.date)],
                    ['الدفعة الأولى', formatMoney(detail.contract.down_payment)],
                    ['عدد الأقساط', String(detail.contract.installments_count)],
                    ['قيمة القسط', formatMoney(detail.contract.installment_amount)],
                    ['الحالة', detail.contract.status],
                  ].map(([l, v]) => <div key={String(l)} className="row-between"><span className="muted">{l}</span><span style={{ fontWeight: 700 }}>{v}</span></div>)}
                </div>
                <div className="mt-16"><div className="sec-head"><h3>جدول الأقساط</h3><Badge tone="slate">{detail.installments.length}</Badge></div></div>
                <table className="mini-table">
                  <thead><tr><th>#</th><th>الاستحقاق</th><th>المبلغ</th><th>المسدد</th><th>الحالة</th><th /></tr></thead>
                  <tbody>
                    {detail.installments.map((i: any) => (
                      <tr key={i.id}>
                        <td className="num">{i.seq}</td>
                        <td><DueCell due={i.due_date} status={i.status} /></td>
                        <td><MoneyCell value={i.amount} /></td>
                        <td><MoneyCell value={i.paid_amount} /></td>
                        <td className="small">{i.status === 'paid' ? 'مسدد' : i.status === 'overdue' ? 'متأخر' : i.status === 'partial' ? 'جزئي' : 'مستحق'}</td>
                        <td>{i.status !== 'paid' && <Btn size="sm" variant="ghost" onClick={() => setPay(i)}>تحصيل</Btn>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-16"><div className="sec-head"><h3>التحصيلات</h3><Badge tone="gold">{detail.collections.length}</Badge></div></div>
                <table className="mini-table">
                  <tbody>
                    {detail.collections.map((c: any) => (
                      <tr key={c.id}><td className="num small">{c.number}</td><td className="small">{formatDate(c.date)}</td><td className="small">{c.method}</td><td style={{ textAlign: 'end' }}><MoneyCell value={c.amount} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ padding: 24 }} className="muted small">جارٍ التحميل…</div>}
          </div>
        </div>
      )}

      {detail && (
        <CollectionModal
          open={!!pay}
          onClose={() => setPay(null)}
          unit={{ code: detail.contract.unit_code }}
          contract={detail.contract}
          projectCode={detail.contract.project_code}
          installments={detail.installments}
          preset={pay && pay !== true ? pay : detail.installments.find((i: any) => i.status !== 'paid')}
          onDone={() => { reloadDetail(); reload(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NewContractModal({ open, onClose, projects, defaultProject, defaultUnit, onSaved }: any) {
  const toast = useToast();
  const firstProject = projects?.[0]?.code || 'MC-A';
  const initialProject = defaultProject && defaultProject !== 'all' ? defaultProject : firstProject;
  const [project, setProject] = useState(initialProject);
  const { data: partners } = useApi<any>(open ? '/re/partners?pageSize=100' : null, [open]);
  const [building, setBuilding] = useState('');
  const [unitId, setUnitId] = useState(defaultUnit || '');
  const [partnerId, setPartnerId] = useState('');
  const [type, setType] = useState('sale');
  const [price, setPrice] = useState('');
  const [down, setDown] = useState('');
  const [count, setCount] = useState('24');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: plan } = useApi<any>(open ? `/re/projects/${project}/plan` : null, [open, project]);
  const buildings = plan?.buildings || [];
  const units = useMemo(() => (plan?.units || []).filter((u: any) => ['available', 'reserved'].includes(u.status) && (!building || u.building_id === Number(building))), [plan, building]);
  const selected = units.find((u: any) => u.id === Number(unitId));

  useEffect(() => {
    if (!open) return;
    setProject(initialProject);
    setBuilding('');
    setUnitId(defaultUnit || '');
    setPartnerId('');
    setType('sale');
    setDown('');
    setCount('24');
    setDate(new Date().toISOString().slice(0, 10));
    setNotes('');
  }, [open, initialProject, defaultUnit]);

  useEffect(() => {
    if (selected) {
      setPrice(String(selected.price));
      setDown(String(Math.round(selected.price * 0.2)));
    }
  }, [selected, unitId]);

  const submit = async () => {
    if (!unitId) return toast.push('يرجى اختيار الوحدة', 'error');
    if (!partnerId) return toast.push('يرجى اختيار العميل', 'error');
    setSaving(true);
    try {
      await api.post('/re/contracts', {
        unitId: Number(unitId), partnerId: Number(partnerId), type,
        price: Number(price), downPayment: Number(down) || 0,
        installmentsCount: Number(count) || 12, date, notes,
      });
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر إنشاء العقد', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      open={open} onClose={onClose} title="عقد جديد" sub="إنشاء عقد بيع أو إيجار مع توليد جدول الأقساط وترحيل القيد تلقائياً"
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} loading={saving} icon={<FileSignature size={15} />}>حفظ العقد</Btn></>}
    >
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Field label="المشروع" required>
          <Select value={project} onChange={(e: any) => { setProject(e.target.value); setBuilding(''); setUnitId(''); }}>
            {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="المبنى">
          <Select value={building} onChange={(e: any) => { setBuilding(e.target.value); setUnitId(''); }}>
            <option value="">كل المباني</option>
            {buildings.map((b: any) => <option key={b.id} value={b.id}>مبنى {b.code} — {b.available || 0} متاحة</option>)}
          </Select>
        </Field>
        <Field label="الوحدة" required>
          <Select value={unitId} onChange={(e: any) => setUnitId(e.target.value)}>
            <option value="">اختر الوحدة</option>
            {units.map((u: any) => (
              <option key={u.id} value={u.id}>{u.code} — {u.area} م² — {formatMoney(u.price)} ({u.status === 'available' ? 'متاحة' : 'محجوزة'})</option>
            ))}
          </Select>
        </Field>
        <Field label="العميل" required>
          <Select value={partnerId} onChange={(e: any) => setPartnerId(e.target.value)}>
            <option value="">اختر العميل</option>
            {(partners?.items || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="نوع العقد">
          <Select value={type} onChange={(e: any) => { setType(e.target.value); setCount(e.target.value === 'rent' ? '12' : '24'); }}>
            <option value="sale">بيع</option>
            <option value="rent">إيجار</option>
          </Select>
        </Field>
        <Field label="تاريخ العقد">
          <TextInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
        </Field>
        <Field label="قيمة العقد" required>
          <TextInput type="number" value={price} onChange={(e: any) => setPrice(e.target.value)} />
        </Field>
        <Field label="الدفعة الأولى">
          <TextInput type="number" value={down} onChange={(e: any) => setDown(e.target.value)} />
        </Field>
        <Field label="عدد الأقساط">
          <TextInput type="number" value={count} onChange={(e: any) => setCount(e.target.value)} />
        </Field>
        <Field label="قيمة القسط (تقريبي)">
          <TextInput readOnly value={price && count ? formatMoney((Number(price) - (Number(down) || 0)) / Number(count)) : '—'} />
        </Field>
      </div>
      <Field label="ملاحظات">
        <Textarea rows={2} value={notes} onChange={(e: any) => setNotes(e.target.value)} />
      </Field>
      {selected && (
        <div className="row-between mt-10" style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 12px' }}>
          <span className="small">الوحدة {selected.code} · طابق {selected.floor} · {selected.area} م²</span>
          <UnitPill status={selected.status} small />
        </div>
      )}
    </Modal>
  );
}
