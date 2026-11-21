import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Calculator, Info } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useMeta, useToast } from '../lib/app-context';
import { Btn, Field, Modal, Select, Textarea, TextInput } from './ui';
import { formatMoney, todayISO } from '../lib/format';

type Kind = 'invoice' | 'quotation' | 'po';

const CONFIG: Record<Kind, { title: string; titleNew: string; endpoint: string; partnerLabel: string; priceKey: 'sale_price' | 'cost_price'; statuses: { value: string; label: string }[] }> = {
  invoice: {
    title: 'تعديل الفاتورة', titleNew: 'إنشاء فاتورة جديدة', endpoint: '/invoices', partnerLabel: 'العميل',
    priceKey: 'sale_price',
    statuses: [
      { value: 'draft', label: 'مسودة' }, { value: 'sent', label: 'مرسلة' },
      { value: 'paid', label: 'مدفوعة' }, { value: 'cancelled', label: 'ملغاة' },
    ],
  },
  quotation: {
    title: 'تعديل عرض السعر', titleNew: 'عرض سعر جديد', endpoint: '/quotations', partnerLabel: 'العميل',
    priceKey: 'sale_price',
    statuses: [
      { value: 'draft', label: 'مسودة' }, { value: 'sent', label: 'مرسلة' },
      { value: 'accepted', label: 'مقبولة' }, { value: 'rejected', label: 'مرفوضة' },
    ],
  },
  po: {
    title: 'تعديل أمر الشراء', titleNew: 'أمر شراء جديد', endpoint: '/purchase-orders', partnerLabel: 'المورد',
    priceKey: 'cost_price',
    statuses: [
      { value: 'draft', label: 'مسودة' }, { value: 'confirmed', label: 'مؤكد' },
      { value: 'received', label: 'مستلم' }, { value: 'cancelled', label: 'ملغى' },
    ],
  },
};

const emptyLine = () => ({ productId: '', description: '', qty: 1, unitPrice: '', taxRate: 15 });

