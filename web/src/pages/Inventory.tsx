import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Boxes, Download, Package, PackagePlus, Plus, TrendingDown, TrendingUp, Warehouse, AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useMeta, useToast } from '../lib/app-context';
import {
  Badge, Btn, Card, Empty, Field, Modal, PageHead, PageSkeleton, SearchBox, Select, Stat, Tabs,
  TextInput, Textarea, exportCsv,
} from '../components/ui';
import { formatCompact, formatDate, formatMoney, todayISO } from '../lib/format';

export default function Inventory() {
  const { data, loading, reload } = useApi<any>('/products');
  const moves = useApi<any>('/stock-moves');
  const [tab, setTab] = useState('products');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [moveModal, setMoveModal] = useState<any>(null);
  const navigate = useNavigate();
  const items = data?.items || [];
  const stats = data?.stats;

  const filtered = useMemo(() => items.filter((p: any) => {
    if (category && p.category !== category) return false;
    if (lowOnly && p.stock_status === 'ok') return false;
    if (q && !`${p.name} ${p.sku} ${p.category || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, category, lowOnly]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="المخزون والمنتجات"
        icon={<Package size={22} color="#14b8a6" />}
        breadcrumb={[{ label: 'المخزون' }]}
        sub="إدارة المنتجات والأرصدة وحركات المخزون مع تنبيهات إعادة الطلب."
        actions={(
          <>
            <Btn icon={<Download size={15} />} onClick={() => exportCsv('inventory', filtered.map((p: any) => ({
              sku: p.sku, name: p.name, category: p.category, stock: p.stock_qty, uom: p.uom,
              cost: p.cost_price, sale: p.sale_price, value: p.stock_qty * p.cost_price,
            })))}>تصدير</Btn>
            <Btn icon={<ArrowLeftRight size={15} />} onClick={() => setMoveModal({ type: 'in', date: todayISO(), qty: 1 })}>حركة مخزون</Btn>
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>منتج جديد</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="عدد المنتجات" value={stats?.count ?? 0} icon={<Boxes size={19} />} accent="#14b8a6" foot={`${(data?.categories || []).length} فئة`} />
        <Stat label="قيمة المخزون (تكلفة)" value={formatCompact(stats?.stockValue)} suffix="د.ع" icon={<Warehouse size={19} />} accent="#6366f1" foot="حسب سعر التكلفة" />
        <Stat label="القيمة البيعية" value={formatCompact(stats?.retailValue)} suffix="د.ع" icon={<TrendingUp size={19} />} accent="#10b981"
          foot={`هامش متوقع ${formatCompact((stats?.retailValue || 0) - (stats?.stockValue || 0))} د.ع`} />
        <Stat label="منتجات تحتاج إعادة طلب" value={stats?.lowStock ?? 0} icon={<TrendingDown size={19} />} accent="#ef4444" foot="أقل من أو يساوي حد الطلب" />
      </div>

      <Card>
        <div style={{ padding: '0 18px' }}>
          <Tabs value={tab} onChange={setTab} tabs={[
            { id: 'products', label: 'المنتجات', count: items.length, icon: <Package size={14} /> },
            { id: 'moves', label: 'حركات المخزون', count: moves.data?.length || 0, icon: <ArrowLeftRight size={14} /> },
          ]} />
        </div>

        {tab === 'products' && (
          <>
            <div className="toolbar">
              <SearchBox value={q} onChange={setQ} placeholder="بحث بالاسم أو الرمز…" className="grow" />
              <Select value={category} onChange={(e: any) => setCategory(e.target.value)} placeholder="كل الفئات"
                options={(data?.categories || []).map((c: string) => ({ value: c, label: c }))} />
              <button className={`btn btn-sm ${lowOnly ? 'btn-primary' : ''}`} onClick={() => setLowOnly((v) => !v)}>
                <AlertTriangle size={14} /> تحت الحد الأدنى
              </button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>المنتج</th><th>الفئة</th><th>المخزون</th><th>حد الطلب</th><th>التكلفة</th><th>سعر البيع</th><th>هامش الربح</th><th>قيمة المخزون</th><th>الحالة</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((p: any) => {
                    const margin = p.sale_price ? Math.round(((p.sale_price - p.cost_price) / p.sale_price) * 100) : 0;
                    return (
                      <tr key={p.id} className="clickable" onClick={() => navigate(`/inventory/${p.id}`)}>
                        <td><div className="cell-title">{p.name}</div><div className="cell-sub num">{p.sku}</div></td>
                        <td><Badge tone="slate">{p.category || '—'}</Badge></td>
                        <td className="num-cell strong">{p.stock_qty} <span className="tiny muted">{p.uom}</span></td>
                        <td className="num-cell small muted">{p.reorder_level}</td>
                        <td className="num-cell small">{formatCompact(p.cost_price)}</td>
                        <td className="num-cell small">{formatCompact(p.sale_price)}</td>
                        <td className="num-cell small" style={{ color: margin > 25 ? 'var(--green-600)' : 'var(--text-2)' }}>{margin}%</td>
                        <td className="num-cell small strong">{formatCompact(p.stock_qty * p.cost_price)}</td>
                        <td>
                          {p.stock_status === 'out' ? <Badge tone="red" dot>نفد</Badge>
                            : p.stock_status === 'low' ? <Badge tone="amber" dot>منخفض</Badge>
                              : <Badge tone="green" dot>متوفر</Badge>}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <Btn size="sm" variant="ghost" onClick={() => setMoveModal({ productId: p.id, type: 'in', date: todayISO(), qty: 1 })}>
                            <ArrowLeftRight size={13} />
                          </Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && <Empty title="لا توجد منتجات" action={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setForm({})}>منتج جديد</Btn>} />}
            </div>
          </>
        )}

        {tab === 'moves' && (
          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>التاريخ</th><th>المنتج</th><th>النوع</th><th>الكمية</th><th>المرجع</th><th>ملاحظة</th><th>بواسطة</th></tr></thead>
              <tbody>
                {(moves.data || []).map((m: any) => (
                  <tr key={m.id}>
                    <td className="small">{formatDate(m.date)}</td>
                    <td><div className="cell-title">{m.product_name}</div><div className="cell-sub num">{m.sku}</div></td>
                    <td>{m.type === 'in' ? <Badge tone="green">إدخال</Badge> : m.type === 'out' ? <Badge tone="red">إخراج</Badge> : <Badge tone="amber">تسوية</Badge>}</td>
                    <td className="num-cell strong">{m.qty} <span className="tiny muted">{m.uom}</span></td>
                    <td className="small num">{m.reference || '—'}</td>
                    <td className="small muted">{m.note || '—'}</td>
                    <td className="small muted">{m.user_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!moves.data?.length && <Empty title="لا توجد حركات" />}
          </div>
        )}
      </Card>

      {form && <ProductForm initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      {moveModal && <StockMoveForm initial={moveModal} products={items} onClose={() => setMoveModal(null)} onSaved={() => { setMoveModal(null); reload(); moves.reload(); }} />}
    </div>
  );
}

function ProductForm({ initial, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({
    sku: initial?.sku || '', name: initial?.name || '', category: initial?.category || '',
    uom: initial?.uom || 'قطعة', salePrice: initial?.sale_price || '', costPrice: initial?.cost_price || '',
    stockQty: initial?.stock_qty ?? '', reorderLevel: initial?.reorder_level || 0,
    warehouse: initial?.warehouse || 'المستودع الرئيسي', description: initial?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name || !form.sku) { toast.push('الاسم ورمز المنتج مطلوبان', 'error'); return; }
    setSaving(true);
    try {
      if (initial?.id) await api.patch(`/products/${initial.id}`, form);
      else await api.post('/products', form);
      toast.push('تم حفظ المنتج');
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial?.id ? 'تعديل المنتج' : 'منتج جديد'} size="lg"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>حفظ</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="اسم المنتج" required><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="رمز المنتج (SKU)" required><TextInput value={form.sku} onChange={(e: any) => setForm({ ...form, sku: e.target.value })} dir="ltr" /></Field>
        <Field label="الفئة"><TextInput value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })} placeholder="شبكات / خدمات…" /></Field>
        <Field label="وحدة القياس">
          <Select value={form.uom} onChange={(e: any) => setForm({ ...form, uom: e.target.value })}
            options={['قطعة', 'ترخيص', 'ساعة', 'عقد', 'يوم', 'مشروع', 'اشتراك'].map((u) => ({ value: u, label: u }))} />
        </Field>
        <Field label="سعر التكلفة"><TextInput type="number" value={form.costPrice} onChange={(e: any) => setForm({ ...form, costPrice: e.target.value })} /></Field>
        <Field label="سعر البيع"><TextInput type="number" value={form.salePrice} onChange={(e: any) => setForm({ ...form, salePrice: e.target.value })} /></Field>
        {!initial?.id && (
          <Field label="الكمية الافتتاحية"><TextInput type="number" value={form.stockQty} onChange={(e: any) => setForm({ ...form, stockQty: e.target.value })} /></Field>
        )}
        <Field label="حد إعادة الطلب"><TextInput type="number" value={form.reorderLevel} onChange={(e: any) => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
        <Field label="المستودع" style={{ gridColumn: '1 / -1' }}>
          <Select value={form.warehouse} onChange={(e: any) => setForm({ ...form, warehouse: e.target.value })}
            options={['المستودع الرئيسي', 'المستودع الرقمي', 'مستودع الفرع'].map((w) => ({ value: w, label: w }))} />
        </Field>
        <Field label="الوصف" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function StockMoveForm({ initial, products, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({ ...initial, note: '', reference: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.productId || !form.qty) { toast.push('المنتج والكمية مطلوبان', 'error'); return; }
    setSaving(true);
    try { await api.post('/stock-moves', form); toast.push('تم تسجيل حركة المخزون'); onSaved(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="حركة مخزون"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>تسجيل</Btn></>}>
      <div className="grid gap-16">
        <Field label="المنتج" required>
          <Select value={form.productId} onChange={(e: any) => setForm({ ...form, productId: e.target.value })} placeholder="اختر المنتج"
            options={products.map((p: any) => ({ value: p.id, label: `${p.sku} — ${p.name} (${p.stock_qty})` }))} />
        </Field>
        <div className="grid grid-2 gap-16">
          <Field label="نوع الحركة">
            <Select value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })}
              options={[{ value: 'in', label: 'إدخال' }, { value: 'out', label: 'إخراج' }, { value: 'adjust', label: 'تسوية (تعيين الرصيد)' }]} />
          </Field>
          <Field label="الكمية" required><TextInput type="number" min="1" value={form.qty} onChange={(e: any) => setForm({ ...form, qty: e.target.value })} /></Field>
          <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="المرجع"><TextInput value={form.reference} onChange={(e: any) => setForm({ ...form, reference: e.target.value })} placeholder="أمر شراء / صرف" dir="ltr" /></Field>
        </div>
        <Field label="ملاحظة"><Textarea value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
