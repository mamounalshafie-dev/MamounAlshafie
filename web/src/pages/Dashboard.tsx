import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, Briefcase, CalendarClock, CheckCircle2, CircleDollarSign, Clock, CreditCard,
  FolderKanban, ListChecks, Package, Plus, Receipt, TrendingUp, TriangleAlert, Users, Wallet,
  ArrowLeft, Sparkles, Target, Activity, FileText, BadgeCheck,
} from 'lucide-react';
import { useApi, useAuth } from '../lib/app-context';
import { Avatar, Badge, Btn, Card, CardHead, Empty, PageHead, PageSkeleton, Progress, StatusBadge, Stat, Money } from '../components/ui';
import { Donut, RevenueTrend } from '../components/charts';
import {
  cx, formatCompact, formatDate, formatMoney, monthLabel, relativeTime, STAGE_LABELS, STAGE_TONE,
  PRIORITY_LABELS, PRIORITY_TONE, INVOICE_STATUS, INVOICE_TONE,
} from '../lib/format';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء الخير';
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading } = useApi<any>('/dashboard');

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <Empty title="تعذّر تحميل لوحة التحكم" />;

  const k = data.kpis;
  const donutData = (data.invoiceStatus || []).map((s: any) => ({
    name: INVOICE_STATUS[s.status] || s.status,
    value: s.total || 0,
    color: {
      paid: '#10b981', sent: '#0ea5e9', partial: '#f59e0b', overdue: '#ef4444',
      draft: '#94a3b8', cancelled: '#cbd5e1',
    }[s.status] || '#94a3b8',
  }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">لوحة التحكم</div>
          <h1>
            {greeting()}، {user?.name?.replace('م. ', '')}
            <span style={{ fontSize: 22 }}>👋</span>
          </h1>
          <div className="sub">
            إليك ملخص أداء الشركة اليوم — {new Date().toLocaleDateString('ar-IQ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="page-actions">
          <Link to="/invoices?new=1" className="btn"><Receipt size={15} /> فاتورة جديدة</Link>
          <Link to="/projects?new=1" className="btn btn-primary"><Plus size={15} /> مشروع جديد</Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-4 mb-16">
        <Stat
          label="إيرادات السنة"
          value={formatCompact(k.revenueYtd)}
          suffix="د.ع"
          accent="#6366f1"
          icon={<TrendingUp size={19} />}
          foot={<><span className="trend up">▲ {k.margin}%</span> هامش الربح</>}
        />
        <Stat
          label="صافي الربح"
          value={formatCompact(k.profitYtd)}
          suffix="د.ع"
          accent="#10b981"
          icon={<CircleDollarSign size={19} />}
          foot={<>المصروفات {formatCompact(k.expenseYtd)} د.ع</>}
        />
        <Stat
          label="النقدية المتاحة"
          value={formatCompact(k.cash)}
          suffix="د.ع"
          accent="#0ea5e9"
          icon={<Wallet size={19} />}
          foot={<>مستحقات الموردين {formatCompact(k.ap)} د.ع</>}
        />
        <Stat
          label="الذمم المدينة"
          value={formatCompact(k.ar)}
          suffix="د.ع"
          accent={k.overdueCount ? '#ef4444' : '#f59e0b'}
          icon={<CreditCard size={19} />}
          foot={<>{k.overdueCount > 0 ? <Badge tone="red" dot>{k.overdueCount} فاتورة متأخرة</Badge> : <Badge tone="green" dot>لا تأخيرات</Badge>}</>}
        />
      </div>

      <div className="grid grid-4 mb-20">
        <Stat label="المشاريع النشطة" value={k.projects.active} suffix={`من ${k.projects.total}`} accent="#8b5cf6" icon={<FolderKanban size={19} />}
          foot={<>متوسط الإنجاز <b style={{ color: 'var(--text-2)' }}>{k.projects.progress}%</b></>} />
        <Stat label="المهام المفتوحة" value={k.tasks.open} suffix={`من ${k.tasks.total}`} accent="#f59e0b" icon={<ListChecks size={19} />}
          foot={<>{k.tasks.overdue > 0 ? <Badge tone="red" dot>{k.tasks.overdue} متأخرة</Badge> : 'لا مهام متأخرة'}</>} />
        <Stat label="قيمة المخزون" value={formatCompact(k.inventoryValue)} suffix="د.ع" accent="#14b8a6" icon={<Package size={19} />}
          foot={<>{k.counts.lowStock > 0 ? <Badge tone="amber" dot>{k.counts.lowStock} منتج منخفض</Badge> : 'مستويات المخزون جيدة'}</>} />
        <Stat label="فريق العمل" value={k.counts.employees} suffix="موظف" accent="#ec4899" icon={<Users size={19} />}
          foot={<>{k.counts.pendingLeaves > 0 ? <Badge tone="blue" dot>{k.counts.pendingLeaves} طلب إجازة</Badge> : 'لا طلبات معلقة'}</>} />
      </div>

      {/* Charts */}
      <div className="grid grid-3-2 mb-20" style={{ alignItems: 'stretch' }}>
        <Card>
          <CardHead
            title="الإيرادات مقابل المصروفات"
            sub="آخر 12 شهراً — حسب القيود المحاسبية المرحّلة"
            right={
              <div className="legend">
                <span><i style={{ background: '#6366f1' }} /> الإيرادات</span>
                <span><i style={{ background: '#f59e0b' }} /> المصروفات</span>
              </div>
            }
          />
          <div style={{ padding: '8px 16px 12px' }}>
            <RevenueTrend data={data.trend} height={270} />
          </div>
          <div className="card-foot">
            <div className="row-between">
              <span className="small muted">هامش الربح الإجمالي</span>
              <div className="row gap-8">
                <div className="progress" style={{ width: 140 }}><i style={{ width: `${Math.min(100, k.margin)}%` }} /></div>
                <b className="num" style={{ fontSize: 13 }}>{k.margin}%</b>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="توزيع الفواتير" sub="حسب الحالة والقيمة الإجمالية" />
          <div style={{ padding: '10px 16px 0' }}>
            <Donut
              data={donutData}
              height={200}
              centerLabel="إجمالي الفواتير"
              centerValue={formatCompact(donutData.reduce((s: number, d: any) => s + d.value, 0))}
            />
          </div>
          <div style={{ padding: '4px 18px 16px' }}>
            {doneLegend(donutData)}
          </div>
        </Card>
      </div>

      {/* Pipeline + my tasks */}
      <div className="grid grid-3-2 mb-20">
        <Card>
          <CardHead
            title="مشاريع قيد التنفيذ"
            sub={`${k.projects.active} مشروع نشط · ميزانية ${formatCompact(k.projects.budget)} د.ع`}
            right={<Link to="/projects" className="btn btn-ghost btn-sm">عرض الكل <ArrowLeft size={14} /></Link>}
          />
          <div className="table-wrap">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>المشروع</th>
                  <th>العميل</th>
                  <th style={{ width: 180 }}>التقدم</th>
                  <th>الميزانية</th>
                  <th>التسليم</th>
                </tr>
              </thead>
              <tbody>
                {data.pipeline.map((p: any) => (
                  <tr key={p.id} className="clickable" onClick={() => navigate(`/projects/${p.id}`)}>
                    <td>
                      <div className="cell-title">{p.name}</div>
                      <div className="cell-sub">{p.code} · {STAGE_LABELS[p.stage]}</div>
                    </td>
                    <td className="small muted">{p.customer_name || '—'}</td>
                    <td>
                      <div className="row gap-8">
                        <div className="progress" style={{ flex: 1 }}>
                          <i style={{ width: `${p.progress}%` }} className="" />
                        </div>
                        <span className="num tiny" style={{ width: 32, textAlign: 'left' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td className="num-cell small">{formatCompact(p.budget)}</td>
                    <td className="small muted">{formatDate(p.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead title="مهامي" sub="المهام المسندة إليك" right={<Link to="/tasks" className="btn btn-ghost btn-sm">كل المهام <ArrowLeft size={14} /></Link>} />
          <div style={{ padding: 12 }}>
            {data.myTasks.length === 0 && <Empty title="لا توجد مهام مفتوحة" message="كل مهامك مكتملة، عمل رائع!" icon={<CheckCircle2 size={22} />} />}
            {data.myTasks.map((t: any) => (
              <Link to={`/tasks?q=${encodeURIComponent(t.title)}`} key={t.id} className="cmdk-item" style={{ alignItems: 'flex-start', padding: '11px 10px' }}>
                <span className={cx('priority-dot', `p-${t.priority}`)} style={{ marginTop: 7 }} />
                <div className="grow">
                  <b style={{ fontSize: 12.8, lineHeight: 1.5 }}>{t.title}</b>
                  <span>{t.project_name || 'بدون مشروع'} · {t.due_date ? formatDate(t.due_date) : 'بدون موعد'}</span>
                </div>
                {t.is_overdue ? <Badge tone="red">متأخرة</Badge> : <Badge tone="slate">{PRIORITY_LABELS[t.priority]}</Badge>}
              </Link>
            ))}
          </div>
          {data.upcoming.length > 0 && (
            <>
              <div className="card-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 'none', paddingBottom: 6 }}>
                <h3 style={{ fontSize: 13 }}><CalendarClock size={15} /> مواعيد تسليم قريبة</h3>
              </div>
              <div style={{ padding: '0 16px 14px' }}>
                {data.upcoming.slice(0, 3).map((p: any) => (
                  <div key={p.id} className="row-between" style={{ padding: '7px 0', borderBottom: '1px dashed var(--border)' }}>
                    <span className="small truncate" style={{ maxWidth: 190 }}>{p.name}</span>
                    <Badge tone={new Date(p.end_date) < new Date() ? 'red' : 'amber'}>{formatDate(p.end_date)}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Alerts + activity */}
      <div className="grid grid-3 mb-20">
        <Card>
          <CardHead title="تنبيهات تحتاج إجراء" sub="أولويات المتابعة اليوم" icon={<TriangleAlert size={15} />} />
          <div style={{ padding: 14 }}>
            {data.alerts.overdueInvoices.map((inv: any) => (
              <Link key={inv.id} to={`/invoices/${inv.id}`} className="alert-row">
                <span className="badge badge-red"><Receipt size={12} /> متأخرة</span>
                <div className="grow">
                  <b>{inv.number} — {inv.customer_name}</b>
                  <span>متأخرة {inv.days} يوم · {formatMoney(inv.total - inv.amount_paid)}</span>
                </div>
                <ArrowLeft size={14} color="var(--muted-2)" />
              </Link>
            ))}
            {data.alerts.atRisk.map((p: any) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="alert-row">
                <span className="badge badge-amber"><Target size={12} /> خطر</span>
                <div className="grow">
                  <b>{p.name}</b>
                  <span>الإنجاز {p.progress}% · استهلاك الميزانية {p.budget ? Math.round((p.spent / p.budget) * 100) : 0}%</span>
                </div>
                <ArrowLeft size={14} color="var(--muted-2)" />
              </Link>
            ))}
            {data.alerts.lowStock.map((p: any) => (
              <Link key={p.id} to={`/inventory/${p.id}`} className="alert-row">
                <span className="badge badge-blue"><Package size={12} /> مخزون</span>
                <div className="grow">
                  <b>{p.name}</b>
                  <span>المتوفر {p.stock_qty} {p.uom} · الحد الأدنى {p.reorder_level}</span>
                </div>
                <ArrowLeft size={14} color="var(--muted-2)" />
              </Link>
            ))}
            {data.kpis.counts.pendingLeaves > 0 && (
              <Link to="/hr/leaves" className="alert-row">
                <span className="badge badge-purple"><Users size={12} /> إجازات</span>
                <div className="grow"><b>{data.kpis.counts.pendingLeaves} طلب بانتظار الموافقة</b><span>الموارد البشرية</span></div>
                <ArrowLeft size={14} color="var(--muted-2)" />
              </Link>
            )}
            {!data.alerts.overdueInvoices.length && !data.alerts.atRisk.length && !data.alerts.lowStock.length && data.kpis.counts.pendingLeaves === 0 && (
              <Empty title="لا توجد تنبيهات" message="جميع المؤشرات ضمن النطاق الآمن." icon={<BadgeCheck size={22} />} />
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="آخر النشاطات" sub="سجل مباشر لعمليات الفريق" right={<Link to="/activity" className="btn btn-ghost btn-sm">الكل</Link>} />
          <div style={{ padding: '16px 18px' }}>
            <div className="timeline">
              {data.activities.slice(0, 7).map((a: any) => (
                <div className="timeline-item" key={a.id}>
                  <div className="t-head">
                    <b>{a.user_name}</b> <span className="muted">{a.message}</span>
                  </div>
                  <div className="t-time">{relativeTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="أفضل العملاء" sub="حسب إيرادات السنة" right={<Link to="/customers" className="btn btn-ghost btn-sm">الكل</Link>} />
          <div style={{ padding: '14px 18px' }}>
            {data.topCustomers.map((c: any, i: number) => (
              <div key={c.name} className="row gap-12" style={{ padding: '9px 0', borderBottom: i < data.topCustomers.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                <span className="num tiny muted" style={{ width: 16 }}>{i + 1}</span>
                <Avatar name={c.name} size="sm" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small strong truncate">{c.name}</div>
                  <div className="tiny muted">{c.invoices} فاتورة</div>
                </div>
                <div className="num small strong">{formatCompact(c.revenue)}</div>
              </div>
            ))}
          </div>
          <div className="card-foot">
            <div className="row-between">
              <span className="small muted">حجم فريق المبيعات</span>
              <div className="row gap-6">
                {data.workload.slice(0, 4).map((u: any) => <Avatar key={u.id} name={u.name} color={u.avatar_color} size="sm" />)}
                <span className="tiny muted">+{Math.max(0, data.workload.length - 4)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent invoices */}
      <Card>
        <CardHead
          title="أحدث الفواتير"
          sub="آخر الحركات المالية على العملاء"
          right={<Link to="/invoices" className="btn btn-ghost btn-sm">كل الفواتير <ArrowLeft size={14} /></Link>}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>
            </thead>
            <tbody>
              {data.recentInvoices.map((inv: any) => (
                <tr key={inv.id} className="clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td className="num-cell strong">{inv.number}</td>
                  <td>{inv.customer_name}</td>
                  <td className="small muted">{formatDate(inv.date)}</td>
                  <td><StatusBadge status={inv.status} labels={INVOICE_STATUS} tones={INVOICE_TONE} /></td>
                  <td className="num-cell">{formatMoney(inv.total)}</td>
                  <td className="num-cell pos">{formatMoney(inv.amount_paid)}</td>
                  <td className="num-cell" style={{ color: inv.total - inv.amount_paid > 0 ? 'var(--red-500)' : 'var(--muted)' }}>
                    {formatMoney(inv.total - inv.amount_paid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function doneLegend(data: any[]) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return data.filter((d) => d.value > 0).map((d) => (
    <div key={d.name} className="row-between" style={{ padding: '4px 0' }}>
      <span className="small muted"><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 3, background: d.color, marginInlineEnd: 7 }} />{d.name}</span>
      <span className="num small strong">{Math.round((d.value / total) * 100)}%</span>
    </div>
  ));
}
