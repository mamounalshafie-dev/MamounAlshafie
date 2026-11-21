import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, Plus, Receipt, Send, Trash2, Pencil, BadgeCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import {
  Badge, Btn, Card, Drawer, Empty, PageHead, PageSkeleton, SearchBox, Select, Stat, StatusBadge, useConfirm,
} from '../components/ui';
import { DocumentForm } from '../components/DocumentForm';
import { QUOTE_STATUS, cx, formatCompact, formatDate, formatMoney } from '../lib/format';

export default function Quotations() {
  const { data, loading, reload } = useApi<any>('/quotations');
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState<any>(null);
  const [editLines, setEditLines] = useState<any[] | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const items = data || [];

  const filtered = useMemo(() => items.filter((x: any) => {
    if (status !== 'all' && x.status !== status) return false;
    if (q && !`${x.number} ${x.customer_name || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, status]);

  const totals = items.reduce((acc: any, x: any) => {
    if (['accepted', 'invoiced'].includes(x.status)) acc.won += x.total;
    if (x.status === 'sent') acc.pending += x.total;
    return acc;
  }, { won: 0, pending: 0 });

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="عروض الأسعار"
        icon={<FileText size={22} color="#f59e0b" />}
        breadcrumb={[{ label: 'المبيعات' }, { label: 'عروض الأسعار' }]}
        sub="أنشئ عروض أسعار احترافية وحوّلها إلى فواتير بضغطة واحدة."
        actions={<Btn variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>عرض سعر جديد</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي العروض" value={items.length} icon={<FileText size={19} />} accent="#f59e0b" foot={`${items.filter((x: any) => x.status === 'draft').length} مسودة`} />
        <Stat label="عروض مرسلة" value={items.filter((x: any) => x.status === 'sent').length} icon={<Send size={19} />} accent="#0ea5e9" foot={`بقيمة ${formatCompact(totals.pending)} د.ع`} />
        <Stat label="عروض مقبولة" value={items.filter((x: any) => ['accepted', 'invoiced'].includes(x.status)).length} icon={<CheckCircle2 size={19} />} accent="#10b981" foot={`بقيمة ${formatCompact(totals.won)} د.ع`} />
        <Stat label="معدل التحويل" value={`${items.length ? Math.round((items.filter((x: any) => ['accepted', 'invoiced'].includes(x.status)).length / items.length) * 100) : 0}%`}
          icon={<BadgeCheck size={19} />} accent="#8b5cf6" foot="من عرض إلى فاتورة" />
      </div>

      <Card className="mb-16">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="بحث برقم العرض أو العميل…" className="grow" />
          <Select value={status} onChange={(e: any) => setStatus(e.target.value)}
            options={[{ value: 'all', label: 'كل الحالات' }, ...Object.entries(QUOTE_STATUS).map(([v, l]) => ({ value: v, label: l }))]} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>رقم العرض</th><th>العميل</th><th>المشروع</th><th>التاريخ</th><th>صالح حتى</th><th>الحالة</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>
              {filtered.map((x: any) => (
                <tr key={x.id} className="clickable" onClick={() => setDetail(x)}>
                  <td className="num-cell strong">{x.number}</td>
                  <td>{x.customer_name}</td>
                  <td className="small muted">{x.project_name || '—'}</td>
                  <td className="small muted">{formatDate(x.date)}</td>
                  <td className="small muted">{formatDate(x.valid_until)}</td>
                  <td><Badge tone={x.status === 'accepted' || x.status === 'invoiced' ? 'green' : x.status === 'rejected' ? 'red' : x.status === 'sent' ? 'blue' : 'slate'}>{QUOTE_STATUS[x.status]}</Badge></td>
                  <td className="num-cell strong">{formatMoney(x.total)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row gap-4">
                      <Btn variant="ghost" className="btn-icon btn-sm" title="تعديل" onClick={async () => {
                        const d = await api.get(`/quotations/${x.id}`);
                        setEditLines(d.lines);
                        setForm(d.quotation);
                      }}><Pencil size={13} /></Btn>
                      {x.status !== 'invoiced' && (
                        <Btn variant="ghost" className="btn-icon btn-sm" title="تحويل إلى فاتورة" onClick={() => confirm({
                          title: 'تحويل إلى فاتورة', message: `سيتم إنشاء فاتورة جديدة من العرض ${x.number} بقيمة ${formatMoney(x.total)}.`, confirmLabel: 'تحويل',
                          onConfirm: async () => {
                            const inv = await api.post(`/quotations/${x.id}/convert`);
                            toast.push('تم إنشاء الفاتورة بنجاح');
                            navigate(`/invoices/${inv.id}`);
                          },
                        })}><Receipt size={13} /></Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="لا توجد عروض أسعار" message="أنشئ عرض سعر جديد لإرساله إلى العميل." action={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setForm({})}>عرض سعر جديد</Btn>} />}
        </div>
      </Card>

      {form && <DocumentForm kind="quotation" initial={form.id ? form : null} lines={editLines || []} onClose={() => { setForm(null); setEditLines(null); }} onSaved={() => { setForm(null); setEditLines(null); reload(); }} />}
      {detail && <QuoteDrawer quote={detail} onClose={() => setDetail(null)} onEdit={() => { setDetail(null); }} onChanged={reload} />}
    </div>
  );
}

function QuoteDrawer({ quote, onClose, onEdit, onChanged }: any) {
  const { data, loading } = useApi<any>(`/quotations/${quote.id}`);
  const toast = useToast();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const q = data?.quotation || quote;
  const lines = data?.lines || [];

  return (
    <Drawer open onClose={onClose} title={q.number} sub={q.customer_name}
      footer={(
        <>
          <Btn onClick={async () => { const d = await api.get(`/quotations/${q.id}`); setEditLines(d.lines); setForm(d.quotation); onClose(); }} icon={<Pencil size={14} />}>تعديل</Btn>
          <div className="grow" />
          {q.status !== 'invoiced' && (
            <Btn variant="primary" icon={<Receipt size={14} />} onClick={() => confirm({
              title: 'تحويل إلى فاتورة', message: 'سيتم إنشاء فاتورة من هذا العرض.', confirmLabel: 'تحويل',
              onConfirm: async () => {
                const inv = await api.post(`/quotations/${q.id}/convert`);
                toast.push('تم إنشاء الفاتورة');
                onChanged();
                navigate(`/invoices/${inv.id}`);
              },
            })}>تحويل إلى فاتورة</Btn>
          )}
        </>
      )}>
      <div className="row-between mb-16">
        <Badge tone={q.status === 'accepted' ? 'green' : 'slate'}>{QUOTE_STATUS[q.status]}</Badge>
        <span className="small muted">{formatDate(q.date)} · صالح حتى {formatDate(q.valid_until)}</span>
      </div>
      {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
        <>
          <div className="table-wrap card mb-16">
            <table className="table table-compact">
              <thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {lines.map((l: any) => (
                  <tr key={l.id}>
                    <td className="small">{l.description}</td>
                    <td className="num-cell">{l.qty}</td>
                    <td className="num-cell">{formatCompact(l.unit_price)}</td>
                    <td className="num-cell strong">{formatCompact(l.qty * l.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card card-pad">
            <div className="row-between" style={{ padding: '3px 0' }}><span className="muted small">المجموع الفرعي</span><span className="num">{formatMoney(q.subtotal)}</span></div>
            <div className="row-between" style={{ padding: '3px 0' }}><span className="muted small">الضريبة</span><span className="num">{formatMoney(q.tax)}</span></div>
            <div className="row-between" style={{ padding: '9px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}><b>الإجمالي</b><b className="num" style={{ fontSize: 16 }}>{formatMoney(q.total)}</b></div>
          </div>
          {q.notes && <p className="small muted mt-16" style={{ lineHeight: 1.8 }}>{q.notes}</p>}
          <div className="mt-20">
            <div className="small strong mb-8">تحديث الحالة</div>
            <div className="row gap-6 wrap">
              {['draft', 'sent', 'accepted', 'rejected'].map((s) => (
                <Btn key={s} size="sm" variant={q.status === s ? 'primary' : ''} onClick={async () => {
                  await api.patch(`/quotations/${q.id}`, { status: s });
                  toast.push('تم تحديث حالة العرض');
                  onChanged();
                }}>{QUOTE_STATUS[s]}</Btn>
              ))}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
