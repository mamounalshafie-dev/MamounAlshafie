import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, Plus, ChevronDown, ChevronLeft, TrendingUp, TrendingDown, Wallet, Scale,
  ArrowLeft, BookOpen, FileSpreadsheet, CircleDollarSign, Building2,
} from 'lucide-react';
import { useApi, useToast } from '../lib/app-context';
import { api, ApiError } from '../lib/api';
import {
  Badge, Btn, Card, CardHead, Empty, Field, Modal, PageHead, PageSkeleton, Select, Stat, TextInput,
} from '../components/ui';
import { ACCOUNT_TYPES, cx, formatCompact, formatMoney } from '../lib/format';
import { RevenueTrend } from '../components/charts';

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense'];
const TYPE_TONES: Record<string, string> = { asset: 'blue', liability: 'amber', equity: 'purple', income: 'green', expense: 'red' };

export default function Accounting() {
  const accounts = useApi<any>('/accounts');
  const pl = useApi<any>('/reports/profit-loss');
  const bs = useApi<any>('/reports/balance-sheet');
  const cf = useApi<any>('/reports/cash-flow');
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true, 7: true, 11: true, 13: true, 16: true });
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  if (accounts.loading && !accounts.data) return <PageSkeleton />;
  const tree = accounts.data?.items || [];
  const totals = bs.data?.totals;
  const plTotals = pl.data?.totals;

  const cashTrend = (cf.data?.rows || []).map((r: any) => ({ month: r.month, revenue: r.inflow, expense: r.outflow, profit: r.inflow - r.outflow }));

  return (
    <div className="page">
      <PageHead
        title="المحاسبة"
        icon={<Landmark size={22} color="#6366f1" />}
        breadcrumb={[{ label: 'المالية' }, { label: 'المحاسبة' }]}
        sub="دليل الحسابات والأرصدة والقوائم المالية وفق نظام القيد المزدوج."
        actions={(
          <>
            <Link to="/accounting/reports" className="btn"><FileSpreadsheet size={15} /> القوائم المالية</Link>
            <Link to="/accounting/journal" className="btn"><BookOpen size={15} /> قيود اليومية</Link>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>حساب جديد</Btn>
          </>
        )}
      />

      <div className="grid grid-5 mb-20">
        <Stat label="إجمالي الأصول" value={formatCompact(totals?.assets)} suffix="د.ع" icon={<Building2 size={18} />} accent="#0ea5e9" />
        <Stat label="الخصوم" value={formatCompact(totals?.liabilities)} suffix="د.ع" icon={<Scale size={18} />} accent="#f59e0b" />
        <Stat label="حقوق الملكية" value={formatCompact(totals?.equity)} suffix="د.ع" icon={<Landmark size={18} />} accent="#8b5cf6" />
        <Stat label="إيرادات السنة" value={formatCompact(plTotals?.income)} suffix="د.ع" icon={<TrendingUp size={18} />} accent="#10b981" />
        <Stat label="صافي الربح" value={formatCompact(plTotals?.net)} suffix="د.ع" icon={<CircleDollarSign size={18} />} accent={plTotals?.net >= 0 ? '#10b981' : '#ef4444'} />
      </div>

      <div className="grid grid-3-2 mb-20">
        <Card>
          <CardHead title="دليل الحسابات" sub={`${tree.length} حساب رئيسي · ${accounts.data?.flat?.length ?? 0} حساب فرعي`} right={<Link to="/accounting/journal" className="btn btn-ghost btn-sm">قيود اليومية <ArrowLeft size={13} /></Link>} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th style={{ width: 100 }}>الرمز</th><th>الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
              <tbody>
                {TYPE_ORDER.map((type) => {
                  const groups = tree.filter((g: any) => g.type === type);
                  if (!groups.length) return null;
                  return (
                    <React.Fragment key={type}>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={6} style={{ padding: '8px 16px' }}>
                          <Badge tone={TYPE_TONES[type]}>{ACCOUNT_TYPES[type]}</Badge>
                        </td>
                      </tr>
                      {groups.map((g: any) => {
                        const isOpen = open[g.id];
                        return (
                          <React.Fragment key={g.id}>
                            <tr className="clickable" onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}>
                              <td className="num-cell strong">{g.code}</td>
                              <td className="strong">
                                <span className="row gap-6">
                                  {isOpen ? <ChevronDown size={13} /> : <ChevronLeft size={13} />}
                                  {g.name}
                                </span>
                              </td>
                              <td><Badge tone={TYPE_TONES[type]}>{ACCOUNT_TYPES[type]}</Badge></td>
                              <td className="num-cell">{formatCompact(g.debit)}</td>
                              <td className="num-cell">{formatCompact(g.credit)}</td>
                              <td className="num-cell strong" dir="ltr">{formatMoney(g.balance)}</td>
                            </tr>
                            {isOpen && g.children.map((c: any) => (
                              <tr key={c.id} style={{ background: 'var(--surface-2)' }}>
                                <td className="num-cell small muted">{c.code}</td>
                                <td className="small" style={{ paddingInlineStart: 34 }}>{c.name}</td>
                                <td><span className="tiny muted">حساب فرعي</span></td>
                                <td className="num-cell small">{formatCompact(c.debit)}</td>
                                <td className="num-cell small">{formatCompact(c.credit)}</td>
                                <td className="num-cell small strong" dir="ltr">{formatMoney(c.balance)}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="col gap-16">
          <Card>
            <CardHead title="الأصول مقابل الخصوم وحقوق الملكية" sub="الميزانية العمومية" />
            <div style={{ padding: 18 }}>
              <div className="row-between mb-8"><span className="small muted">الأصول</span><b className="num">{formatMoney(totals?.assets)}</b></div>
              <div className="progress"><i style={{ width: `${totals?.assets ? Math.min(100, (totals.assets / Math.max(totals.assets, totals.liabilitiesAndEquity)) * 100) : 0}%` }} /></div>
              <div className="row-between mt-16 mb-8"><span className="small muted">الخصوم + حقوق الملكية</span><b className="num">{formatMoney(totals?.liabilitiesAndEquity)}</b></div>
              <div className="progress green"><i style={{ width: `${totals?.assets ? Math.min(100, (totals.liabilitiesAndEquity / Math.max(totals.assets, totals.liabilitiesAndEquity)) * 100) : 0}%` }} /></div>
              <div className="divider" style={{ margin: '16px 0' }} />
              <div className="row-between"><span className="small muted">حالة التوازن</span>
                {Math.abs((totals?.assets || 0) - (totals?.liabilitiesAndEquity || 0)) < 1
                  ? <Badge tone="green" dot>متوازنة</Badge> : <Badge tone="red" dot>غير متوازنة</Badge>}
              </div>
            </div>
          </Card>
          <Card>
            <CardHead title="النتيجة المالية" sub="الإيرادات والمصروفات للسنة الحالية" />
            <div style={{ padding: 18 }}>
              <div className="row-between" style={{ padding: '5px 0' }}><span className="small muted">الإيرادات</span><b className="num pos">{formatMoney(plTotals?.income)}</b></div>
              <div className="row-between" style={{ padding: '5px 0' }}><span className="small muted">المصروفات</span><b className="num neg">{formatMoney(plTotals?.expense)}</b></div>
              <div className="row-between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}>
                <b>صافي الربح</b><b className="num" style={{ fontSize: 16 }}>{formatMoney(plTotals?.net)}</b>
              </div>
              <div className="badge badge-indigo mt-12" style={{ width: '100%', justifyContent: 'center' }}>
                هامش الربح {plTotals?.income ? Math.round((plTotals.net / plTotals.income) * 100) : 0}%
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mb-20">
        <CardHead title="التدفق النقدي" sub="المقبوضات والمدفوعات الشهرية" right={<Badge tone="green">الرصيد النقدي {formatCompact(cf.data?.balance)} د.ع</Badge>} />
        <div style={{ padding: '8px 16px 12px' }}>
          {cashTrend.length ? <RevenueTrend data={cashTrend} height={240} /> : <Empty title="لا توجد حركات نقدية" />}
        </div>
      </Card>

      <div className="grid grid-2">
        <Card>
          <CardHead title="أحدث القيود" right={<Link to="/accounting/journal" className="btn btn-ghost btn-sm">عرض الكل</Link>} />
          <RecentEntries />
        </Card>
        <Card>
          <CardHead title="المصروفات حسب البند" sub="السنة الحالية" />
          <div style={{ padding: 14 }}>
            {(pl.data?.expense || []).sort((a: any, b: any) => b.amount - a.amount).slice(0, 7).map((e: any, i: number) => {
              const max = Math.max(...(pl.data?.expense || []).map((x: any) => x.amount), 1);
              return (
                <div key={e.code} style={{ padding: '7px 4px' }}>
                  <div className="row-between mb-4">
                    <span className="small">{e.name}</span>
                    <span className="num small strong">{formatCompact(e.amount)}</span>
                  </div>
                  <div className="progress sm"><i style={{ width: `${(e.amount / max) * 100}%`, background: ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#0ea5e9', '#14b8a6', '#6366f1'][i % 7] }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {modalOpen && <AccountModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); accounts.reload(); toast.push('تم إنشاء الحساب'); }} parents={tree} />}
    </div>
  );
}

function RecentEntries() {
  const { data, loading } = useApi<any>('/journal-entries?pageSize=6');
  const items = (data?.items || []).slice(0, 6);
  if (loading && !data) return <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 120 }} /></div>;
  return (
    <div className="table-wrap">
      <table className="table table-compact">
        <thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead>
        <tbody>
          {items.map((e: any) => (
            <tr key={e.id}>
              <td className="num-cell strong">{e.number}</td>
              <td className="small muted">{e.date}</td>
              <td className="small">{e.memo}</td>
              <td className="num-cell strong">{formatCompact(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty title="لا قيود" />}
    </div>
  );
}

function AccountModal({ onClose, onSaved, parents }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({ code: '', name: '', type: 'asset', parentId: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.code || !form.name) { toast.push('الرمز والاسم مطلوبان', 'error'); return; }
    setSaving(true);
    try { await api.post('/accounts', form); onSaved(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="حساب جديد" sub="أضف حساباً إلى دليل الحسابات"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>إنشاء</Btn></>}>
      <div className="grid gap-16">
        <div className="grid grid-2 gap-16">
          <Field label="رمز الحساب" required><TextInput value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} placeholder="1700" dir="ltr" /></Field>
          <Field label="نوع الحساب" required>
            <Select value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })}
              options={Object.entries(ACCOUNT_TYPES).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
        </div>
        <Field label="اسم الحساب" required><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="الحساب الأب">
          <Select value={form.parentId} onChange={(e: any) => setForm({ ...form, parentId: e.target.value })} placeholder="حساب رئيسي"
            options={parents.filter((p: any) => p.type === form.type).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} />
        </Field>
      </div>
    </Modal>
  );
}
