import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Ban, CheckCircle2, CreditCard, Download, FileText, Mail, Pencil, Plus,
  Printer, Receipt, Send, Trash2, Wallet, CalendarDays, Building2,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import {
  Badge, Btn, Card, CardHead, Empty, Field, Modal, PageHead, PageSkeleton, Select, StatusBadge,
  Textarea, TextInput, useConfirm,
} from '../components/ui';
import { DocumentForm } from '../components/DocumentForm';
import {
  INVOICE_STATUS, INVOICE_TONE, cx, formatDate, formatMoney, todayISO,
} from '../lib/format';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useApi<any>(`/invoices/${id}`);
  const settings = useApi<any>('/settings');
  const [payModal, setPayModal] = useState(false);
  const [edit, setEdit] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <Empty title="الفاتورة غير موجودة" action={<Link to="/invoices" className="btn">عودة للفواتير</Link>} />;

  const { invoice: inv, lines, payments, customer } = data;
  const company = settings.data?.company || {};
  const balance = inv.total - inv.amount_paid;

  const setStatus = async (status: string, message: string) => {
    try {
      await api.patch(`/invoices/${inv.id}`, { status });
      toast.push(message);
      reload();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر التحديث', 'error'); }
  };

  return (
    <div className="page">
      <PageHead
        title={inv.number}
        icon={<Receipt size={22} color="#10b981" />}
        breadcrumb={[{ label: 'الفواتير', to: '/invoices' }, { label: inv.number }]}
        sub={<span className="row gap-8 wrap"><StatusBadge status={inv.status} labels={INVOICE_STATUS} tones={INVOICE_TONE} /> {inv.customer_name} · {formatMoney(inv.total)}</span>}
        actions={(
          <>
            <Btn icon={<ArrowRight size={15} />} onClick={() => navigate('/invoices')}>رجوع</Btn>
            <Btn icon={<Pencil size={15} />} onClick={() => setEdit(true)}>تعديل</Btn>
            <Btn icon={<Printer size={15} />} onClick={() => window.print()}>طباعة</Btn>
            {balance > 0 && <Btn variant="primary" icon={<CreditCard size={15} />} onClick={() => setPayModal(true)}>تسجيل دفعة</Btn>}
          </>
        )}
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 340px', alignItems: 'start' }}>
        <div className="doc-paper print-area">
          <div className="doc-head">
            <div>
              <div className="doc-brand">
                <div className="mark">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 19V5l14 14V5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <b>{company.name || 'شركة نور التقنية المحدودة'}</b>
                  <span>{company.nameEn || 'Noor Technology Co. Ltd.'}</span>
                </div>
              </div>
              <div className="doc-meta" style={{ marginTop: 12 }}>
                {company.address}<br />
                {company.phone} · {company.email}<br />
                الرقم الضريبي: {company.taxId} · السجل التجاري: {company.cr}
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="doc-title">فاتورة</div>
              <div className="doc-no">{inv.number}</div>
              <div className="doc-meta" style={{ marginTop: 10 }}>
                تاريخ الإصدار: {formatDate(inv.date)}<br />
                تاريخ الاستحقاق: {formatDate(inv.due_date)}<br />
                الحالة: {INVOICE_STATUS[inv.status]}
              </div>
            </div>
          </div>

          <div className="doc-parties">
            <div>
              <h5>فاتورة إلى</h5>
              <div className="name">{inv.customer_name}</div>
              {customer?.contact_name && <div className="line">{customer.contact_name}</div>}
              {customer?.address && <div className="line">{customer.address}</div>}
              {customer?.phone && <div className="line" dir="ltr">{customer.phone}</div>}
              {customer?.email && <div className="line" dir="ltr">{customer.email}</div>}
              {customer?.tax_id && <div className="line">الرقم الضريبي: {customer.tax_id}</div>}
            </div>
            <div>
              <h5>تفاصيل المشروع</h5>
              <div className="name">{inv.project_name || 'خدمات عامة'}</div>
              <div className="line">شروط الدفع: {customer?.payment_terms || 30} يوم</div>
              <div className="line">العملة: دينار عراقي (IQD)</div>
            </div>
          </div>

          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>الوصف</th>
                <th style={{ width: 70, textAlign: 'center' }}>الكمية</th>
                <th style={{ width: 120, textAlign: 'left' }}>سعر الوحدة</th>
                <th style={{ width: 60, textAlign: 'center' }}>ضريبة</th>
                <th style={{ width: 130, textAlign: 'left' }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any, i: number) => (
                <tr key={l.id}>
                  <td className="num">{i + 1}</td>
                  <td>{l.description}</td>
                  <td className="num" style={{ textAlign: 'center' }}>{l.qty}</td>
                  <td className="num" style={{ textAlign: 'left' }}>{formatMoney(l.unit_price, { currency: false })}</td>
                  <td className="num" style={{ textAlign: 'center' }}>{l.tax_rate}%</td>
                  <td className="num" style={{ textAlign: 'left', fontWeight: 600 }}>{formatMoney(l.qty * l.unit_price, { currency: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="doc-totals">
            <div className="line"><span>المجموع الفرعي</span><span className="num">{formatMoney(inv.subtotal)}</span></div>
            <div className="line"><span>ضريبة القيمة المضافة (15%)</span><span className="num">{formatMoney(inv.tax)}</span></div>
            {inv.amount_paid > 0 && <div className="line"><span>المدفوع</span><span className="num">- {formatMoney(inv.amount_paid)}</span></div>}
            <div className="line total"><span>{balance > 0 ? 'المبلغ المستحق' : 'الإجمالي'}</span><span className="num">{formatMoney(balance > 0 ? balance : inv.total)}</span></div>
          </div>

          {inv.notes && (
            <div style={{ marginTop: 26, padding: 14, background: '#f8fafc', borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>ملاحظات</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>{inv.notes}</div>
            </div>
          )}

          <div className="doc-foot">
            <div>
              <div style={{ fontWeight: 700, color: '#475569', marginBottom: 3 }}>بيانات الدفع</div>
              {company.bankName}<br />{company.bankAccount}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#475569', marginBottom: 3 }}>شكراً لتعاملكم معنا</div>
              {company.website} · {company.email}
            </div>
          </div>
        </div>

        <div className="col gap-16 no-print">
          <Card>
            <CardHead title="ملخص الفاتورة" />
            <div style={{ padding: 18 }}>
              <div className="row-between mb-12">
                <span className="small muted">الحالة</span>
                <StatusBadge status={inv.status} labels={INVOICE_STATUS} tones={INVOICE_TONE} />
              </div>
              <div className="divider" style={{ margin: '10px 0' }} />
              <div className="row-between" style={{ padding: '5px 0' }}><span className="small muted">الإجمالي</span><b className="num">{formatMoney(inv.total)}</b></div>
              <div className="row-between" style={{ padding: '5px 0' }}><span className="small muted">المدفوع</span><b className="num pos">{formatMoney(inv.amount_paid)}</b></div>
              <div className="row-between" style={{ padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}>
                <span className="small strong">المتبقي</span><b className="num" style={{ color: balance > 0 ? 'var(--red-500)' : 'var(--green-600)', fontSize: 15 }}>{formatMoney(balance)}</b>
              </div>
              <div className="progress mt-12"><i style={{ width: `${inv.total ? Math.min(100, (inv.amount_paid / inv.total) * 100) : 0}%` }} /></div>
              <div className="tiny muted mt-4">{inv.total ? Math.round((inv.amount_paid / inv.total) * 100) : 0}% تم تحصيله</div>

              <div className="divider" style={{ margin: '16px 0' }} />
              <dl className="kv" style={{ gridTemplateColumns: '96px 1fr', fontSize: 12.5 }}>
                <dt>العميل</dt><dd>{inv.customer_id ? <Link to={`/customers/${inv.customer_id}`} style={{ color: 'var(--brand-600)' }}>{inv.customer_name}</Link> : '—'}</dd>
                <dt>المشروع</dt><dd>{inv.project_id ? <Link to={`/projects/${inv.project_id}`} style={{ color: 'var(--brand-600)' }}>{inv.project_name}</Link> : '—'}</dd>
                <dt>تاريخ الإصدار</dt><dd>{formatDate(inv.date)}</dd>
                <dt>الاستحقاق</dt><dd>{formatDate(inv.due_date)}</dd>
              </dl>

              <div className="grid gap-8 mt-16">
                {inv.status === 'draft' && (
                  <Btn variant="primary" block icon={<Send size={14} />} onClick={() => setStatus('sent', 'تم إرسال الفاتورة')}>إرسال الفاتورة</Btn>
                )}
                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                  <Btn block variant="success" icon={<CheckCircle2 size={14} />} onClick={() => confirm({
                    title: 'تعليم كمدفوعة', message: 'سيتم تسجيل المبلغ المتبقي كمدفوع بالكامل.', confirmLabel: 'تأكيد الدفع',
                    onConfirm: async () => { await api.patch(`/invoices/${inv.id}`, { status: 'paid' }); toast.push('تم تحديث الفاتورة كمدفوعة'); reload(); },
                  })}>تعليم كمدفوعة بالكامل</Btn>
                )}
                {inv.status !== 'cancelled' && (
                  <Btn block icon={<Ban size={14} />} onClick={() => confirm({
                    title: 'إلغاء الفاتورة', message: 'سيتم إلغاء الفاتورة وعكس تأثيرها المحاسبي.', danger: true, confirmLabel: 'إلغاء الفاتورة',
                    onConfirm: async () => { await api.patch(`/invoices/${inv.id}`, { status: 'cancelled' }); toast.push('تم إلغاء الفاتورة'); reload(); },
                  })}>إلغاء الفاتورة</Btn>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="سجل الدفعات" sub={`${payments.length} دفعة`} />
            <div style={{ padding: 16 }}>
              {payments.length === 0 && <div className="small muted text-center" style={{ padding: 10 }}>لا توجد دفعات مسجلة</div>}
              <div className="timeline">
                {payments.map((p: any) => (
                  <div className="timeline-item" key={p.id}>
                    <div className="t-head row-between">
                      <b className="num">{formatMoney(p.amount)}</b>
                      <Badge tone="green">{p.method}</Badge>
                    </div>
                    <div className="t-time">{formatDate(p.date)} · {p.reference || '—'}</div>
                  </div>
                ))}
              </div>
              {balance > 0 && <Btn block size="sm" className="mt-12" icon={<Plus size={14} />} onClick={() => setPayModal(true)}>إضافة دفعة</Btn>}
            </div>
          </Card>
        </div>
      </div>

      {payModal && <PaymentModal invoice={inv} balance={balance} onClose={() => setPayModal(false)} onSaved={() => { setPayModal(false); reload(); }} />}
      {edit && <DocumentForm kind="invoice" initial={inv} lines={lines} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    </div>
  );
}

function PaymentModal({ invoice, balance, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({ amount: balance, date: todayISO(), method: 'تحويل بنكي', reference: '', note: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/invoices/${invoice.id}/payments`, form);
      toast.push('تم تسجيل الدفعة بنجاح');
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="تسجيل دفعة" sub={`الفاتورة ${invoice.number} · المتبقي ${formatMoney(balance)}`}
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>تسجيل الدفعة</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="المبلغ (د.ع)" required>
          <TextInput type="number" value={form.amount} onChange={(e: any) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="طريقة الدفع">
          <Select value={form.method} onChange={(e: any) => setForm({ ...form, method: e.target.value })}
            options={['تحويل بنكي', 'نقداً', 'شيك', 'بطاقة', 'محفظة إلكترونية'].map((m) => ({ value: m, label: m }))} />
        </Field>
        <Field label="المرجع"><TextInput value={form.reference} onChange={(e: any) => setForm({ ...form, reference: e.target.value })} placeholder="رقم الحوالة/الشيك" dir="ltr" /></Field>
        <Field label="ملاحظات" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
