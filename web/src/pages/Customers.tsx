import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Download, Mail, MapPin, Phone, Plus, Star, Users, Wallet, ArrowLeft, CircleDollarSign, BadgeCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead, PageSkeleton, SearchBox, Select, Stat, Textarea, TextInput, exportCsv,
} from '../components/ui';
import { formatCompact, formatMoney } from '../lib/format';

export default function Customers() {
  const { data, loading, reload } = useApi<any>('/partners?type=customer');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [modal, setModal] = useState<any>(null);
  const navigate = useNavigate();
  const items = data?.items || [];

  const filtered = useMemo(() => items.filter((p: any) => {
    if (city && p.city !== city) return false;
    if (q && !`${p.name} ${p.email || ''} ${p.phone || ''} ${p.contact_name || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, city]);

  const totals = items.reduce((acc: any, p: any) => ({
    revenue: acc.revenue + p.revenue, outstanding: acc.outstanding + p.outstanding,
  }), { revenue: 0, outstanding: 0 });

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="العملاء"
        icon={<Users size={22} color="#ec4899" />}
        breadcrumb={[{ label: 'المبيعات' }, { label: 'العملاء' }]}
        sub="سجل العملاء مع الأرصدة والإيرادات والمشاريع المرتبطة."
        actions={(
          <>
            <Btn icon={<Download size={15} />} onClick={() => exportCsv('customers', filtered.map((p: any) => ({
              name: p.name, contact: p.contact_name, email: p.email, phone: p.phone, city: p.city,
              revenue: p.revenue, outstanding: p.outstanding, invoices: p.invoice_count,
            })))}>تصدير</Btn>
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModal({ type: 'customer' })}>عميل جديد</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="عدد العملاء" value={items.length} icon={<Users size={19} />} accent="#ec4899" foot={`${items.filter((p: any) => p.active).length} عميل نشط`} />
        <Stat label="إجمالي الإيرادات" value={formatCompact(totals.revenue)} suffix="د.ع" icon={<CircleDollarSign size={19} />} accent="#10b981" foot="من فواتير معتمدة" />
        <Stat label="الذمم المدينة" value={formatCompact(totals.outstanding)} suffix="د.ع" icon={<Wallet size={19} />} accent="#f59e0b" foot="أرصدة غير محصّلة" />
        <Stat label="متوسط الفواتير" value={items.length ? Math.round(items.reduce((s: number, p: any) => s + p.invoice_count, 0) / items.length) : 0} icon={<BadgeCheck size={19} />} accent="#0ea5e9" foot="فاتورة لكل عميل" />
      </div>

      <Card className="mb-16">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث عن عميل بالاسم أو الهاتف…" className="grow" />
          <Select value={city} onChange={(e: any) => setCity(e.target.value)} placeholder="كل المدن"
            options={(data?.cities || []).map((c: string) => ({ value: c, label: c }))} />
          <span className="small muted">{filtered.length} نتيجة</span>
        </div>
      </Card>

      <div className="grid grid-3">
        {filtered.map((p: any) => (
          <Card key={p.id} className="card-pad" style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${p.id}`)}>
            <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
              <Avatar name={p.name} size="lg" color="#ec4899" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row-between gap-8">
                  <b className="truncate" style={{ fontSize: 14 }}>{p.name}</b>
                  <div className="row gap-2">{Array.from({ length: p.rating || 4 }).map((_, i) => <Star key={i} size={11} fill="#f59e0b" color="#f59e0b" />)}</div>
                </div>
                <div className="tiny muted truncate">{p.contact_name || '—'}</div>
                <div className="row gap-12 mt-8 wrap">
                  {p.phone && <span className="tiny muted row gap-4"><Phone size={11} />{p.phone}</span>}
                  {p.city && <span className="tiny muted row gap-4"><MapPin size={11} />{p.city}</span>}
                </div>
              </div>
            </div>
            <div className="divider" style={{ margin: '14px 0' }} />
            <div className="row-between">
              <div>
                <div className="tiny muted">الإيرادات</div>
                <b className="num" style={{ fontSize: 15 }}>{formatCompact(p.revenue)}</b>
              </div>
              <div>
                <div className="tiny muted">الرصيد المستحق</div>
                <b className="num" style={{ fontSize: 15, color: p.outstanding > 0 ? 'var(--red-500)' : 'var(--green-600)' }}>{formatCompact(p.outstanding)}</b>
              </div>
              <div>
                <div className="tiny muted">المشاريع</div>
                <b className="num" style={{ fontSize: 15 }}>{p.project_count}</b>
              </div>
            </div>
            <div className="row-between mt-12">
              <Badge tone={p.active ? 'green' : 'slate'} dot>{p.active ? 'نشط' : 'معطّل'}</Badge>
              <span className="small" style={{ color: 'var(--brand-600)' }}>عرض الملف <ArrowLeft size={12} style={{ verticalAlign: -1 }} /></span>
            </div>
          </Card>
        ))}
      </div>
      {!filtered.length && <Card><Empty title="لا يوجد عملاء مطابقون" message="أضف عميلاً جديداً للبدء." action={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setModal({ type: 'customer' })}>عميل جديد</Btn>} /></Card>}

      {modal && <PartnerForm initial={modal} defaultType="customer" onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </div>
  );
}

