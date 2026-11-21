import React, { useMemo, useState } from 'react';
import {
  Printer, Scale, TrendingUp, Landmark, Clock, Wallet, FileSpreadsheet, CheckCircle2, CalendarDays,
} from 'lucide-react';
import { useApi } from '../lib/app-context';
import {
  Badge, Btn, Card, Empty, PageHead, PageSkeleton, Stat, Tabs, Select, exportCsv,
} from '../components/ui';
import { RevenueTrend } from '../components/charts';
import { ACCOUNT_TYPES, formatCompact, formatDate, formatMoney, monthLabel, todayISO, INVOICE_STATUS } from '../lib/format';

const TABS = [
  { id: 'pl', label: 'الأرباح والخسائر', icon: <TrendingUp size={14} /> },
  { id: 'bs', label: 'الميزانية العمومية', icon: <Landmark size={14} /> },
  { id: 'trial', label: 'ميزان المراجعة', icon: <Scale size={14} /> },
  { id: 'aging', label: 'أعمار الذمم', icon: <Clock size={14} /> },
  { id: 'cash', label: 'التدفق النقدي', icon: <Wallet size={14} /> },
];

const year = new Date().getFullYear();
const PRESETS = [
  { id: 'month', label: 'هذا الشهر', from: `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`, to: todayISO() },
  { id: 'quarter', label: 'هذا الربع', from: `${year}-${String(Math.floor(new Date().getMonth() / 3) * 3 + 1).padStart(2, '0')}-01`, to: todayISO() },
  { id: 'year', label: 'السنة الحالية', from: `${year}-01-01`, to: todayISO() },
];

