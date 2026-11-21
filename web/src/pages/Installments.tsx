import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Download, HandCoins, OctagonAlert, Search, Wallet } from 'lucide-react';
import { qs } from '../lib/api';
import { useApi, useDebounced } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, PageHead, Pagination, SearchBox, Select, exportCsv } from '../components/ui';
import { DueCell, KpiTile, MoneyCell, Panel } from '../components/re-ui';
import { CollectionModal } from '../components/CollectionModal';
import { BarList } from '../components/re-charts';
import { monthLabel, formatCompact, formatMoney } from '../lib/format';

const TABS = [
  { id: '', label: 'الكل' },
  { id: 'pending', label: 'مستحقة' },
  { id: 'overdue', label: 'متأخرة' },
  { id: 'partial', label: 'جزئية' },
  { id: 'paid', label: 'مسددة' },
];

export default function Installments() {
  const { code, setCode, projects } = useRe();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || '');
  const [month, setMonth] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const debounced = useDebounced(q, 350);
  const [page, setPage] = useState(1);
  const [pay, setPay] = useState<any>(null);

  const { data, loading, reload } = useApi<any>(
    `/re/installments${qs({ project: code, status, month, q: debounced, page, pageSize: 20 })}`,
    [code, status, month, debounced, page],
  );
  useEffect(() => { setPage(1); }, [code, status, month, debounced]);

  const items = data?.items || [];
  const stats = data?.stats || {};
  const months = data?.months || [];

  const monthBars = useMemo(() => months.slice(0, 6).reverse().map((m: any) => ({
    label: monthLabel(m.month), amount: m.collected, amount2: m.amount,
  })), [months]);

  const doExport = () => exportCsv('installments', items.map((i: any) => ({
    contract: i.contract_number, partner: i.partner_name, unit: i.unit_code,
    due: i.due_date, amount: i.amount, paid: i.paid_amount, status: i.status,
  })), [
    { key: 'contract', label: 'العقد' }, { key: 'partner', label: 'العميل' }, { key: 'unit', label: 'الوحدة' },
    { key: 'due', label: 'الاستحقاق' }, { key: 'amount', label: 'المبلغ' }, { key: 'paid', label: 'المسدد' },
    { key: 'status', label: 'الحالة' },
  ]);

  const payModalInstallments = pay ? [pay] : [];

  return (
    <div className="page">
      <PageHead
        title="الأقساط"
        icon={<CalendarClock size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'التحصيل' }, { label: 'الأقساط' }]}
        sub="متابعة جدول الأقساط لكل عقد، وتحصيل المستحق منها مع ترحيل محاسبي فوري."
        actions={(
          <div className="row gap-8">
            <Btn variant="ghost" icon={<Download size={15} />} onClick={doExport}>تصدير</Btn>
            <Btn icon={<HandCoins size={15} />} onClick={() => setPay(items.find((i: any) => i.status !== 'paid') || null)} disabled={!items.some((i: any) => i.status !== 'paid')}>تحصيل قسط</Btn>
          </div>
        )}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي الأقساط" value={stats.total || 0} icon={<CalendarClock size={19} />} foot={`${stats.paid || 0} مسدد · ${stats.pending || 0} مستحق`} />
        <KpiTile label="المحصل" value={formatCompact(stats.collected)} icon={<Wallet size={19} />} foot={`من أصل ${formatCompact(stats.amount)}`} />
        <KpiTile label="مستحق هذا الشهر" value={formatCompact(stats.due_this_month)} icon={<CalendarClock size={19} />} foot="بحاجة متابعة" gold />
        <KpiTile label="متأخر" value={formatCompact(stats.overdue_amount)} icon={<OctagonAlert size={19} />} foot={`${stats.overdue || 0} قسط متأخر`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 14 }}>
        <div className="card">
          <div className="row-between" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {TABS.map((t) => (
                <button key={t.id || 'all'} onClick={() => setStatus(t.id)} className="tiny" style={{
                  padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 600,
                  border: `1px solid ${status === t.id ? 'var(--brand-600)' : 'var(--border)'}`,
                  background: status === t.id ? 'var(--brand-600)' : 'var(--surface)',
                  color: status === t.id ? '#fff' : 'var(--text-2)',
                }}>{t.label}</button>
              ))}
            </div>
            <div className="row gap-8">
              <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 160 }}>
                <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
              <Select value={month} onChange={(e: any) => setMonth(e.target.value)} style={{ minWidth: 130 }}>
                <option value="">كل الأشهر</option>
                {months.map((m: any) => <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>)}
              </Select>
              <SearchBox value={q} onChange={setQ} placeholder="اسم العميل أو العقد…" />
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>العميل / العقد</th><th>الوحدة</th><th>الاستحقاق</th><th>المبلغ</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i.id}>
                    <td className="num muted">{i.seq}</td>
                    <td>
                      <div className="small" style={{ fontWeight: 700 }}>{i.partner_name}</div>
                      <div className="tiny muted num">{i.contract_number} · {i.contract_type === 'sale' ? 'بيع' : 'إيجار'}</div>
                    </td>
                    <td><div className="num small">{i.unit_code}</div><div className="tiny muted">مبنى {i.building_code}</div></td>
                    <td><DueCell due={i.due_date} status={i.status} /></td>
                    <td><MoneyCell value={i.amount} /></td>
                    <td><MoneyCell value={i.paid_amount} tone="var(--green-600)" /></td>
                    <td><MoneyCell value={i.amount - i.paid_amount} strong /></td>
                    <td>
                      <Badge tone={i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : i.status === 'partial' ? 'amber' : 'slate'}>
                        {i.status === 'paid' ? 'مسدد' : i.status === 'overdue' ? 'متأخر' : i.status === 'partial' ? 'جزئي' : 'مستحق'}
                      </Badge>
                    </td>
                    <td>{i.status !== 'paid' && <Btn size="sm" variant="ghost" icon={<HandCoins size={13} />} onClick={() => setPay(i)}>تحصيل</Btn>}</td>
                  </tr>
                ))}
                {!loading && !items.length && <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد أقساط مطابقة</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <span className="tiny muted">عرض {items.length} من {stats.total || 0} قسط</span>
            <Pagination page={page} pageSize={20} total={stats.total || 0} onChange={setPage} />
          </div>
        </div>

        <div className="col gap-14">
          <Panel title="التحصيل الشهري" icon={<Wallet size={16} color="var(--gold)" />} right={<span className="tiny muted">آخر 6 أشهر</span>}>
            <BarList data={monthBars.map((m: any) => ({ label: m.label, amount: m.amount }))} color="var(--gold)" />
          </Panel>
          <Panel title="ملخص" icon={<CalendarClock size={16} color="var(--gold)" />}>
            <div className="col gap-8 small">
              {[
                ['إجمالي قيمة الأقساط', stats.amount],
                ['المحصل منها', stats.collected],
                ['المتبقي', stats.remaining],
                ['منها متأخر', stats.overdue_amount],
                ['متوسط القسط', stats.total ? stats.amount / stats.total : 0],
              ].map(([l, v]) => (
                <div key={String(l)} className="row-between"><span className="muted">{l}</span><MoneyCell value={Number(v) || 0} strong /></div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <CollectionModal
        open={!!pay}
        onClose={() => setPay(null)}
        unit={{ code: pay?.unit_code }}
        contract={{ number: pay?.contract_number, partner_name: pay?.partner_name, project_code: pay?.project_code }}
        projectCode={pay?.project_code || code}
        installments={payModalInstallments}
        preset={pay}
        onDone={reload}
      />
    </div>
  );
}
