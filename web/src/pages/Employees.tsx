import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Mail, Phone, Plus, UserCog, Users, Wallet, CalendarDays, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useMeta, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, CardHead, Empty, Field, Modal, PageHead, PageSkeleton, SearchBox, Select, Stat, TextInput,
} from '../components/ui';
import { formatCompact, formatDate, formatMoney, ROLE_LABELS, todayISO } from '../lib/format';

export default function Employees() {
  const { data, loading, reload } = useApi<any>('/employees');
  const { meta } = useMeta();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [modal, setModal] = useState<any>(null);
  const navigate = useNavigate();
  const items = data?.items || [];
  const stats = data?.stats;

  const filtered = useMemo(() => items.filter((e: any) => {
    if (dept && String(e.department_id) !== dept) return false;
    if (q && !`${e.name} ${e.code} ${e.job_title || ''} ${e.email || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, dept]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="الموظفون"
        icon={<Users size={22} color="#8b5cf6" />}
        breadcrumb={[{ label: 'الموارد البشرية' }, { label: 'الموظفون' }]}
        sub="الهيكل التنظيمي وسجلات الموظفين والرواتب."
        actions={<Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModal({})}>موظف جديد</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي الموظفين" value={stats?.total ?? 0} icon={<Users size={19} />} accent="#8b5cf6" foot={`${stats?.active ?? 0} على رأس العمل`} />
        <Stat label="كلفة الرواتب الشهرية" value={formatCompact(stats?.payroll)} suffix="د.ع" icon={<Wallet size={19} />} accent="#10b981" foot="رواتب + مخصصات" />
        <Stat label="الأقسام" value={data?.departments?.length ?? 0} icon={<Briefcase size={19} />} accent="#0ea5e9" foot="وحدات تنظيمية" />
        <Stat label="في إجازة" value={stats?.onLeave ?? 0} icon={<CalendarDays size={19} />} accent="#f59e0b" foot="حالات إجازة نشطة" />
      </div>

      <div className="grid grid-2-1 mb-20">
        <Card>
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} placeholder="بحث بالاسم أو الرقم الوظيفي…" className="grow" />
            <Select value={dept} onChange={(e: any) => setDept(e.target.value)} placeholder="كل الأقسام"
              options={(data?.departments || []).map((d: any) => ({ value: d.id, label: d.name }))} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الموظف</th><th>القسم</th><th>المسمى الوظيفي</th><th>تاريخ التعيين</th><th>الراتب الإجمالي</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate(`/hr/employees/${e.id}`)}>
                    <td>
                      <div className="row gap-8">
                        <Avatar name={e.name} color={e.avatar_color} size="sm" />
                        <div><div className="cell-title">{e.name}</div><div className="cell-sub num">{e.code}</div></div>
                      </div>
                    </td>
                    <td className="small">{e.department_name || '—'}</td>
                    <td className="small">{e.job_title || '—'}</td>
                    <td className="small muted">{formatDate(e.hire_date)}</td>
                    <td className="num-cell">{formatMoney(e.gross_salary)}</td>
                    <td>
                      {e.status === 'active' ? <Badge tone="green" dot>نشط</Badge>
                        : e.status === 'leave' ? <Badge tone="amber" dot>إجازة</Badge>
                          : <Badge tone="slate" dot>منتهي</Badge>}
                    </td>
                    <td><ArrowLeft size={13} color="var(--muted-2)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <Empty title="لا موظفون مطابقون" />}
          </div>
        </Card>

        <Card>
          <CardHead title="توزيع الموظفين" sub="حسب القسم" />
          <div style={{ padding: 16 }}>
            {(data?.departments || []).map((d: any) => {
              const max = Math.max(...(data?.departments || []).map((x: any) => x.employee_count), 1);
              return (
                <div key={d.id} style={{ padding: '7px 0' }}>
                  <div className="row-between mb-4"><span className="small">{d.name}</span><span className="num small strong">{d.employee_count}</span></div>
                  <div className="progress sm"><i style={{ width: `${(d.employee_count / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="card-foot">
            <div className="row-between"><span className="small muted">متوسط الراتب</span><b className="num">{formatMoney(stats?.avgSalary)}</b></div>
          </div>
        </Card>
      </div>

      {modal && <EmployeeForm initial={modal} departments={data?.departments || []} users={meta?.users || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </div>
  );
}


export function EmployeeForm({ initial, departments, users, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({
    name: initial?.name || '', userId: initial?.user_id || '', departmentId: initial?.department_id || '',
    jobTitle: initial?.job_title || '', email: initial?.email || '', phone: initial?.phone || '',
    hireDate: initial?.hire_date || todayISO(), salary: initial?.salary || '', allowances: initial?.allowances || 0,
    status: initial?.status || 'active', nationalId: initial?.national_id || '', address: initial?.address || '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name) { toast.push('اسم الموظف مطلوب', 'error'); return; }
    setSaving(true);
    try {
      if (initial?.id) await api.patch(`/employees/${initial.id}`, form);
      else await api.post('/employees', form);
      toast.push('تم حفظ بيانات الموظف');
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial?.id ? 'تعديل بيانات الموظف' : 'موظف جديد'} size="lg"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>حفظ</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="الاسم الكامل" required><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="القسم">
          <Select value={form.departmentId} onChange={(e: any) => setForm({ ...form, departmentId: e.target.value })} placeholder="اختر القسم"
            options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
        </Field>
        <Field label="المسمى الوظيفي"><TextInput value={form.jobTitle} onChange={(e: any) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
        <Field label="حساب المستخدم">
          <Select value={form.userId} onChange={(e: any) => setForm({ ...form, userId: e.target.value })} placeholder="بدون حساب"
            options={users.map((u: any) => ({ value: u.id, label: u.name }))} />
        </Field>
        <Field label="البريد الإلكتروني"><TextInput type="email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} dir="ltr" /></Field>
        <Field label="الهاتف"><TextInput value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
        <Field label="تاريخ التعيين"><TextInput type="date" value={form.hireDate} onChange={(e: any) => setForm({ ...form, hireDate: e.target.value })} /></Field>
        <Field label="الحالة">
          <Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'active', label: 'نشط' }, { value: 'leave', label: 'إجازة' }, { value: 'terminated', label: 'منتهي' }]} />
        </Field>
        <Field label="الراتب الأساسي (د.ع)"><TextInput type="number" value={form.salary} onChange={(e: any) => setForm({ ...form, salary: e.target.value })} /></Field>
        <Field label="المخصصات (د.ع)"><TextInput type="number" value={form.allowances} onChange={(e: any) => setForm({ ...form, allowances: e.target.value })} /></Field>
        <Field label="الرقم الوطني"><TextInput value={form.nationalId} onChange={(e: any) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" /></Field>
        <Field label="العنوان"><TextInput value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