export function DocumentForm({ kind, initial, lines: initialLines, onClose, onSaved }: any) {
  const cfg = CONFIG[kind as Kind];
  const { meta } = useMeta();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const partners = kind === 'po' ? meta?.vendors : meta?.customers;

  const [form, setForm] = useState<any>({
    partnerId: initial?.customer_id || initial?.vendor_id || '',
    projectId: initial?.project_id || '',
    date: initial?.date || todayISO(),
    dueDate: initial?.due_date || initial?.valid_until || initial?.expected_date || '',
    status: initial?.status || 'draft',
    notes: initial?.notes || '',
  });
  const [lines, setLines] = useState<any[]>(
    initialLines?.length
      ? initialLines.map((l: any) => ({
        productId: l.product_id || '', description: l.description || '',
        qty: l.qty, unitPrice: l.unit_price, taxRate: l.tax_rate,
      }))
      : [emptyLine()]
  );

  const totals = useMemo(() => {
    let subtotal = 0; let tax = 0;
    lines.forEach((l) => {
      const amt = Number(l.qty || 0) * Number(l.unitPrice || 0);
      subtotal += amt;
      tax += amt * Number(l.taxRate ?? 15) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  const setLine = (idx: number, patch: any) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const pickProduct = (idx: number, productId: string) => {
    const p = (meta?.products || []).find((x: any) => String(x.id) === String(productId));
    if (!p) { setLine(idx, { productId }); return; }
    setLine(idx, { productId, description: p.name, unitPrice: p[cfg.priceKey] || 0 });
  };

  const save = async () => {
    if (!form.partnerId) { toast.push(`يجب اختيار ${cfg.partnerLabel}`, 'error'); return; }
    const payload = {
      ...form,
      ...(kind === 'po' ? { vendorId: form.partnerId, expectedDate: form.dueDate } : { customerId: form.partnerId }),
      ...(kind === 'quotation' ? { validUntil: form.dueDate } : {}),
      ...(kind === 'invoice' ? { dueDate: form.dueDate } : {}),
      lines: lines.filter((l) => Number(l.qty) > 0).map((l) => ({
        productId: l.productId || null, description: l.description,
        qty: Number(l.qty), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate),
      })),
    };
    setSaving(true);
    try {
      if (initial?.id) await api.patch(`${cfg.endpoint}/${initial.id}`, payload);
      else await api.post(cfg.endpoint, payload);
      toast.push(initial?.id ? 'تم حفظ التعديلات' : 'تم إنشاء المستند بنجاح');
      onSaved();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial?.id ? cfg.title : cfg.titleNew}
      sub="أضف البنود والأسعار — تُحسب الضريبة والإجماليات تلقائياً."
      size="xl"
      footer={(
        <>
          <div className="row gap-12" style={{ marginInlineEnd: 'auto' }}>
            <span className="small muted">الإجمالي النهائي</span>
            <b className="num" style={{ fontSize: 17 }}>{formatMoney(totals.total)}</b>
          </div>
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn variant="primary" loading={saving} onClick={save}>{initial?.id ? 'حفظ التعديلات' : 'حفظ المستند'}</Btn>
        </>
      )}
    >
      <div className="grid grid-3 gap-16 mb-20">
        <Field label={cfg.partnerLabel} required>
          <Select value={form.partnerId} onChange={(e: any) => setForm({ ...form, partnerId: e.target.value })} placeholder={`اختر ${cfg.partnerLabel}`}
            options={(partners || []).map((p: any) => ({ value: p.id, label: p.name }))} />
        </Field>
        {kind !== 'po' && (
          <Field label="المشروع (اختياري)">
            <Select value={form.projectId} onChange={(e: any) => setForm({ ...form, projectId: e.target.value })} placeholder="بدون مشروع"
              options={(meta?.projects || []).map((p: any) => ({ value: p.id, label: p.name }))} />
          </Field>
        )}
        <Field label="التاريخ">
          <TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label={kind === 'quotation' ? 'صالح حتى' : kind === 'po' ? 'تاريخ التسليم المتوقع' : 'تاريخ الاستحقاق'}>
          <TextInput type="date" value={form.dueDate} onChange={(e: any) => setForm({ ...form, dueDate: e.target.value })} />
        </Field>
        <Field label="الحالة">
          <Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={cfg.statuses} />
        </Field>
      </div>

      <div className="card" style={{ overflow: 'visible' }}>
        <div className="card-head" style={{ padding: '12px 16px' }}>
          <h3 style={{ fontSize: 13.5 }}><Calculator size={15} /> بنود المستند</h3>
          <Btn size="sm" icon={<Plus size={14} />} onClick={() => setLines((l) => [...l, emptyLine()])}>إضافة بند</Btn>
        </div>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th style={{ minWidth: 210 }}>المنتج / الخدمة</th>
                <th style={{ minWidth: 200 }}>الوصف</th>
                <th style={{ width: 90 }}>الكمية</th>
                <th style={{ width: 140 }}>سعر الوحدة</th>
                <th style={{ width: 90 }}>الضريبة %</th>
                <th style={{ width: 130 }}>الإجمالي</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <Select value={l.productId} onChange={(e: any) => pickProduct(i, e.target.value)} placeholder="اختر منتجاً"
                      options={(meta?.products || []).map((p: any) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))} />
                  </td>
                  <td><TextInput value={l.description} onChange={(e: any) => setLine(i, { description: e.target.value })} placeholder="وصف البند" /></td>
                  <td><TextInput type="number" min="0" step="1" value={l.qty} onChange={(e: any) => setLine(i, { qty: e.target.value })} /></td>
                  <td><TextInput type="number" min="0" step="1000" value={l.unitPrice} onChange={(e: any) => setLine(i, { unitPrice: e.target.value })} /></td>
                  <td><TextInput type="number" min="0" max="100" value={l.taxRate} onChange={(e: any) => setLine(i, { taxRate: e.target.value })} /></td>
                  <td className="num-cell strong">{formatMoney(Number(l.qty || 0) * Number(l.unitPrice || 0) * (1 + Number(l.taxRate ?? 15) / 100))}</td>
                  <td>
                    <Btn variant="ghost" className="btn-icon btn-sm" onClick={() => setLines((prev) => prev.length > 1 ? prev.filter((_, x) => x !== i) : prev)}>
                      <Trash2 size={13} />
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <div className="row" style={{ justifyContent: 'flex-end', gap: 0 }}>
            <div style={{ width: 300, fontSize: 13 }}>
              <div className="row-between" style={{ padding: '4px 0' }}><span className="muted">المجموع الفرعي</span><span className="num">{formatMoney(totals.subtotal)}</span></div>
              <div className="row-between" style={{ padding: '4px 0' }}><span className="muted">ضريبة القيمة المضافة</span><span className="num">{formatMoney(totals.tax)}</span></div>
              <div className="row-between" style={{ padding: '9px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}>
                <b>الإجمالي</b><b className="num" style={{ fontSize: 15 }}>{formatMoney(totals.total)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-16 mt-16">
        <Field label="ملاحظات">
          <Textarea value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} placeholder="شروط الدفع، ملاحظات التسليم…" />
        </Field>
      </div>
      <div className="tiny muted mt-12 row gap-6"><Info size={13} /> يُنشأ قيد محاسبي تلقائياً عند اعتماد الفاتورة، ويُحدَّث المخزون عند استلام أمر الشراء.</div>
    </Modal>
  );
}
