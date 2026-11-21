import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Landmark, PiggyBank, Wallet } from 'lucide-react';
import { qs } from '../lib/api';
import { useApi } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, PageHead, PageSkeleton, Select } from '../components/ui';
import { KpiTile, MoneyCell, Panel } from '../components/re-ui';
import { MiniArea } from '../components/re-charts';
import { formatCompact, formatDate, formatMoney } from '../lib/format';

export default function Treasury() {
  const { code, setCode, projects, project } = useRe();
  const { data, loading } = useApi<any>(`/re/treasury${qs({ project: code })}`, [code]);
  const navigate = useNavigate();

  if (loading && !data) return <PageSkeleton />;
  const accounts = data?.accounts || [];
  const total = data?.total || 0;
  const movements = data?.movements || [];
  const monthly = data?.monthly || [];
  const accountMap = data?.map || {};
  const cashCode = accountMap.cash || '1100';
  const bankCode = accountMap.bank || '1200';
  const inflowTotal = monthly.reduce((sum: number, month: any) => sum + month.inflow, 0);
  const outflowTotal = monthly.reduce((sum: number, month: any) => sum + month.outflow, 0);
  const lastMonth = monthly[monthly.length - 1];
  const maxMovement = Math.max(1, ...monthly.map((month: any) => Math.max(month.inflow, month.outflow)));

  return (
    <div className="page">
      <PageHead
        title="الصندوق والبنوك"
        icon={<Landmark size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المالية' }, { label: 'الصندوق والبنوك' }]}
        sub={`أرصدة وحركة حسابات النقدية المرتبطة بـ${code === 'all' ? 'كل المشاريع' : (project?.name || 'المشروع المحدد')}، من القيود المحاسبية المرحّلة.`}
        actions={(
          <div className="row gap-8">
            <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 200 }}>
              <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
            <Btn variant="ghost" icon={<BookOpen size={15} />} onClick={() => navigate('/re/accounts')}>ربط الحسابات</Btn>
            <Btn variant="ghost" icon={<Wallet size={15} />} onClick={() => navigate('/accounting/journal')}>قيود اليومية</Btn>
          </div>
        )}
      />

      <div className="grid grid-3 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي السيولة" value={formatCompact(total)} icon={<Wallet size={19} />} foot="أرصدة الصندوق والبنوك" gold />
        {accounts.map((account: any) => {
          const isCash = account.code === cashCode;
          return (
            <KpiTile
              key={account.id}
              label={account.name}
              value={formatCompact(account.balance)}
              icon={isCash ? <PiggyBank size={19} /> : <Landmark size={19} />}
              foot={`${isCash ? 'الصندوق' : 'البنك'} · ${account.code}`}
            />
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14 }}>
        <Panel title="حركة السيولة الشهرية" icon={<Wallet size={16} color="var(--gold)" />} right={<span className="tiny muted">آخر 6 أشهر</span>}>
          <div className="row gap-16 mb-8">
            <span className="small"><i className="mc-dot" style={{ background: '#16a34a' }} /> الداخل</span>
            <span className="small"><i className="mc-dot" style={{ background: '#dc2626' }} /> الخارج</span>
          </div>
          {monthly.length ? (
            <div className="grid" style={{ gridTemplateColumns: `repeat(${monthly.length}, minmax(0, 1fr))`, gap: 8, alignItems: 'end', height: 220 }}>
              {monthly.map((month: any) => (
                <div key={month.month} style={{ textAlign: 'center', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 170, justifyContent: 'center' }}>
                    <div title={`داخل ${formatMoney(month.inflow)}`} style={{ width: 14, height: `${Math.max(2, (month.inflow / maxMovement) * 100)}%`, background: 'linear-gradient(180deg,#34d399,#16a34a)', borderRadius: 5 }} />
                    <div title={`خارج ${formatMoney(month.outflow)}`} style={{ width: 14, height: `${Math.max(2, (month.outflow / maxMovement) * 100)}%`, background: 'linear-gradient(180deg,#f87171,#dc2626)', borderRadius: 5 }} />
                  </div>
                  <div className="tiny muted mt-6">{month.month.slice(5)}/{month.month.slice(2, 4)}</div>
                </div>
              ))}
            </div>
          ) : <div className="empty small">لا توجد حركة نقدية للفترة المحددة.</div>}
        </Panel>

        <Panel title="ملخص السيولة" icon={<Landmark size={16} color="var(--gold)" />}>
          <div className="col gap-10">
            <div className="row-between small"><span className="muted">صافي الشهر الحالي</span><MoneyCell value={(lastMonth?.inflow || 0) - (lastMonth?.outflow || 0)} strong /></div>
            <div className="row-between small"><span className="muted">إجمالي الداخل (6 أشهر)</span><MoneyCell value={inflowTotal} /></div>
            <div className="row-between small"><span className="muted">إجمالي الخارج (6 أشهر)</span><MoneyCell value={outflowTotal} /></div>
            <div className="row-between small"><span className="muted">نسبة تغطية المدفوعات</span><b className="num">{outflowTotal ? Math.round((inflowTotal / outflowTotal) * 100) : 0}%</b></div>
            <div className="row-between small"><span className="muted">حسابات السيولة المرتبطة</span><Badge tone="slate">{accounts.length}</Badge></div>
            <div className="tiny muted">مصدر الحركة: {cashCode} (صندوق) و{bankCode} (بنك) · {code === 'all' ? 'كل المشاريع' : project?.code}</div>
          </div>
          <div className="mt-12"><MiniArea data={monthly.map((month: any) => month.inflow - month.outflow)} color="#c8a24a" height={54} /></div>
        </Panel>
      </div>

      <Panel title="أحدث الحركات المالية" icon={<Wallet size={16} color="var(--gold)" />} className="mt-14" pad>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>داخل</th><th>خارج</th><th>الاتجاه</th></tr></thead>
            <tbody>
              {movements.map((movement: any) => (
                <tr key={movement.id}>
                  <td className="num small">{movement.number}</td>
                  <td className="small">{formatDate(movement.date)}</td>
                  <td className="small">{movement.memo}</td>
                  <td className="small muted">{movement.reference || '—'}</td>
                  <td>{movement.inflow ? <span className="num" style={{ color: 'var(--green-600)', fontWeight: 700 }}>{formatMoney(movement.inflow)}</span> : <span className="muted">—</span>}</td>
                  <td>{movement.outflow ? <span className="num" style={{ color: 'var(--red-600)', fontWeight: 700 }}>{formatMoney(movement.outflow)}</span> : <span className="muted">—</span>}</td>
                  <td><Badge tone={movement.inflow > movement.outflow ? 'green' : 'red'}>{movement.inflow > movement.outflow ? 'داخل' : 'خارج'}</Badge></td>
                </tr>
              ))}
              {!movements.length && <tr><td colSpan={7} className="small muted" style={{ padding: 24, textAlign: 'center' }}>لا توجد قيود نقدية للمشروع المحدد.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
