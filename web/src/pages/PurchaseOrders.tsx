import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, PackageCheck, Plus, ShoppingCart, Truck, Wallet, Pencil } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import {
  Badge, Btn, Card, Drawer, Empty, PageHead, PageSkeleton, SearchBox, Select, Stat, StatusBadge, useConfirm,
} from '../components/ui';
import { DocumentForm } from '../components/DocumentForm';
import { PO_STATUS, PO_TONE, formatCompact, formatDate, formatMoney } from '../lib/format';

export default function PurchaseOrders() {
  const { data, loading, reload } = useApi<any>('/purchase-orders');
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [vendor, setVendor] = useState(params.get('vendor') || '');
  const [form, setForm] = useState<any>(null);
  const [editLines, setEditLines] = useState<any[] | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const items = data?.items || [];
  const stats = data?.stats;

  const vendors = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((o: any) => o.vendor_name && map.set(String(o.vendor_id), o.vendor_name));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [items]);

  const filtered = useMemo(() => items.filter((o: any) => {
    if (status !== 'all' && o.status !== status) return false;
    if (vendor && String(o.vendor_id) !== vendor) return false;
    if (q && !`${o.number} ${o.vendor_name || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, status, q, vendor]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="أوامر الشراء"
        icon={<ShoppingCart size={22} color="#0ea5e9" />}
        breadcrumb={[{ label: 'المشتريات' }, { label: 'أوامر الشراء' }]}
        sub="دورة شراء كاملة من الإنشاء حتى الاستلام وإضافة المخزون."
        actions={<Btn variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>أمر شراء جديد</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي الأوامر" value={stats?.count ?? 0} icon={<ShoppingCart size={19} />} accent="#0ea5e9" foot={`قيمة ${formatCompact(stats?.total)} د.ع`} />
        <Stat label="قيد التنفيذ" value={stats?.pending ?? 0} icon={<Truck size={19} />} accent="#f59e0b" foot="مسودات ومؤكدة" />
        <Stat label="مستلمة" value={stats?.received ?? 0} icon={<PackageCheck size={19} />} accent="#10b981" foot="أُضيفت للمخزون" />
        <Stat label="ملغاة" value={items.filter((o: any) => o.status === 'cancelled').length} icon={<Wallet size={19} />} accent="#ef4444" foot="أوامر غير نافذة" />
      </div>

      <Card className="mb-16">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="بحث برقم الأمر أو المورد…" className="grow" />
          <Select value={vendor} onChange={(e: any) => setVendor(e.target.value)} placeholder="كل الموردين" options={vendors} />
          <Select value={status} onChange={(e: any) => setStatus(e.target.value)}
            options={[{ value: 'all', label: 'كل الحالات' }, ...Object.entries(PO_STATUS).map(([v, l]) => ({ value: v, label: l }))]} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الأمر</th><th>المورد</th><th>التاريخ</th><th>التسليم المتوقع</th><th>الحالة</th><th>البنود</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id} className="clickable" onClick={() => setDetail(o)}>
                  <td className="num-cell strong">{o.number}</td>
                  <td>{o.vendor_name}</td>
                  <td className="small muted">{formatDate(o.date)}</td>
                  <td className="small muted">{formatDate(o.expected_date)}</td>
                  <td><StatusBadge status={o.status} labels={PO_STATUS} tones={PO_TONE} /></td>
                  <td className="num-cell small">{o.line_count}</td>
                  <td className="num-cell strong">{formatMoney(o.total)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row gap-4">
                      <Btn variant="ghost" className="btn-icon btn-sm" onClick={() => setDetail(o)}><Eye size={14} /></Btn>
                      <Btn variant="ghost" className="btn-icon btn-sm" onClick={async () => {
                        const d = await api.get(`/purchase-orders/${o.id}`);
                        setEditLines(d.lines);
                        setForm(d.purchaseOrder);
                      }}><Pencil size={13} /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="لا توجد أوامر شراء" message="أنشئ أمر شراء لبدء دورة التوريد." action={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setForm({})}>أمر شراء جديد</Btn>} />}
        </div>
      </Card>

      {form && <DocumentForm kind="po" initial={form.id ? form : null} lines={editLines || []} onClose={() => { setForm(null); setEditLines(null); }} onSaved={() => { setForm(null); setEditLines(null); reload(); }} />}
      {detail && <PODrawer po={detail} onClose={() => setDetail(null)} onChanged={reload} onEdit={async () => {
        const d = await api.get(`/purchase-orders/${detail.id}`);
        setEditLines(d.lines);
        setForm(d.purchaseOrder);
        setDetail(null);
      }} />}
    </div>
  );
}

function PODrawer({ po, onClose, onChanged, onEdit }: any) {
  const { data, loading } = useApi<any>(`/purchase-orders/${po.id}`);
  const toast = useToast();
  const confirm = useConfirm();
  const p = data?.purchaseOrder || po;
  const lines = data?.lines || [];

  const receive = () => confirm({
    title: 'استلام أمر الشراء',
    message: 'سيتم إضافة الكميات إلى المخزون وإنشاء قيد محاسبي للمشتريات.',
    confirmLabel: 'تأكيد الاستلام',
    onConfirm: async () => {
      await api.patch(`/purchase-orders/${p.id}`, { status: 'received' });
      toast.push('تم استلام الأمر وتحديث المخزون');
      onChanged();
      onClose();
    },
  });

  return (
    <Drawer open onClose={onClose} title={p.number} sub={p.vendor_name}
      footer={(
        <>
          <Btn icon={<Pencil size={14} />} onClick={onEdit}>تعديل</Btn>
          <div className="grow" />
          {p.status === 'draft' && <Btn variant="primary" onClick={async () => { await api.patch(`/purchase-orders/${p.id}`, { status: 'confirmed' }); toast.push('تم تأكيد الأمر'); onChanged(); }}><CheckCircle2 size={14} /> تأكيد</Btn>}
          {p.status === 'confirmed' && <Btn variant="success" onClick={receive}><PackageCheck size={14} /> استلام</Btn>}
        </>
      )}>
      <div className="row-between mb-16">
        <StatusBadge status={p.status} labels={PO_STATUS} tones={PO_TONE} />
        <span className="small muted">{formatDate(p.date)} · التسليم {formatDate(p.expected_date)}</span>
      </div>
      {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
        <>
          <div className="table-wrap card mb-16">
            <table className="table table-compact">
              <thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {lines.map((l: any) => (
                  <tr key={l.id}><td className="small">{l.description}</td><td className="num-cell">{l.qty}</td><td className="num-cell">{formatCompact(l.unit_price)}</td><td className="num-cell strong">{formatCompact(l.qty * l.unit_price)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card card-pad">
            <div className="row-between" style={{ padding: '3px 0' }}><span className="muted small">المجموع الفرعي</span><span className="num">{formatMoney(p.subtotal)}</span></div>
            <div className="row-between" style={{ padding: '3px 0' }}><span className="muted small">الضريبة</span><span className="num">{formatMoney(p.tax)}</span></div>
            <div className="row-between" style={{ padding: '9px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}><b>الإجمالي</b><b className="num" style={{ fontSize: 16 }}>{formatMoney(p.total)}</b></div>
          </div>
          {data?.vendor && (
            <Card className="mt-16" pad>
              <div className="small strong mb-8">بيانات المورد</div>
              <dl className="kv" style={{ gridTemplateColumns: '90px 1fr', fontSize: 12.5 }}>
                <dt>الاسم</dt><dd>{data.vendor.name}</dd>
                <dt>الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{data.vendor.phone || '—'}</dd>
                <dt>البريد</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{data.vendor.email || '—'}</dd>
              </dl>
            </Card>
          )}
          {p.notes && <p className="small muted mt-16" style={{ lineHeight: 1.8 }}>{p.notes}</p>}
        </>
      )}
    </Drawer>
  );
}
