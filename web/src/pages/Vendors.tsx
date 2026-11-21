import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, MapPin, Phone, Plus, ShoppingCart, Wallet, ArrowLeft } from 'lucide-react';
import { useApi } from '../lib/app-context';
import { Avatar, Badge, Btn, Card, Empty, PageHead, PageSkeleton, SearchBox, Stat } from '../components/ui';
import { PartnerForm } from './Customers';
import { formatCompact, formatDate } from '../lib/format';

export default function Vendors() {
  const { data, loading, reload } = useApi<any>('/partners?type=vendor');
  const poApi = useApi<any>('/purchase-orders');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<any>(null);
  const navigate = useNavigate();
  const items = data?.items || [];
  const orders = poApi.data?.items || [];

  const filtered = useMemo(() => items.filter((p: any) => {
    if (!q) return true;
    return `${p.name} ${p.email || ''} ${p.city || ''}`.toLowerCase().includes(q.toLowerCase());
  }), [items, q]);

  const spend = orders.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + o.total, 0);
  const pending = orders.filter((o: any) => ['draft', 'confirmed'].includes(o.status));

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="الموردون"
        icon={<Building2 size={22} color="#0ea5e9" />}
        breadcrumb={[{ label: 'المشتريات' }, { label: 'الموردون' }]}
        sub="إدارة سجل الموردين وأوامر الشراء والالتزامات المالية."
        actions={<Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModal({ type: 'vendor' })}>مورد جديد</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="عدد الموردين" value={items.length} icon={<Building2 size={19} />} accent="#0ea5e9" foot={`${items.filter((p: any) => p.active).length} مورد نشط`} />
        <Stat label="إجمالي المشتريات" value={formatCompact(spend)} suffix="د.ع" icon={<Wallet size={19} />} accent="#6366f1" foot="أوامر شراء معتمدة" />
        <Stat label="أوامر قيد التنفيذ" value={pending.length} icon={<ShoppingCart size={19} />} accent="#f59e0b" foot={`بقيمة ${formatCompact(pending.reduce((s: number, o: any) => s + o.total, 0))} د.ع`} />
        <Stat label="طلبات مستلمة" value={orders.filter((o: any) => o.status === 'received').length} icon={<ShoppingCart size={19} />} accent="#10b981" foot="أُضيفت للمخزون" />
      </div>

      <Card className="mb-16">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث عن مورد…" className="grow" />
          <span className="small muted">{filtered.length} مورد</span>
        </div>
      </Card>

      <div className="grid grid-2 mb-20">
        {filtered.map((v: any) => {
          const vendorOrders = orders.filter((o: any) => o.vendor_id === v.id);
          return (
            <Card key={v.id} className="card-pad">
              <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                <Avatar name={v.name} size="lg" color="#0ea5e9" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row-between">
                    <b className="truncate" style={{ fontSize: 14.5 }}>{v.name}</b>
                    <Badge tone={v.active ? 'green' : 'slate'} dot>{v.active ? 'نشط' : 'معطّل'}</Badge>
                  </div>
                  <div className="tiny muted">{v.contact_name || '—'} · {v.city || '—'}</div>
                  <div className="row gap-12 mt-4 wrap">
                    {v.email && <span className="tiny muted row gap-4" dir="ltr"><Mail size={11} />{v.email}</span>}
                    {v.phone && <span className="tiny muted row gap-4" dir="ltr"><Phone size={11} />{v.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="divider" style={{ margin: '13px 0' }} />
              <div className="grid grid-3" style={{ gap: 8 }}>
                <div><div className="tiny muted">المشتريات</div><b className="num">{formatCompact(vendorOrders.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + o.total, 0))}</b></div>
                <div><div className="tiny muted">أوامر الشراء</div><b className="num">{vendorOrders.length}</b></div>
                <div><div className="tiny muted">آخر أمر</div><b className="small">{vendorOrders[0] ? formatDate(vendorOrders[0].date) : '—'}</b></div>
              </div>
              <div className="row-between mt-12">
                <Btn size="sm" variant="ghost" onClick={() => setModal(v)}>تعديل</Btn>
                <Btn size="sm" onClick={() => navigate(`/purchase-orders?vendor=${v.id}`)}>أوامر الشراء <ArrowLeft size={13} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>
      {!filtered.length && <Card><Empty title="لا يوجد موردون" message="أضف أول مورد لبدء دورة المشتريات." action={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setModal({ type: 'vendor' })}>مورد جديد</Btn>} /></Card>}

      {modal && <PartnerForm initial={modal} defaultType="vendor" onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </div>
  );
}
