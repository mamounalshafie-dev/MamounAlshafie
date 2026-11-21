import React, { useMemo } from 'react';
import { BarChart3, Building2, Download, Layers, TrendingUp, Users, Wallet } from 'lucide-react';
import { useApi } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, PageHead, PageSkeleton, Select, exportCsv } from '../components/ui';
import { KpiTile, MoneyCell, Panel, ProgressRing } from '../components/re-ui';
import { SalesTrend, StatusDonut, BarList } from '../components/re-charts';
import { formatCompact, formatMoney, formatPercent } from '../lib/format';

export default function ReReports() {
  const { code, setCode, projects, project } = useRe();
  const { data, loading } = useApi<any>(`/re/reports?project=${encodeURIComponent(code)}`, [code]);

  const donut = useMemo(() => (data?.unitMix || []).map((u: any, i: number) => ({
    name: u.unit_type === 'shop' ? 'محلات' : u.unit_type === 'office' ? 'مكاتب' : u.unit_type === 'duplex' ? 'دوبلكس' : 'شقق',
    value: u.count,
    color: ['#153a63', '#c8a24a', '#2f7d5f', '#8a5cf6'][i % 4],
  })), [data]);

  if (loading && !data) return <PageSkeleton />;

  const trend = data?.trend || [];
  const allProjects = data?.byProject || [];
  const byProject = code === 'all' ? allProjects : allProjects.filter((p: any) => p.code === code);
  const byBuilding = data?.byBuilding || [];
  const aging = data?.aging || [];
  const topBuyers = data?.topBuyers || [];
  const finance = data?.finance || {};

  const totals = byProject.reduce((acc: any, p: any) => ({
    contract: acc.contract + (p.contract_value || 0),
    collected: acc.collected + (p.collected || 0),
    cost: acc.cost + (p.cost || 0),
  }), { contract: 0, collected: 0, cost: 0 });

  const doExport = () => exportCsv('re-report', byProject.map((p: any) => ({
    project: p.name, units: p.units, sold: p.sold, contract: p.contract_value, collected: p.collected, cost: p.cost,
  })), [
    { key: 'project', label: 'المشروع' }, { key: 'units', label: 'الوحدات' }, { key: 'sold', label: 'المباع' },
    { key: 'contract', label: 'قيمة العقود' }, { key: 'collected', label: 'المحصل' }, { key: 'cost', label: 'التكلفة' },
  ]);

  return (
    <div className="page">
      <PageHead
        title="تقارير المبيعات والتحصيل"
        icon={<BarChart3 size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'التقارير' }, { label: 'المبيعات والتحصيل' }]}
        sub="تحليل الأداء البيعي والتحصيلي وأعمار الذمم وربحية المشاريع."
        actions={(
          <div className="row gap-8">
            <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 180 }}>
              <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
            <Btn variant="ghost" icon={<Download size={15} />} onClick={doExport}>تصدير</Btn>
          </div>
        )}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="قيمة العقود" value={formatCompact(totals.contract)} icon={<Wallet size={19} />} foot={`${byProject.reduce((s: number, p: any) => s + (p.sold || 0), 0)} وحدة مباعة`} />
        <KpiTile label="إجمالي التحصيل" value={formatCompact(totals.collected)} icon={<TrendingUp size={19} />} foot={`${totals.contract ? Math.round((totals.collected / totals.contract) * 100) : 0}% من العقود`} gold />
        <KpiTile label="تكاليف التطوير" value={formatCompact(totals.cost)} icon={<Building2 size={19} />} foot="مرحّلة محاسبياً" />
        <KpiTile label="إيرادات ومصروفات السنة" value={`${formatCompact(finance.revenue)} / ${formatCompact(finance.expense)}`} icon={<BarChart3 size={19} />} foot={`صافي ${formatCompact((finance.revenue || 0) - (finance.expense || 0))}`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 14 }}>
        <Panel title="المبيعات والتحصيل الشهري" icon={<TrendingUp size={16} color="var(--gold)" />} right={<span className="tiny muted">آخر 12 شهراً</span>}>
          <SalesTrend data={trend} height={260} />
        </Panel>
        <Panel title="تركيبة الوحدات" icon={<Layers size={16} color="var(--gold)" />}>
          <StatusDonut data={donut} centerValue={String(donut.reduce((s, d) => s + d.value, 0))} centerLabel="وحدة" height={200} />
          <div className="col gap-6 mt-8">
            {donut.map((d) => (
              <div key={d.name} className="row-between small"><span><i className="mc-dot" style={{ background: d.color }} /> {d.name}</span><b className="num">{d.value}</b></div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid mt-14" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 14 }}>
        <Panel title="أداء المشاريع" icon={<Building2 size={16} color="var(--gold)" />} pad>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>المشروع</th><th>الوحدات</th><th>المباع</th><th>قيمة العقود</th><th>المحصل</th><th>نسبة التحصيل</th></tr></thead>
              <tbody>
                {byProject.map((p: any) => (
                  <tr key={p.code}>
                    <td><div className="small" style={{ fontWeight: 700 }}>{p.name}</div><div className="tiny muted">{p.code}</div></td>
                    <td className="num">{p.units}</td>
                    <td className="num">{p.sold}</td>
                    <td><MoneyCell value={p.contract_value} /></td>
                    <td><MoneyCell value={p.collected} /></td>
                    <td>
                      <div className="row gap-6">
                        <div style={{ width: 60, height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                          <div style={{ width: `${p.contract_value ? Math.min(100, (p.collected / p.contract_value) * 100) : 0}%`, height: '100%', background: 'var(--gold)' }} />
                        </div>
                        <span className="tiny num">{p.contract_value ? Math.round((p.collected / p.contract_value) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="أعمار الذمم (أقساط غير مسددة)" icon={<Wallet size={16} color="var(--gold)" />}>
          <BarList
            data={aging.map((a: any) => ({ label: `${a.label} — ${a.count || 0} قسط`, amount: a.amount || 0 }))}
            color="#153a63"
          />
          <div className="row-between mt-12 tiny muted">
            <span>إجمالي الذمم غير المسددة</span>
            <b className="num">{formatMoney(aging.reduce((s: number, a: any) => s + (a.amount || 0), 0))}</b>
          </div>
        </Panel>
      </div>

      <div className="grid mt-14" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
        <Panel title="أفضل المشترين" icon={<Users size={16} color="var(--gold)" />} pad>
          <table className="mini-table">
            <thead><tr><th>العميل</th><th>العقود</th><th>القيمة</th><th>المحصل</th></tr></thead>
            <tbody>
              {topBuyers.map((b: any) => (
                <tr key={b.id}>
                  <td><div className="small" style={{ fontWeight: 700 }}>{b.name}</div><div className="tiny muted">{b.type === 'investor' ? 'مستثمر' : 'عميل'}</div></td>
                  <td className="num">{b.contracts}</td>
                  <td><MoneyCell value={b.value} /></td>
                  <td><MoneyCell value={b.collected} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="حالة المباني" icon={<Building2 size={16} color="var(--gold)" />} pad>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="mini-table">
              <thead><tr><th>المبنى</th><th>الوحدات</th><th>مباع</th><th>متاح</th><th>محجوز</th><th>القيمة</th></tr></thead>
              <tbody>
                {byBuilding.map((b: any) => (
                  <tr key={b.code}>
                    <td><b>{b.code}</b> <span className="tiny muted">{b.project_code}</span></td>
                    <td className="num">{b.units}</td>
                    <td className="num">{b.sold}</td>
                    <td className="num">{b.available}</td>
                    <td className="num">{b.reserved}</td>
                    <td className="num small">{formatCompact(b.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
