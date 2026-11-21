import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Plus, XCircle, Users } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead, PageSkeleton, Select, Stat, Textarea, TextInput,
} from '../components/ui';
import { LEAVE_LABELS, LEAVE_TONE, formatDate, todayISO } from '../lib/format';

export default function Leaves() {
  const { data, loading, reload } = useApi<any>('/leaves');
  const emps = useApi<any>('/employees');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [modal, setModal] = useState(false);
  const toast = useToast();
  const items = data || [];

  const filtered = useMemo(() => items.filter((l: any) => {
    if (status !== 'all' && l.status !== status) return false;
    if (type !== 'all' && l.type !== type) return false;
    return true;
  }), [items, status, type]);

  const counts = {
    pending: items.filter((l: any) => l.status === 'pending').length,
    approved: items.filter((l: any) => l.status === 'approved').length,
    rejected: items.filter((l: any) => l.status === 'rejected').length,
    days: items.filter((l: any) => l.status === 'approved').reduce((s: number, l: any) => s + l.days, 0),
  };

  const act = async (id: number, st: string) => {
    try { await api.patch(`/leaves/${id}`, { status: st }); toast.push(st === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب'); reload(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر التحديث', 'error'); }
  };

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="الإجازات"
        icon={<CalendarDays size={22} color="#f59e0b" />}
        breadcrumb={[{ label: 'الموارد البشرية' }, { label: 'الإجازات' }]}
        sub="إدارة طلبات الإجازات والموافقات ورصيد كل موظف."
        actions={<Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModal(true)}>طلب إجازة</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="طلبات معلّقة" value={counts.pending} icon={<Clock size={19} />} accent="#f59e0b" foot="بانتظار الموافقة" />
        <Stat label="إجازات معتمدة" value={counts.approved} icon={<CheckCircle2 size={19} />} accent="#10b981" foot={`${counts.days} يوم إجمالي`} />
        <Stat label="طلبات مرفوضة" value={counts.rejected} icon={<XCircle size={19} />} accent="#ef4444" foot="هذا العام" />
        <Stat label="إجمالي الطلبات" value={items.length} icon={<Users size={19} />} accent="#6366f1" foot="جميع الأنواع" />
      </div>

      <Card>
        <div className="toolbar">
          <Select value={status} onChange={(e: any) => setStatus(e.target.value)}
            options={[{ value: 'all', label: 'كل الحالات' }, { value: 'pending', label: 'معلّقة' }, { value: 'approved', label: 'موافق عليها' }, { value: 'rejected', label: 'مرفوضة' }]} />
          <Select value={type} onChange={(e: any) => setType(e.target.value)}
            options={[{ value: 'all', label: 'كل الأنواع' }, ...Object.entries(LEAVE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
          <div className="spacer" />
          <span className="small muted">{filtered.length} طلب</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الموظف</th><th>القسم</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>السبب</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {filtered.map((l: any) => (
                <tr key={l.id}>
                  <td><div className="row gap-8"><Avatar name={l.employee_name} color={l.avatar_color} size="sm" /><div><div className="cell-title">{l.employee_name}</div><div className="cell-sub num">{l.employee_code}</div></div></div></td>
                  <td className="small">{l.department_name || '—'}</td>
                  <td><Badge tone="slate">{LEAVE_LABELS[l.type] || l.type}</Badge></td>
                  <td className="small">{formatDate(l.start_date)}</td>
                  <td className="small">{formatDate(l.end_date)}</td>
                  <td className="num-cell">{l.days}</td>
                  <td className="small muted truncate" style={{ maxWidth: 170 }}>{l.reason || '—'}</td>
                  <td><Badge tone={LEAVE_TONE[l.status]} dot>{l.status === 'approved' ? 'موافق' : l.status === 'pending' ? 'معلّق' : 'مرفوض'}</Badge></td>
                  <td>
                    {l.status === 'pending' && (
                      <div className="row gap-4">
                        <Btn size="sm" variant="success" onClick={() => act(l.id, 'approved')}><CheckCircle2 size={13} /></Btn>
                        <Btn size="sm" variant="danger" onClick={() => act(l.id, 'rejected')}><XCircle size={13} /></Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="لا طلبات إجازة" message="لا توجد طلبات مطابقة لعوامل التصفية." />}
        </div>
      </Card>

      {modal && <LeaveModal employees={emps.data?.items || []} onClose={() => setModal(false)} onSaved={() => { setModal(false); reload(); toast.push('تم إرسال طلب الإجازة'); }} />}
    </div>
  );
}

function LeaveModal({ employees, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({ employeeId: '', type: 'annual', startDate: todayISO(), endDate: todayISO(), reason: '', status: 'pending' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.employeeId) { toast.push('اختر الموظف', 'error'); return; }
    setSaving(true);
    try { await api.post('/leaves', form); onSaved(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  const days = Math.max(1, Math.round((new Date(form.endDate) - new Date(form.startDate)) / 864e5) + 1);
  return (
    <Modal open onClose={onClose} title="طلب إجازة" sub={`المدة: ${Number.isFinite(days) ? days : 1} يوم`}
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>إرسال الطلب</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="الموظف" required style={{ gridColumn: '1 / -1' }}>
          <Select value={form.employeeId} onChange={(e: any) => setForm({ ...form, employeeId: e.target.value })} placeholder="اختر الموظف"
            options={employees.map((e: any) => ({ value: e.id, label: `${e.name} — ${e.job_title || ''}` }))} />
        </Field>
        <Field label="نوع الإجازة">
          <Select value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })}
            options={Object.entries(LEAVE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </Field>
        <Field label="الحالة">
          <Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'pending', label: 'معلّق' }, { value: 'approved', label: 'موافق عليه' }]} />
        </Field>
        <Field label="من تاريخ"><TextInput type="date" value={form.startDate} onChange={(e: any) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="إلى تاريخ"><TextInput type="date" value={form.endDate} onChange={(e: any) => setForm({ ...form, endDate: e.target.value })} /></Field>
        <Field label="السبب" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} placeholder="سبب طلب الإجازة…" />
        </Field>
      </div>
    </Modal>
  );
}
