import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Download, FileText, Plus, Receipt, Search, Wallet,
} from 'lucide-react';
import { useApi } from '../lib/app-context';
import {
  Badge, Btn, Card, Empty, PageHead, PageSkeleton, SearchBox, Select, Stat, StatusBadge, exportCsv,
} from '../components/ui';
import { DocumentForm } from '../components/DocumentForm';
import { INVOICE_STATUS, INVOICE_TONE, cx, formatCompact, formatDate, formatMoney } from '../lib/format';

const TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'draft', label: 'مسودات' },
  { id: 'sent', label: 'مرسلة' },
  { id: 'partial', label: 'جزئية' },
  { id: 'paid', label: 'مدفوعة' },
  { id: 'overdue', label: 'متأخرة' },
];

export default function Invoices() {
  const { data, loading, reload } = useApi<any>('/invoices');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [customer, setCustomer] = useState(params.get('customer') || '');
  const [form, setForm] = useState<any>(null);
  const navigate = useNavigate();
  const items = data?.items || [];
  const stats = data?.stats;

  useEffect(() => {
    if (params.get('new')) { setForm({}); params.delete('new'); setParams(params, { replace: true }); }
  }, [params]);

  const filtered = useMemo(() => items.filter((i: any) => {
    if (status !== 'all' && !(i.status === status || (status === 'overdue' && i.is_overdue))) return false;
    if (customer && String(i.customer_id) !== customer) return false;
    if (q && !`${i.number} ${i.customer_name || ''} ${i.project_name || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, status, q, customer]);

  const customers = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i: any) => i.customer_name && map.set(String(i.customer_id), i.customer_name));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [items]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="الفواتير"
        icon={<Receipt size={22} color="#10b981" />}
        breadcrumb={[{ label: 'المبيعات' }, { label: 'الفواتير' }]}
        sub="إصدار الفواتير ومتابعة التحصيل والأرصدة المتأخرة."
        actions={(
          <>
            <Btn icon={<Download size={15} />} onClick={() => exportCsv('invoices', filtered.map((i: any) => ({
              number: i.number, customer: i.customer_name, date: i.date, due: i.due_date,
              status: INVOICE_STATUS[i.status], total: i.total, paid: i.amount_paid, balance: i.total - i.amount_paid,
            })))}>تصدير</Btn>
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>فاتورة جديدة</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي الفواتير" value={formatCompact(stats?.total)} suffix="د.ع" icon={<FileText size={19} />} accent="#6366f1" foot={`${stats?.count ?? 0} فاتورة`} />
        <Stat label="المحصّل" value={formatCompact(stats?.paid)} suffix="د.ع" icon={<CheckCircle2 size={19} />} accent="#10b981"
          foot={`${stats?.total ? Math.round((stats.paid / stats.total) * 100) : 0}% نسبة التحصيل`} />
        <Stat label="المستحق" value={formatCompact(stats?.outstanding)} suffix="د.ع" icon={<Wallet size={19} />} accent="#f59e0b" foot="أرصدة مفتوحة" />
        <Stat label="متأخرة" value={stats?.overdue ?? 0} suffix="فاتورة" icon={<AlertCircle size={19} />} accent="#ef4444" foot="تجاوزت تاريخ الاستحقاق" />
      </div>

      <Card className="mb-16">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="بحث برقم الفاتورة أو العميل…" className="grow" />
          <Select value={customer} onChange={(e: any) => setCustomer(e.target.value)} placeholder="كل العملاء" options={customers} />
          <span className="small muted">{filtered.length} فاتورة</span>
        </div>
        <div className="row gap-6 wrap" style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
          {TABS.map((t) => {
            const count = t.id === 'all' ? items.length : t.id === 'overdue' ? items.filter((i: any) => i.is_overdue).length : items.filter((i: any) => i.status === t.id).length;
            return (
              <button key={t.id} className={cx('badge', status === t.id ? 'badge-indigo' : 'badge-slate')} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setStatus(t.id)}>
                {t.label} · {count}
              </button>
            );
          })}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>الفاتورة</th><th>العميل</th><th>المشروع</th><th>التاريخ</th><th>الاستحقاق</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((i: any) => (
                <tr key={i.id} className="clickable" onClick={() => navigate(`/invoices/${i.id}`)}>
                  <td className="num-cell strong">{i.number}</td>
                  <td>{i.customer_name}</td>
                  <td className="small muted truncate" style={{ maxWidth: 160 }}>{i.project_name || '—'}</td>
                  <td className="small muted">{formatDate(i.date)}</td>
                  <td className="small">
                    <span className={cx(i.is_overdue && 'neg')}>{formatDate(i.due_date)}</span>
                    {i.is_overdue ? <Badge tone="red" className="ms-8">متأخرة</Badge> : null}
                  </td>
                  <td><StatusBadge status={i.status} labels={INVOICE_STATUS} tones={INVOICE_TONE} /></td>
                  <td className="num-cell">{formatMoney(i.total)}</td>
                  <td className="num-cell pos">{formatMoney(i.amount_paid)}</td>
                  <td className="num-cell" style={{ color: i.total - i.amount_paid > 0 ? 'var(--red-500)' : 'var(--muted)' }}>{formatMoney(i.total - i.amount_paid)}</td>
                  <td><ArrowLeft size={14} color="var(--muted-2)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="لا توجد فواتير" message="أصدر فاتورة جديدة لبدء دورة التحصيل." action={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setForm({})}>فاتورة جديدة</Btn>} />}
        </div>
      </Card>

      {form && <DocumentForm kind="invoice" initial={form.id ? form : null} onClose={() => setForm(null)} onSaved={async () => { setForm(null); reload(); }} />}
    </div>
  );
}
