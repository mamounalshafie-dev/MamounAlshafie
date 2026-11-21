import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Briefcase, CalendarDays, Clock, Mail, MapPin, Pencil, Phone, UserCog, Wallet, Users, FolderKanban, CheckCircle2, XCircle,
} from 'lucide-react';
import { useApi, useMeta } from '../lib/app-context';
import { Avatar, Badge, Btn, Card, CardHead, Empty, PageHead, PageSkeleton, Progress, Stat, Tabs } from '../components/ui';
import { EmployeeForm } from './Employees';
import { LEAVE_LABELS, LEAVE_TONE, ATTENDANCE_LABELS, formatDate, formatMoney, formatNumber } from '../lib/format';

export default function EmployeeDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useApi<any>(`/employees/${id}`);
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const deps = useApi<any>('/employees');
  const { meta } = useMeta();

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <Empty title="الموظف غير موجود" action={<Link to="/hr/employees" className="btn">عودة</Link>} />;

  const { employee: e, leaves, payslips, attendance, projects, leaveBalance } = data;
  const presentDays = attendance.filter((a: any) => a.status === 'present').length;
  const lateDays = attendance.filter((a: any) => a.status === 'late').length;
  const absentDays = attendance.filter((a: any) => a.status === 'absent').length;

  return (
    <div className="page">
      <PageHead
        title={e.name}
        icon={<UserCog size={22} color="#8b5cf6" />}
        breadcrumb={[{ label: 'الموظفون', to: '/hr/employees' }, { label: e.code }]}
        sub={<span className="row gap-8 wrap"><span className="num">{e.code}</span> · {e.job_title || 'موظف'} · {e.department_name || 'بدون قسم'} {e.status === 'active' ? <Badge tone="green" dot>نشط</Badge> : e.status === 'leave' ? <Badge tone="amber" dot>إجازة</Badge> : <Badge tone="slate" dot>منتهي</Badge>}</span>}
        actions={<Btn icon={<Pencil size={15} />} onClick={() => setEdit(true)}>تعديل</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="الراتب الأساسي" value={formatMoney(e.salary)} suffix="" icon={<Wallet size={19} />} accent="#10b981" foot={`المخصصات ${formatMoney(e.allowances)}`} />
        <Stat label="إجمالي الراتب" value={formatMoney(e.gross_salary)} icon={<Wallet size={19} />} accent="#6366f1" foot="شهرياً" />
        <Stat label="رصيد الإجازات" value={leaveBalance.annual - leaveBalance.used} suffix="يوم" icon={<CalendarDays size={19} />} accent="#f59e0b" foot={`استُخدم ${leaveBalance.used} من ${leaveBalance.annual}`} />
        <Stat label="الحضور (30 يوم)" value={presentDays + lateDays} icon={<Clock size={19} />} accent="#0ea5e9" foot={`${lateDays} تأخير · ${absentDays} غياب`} />
      </div>

      <div className="grid grid-1-2 mb-20">
        <Card className="card-pad">
          <div className="text-center" style={{ padding: '8px 0 16px' }}>
            <Avatar name={e.name} color={e.avatar_color} size="xl" />
            <div className="strong mt-12" style={{ fontSize: 16 }}>{e.name}</div>
            <div className="small muted">{e.job_title || 'موظف'}</div>
            <Badge tone="purple" className="mt-8">{e.department_name || 'بدون قسم'}</Badge>
          </div>
          <div className="divider" />
          <dl className="kv" style={{ gridTemplateColumns: '96px 1fr', fontSize: 12.5 }}>
            <dt>البريد</dt><dd dir="ltr" style={{ textAlign: 'right', fontSize: 11.5 }}>{e.email || '—'}</dd>
            <dt>الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{e.phone || '—'}</dd>
            <dt>تاريخ التعيين</dt><dd>{formatDate(e.hire_date)}</dd>
            <dt>الرقم الوطني</dt><dd className="num">{e.national_id || '—'}</dd>
            <dt>العنوان</dt><dd>{e.address || '—'}</dd>
          </dl>
        </Card>

        <Card>
          <div style={{ padding: '0 18px' }}>
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: 'overview', label: 'نظرة عامة' },
              { id: 'payslips', label: 'كشوف الرواتب', count: payslips.length },
              { id: 'leaves', label: 'الإجازات', count: leaves.length },
              { id: 'attendance', label: 'الحضور', count: attendance.length },
            ]} />
          </div>

          {tab === 'overview' && (
            <div style={{ padding: 20 }}>
              <h4 style={{ fontSize: 14, marginBottom: 12 }}>المشاريع المشارك بها</h4>
              <div className="grid grid-2">
                {projects.map((p: any) => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="cmdk-item">
                    <span className="ci-icon"><FolderKanban size={14} /></span>
                    <div className="grow"><b>{p.name}</b><span>{p.code} · {p.role}</span></div>
                  </Link>
                ))}
              </div>
              {!projects.length && <Empty title="لا مشاريع" message="لم يُسند هذا الموظف لأي مشروع." />}
              <div className="divider" style={{ margin: '18px 0' }} />
              <h4 style={{ fontSize: 14, marginBottom: 12 }}>مؤشرات الأداء</h4>
              <div className="grid grid-3">
                <div className="card card-pad text-center"><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{payslips.length}</div><div className="tiny muted">كشف راتب</div></div>
                <div className="card card-pad text-center"><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{leaveBalance.used}</div><div className="tiny muted">أيام إجازة</div></div>
                <div className="card card-pad text-center"><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{projects.length}</div><div className="tiny muted">مشاريع</div></div>
              </div>
            </div>
          )}

          {tab === 'payslips' && (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table table-compact">
                <thead><tr><th>الفترة</th><th>الأساسي</th><th>المخصصات</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th></tr></thead>
                <tbody>
                  {payslips.map((s: any) => (
                    <tr key={s.id}>
                      <td className="num strong">{s.period}</td>
                      <td className="num-cell">{formatMoney(s.basic)}</td>
                      <td className="num-cell">{formatMoney(s.allowances)}</td>
                      <td className="num-cell neg">{formatMoney(s.deductions)}</td>
                      <td className="num-cell strong">{formatMoney(s.net)}</td>
                      <td>{s.status === 'paid' ? <Badge tone="green" dot>مدفوع</Badge> : <Badge tone="amber" dot>مسودة</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!payslips.length && <Empty title="لا كشوف رواتب" />}
            </div>
          )}

          {tab === 'leaves' && (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table table-compact">
                <thead><tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr></thead>
                <tbody>
                  {leaves.map((l: any) => (
                    <tr key={l.id}>
                      <td className="small">{LEAVE_LABELS[l.type] || l.type}</td>
                      <td className="small">{formatDate(l.start_date)}</td>
                      <td className="small">{formatDate(l.end_date)}</td>
                      <td className="num-cell">{l.days}</td>
                      <td><Badge tone={LEAVE_TONE[l.status]} dot>{l.status === 'approved' ? 'موافق' : l.status === 'pending' ? 'معلّق' : 'مرفوض'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!leaves.length && <Empty title="لا إجازات مسجلة" />}
            </div>
          )}

          {tab === 'attendance' && (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table table-compact">
                <thead><tr><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>الحالة</th></tr></thead>
                <tbody>
                  {attendance.map((a: any) => (
                    <tr key={a.id}>
                      <td className="small">{formatDate(a.date)}</td>
                      <td className="num-cell">{a.check_in || '—'}</td>
                      <td className="num-cell">{a.check_out || '—'}</td>
                      <td><Badge tone={a.status === 'present' ? 'green' : a.status === 'late' ? 'amber' : a.status === 'leave' ? 'blue' : 'red'} dot>{ATTENDANCE_LABELS[a.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!attendance.length && <Empty title="لا سجلات حضور" />}
            </div>
          )}
        </Card>
      </div>

      {edit && <EmployeeForm initial={e} departments={deps.data?.departments || []} users={meta?.users || []} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    </div>
  );
}
