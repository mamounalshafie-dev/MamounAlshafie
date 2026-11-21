import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, HandCoins, Landmark, Search, Wallet } from 'lucide-react';
import { qs } from '../lib/api';
import { useApi, useDebounced } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, PageHead, Pagination, SearchBox, Select } from '../components/ui';
import { KpiTile, MoneyCell, Panel } from '../components/re-ui';
import { BarList, StatusDonut } from '../components/re-charts';
import { formatCompact, formatDate, formatMoney, monthLabel } from '../lib/format';

export default function Collections() {
  const { code, setCode, projects } = useRe();
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 350);
  const [page, setPage] = useState(1);

  const { data, loading } = useApi<any>(
    `/re/collections${qs({ project: code, method, q: debounced, page, pageSize: 20 })}`,
    [code, method, debounced, page],
  );
  React.useEffect(() => { setPage(1); }, [code, method, debounced]);

  const items = data?.items || [];
  const stats = data?.stats || {};
  const byMethod = data?.byMethod || [];
  const monthly = data?.monthly || [];

  const donut = useMemo(() => byMethod.map((m: any, i: number) => ({
    name: m.method, value: m.amount,
    color: ['#c8a24a', '#153a63', '#2f7d5f', '#8a5cf6', '#d97706'][i % 5],
  })), [byMethod]);

  return (
    <div className="page">
      <PageHead
        title="التحصيل"
        icon={<HandCoins size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المبيعات' }, { label: 'التحصيل' }]}
        sub="سجل إيصالات التحصيل من العملاء والمستأجرين، موزّعاً على طرق الدفع والحسابات البنكية."
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي التحصيلات" value={formatCompact(stats.amount)} icon={<Wallet size={19} />} foot={`${stats.total || 0} إيصال`} gold />
        <KpiTile label="تحصيل اليوم" value={formatCompact(stats.today)} icon={<Banknote size={19} />} foot="نقدي وبنكي" />
        <KpiTile label="تحصيل هذا الشهر" value={formatCompact(stats.this_month)} icon={<CreditCard size={19} />} foot="الشهر الحالي" />
        <KpiTile label="متوسط الإيصال" value={formatCompact(stats.avg_amount)} icon={<Landmark size={19} />} foot="لكل عملية" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(320px,1fr)', gap: 14 }}>
        <div className="card">
          <div className="row-between" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 14 }}>أحدث عمليات التحصيل</h3>
            <div className="row gap-8">
              <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 160 }}>
                <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
              <Select value={method} onChange={(e: any) => setMethod(e.target.value)} style={{ minWidth: 130 }}>
                <option value="">كل الطرق</option>
                {byMethod.map((m: any) => <option key={m.method} value={m.method}>{m.method}</option>)}
              </Select>
              <SearchBox value={q} onChange={setQ} placeholder="اسم العميل أو رقم الإيصال…" />
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الإيصال</th><th>التاريخ</th><th>العميل</th><th>الوحدة</th><th>العقد</th><th>الطريقة</th><th>المبلغ</th></tr></thead>
              <tbody>
                {items.map((c: any) => (
                  <tr key={c.id}>
                    <td className="num small" style={{ fontWeight: 700 }}>{c.number}</td>
                    <td className="small">{formatDate(c.date)}</td>
                    <td><div className="small" style={{ fontWeight: 600 }}>{c.partner_name}</div><div className="tiny muted">{c.reference || '—'}</div></td>
                    <td className="num">{c.unit_code}</td>
                    <td className="num small">{c.contract_number}</td>
                    <td><Badge tone={c.method === 'نقدي' ? 'green' : 'blue'}>{c.method}</Badge></td>
                    <td><MoneyCell value={c.amount} strong /></td>
                  </tr>
                ))}
                {!loading && !items.length && <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد تحصيلات</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <span className="tiny muted">عرض {items.length} من {stats.total || 0}</span>
            <Pagination page={page} pageSize={20} total={stats.total || 0} onChange={setPage} />
          </div>
        </div>

        <div className="col gap-14">
          <Panel title="توزيع طرق الدفع" icon={<CreditCard size={16} color="var(--gold)" />}>
            <StatusDonut data={donut} centerValue={formatCompact(stats.amount)} centerLabel="محصل" height={190} />
            <div className="col gap-6 mt-8">
              {byMethod.map((m: any, i: number) => (
                <div key={m.method} className="row-between small">
                  <span><i className="mc-dot" style={{ background: ['#c8a24a', '#153a63', '#2f7d5f', '#8a5cf6', '#d97706'][i % 5] }} /> {m.method}</span>
                  <span className="num">{formatCompact(m.amount)} <span className="tiny muted">({m.count})</span></span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="التحصيل الشهري" icon={<Wallet size={16} color="var(--gold)" />}>
            <BarList data={monthly.slice(0, 6).reverse().map((m: any) => ({ label: monthLabel(m.month), amount: m.amount }))} color="#153a63" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
