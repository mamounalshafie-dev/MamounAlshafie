import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, TrendingUp, Users, Package, FolderKanban, Wallet, Download, Printer, ArrowLeft, PieChart, Landmark,
} from 'lucide-react';
import { useApi } from '../lib/app-context';
import { Badge, Btn, Card, CardHead, Empty, PageHead, PageSkeleton, Progress, Stat, Tabs } from '../components/ui';
import { Donut, HBar, ProfitBars, RevenueTrend } from '../components/charts';
import { formatCompact, formatMoney, monthLabel } from '../lib/format';

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const dash = useApi<any>('/dashboard');
  const sales = useApi<any>('/sales/overview');
  const purchases = useApi<any>('/purchases/overview');
  const inv = useApi<any>('/inventory/overview');
  const hr = useApi<any>('/hr/overview');

  if (dash.loading && !dash.data) return <PageSkeleton />;
  const k = dash.data?.kpis;

  const tabs = [
    { id: 'sales', label: 'المبيعات', icon: <TrendingUp size={14} /> },
    { id: 'projects', label: 'المشاريع', icon: <FolderKanban size={14} /> },
    { id: 'finance', label: 'المالية', icon: <Landmark size={14} /> },
    { id: 'inventory', label: 'المخزون', icon: <Package size={14} /> },
    { id: 'hr', label: 'الموارد البشرية', icon: <Users size={14} /> },
  ];

  return (
    <div className="page">
      <PageHead
        title="التقارير والتحليلات"
        icon={<BarChart3 size={22} color="#6366f1" />}
        breadcrumb={[{ label: 'التقارير' }]}
        sub="لوحة تحليلات تنفيذية شاملة لكل وحدات النظام."
        actions={(
          <>
            <Btn icon={<Download size={15} />} onClick={() => window.print()}>تصدير PDF</Btn>
            <Link to="/accounting/reports" className="btn btn-primary"><Landmark size={15} /> القوائم المالية</Link>
          </>
        )}
      />

      <div className="grid grid-5 mb-20">
        <Stat label="الإيرادات" value={formatCompact(k?.revenueYtd)} suffix="د.ع" accent="#10b981" />
        <Stat label="صافي الربح" value={formatCompact(k?.profitYtd)} suffix="د.ع" accent="#6366f1" foot={`هامش ${k?.margin}%`} />
        <Stat label="المشاريع النشطة" value={k?.projects?.active} accent="#8b5cf6" foot={`${k?.projects?.progress}% متوسط الإنجاز`} />
        <Stat label="المهام المفتوحة" value={k?.tasks?.open} accent="#f59e0b" foot={`${k?.tasks?.overdue} متأخرة`} />
        <Stat label="الموظفون" value={k?.counts?.employees} accent="#ec4899" foot={`${k?.counts?.customers} عميل`} />
      </div>

      <Card className="mb-16">
        <div style={{ padding: '0 18px' }}>
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
        </div>
      </Card>

      {tab === 'sales' && (
        <div className="grid gap-16">
          <Card>
            <CardHead title="تطور الإيرادات والتحصيل" sub="آخر 12 شهراً" />
            <div style={{ padding: '10px 16px' }}>
              <RevenueTrend data={dash.data?.trend || []} height={280} />
            </div>
          </Card>
          <div className="grid grid-2">
            <Card>
              <CardHead title="أفضل العملاء" sub="حسب الإيرادات" />
              <div style={{ padding: '12px 16px' }}>
                {sales.data?.topCustomers?.length ? (
                  <HBar data={sales.data.topCustomers.map((c: any) => ({ name: c.name, value: c.revenue }))} height={260} valueName="الإيرادات" color="#10b981" />
                ) : <Empty title="لا بيانات" />}
              </div>
            </Card>
            <Card>
              <CardHead title="حالة الفواتير" sub="حسب القيمة" />
              <div style={{ padding: '12px 16px' }}>
                <Donut
                  data={(sales.data?.byStatus || []).map((s: any) => ({
                    name: s.status, value: s.total,
                    color: { paid: '#10b981', sent: '#0ea5e9', partial: '#f59e0b', overdue: '#ef4444', draft: '#94a3b8', cancelled: '#cbd5e1' }[s.status] || '#94a3b8',
                  }))}
                  height={250} centerLabel="إجمالي الفواتير"
                  centerValue={formatCompact((sales.data?.byStatus || []).reduce((s: number, x: any) => s + x.total, 0))}
                />
              </div>
            </Card>
          </div>
          <Card>
            <CardHead title="المشتريات الشهرية" sub="حسب أوامر الشراء" />
            <div style={{ padding: '10px 16px' }}>
              <ProfitBars data={(purchases.data?.monthly || []).map((m: any) => ({ month: m.month, profit: m.total }))} height={240} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'projects' && (
        <div className="grid gap-16">
          <div className="grid grid-3">
            <Card pad>
              <div className="row-between"><span className="small muted">إجمالي الميزانيات</span><Wallet size={16} color="var(--brand-500)" /></div>
              <div className="num mt-8" style={{ fontSize: 24, fontWeight: 800 }}>{formatCompact(k?.projects?.budget)}</div>
              <div className="tiny muted mt-4">د.ع</div>
            </Card>
            <Card pad>
              <div className="row-between"><span className="small muted">المصروف</span><Wallet size={16} color="#f59e0b" /></div>
              <div className="num mt-8" style={{ fontSize: 24, fontWeight: 800 }}>{formatCompact(k?.projects?.spent)}</div>
              <Progress value={k?.projects?.utilization || 0} className="mt-8" tone={(k?.projects?.utilization || 0) > 90 ? 'red' : undefined} />
            </Card>
            <Card pad>
              <div className="row-between"><span className="small muted">مشاريع في خطر</span><PieChart size={16} color="#ef4444" /></div>
              <div className="num mt-8" style={{ fontSize: 24, fontWeight: 800 }}>{k?.projects?.atRisk}</div>
              <div className="tiny muted mt-4">تحتاج مراجعة الإدارة</div>
            </Card>
          </div>
          <Card>
            <CardHead title="الميزانية مقابل المصروف" sub="أهم المشاريع" right={<Link to="/projects" className="btn btn-ghost btn-sm">إدارة المشاريع</Link>} />
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>المشروع</th><th>العميل</th><th>الميزانية</th><th>المصروف</th><th style={{ width: 180 }}>الاستهلاك</th><th>الإنجاز</th></tr></thead>
                <tbody>
                  {(dash.data?.pipeline || []).map((p: any) => {
                    const util = p.budget ? Math.round((p.spent / p.budget) * 100) : 0;
                    return (
                      <tr key={p.id}>
                        <td><Link to={`/projects/${p.id}`} className="cell-title" style={{ color: 'var(--brand-600)' }}>{p.name}</Link><div className="cell-sub num">{p.code}</div></td>
                        <td className="small">{p.customer_name || '—'}</td>
                        <td className="num-cell">{formatCompact(p.budget)}</td>
                        <td className="num-cell">{formatCompact(p.spent)}</td>
                        <td>
                          <div className="row gap-8"><Progress value={util} tone={util > 100 ? 'red' : util > 85 ? 'amber' : 'green'} className="grow" /><span className="num tiny">{util}%</span></div>
                        </td>
                        <td><Badge tone={p.progress >= 80 ? 'green' : p.progress >= 40 ? 'blue' : 'slate'}>{p.progress}%</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'finance' && (
        <div className="grid gap-16">
          <Card>
            <CardHead title="الإيرادات والمصروفات" sub="آخر 12 شهراً" />
            <div style={{ padding: '10px 16px' }}><RevenueTrend data={dash.data?.trend || []} height={280} /></div>
          </Card>
          <div className="grid grid-2">
            <Card>
              <CardHead title="صافي الربح الشهري" />
              <div style={{ padding: '10px 16px' }}><ProfitBars data={dash.data?.trend || []} height={250} /></div>
            </Card>
            <Card>
              <CardHead title="مؤشرات مالية" />
              <div style={{ padding: 20 }}>
                {[
                  ['الإيرادات السنوية', formatMoney(k?.revenueYtd)],
                  ['المصروفات السنوية', formatMoney(k?.expenseYtd)],
                  ['صافي الربح', formatMoney(k?.profitYtd)],
                  ['هامش الربح', `${k?.margin}%`],
                  ['النقدية المتاحة', formatMoney(k?.cash)],
                  ['الذمم المدينة Outstanding', formatMoney(k?.ar)],
                  ['مستحقات الموردين', formatMoney(k?.ap)],
                  ['قيمة المخزون', formatMoney(k?.inventoryValue)],
                ].map(([label, value]) => (
                  <div key={label} className="row-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                    <span className="small muted">{label}</span>
                    <b className="num small">{value}</b>
                  </div>
                ))}
                <Link to="/accounting/reports" className="btn btn-primary btn-block mt-16">القوائم المالية الكاملة <ArrowLeft size={14} /></Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="grid gap-16">
          <div className="grid grid-2">
            <Card>
              <CardHead title="قيمة المخزون حسب الفئة" />
              <div style={{ padding: '12px 16px' }}>
                {inv.data?.byCategory?.length ? (
                  <HBar data={inv.data.byCategory.map((c: any) => ({ name: c.category || 'غير مصنف', value: c.value }))} height={280} valueName="القيمة" color="#14b8a6" />
                ) : <Empty title="لا بيانات" />}
              </div>
            </Card>
            <Card>
              <CardHead title="منتجات تحتاج إعادة طلب" sub={`${k?.counts?.lowStock ?? 0} منتج`} right={<Link to="/inventory" className="btn btn-ghost btn-sm">المخزون</Link>} />
              <div className="table-wrap">
                <table className="table table-compact">
                  <thead><tr><th>المنتج</th><th>المتوفر</th><th>حد الطلب</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {(inv.data?.lowStock || []).map((p: any) => (
                      <tr key={p.id}><td className="small">{p.name}</td><td className="num-cell">{p.stock_qty} {p.uom}</td><td className="num-cell">{p.reorder_level}</td><td><Badge tone="amber">منخفض</Badge></td></tr>
                    ))}
                  </tbody>
                </table>
                {!inv.data?.lowStock?.length && <Empty title="مستويات المخزون جيدة" />}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'hr' && (
        <div className="grid grid-2">
          <Card>
            <CardHead title="الموظفون حسب القسم" sub={`${hr.data?.headcount?.total ?? 0} موظف`} />
            <div style={{ padding: '12px 16px' }}>
              {hr.data?.byDept?.length ? (
                <HBar data={hr.data.byDept.map((d: any) => ({ name: d.name, value: d.count }))} height={300} valueName="موظف" color="#8b5cf6" />
              ) : <Empty title="لا بيانات" />}
            </div>
          </Card>
          <Card>
            <CardHead title="كلفة الرواتب حسب القسم" />
            <div style={{ padding: '12px 16px' }}>
              {hr.data?.byDept?.length ? (
                <HBar data={hr.data.byDept.map((d: any) => ({ name: d.name, value: d.payroll }))} height={300} valueName="الرواتب" color="#10b981" />
              ) : <Empty title="لا بيانات" />}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
