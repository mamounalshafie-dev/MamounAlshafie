import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Plus, Wallet, Wifi, Wrench } from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useDebounced, useToast } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, Field, Modal, PageHead, Pagination, SearchBox, Select, TextInput, Textarea } from '../components/ui';
import { KpiTile, MoneyCell, Panel } from '../components/re-ui';
import { BarList } from '../components/re-charts';
import { formatCompact, formatDate, formatMoney } from '../lib/format';

export default function Services() {
  const { code, setCode, projects } = useRe();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 350);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const { data, loading, reload } = useApi<any>(
    `/re/services${qs({ project: code, q: debounced, page, pageSize: 20 })}`,
    [code, debounced, page],
  );
  useEffect(() => { setPage(1); }, [code, debounced]);
  useEffect(() => { if (params.get('new')) { setOpen(true); params.delete('new'); setParams(params, { replace: true }); } }, [params]);

  const items = data?.items || [];
  const stats = data?.stats || {};
  const byName = data?.byName || [];

  const toggle = async (s: any) => {
    try {
      await api.patch(`/re/services/${s.id}`, { status: s.status === 'active' ? 'suspended' : 'active' });
      reload();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر التحديث', 'error'); }
  };

  return (
    <div className="page">
      <PageHead
        title="الخدمات"
        icon={<Wifi size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'الخدمات والصيانة' }, { label: 'الخدمات' }]}
        sub="خدمات الوحدات الشهرية (إنترنت، كهرباء، ماء، أمن، نظافة) وربطها بإيرادات الخدمات."
        actions={<Btn icon={<Plus size={15} />} onClick={() => setOpen(true)}>إضافة خدمة</Btn>}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي الاشتراكات" value={stats.total || 0} icon={<Wifi size={19} />} foot={`${stats.units || 0} وحدة مشمولة`} />
        <KpiTile label="اشتراكات نشطة" value={stats.active || 0} icon={<Building2 size={19} />} foot="قيد التقديم" />
        <KpiTile label="الإيراد الشهري" value={formatCompact(stats.monthly)} icon={<Wallet size={19} />} foot="من رسوم الخدمات" gold />
        <KpiTile label="متوسط رسوم الوحدة" value={formatCompact(stats.units ? stats.monthly / stats.units : 0)} icon={<Wrench size={19} />} foot="شهرياً" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 14 }}>
        <div className="card">
          <div className="row-between" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 14 }}>اشتراكات الوحدات</h3>
            <div className="row gap-8">
              <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 170 }}>
                <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
              <SearchBox value={q} onChange={setQ} placeholder="الخدمة أو الوحدة…" />
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الخدمة</th><th>المزوّد</th><th>الوحدة</th><th>الرسوم الشهرية</th><th>بداية الاشتراك</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {items.map((s: any) => (
                  <tr key={s.id}>
                    <td><div className="small" style={{ fontWeight: 700 }}>{s.name}</div><div className="tiny muted">مبنى {s.building_code}</div></td>
                    <td className="small">{s.provider || '—'}</td>
                    <td><div className="num small">{s.unit_code}</div><div className="tiny muted">{s.unit_status === 'sold' ? 'مباعة' : s.unit_status === 'rented' ? 'مؤجرة' : 'متاحة'}</div></td>
                    <td><MoneyCell value={s.monthly_fee} strong /></td>
                    <td className="small">{formatDate(s.start_date)}</td>
                    <td><Badge tone={s.status === 'active' ? 'green' : 'slate'}>{s.status === 'active' ? 'نشط' : 'موقوف'}</Badge></td>
                    <td><Btn size="sm" variant="ghost" onClick={() => toggle(s)}>{s.status === 'active' ? 'إيقاف' : 'تفعيل'}</Btn></td>
                  </tr>
                ))}
                {!loading && !items.length && <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد خدمات</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <span className="tiny muted">عرض {items.length} من {stats.total || 0}</span>
            <Pagination page={page} pageSize={20} total={stats.total || 0} onChange={setPage} />
          </div>
        </div>

        <div className="col gap-14">
          <Panel title="الإيراد حسب الخدمة" icon={<Wallet size={16} color="var(--gold)" />}>
            <BarList data={byName.slice(0, 7).map((s: any) => ({ label: s.name, amount: s.monthly }))} color="var(--gold)" />
          </Panel>
          <Panel title="ملاحظة محاسبية" icon={<Wrench size={16} color="var(--gold)" />}>
            <div className="small muted" style={{ lineHeight: 2 }}>
              تُحصّل رسوم الخدمات شهرياً وتُسجل كإيرادات خدمات، ويمكن ربطها بحساب الإيرادات في دليل الحسابات من شاشة الإعدادات المحاسبية.
            </div>
          </Panel>
        </div>
      </div>

      <AddServiceModal open={open} onClose={() => setOpen(false)} projectCode={code} onSaved={() => { setOpen(false); reload(); toast.push('تمت إضافة الخدمة'); }} />
    </div>
  );
}

function AddServiceModal({ open, onClose, projectCode, onSaved }: any) {
  const toast = useToast();
  const { projects } = useRe();
  const fallbackProject = projectCode && projectCode !== 'all' ? projectCode : (projects?.[0]?.code || 'MC-A');
  const [selectedProject, setSelectedProject] = useState(fallbackProject);
  const { data: plan } = useApi<any>(open && selectedProject ? `/re/projects/${selectedProject}/plan` : null, [open, selectedProject]);
  const [building, setBuilding] = useState('');
  const [unitId, setUnitId] = useState('');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
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
    if (!name) return toast.push('يرجى إدخال اسم الخدمة', 'error');
    setSaving(true);
    try {
      await api.post('/re/services', { unitId: Number(unitId), name, provider, monthlyFee: Number(fee) || 0, notes });
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="إضافة خدمة" sub="ربط رسم شهري بوحدة محددة"
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} loading={saving}>حفظ</Btn></>}>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Field label="المشروع" required><Select value={selectedProject} onChange={(e: any) => { setSelectedProject(e.target.value); setBuilding(''); setUnitId(''); }}>{(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label="المبنى"><Select value={building} onChange={(e: any) => { setBuilding(e.target.value); setUnitId(''); }}><option value="">كل المباني</option>{(plan?.buildings || []).map((b: any) => <option key={b.id} value={b.id}>مبنى {b.code}</option>)}</Select></Field>
        <Field label="الوحدة" required><Select value={unitId} onChange={(e: any) => setUnitId(e.target.value)}><option value="">اختر الوحدة</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.code} — {u.area} م²</option>)}</Select></Field>
        <Field label="اسم الخدمة" required><TextInput value={name} onChange={(e: any) => setName(e.target.value)} placeholder="إنترنت ألياف بصرية" /></Field>
        <Field label="المزوّد"><TextInput value={provider} onChange={(e: any) => setProvider(e.target.value)} /></Field>
        <Field label="الرسوم الشهرية"><TextInput type="number" value={fee} onChange={(e: any) => setFee(e.target.value)} /></Field>
      </div>
      <Field label="ملاحظات"><Textarea rows={2} value={notes} onChange={(e: any) => setNotes(e.target.value)} /></Field>
    </Modal>
  );
}