export default function FinancialReports() {
  const [tab, setTab] = useState('pl');
  const [range, setRange] = useState<any>(PRESETS[2]);
  const q = `from=${range.from}&to=${range.to}`;
  const pl = useApi<any>(`/reports/profit-loss?${q}`, [range]);
  const bs = useApi<any>(`/reports/balance-sheet?to=${range.to}`, [range]);
  const trial = useApi<any>(`/reports/trial-balance?${q}`, [range]);
  const aging = useApi<any>('/reports/ar-aging');
  const cash = useApi<any>('/reports/cash-flow');

  if (pl.loading && !pl.data) return <PageSkeleton />;

  const plData = pl.data;
  const bsData = bs.data;

  return (
    <div className="page">
      <PageHead
        title="القوائم المالية"
        icon={<FileSpreadsheet size={22} color="#6366f1" />}
        breadcrumb={[{ label: 'المالية' }, { label: 'القوائم المالية' }]}
        sub="قوائم مالية معتمدة على القيود المرحّلة — قابلة للطباعة والتصدير."
        actions={(
          <>
            <Btn icon={<Printer size={15} />} onClick={() => window.print()}>طباعة</Btn>
            <Select value={range.id} onChange={(e: any) => setRange(PRESETS.find((p) => p.id === e.target.value) || PRESETS[2])}
              options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
          </>
        )}
      />

      <div className="grid grid-4 mb-20 no-print">
        <Stat label="الإيرادات" value={formatCompact(plData?.totals?.income)} suffix="د.ع" icon={<TrendingUp size={19} />} accent="#10b981" />
        <Stat label="المصروفات" value={formatCompact(plData?.totals?.expense)} suffix="د.ع" icon={<Wallet size={19} />} accent="#ef4444" />
        <Stat label="صافي الربح" value={formatCompact(plData?.totals?.net)} suffix="د.ع" icon={<Scale size={19} />} accent="#6366f1"
          foot={`هامش ${plData?.totals?.income ? Math.round((plData.totals.net / plData.totals.income) * 100) : 0}%`} />
        <Stat label="إجمالي الأصول" value={formatCompact(bsData?.totals?.assets)} suffix="د.ع" icon={<Landmark size={19} />} accent="#0ea5e9" />
      </div>

      <Card className="no-print">
        <div style={{ padding: '0 18px' }}>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
        </div>
        <div className="toolbar" style={{ borderTop: 'none' }}>
          <span className="small muted">الفترة: {formatDate(range.from)} — {formatDate(range.to)}</span>
          <div className="spacer" />
          <Badge tone="green"><CheckCircle2 size={12} /> بيانات مرحّلة</Badge>
        </div>
      </Card>

      <div className="mt-16 print-area">
        {tab === 'pl' && (
          <Card>
            <div className="card-head"><div><h3>{'قائمة الأرباح والخسائر'}</h3><div className="sub">{formatDate(range.from)} — {formatDate(range.to)} · بالدينار العراقي</div></div></div>
            <div style={{ padding: 22 }}>
              <div className="row-between mb-12">
                <h4 style={{ fontSize: 14, color: 'var(--green-600)' }}>الإيرادات</h4>
                <span className="small muted">المبالغ بالدينار العراقي</span>
              </div>
              <StatementTable rows={plData?.income || []} total={plData?.totals?.income} totalLabel="إجمالي الإيرادات" tone="green" />
              <div className="divider" style={{ margin: '22px 0' }} />
              <h4 style={{ fontSize: 14, color: 'var(--red-500)', marginBottom: 12 }}>المصروفات</h4>
              <StatementTable rows={plData?.expense || []} total={plData?.totals?.expense} totalLabel="إجمالي المصروفات" tone="red" />
              <div className="divider" style={{ margin: '22px 0' }} />
              <div className="row-between" style={{ padding: '10px 14px', background: 'var(--surface-3)', borderRadius: 10 }}>
                <b style={{ fontSize: 15 }}>{plData?.totals?.net >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</b>
                <b className="num" style={{ fontSize: 19, color: plData?.totals?.net >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
                  {formatMoney(plData?.totals?.net)}
                </b>
              </div>
              {plData?.monthly?.length > 0 && (
                <div className="mt-24">
                  <h4 style={{ fontSize: 13.5, marginBottom: 10 }}>الأداء الشهري</h4>
                  <RevenueTrend data={plData.monthly.map((m: any) => ({ month: m.month, revenue: m.income, expense: m.expense, profit: m.income - m.expense }))} height={250} />
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === 'bs' && (
          <Card>
            <div className="card-head"><div><h3>الميزانية العمومية</h3><div className="sub">كما في {formatDate(range.to)} · بالدينار العراقي</div></div></div>
            <div className="grid grid-2" style={{ padding: 22, alignItems: 'start' }}>
              <div>
                <h4 style={{ fontSize: 14, color: '#0369a1', marginBottom: 12 }}>الأصول</h4>
                <StatementTable rows={bsData?.assets || []} total={bsData?.totals?.assets} totalLabel="إجمالي الأصول" tone="blue" />
              </div>
              <div>
                <h4 style={{ fontSize: 14, color: '#b45309', marginBottom: 12 }}>الخصوم وحقوق الملكية</h4>
                <StatementTable rows={bsData?.liabilities || []} total={bsData?.totals?.liabilities} totalLabel="إجمالي الخصوم" tone="amber" />
                <div className="mt-16" />
                <StatementTable
                  rows={[...(bsData?.equity || []), ...(bsData?.netIncome ? [{ code: '3999', name: 'صافي ربح الفترة', amount: bsData.netIncome }] : [])]}
                  total={bsData?.totals?.equity} totalLabel="إجمالي حقوق الملكية" tone="purple" />
                <div className="row-between mt-16" style={{ padding: '10px 14px', background: 'var(--surface-3)', borderRadius: 10 }}>
                  <b>إجمالي الخصوم وحقوق الملكية</b>
                  <b className="num">{formatMoney(bsData?.totals?.liabilitiesAndEquity)}</b>
                </div>
              </div>
            </div>
          </Card>
        )}

        {tab === 'trial' && (
          <Card>
            <div className="card-head">
              <div><h3>ميزان المراجعة</h3><div className="sub">أرصدة مدينة ودائنة لكل حساب</div></div>
              <div className="row gap-8">
                {trial.data?.balanced ? <Badge tone="green" dot>متوازن</Badge> : <Badge tone="red" dot>غير متوازن</Badge>}
                <Btn size="sm" onClick={() => exportCsv('trial-balance', trial.data?.rows || [])}>تصدير</Btn>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>الرمز</th><th>الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
                <tbody>
                  {(trial.data?.rows || []).map((r: any) => (
                    <tr key={r.code}>
                      <td className="num-cell">{r.code}</td>
                      <td>{r.name}</td>
                      <td><Badge tone="slate">{ACCOUNT_TYPES[r.type]}</Badge></td>
                      <td className="num-cell">{formatMoney(r.debit)}</td>
                      <td className="num-cell">{formatMoney(r.credit)}</td>
                      <td className="num-cell strong" dir="ltr">{formatMoney(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>الإجمالي</td>
                    <td className="num-cell">{formatMoney(trial.data?.totals?.debit)}</td>
                    <td className="num-cell">{formatMoney(trial.data?.totals?.credit)}</td>
                    <td className="num-cell">{formatMoney((trial.data?.totals?.debit || 0) - (trial.data?.totals?.credit || 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {tab === 'aging' && (
          <div className="grid gap-16">
            <div className="grid grid-5">
              {(aging.data?.summary || []).map((b: any) => (
                <Stat key={b.label} label={b.label === 'current' ? 'غير مستحقة' : `${b.label} يوم`}
                  value={formatCompact(b.amount)} suffix="د.ع" accent={b.label === '90+' ? '#ef4444' : b.label === 'current' ? '#10b981' : '#f59e0b'}
                  foot={`${b.count} فاتورة`} />
              ))}
            </div>
            <Card>
              <div className="card-head"><div><h3>أعمار الذمم المدينة</h3><div className="sub">فواتير غير مدفوعة مرتبة حسب أيام التأخير</div></div>
                <Badge tone="amber">الإجمالي {formatMoney(aging.data?.total)}</Badge></div>
              <div className="table-wrap">
                <table className="table table-compact">
                  <thead><tr><th>الفاتورة</th><th>العميل</th><th>التاريخ</th><th>الاستحقاق</th><th>أيام التأخير</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
                  <tbody>
                    {(aging.data?.invoices || []).map((i: any) => (
                      <tr key={i.id}>
                        <td className="num-cell strong">{i.number}</td>
                        <td className="small">{i.customer_name}</td>
                        <td className="small muted">{formatDate(i.date)}</td>
                        <td className="small muted">{formatDate(i.due_date)}</td>
                        <td className="num-cell">{i.days_overdue > 0 ? <span className="neg">{i.days_overdue}</span> : '—'}</td>
                        <td className="num-cell">{formatMoney(i.total)}</td>
                        <td className="num-cell pos">{formatMoney(i.amount_paid)}</td>
                        <td className="num-cell strong">{formatMoney(i.total - i.amount_paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!aging.data?.invoices?.length && <Empty title="لا ذمم مفتوحة" message="جميع الفواتير محصّلة." />}
              </div>
            </Card>
          </div>
        )}

        {tab === 'cash' && (
          <Card>
            <div className="card-head">
              <div><h3>قائمة التدفق النقدي</h3><div className="sub">حركة النقدية في الصندوق والبنك</div></div>
              <Badge tone="green">الرصيد الحالي {formatMoney(cash.data?.balance)}</Badge>
            </div>
            <div style={{ padding: '10px 16px' }}>
              <RevenueTrend data={(cash.data?.rows || []).map((r: any) => ({ month: r.month, revenue: r.inflow, expense: r.outflow, profit: r.inflow - r.outflow }))} height={260} />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>الشهر</th><th>المقبوضات</th><th>المدفوعات</th><th>صافي التدفق</th></tr></thead>
                <tbody>
                  {(cash.data?.rows || []).map((r: any) => (
                    <tr key={r.month}>
                      <td className="strong">{monthLabel(r.month)}</td>
                      <td className="num-cell pos">{formatMoney(r.inflow)}</td>
                      <td className="num-cell neg">{formatMoney(r.outflow)}</td>
                      <td className="num-cell strong">{formatMoney(r.inflow - r.outflow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatementTable({ rows, total, totalLabel, tone }: any) {
  if (!rows?.length) return <Empty title="لا توجد حركات في هذه الفترة" />;
  return (
    <table className="table" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
      <tbody>
        {rows.map((r: any) => (
          <tr key={r.code}>
            <td style={{ width: 80 }} className="num-cell small muted">{r.code}</td>
            <td>{r.name}</td>
            <td className="num-cell" style={{ width: 200 }}>{formatMoney(r.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}><b>{totalLabel}</b></td>
          <td className="num-cell"><b>{formatMoney(total)}</b></td>
        </tr>
      </tfoot>
    </table>
  );
}
