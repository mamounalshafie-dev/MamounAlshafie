import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, CreditCard, FileText, FolderKanban, Mail, MapPin, Pencil, Phone, Plus,
  Receipt, Star, Users, Wallet, Hash, CalendarDays, StickyNote,
} from 'lucide-react';
import { useApi } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, CardHead, Empty, PageHead, PageSkeleton, Progress, StatusBadge, Stat,
} from '../components/ui';
import { PartnerForm } from './Customers';
import {
  INVOICE_STATUS, INVOICE_TONE, QUOTE_STATUS, STAGE_LABELS, STAGE_TONE,
  formatCompact, formatDate, formatMoney,
} from '../lib/format';

export default function CustomerDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useApi<any>(`/partners/${id}`);
  const [edit, setEdit] = useState(false);
  const navigate = useNavigate();

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <Empty title="العميل غير موجود" action={<Link to="/customers" className="btn">عودة</Link>} />;

  const { partner: p, invoices, projects, quotations, stats } = data;
  const creditUsed = p.credit_limit ? Math.min(100, Math.round((stats.outstanding / p.credit_limit) * 100)) : 0;

  return (
    <div className="page">
      <PageHead
        title={p.name}
        icon={<Building2 size={22} color="#ec4899" />}
        breadcrumb={[{ label: 'العملاء', to: '/customers' }, { label: p.name }]}
        sub={<span className="row gap-8 wrap">{p.contact_name || '—'} · {p.city || '—'} <Badge tone={p.active ? 'green' : 'slate'} dot>{p.active ? 'نشط' : 'معطّل'}</Badge></span>}
        actions={(
          <>
            <Btn icon={<Pencil size={15} />} onClick={() => setEdit(true)}>تعديل</Btn>
            <Btn icon={<FolderKanban size={15} />} onClick={() => navigate('/projects?new=1')}>مشروع جديد</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => navigate('/invoices?new=1')}>فاتورة جديدة</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي الإيرادات" value={formatCompact(stats.revenue)} suffix="د.ع" icon={<Wallet size={19} />} accent="#10b981" foot={`${stats.invoiceCount} فاتورة`} />
        <Stat label="المحصّل" value={formatCompact(stats.collected)} suffix="د.ع" icon={<CreditCard size={19} />} accent="#0ea5e9"
          foot={`${stats.revenue ? Math.round((stats.collected / stats.revenue) * 100) : 0}% من الإيرادات`} />
        <Stat label="الرصيد المستحق" value={formatCompact(stats.outstanding)} suffix="د.ع" icon={<Receipt size={19} />} accent="#f59e0b" foot="مطلوب التحصيل" />
        <Stat label="المشاريع" value={stats.projectCount} icon={<FolderKanban size={19} />} accent="#8b5cf6" foot="مشاريع مرتبطة" />
      </div>

      <div className="grid grid-3-2 mb-20">
        <Card>
          <CardHead title="الفواتير" sub={`${invoices.length} فاتورة`} right={<Link to={`/invoices?customer=${p.id}`} className="btn btn-ghost btn-sm">عرض الكل</Link>} />
          <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="table table-compact">
              <thead><tr><th>الفاتورة</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th><th>المتبقي</th></tr></thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="num-cell strong">{inv.number}</td>
                    <td className="small muted">{formatDate(inv.date)}</td>
                    <td><StatusBadge status={inv.status} labels={INVOICE_STATUS} tones={INVOICE_TONE} /></td>
                    <td className="num-cell">{formatCompact(inv.total)}</td>
                    <td className="num-cell" style={{ color: inv.total - inv.amount_paid > 0 ? 'var(--red-500)' : 'var(--muted)' }}>{formatCompact(inv.total - inv.amount_paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!invoices.length && <Empty title="لا فواتير" message="لم تصدر فواتير لهذا العميل بعد." />}
          </div>
        </Card>

        <div className="col gap-16">
          <Card>
            <CardHead title="بيانات التواصل" />
            <div style={{ padding: 18 }}>
              <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
                <dt>مسؤول التواصل</dt><dd>{p.contact_name || '—'}</dd>
                <dt>البريد</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{p.email || '—'}</dd>
                <dt>الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{p.phone || '—'}</dd>
                <dt>العنوان</dt><dd>{p.address || p.city || '—'}</dd>
                <dt>الرقم الضريبي</dt><dd className="num">{p.tax_id || '—'}</dd>
                <dt>شروط الدفع</dt><dd>{p.payment_terms} يوم</dd>
                <dt>التقييم</dt><dd className="row gap-2">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill={i < p.rating ? '#f59e0b' : 'none'} color="#f59e0b" />)}</dd>
              </dl>
            </div>
          </Card>
          <Card pad>
            <div className="row-between mb-8"><span className="small muted">استهلاك حد الائتمان</span><CreditCard size={15} color="var(--brand-500)" /></div>
            <div className="row gap-12" style={{ alignItems: 'flex-end' }}>
              <span className="num" style={{ fontSize: 22, fontWeight: 800 }}>{creditUsed}%</span>
              <span className="tiny muted" style={{ paddingBottom: 4 }}>{formatCompact(stats.outstanding)} / {formatCompact(p.credit_limit)}</span>
            </div>
            <Progress value={creditUsed} className="mt-8" tone={creditUsed > 85 ? 'red' : creditUsed > 60 ? 'amber' : 'green'} />
          </Card>
          {p.notes && (
            <Card pad>
              <div className="row gap-6 mb-8"><StickyNote size={14} color="var(--muted)" /><span className="small strong">ملاحظات</span></div>
              <p className="small muted" style={{ lineHeight: 1.8 }}>{p.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead title="المشاريع" sub={`${projects.length} مشروع`} />
          <div style={{ padding: 14 }}>
            {projects.map((pr: any) => (
              <Link key={pr.id} to={`/projects/${pr.id}`} className="cmdk-item">
                <span className="ci-icon"><FolderKanban size={14} /></span>
                <div className="grow">
                  <b>{pr.name}</b>
                  <span>{pr.code} · {formatDate(pr.start_date)} ← {formatDate(pr.end_date)}</span>
                </div>
                <div style={{ width: 90 }}>
                  <Progress value={pr.progress} className="sm" />
                </div>
                <StatusBadge status={pr.stage} labels={STAGE_LABELS} tones={STAGE_TONE} />
              </Link>
            ))}
            {!projects.length && <Empty title="لا مشاريع" message="لم ترتبط مشاريع بهذا العميل." />}
          </div>
        </Card>

        <Card>
          <CardHead title="عروض الأسعار" sub={`${quotations.length} عرض`} />
          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>العرض</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {quotations.map((q: any) => (
                  <tr key={q.id}>
                    <td className="num-cell strong">{q.number}</td>
                    <td className="small muted">{formatDate(q.date)}</td>
                    <td><Badge tone={q.status === 'accepted' ? 'green' : q.status === 'rejected' ? 'red' : 'slate'}>{QUOTE_STATUS[q.status]}</Badge></td>
                    <td className="num-cell">{formatMoney(q.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!quotations.length && <Empty title="لا عروض أسعار" />}
          </div>
        </Card>
      </div>

      {edit && <PartnerForm initial={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    </div>
  );
}