export function PartnerForm({ initial, defaultType = 'customer', onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({
    type: initial?.type || defaultType,
    name: initial?.name || '',
    contactName: initial?.contact_name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    city: initial?.city || '',
    country: initial?.country || 'العراق',
    taxId: initial?.tax_id || '',
    address: initial?.address || '',
    creditLimit: initial?.credit_limit || '',
    paymentTerms: initial?.payment_terms ?? 30,
    notes: initial?.notes || '',
    rating: initial?.rating || 4,
    active: initial?.active !== 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.push('الاسم مطلوب', 'error'); return; }
    setSaving(true);
    try {
      if (initial?.id) await api.patch(`/partners/${initial.id}`, form);
      else await api.post('/partners', form);
      toast.push(initial?.id ? 'تم تحديث البيانات' : 'تمت الإضافة بنجاح');
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  const isVendor = form.type === 'vendor';
  return (
    <Modal open onClose={onClose} title={initial?.id ? (isVendor ? 'تعديل المورد' : 'تعديل العميل') : (isVendor ? 'مورد جديد' : 'عميل جديد')}
      sub="بيانات الاتصال والشروط التجارية" size="lg"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>{initial?.id ? 'حفظ' : 'إضافة'}</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label={isVendor ? 'اسم المورد' : 'اسم العميل'} required>
          <TextInput value={form.name} onChange={(e: any) => set('name', e.target.value)} placeholder="اسم الشركة أو الجهة" />
        </Field>
        <Field label="مسؤول التواصل">
          <TextInput value={form.contactName} onChange={(e: any) => set('contactName', e.target.value)} placeholder="الاسم والمنصب" />
        </Field>
        <Field label="البريد الإلكتروني">
          <TextInput type="email" value={form.email} onChange={(e: any) => set('email', e.target.value)} dir="ltr" placeholder="name@company.iq" />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput value={form.phone} onChange={(e: any) => set('phone', e.target.value)} dir="ltr" placeholder="+964 7XX XXX XXXX" />
        </Field>
        <Field label="المدينة">
          <TextInput value={form.city} onChange={(e: any) => set('city', e.target.value)} placeholder="بغداد" />
        </Field>
        <Field label="الدولة">
          <TextInput value={form.country} onChange={(e: any) => set('country', e.target.value)} />
        </Field>
        <Field label="الرقم الضريبي">
          <TextInput value={form.taxId} onChange={(e: any) => set('taxId', e.target.value)} dir="ltr" />
        </Field>
        <Field label="شروط الدفع (يوم)">
          <TextInput type="number" value={form.paymentTerms} onChange={(e: any) => set('paymentTerms', e.target.value)} />
        </Field>
        <Field label="حد الائتمان (د.ع)">
          <TextInput type="number" value={form.creditLimit} onChange={(e: any) => set('creditLimit', e.target.value)} />
        </Field>
        <Field label="التقييم">
          <Select value={form.rating} onChange={(e: any) => set('rating', e.target.value)}
            options={[5, 4, 3, 2, 1].map((r) => ({ value: r, label: `${r} نجوم` }))} />
        </Field>
        <Field label="العنوان" style={{ gridColumn: '1 / -1' }}>
          <TextInput value={form.address} onChange={(e: any) => set('address', e.target.value)} placeholder="المدينة، المنطقة، الشارع" />
        </Field>
        <Field label="ملاحظات" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.notes} onChange={(e: any) => set('notes', e.target.value)} />
        </Field>
        <label className="checkbox" style={{ gridColumn: '1 / -1' }}>
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> {isVendor ? 'مورد نشط' : 'عميل نشط'}
        </label>
      </div>
    </Modal>
  );
}

