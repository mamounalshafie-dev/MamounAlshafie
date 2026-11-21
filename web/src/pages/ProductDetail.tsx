import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftRight, Package, Pencil, TrendingUp, Warehouse, Wallet, Boxes } from 'lucide-react';
import { useApi } from '../lib/app-context';
import { Badge, Btn, Card, CardHead, Empty, PageHead, PageSkeleton, Progress, Stat } from '../components/ui';
import { MiniLine } from '../components/charts';
import { formatCompact, formatDate, formatMoney } from '../lib/format';

export default function ProductDetail() {
  const { id } = useParams();
  const apiRes = useApi<any>(`/products/${id}`);
  const d = apiRes.data;

  if (apiRes.loading && !d) return <PageSkeleton />;
  if (!d) return <Empty title="المنتج غير موجود" action={<Link to="/inventory" className="btn">عودة</Link>} />;

  const { product: p, moves, sales } = d;
  const margin = p.sale_price ? Math.round(((p.sale_price - p.cost_price) / p.sale_price) * 100) : 0;
  const stockPct = p.reorder_level ? Math.min(100, Math.round((p.stock_qty / (p.reorder_level * 2 || 1)) * 100)) : 100;

  return (
    <div className="page">
      <PageHead
        title={p.name}
        icon={<Package size={22} color="#14b8a6" />}
        breadcrumb={[{ label: 'المخزون', to: '/inventory' }, { label: p.sku }]}
        sub={<span className="row gap-8"><span className="num">{p.sku}</span> · <Badge tone="slate">{p.category || 'بدون فئة'}</Badge> <Badge tone={p.stock_status === 'ok' ? 'green' : p.stock_status === 'low' ? 'amber' : 'red'} dot>{p.stock_status === 'ok' ? 'متوفر' : p.stock_status === 'low' ? 'مخزون منخفض' : 'نفد المخزون'}</Badge></span>}
        actions={<Link to="/inventory" className="btn"><Pencil size={15} /> إدارة المنتجات</Link>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="الكمية المتوفرة" value={p.stock_qty} suffix={p.uom} icon={<Boxes size={19} />} accent="#14b8a6" foot={`حد إعادة الطلب: ${p.reorder_level}`} />
        <Stat label="قيمة المخزون" value={formatCompact(p.stock_qty * p.cost_price)} suffix="د.ع" icon={<Wallet size={19} />} accent="#6366f1" foot="بسعر التكلفة" />
        <Stat label="سعر البيع" value={formatCompact(p.sale_price)} suffix="د.ع" icon={<TrendingUp size={19} />} accent="#10b981" foot={`هامش الربح ${margin}%`} />
        <Stat label="سعر التكلفة" value={formatCompact(p.cost_price)} suffix="د.ع" icon={<Warehouse size={19} />} accent="#f59e0b" foot={`الموقع: ${p.warehouse}`} />
      </div>

      <div className="grid grid-3-2 mb-20">
        <Card>
          <CardHead title="مستوى المخزون" sub="مقارنة بالحد الأدنى للطلب" />
          <div style={{ padding: 20 }}>
            <div className="row-between mb-8"><span className="small muted">المتوفر حالياً</span><b className="num">{p.stock_qty} {p.uom}</b></div>
            <Progress value={stockPct} tone={p.stock_qty <= p.reorder_level ? 'red' : 'green'} />
            <div className="row-between mt-8">
              <span className="tiny muted">0</span><span className="tiny muted">حد الطلب {p.reorder_level}</span>
            </div>
            <div className="divider" style={{ margin: '16px 0' }} />
            <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>المستودع</dt><dd>{p.warehouse}</dd>
              <dt>وحدة القياس</dt><dd>{p.uom}</dd>
              <dt>خاضع للضريبة</dt><dd>{p.taxable ? 'نعم (15%)' : 'لا'}</dd>
              <dt>الوصف</dt><dd>{p.description || '—'}</dd>
            </dl>
          </div>
        </Card>
        <Card>
          <CardHead title="حركة المخزون" sub="آخر 10 حركات" />
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="table table-compact">
              <thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المرجع</th></tr></thead>
              <tbody>
                {moves.slice(0, 10).map((m: any) => (
                  <tr key={m.id}>
                    <td className="small">{formatDate(m.date)}</td>
                    <td>{m.type === 'in' ? <Badge tone="green">إدخال</Badge> : <Badge tone="red">إخراج</Badge>}</td>
                    <td className="num-cell">{m.qty}</td>
                    <td className="small muted num">{m.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="سجل المبيعات" sub={`${sales.length} عملية بيع`} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
            <tbody>
              {sales.map((s: any, i: number) => (
                <tr key={i}>
                  <td className="num-cell strong">{s.number}</td>
                  <td className="small muted">{formatDate(s.date)}</td>
                  <td>{s.customer_name}</td>
                  <td className="num-cell">{s.qty}</td>
                  <td className="num-cell">{formatMoney(s.unit_price)}</td>
                  <td className="num-cell strong">{formatMoney(s.qty * s.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.length && <Empty title="لا مبيعات مسجلة" message="لم يُبع هذا المنتج بعد." />}
        </div>
      </Card>
    </div>
  );
}
