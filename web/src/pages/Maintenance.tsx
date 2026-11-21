import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Plus, Timer, Wrench } from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useDebounced, useToast } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, Field, Modal, PageHead, Pagination, SearchBox, Select, TextInput, Textarea } from '../components/ui';
import { KpiTile, MoneyCell, Panel, PriorityPill } from '../components/re-ui';
import { formatCompact, formatDate } from '../lib/format';

const STATUS = [
  { id: '', label: 'الكل' },
  { id: 'new', label: 'جديدة' },
  { id: 'in_progress', label: 'قيد التنفيذ' },
  { id: 'done', label: 'منجزة' },
  { id: 'cancelled', label: 'ملغاة' },
];

export default function Maintenance() {
  const { code, setCode, projects } = useRe();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 350);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState<any>(null);
  const toast = useToast();

  const { data, loading, reload } = useApi<any>(
    `/re/maintenance${qs({ project: code, status, priority, q: debounced, page, pageSize: 20 })}`,
    [code, status, priority, debounced, page],
  );
  useEffect(() => { setPage(1); }, [code, status, priority, debounced]);
  useEffect(() => { if (params.get('new')) { setOpen(true); params.delete('new'); setParams(params, { replace: true }); } }, [params]);

  const items = data?.items || [];
  const stats = data?.stats || {};

  const start = async (m: any) => {
    try {
      await api.patch(`/re/maintenance/${m.id}`, { status: 'in_progress', technician: m.technician || 'فريق الصيانة الداخلية' });
      toast.push(`بدأ تنفيذ الطلب ${m.number}`);
      reload();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر التحديث', 'error'); }
  };

  return (
    <div className="page">
      <PageHead
        title="الصيانة"
        icon={<Wrench size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'الخدمات والصيانة' }, { label: 'الصيانة' }]}
        sub="طلبات الصيانة لكل وحدة، مع الأولوية والفني المسؤول والتكلفة والأثر المحاسبي عند الإنجاز."
        actions={<Btn icon={<Plus size={15} />} onClick={() => setOpen(true)}>طلب صيانة</Btn>}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي الطلبات" value={stats.total || 0} icon={<ClipboardList size={19} />} foot={`${stats.urgent || 0} عاجل`} />
        <KpiTile label="طلبات جديدة" value={stats.new || 0} icon={<Timer size={19} />} foot="بانتظار الإسناد" />
        <KpiTile label="قيد التنفيذ" value={stats.in_progress || 0} icon={<Wrench size={19} />} foot="فرق الصيانة" />
        <KpiTile label="تكاليف منجزة" value={formatCompact(stats.cost)} icon={<CheckCircle2 size={19} />} foot={`${stats.done || 0} طلب منجز`} gold />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 14 }}>
        <div className="card">
          <div className="row-between" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {STATUS.map((s) => (
                <button key={s.id || 'all'} onClick={() => setStatus(s.id)} className="tiny" style={{
                  padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 600,
                  border: `1px solid ${status === s.id ? 'var(--brand-600)' : 'var(--border)'}`,
                  background: status === s.id ? 'var(--brand-600)' : 'var(--surface)',
                  color: status === s.id ? '#fff' : 'var(--text-2)',
                }}>{s.label}</button>
              ))}
            </div>
            <div className="row gap-8">
              <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 160 }}>
                <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
              <Select value={priority} onChange={(e: any) => setPriority(e.target.value)} style={{ minWidth: 120 }}>
                <option value="">كل الأولويات</option>
                <option value="urgent">عاجل</option>
                <option value="high">عالية</option>
                <option value="normal">عادية</option>
                <option value="low">منخفضة</option>
              </Select>
              <SearchBox value={q} onChange={setQ} placeholder="رقم الطلب أو الوصف…" />
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الطلب</th><th>الوحدة</th><th>التصنيف</th><th>الوصف</th><th>الأولوية</th><th>الحالة</th><th>التكلفة</th><th /></tr></thead>
              <tbody>
                {items.map((m: any) => (
                  <tr key={m.id}>
                    <td><div className="num small" style={{ fontWeight: 700 }}>{m.number}</div><div className="tiny muted">{formatDate(m.reported_at)}</div></td>
                    <td><div className="num small">{m.unit_code || '—'}</div><div className="tiny muted">مبنى {m.building_code || '—'}</div></td>
                    <td className="small">{m.category}</td>
                    <td className="small" style={{ maxWidth: 230 }}>{m.description}</td>
                    <td><PriorityPill priority={m.priority} /></td>
                    <td>
                      <Badge tone={m.status === 'done' ? 'green' : m.status === 'in_progress' ? 'blue' : m.status === 'new' ? 'amber' : 'slate'}>
                        {m.status === 'done' ? 'منجز' : m.status === 'in_progress' ? 'قيد التنفيذ' : m.status === 'new' ? 'جديد' : 'ملغي'}
                      </Badge>
                    </td>
                    <td><MoneyCell value={m.cost} /></td>
                    <td>
                      <div className="row gap-4">
                        {m.status === 'new' && <Btn size="sm" variant="ghost" onClick={() => start(m)}>بدء</Btn>}
                        {['new', 'in_progress'].includes(m.status) && <Btn size="sm" variant="ghost" onClick={() => setClosing(m)}>إنجاز</Btn>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !items.length && <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد طلبات مطابقة</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <span className="tiny muted">عرض {items.length} من {stats.total || 0}</span>
            <Pagination page={page} pageSize={20} total={stats.total || 0} onChange={setPage} />
          </div>
        </div>

        <div className="col gap-14">
          <Panel title="حالة الطلبات" icon={<Wrench size={16} color="var(--gold)" />}>
            {[
              ['جديدة', stats.new || 0, '#d97706'],
              ['قيد التنفيذ', stats.in_progress || 0, '#2563eb'],
              ['منجزة', stats.done || 0, '#16a34a'],
              ['ملغاة', stats.cancelled || 0, '#64748b'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="row-between small" style={{ marginBottom: 8 }}>
                <span><i className="mc-dot" style={{ background: String(color) }} /> {label}</span>
                <b className="num">{value}</b>
              </div>
            ))}
          </Panel>
          <Panel title="سياسة الصيانة" icon={<CheckCircle2 size={16} color="var(--gold)" />}>
            <div className="small muted" style={{ lineHeight: 2 }}>
              عند إنجاز الطلب تُسجّل التكلفة تلقائياً كقيد محاسبي (مصروف صيانة / بنك) إن كانت أكبر من صفر، وتُربط بالوحدة والمشروع لقياس تكلفة الوحدة.
            </div>
          </Panel>
        </div>
      </div>

      <NewRequestModal open={open} onClose={() => setOpen(false)} projectCode={code} onSaved={() => { setOpen(false); reload(); toast.push('تم إنشاء طلب الصيانة'); }} />
      <CloseRequestModal item={closing} onClose={() => setClosing(null)} onSaved={() => { setClosing(null); reload(); toast.push('تم إنجاز الطلب وترحيل التكلفة'); }} />
    </div>
  );
}

function NewRequestModal({ open, onClose, projectCode, onSaved }: any) {
  const toast = useToast();
  const { projects } = useRe();
  const fallbackProject = projectCode && projectCode !== 'all' ? projectCode : (projects?.[0]?.code || 'MC-A');
  const [selectedProject, setSelectedProject] = useState(fallbackProject);
  const { data: plan } = useApi<any>(open && selectedProject ? `/re/projects/${selectedProject}/plan` : null, [open, selectedProject]);
  const [building, setBuilding] = useState('');
  const [unitId, setUnitId] = useState('');
  const [category, setCategory] = useState('سباكة');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setSelectedProject(fallbackProject);
    setBuilding('');
    setUnitId('');
  }, [open, fallbackProject]);
  const units = useMemo(() => (plan?.units || []).filter((u: any) => !building || u.building_id === Number(building)), [plan, building]);

  const submit = async () => {
    if (!unitId) return toast.push('يرجى اختيار الوحدة', 'error');
    if (!description) return toast.push('يرجى إدخال وصف المشكلة', 'error');
    setSaving(true);
    try {
      await api.post('/re/maintenance', { unitId: Number(unitId), category, description, priority, dueDate: dueDate || null, project: selectedProject });
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="طلب صيانة جديد" sub="سيُسند الطلب إلى الوحدة المحددة حسب المشروع الحالي"
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} loading={saving}>حفظ الطلب</Btn></>}>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Field label="المشروع" required><Select value={selectedProject} onChange={(e: any) => { setSelectedProject(e.target.value); setBuilding(''); setUnitId(''); }}>{(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label="المبنى"><Select value={building} onChange={(e: any) => { setBuilding(e.target.value); setUnitId(''); }}><option value="">كل المباني</option>{(plan?.buildings || []).map((b: any) => <option key={b.id} value={b.id}>مبنى {b.code}</option>)}</Select></Field>
        <Field label="الوحدة" required><Select value={unitId} onChange={(e: any) => setUnitId(e.target.value)}><option value="">اختر الوحدة</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}</Select></Field>
        <Field label="التصنيف"><Select value={category} onChange={(e: any) => setCategory(e.target.value)}><option>سباكة</option><option>كهرباء</option><option>تكييف</option><option>نجارة</option><option>دهان</option><option>مصعد</option><option>عام</option></Select></Field>
        <Field label="الأولوية"><Select value={priority} onChange={(e: any) => setPriority(e.target.value)}><option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">عالية</option><option value="urgent">عاجل</option></Select></Field>
        <Field label="تاريخ الاستحقاق"><TextInput type="date" value={dueDate} onChange={(e: any) => setDueDate(e.target.value)} /></Field>
      </div>
      <Field label="وصف المشكلة" required><Textarea rows={3} value={description} onChange={(e: any) => setDescription(e.target.value)} /></Field>
    </Modal>
  );
}

function CloseRequestModal({ item, onClose, onSaved }: any) {
  const toast = useToast();
  const [cost, setCost] = useState('');
  const [technician, setTechnician] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (item) { setCost(String(item.cost || 0)); setTechnician(item.technician || ''); } }, [item]);

  const submit = async () => {
    setSaving(true);
    try {
      await api.patch(`/re/maintenance/${item.id}`, { status: 'done', cost: Number(cost) || 0, technician });
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={!!item} onClose={onClose} title="إنجاز طلب الصيانة" sub={item?.number}
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} loading={saving}>تأكيد الإنجاز</Btn></>}>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Field label="التكلفة النهائية"><TextInput type="number" value={cost} onChange={(e: any) => setCost(e.target.value)} /></Field>
        <Field label="الفني المنفذ"><TextInput value={technician} onChange={(e: any) => setTechnician(e.target.value)} /></Field>
      </div>
      <div className="tiny muted" style={{ lineHeight: 1.9 }}>
        سيتم ترحيل قيد محاسبي بقيمة التكلفة (مصروف صيانة / بنك) وربطه بطلب الصيانة والوحدة.
      </div>
    </Modal>
  );
}
