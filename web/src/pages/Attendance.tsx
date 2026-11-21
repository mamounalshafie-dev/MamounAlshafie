import React, { useState } from 'react';
import { CalendarCheck, CalendarDays, Clock, Plus, UserCheck, UserX, AlarmClock } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead, PageSkeleton, Select, Stat, TextInput,
} from '../components/ui';
import { ATTENDANCE_LABELS, cx, formatDate, todayISO } from '../lib/format';

function lastWorkday() {
  const d = new Date();
  const day = d.getDay();
  if (day === 5) d.setDate(d.getDate() - 1);
  if (day === 6) d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}

export default function Attendance() {
  const [date, setDate] = useState(lastWorkday());
  const { data, loading, reload } = useApi<any>(`/attendance?date=${date}`, [date]);
  const emps = useApi<any>('/employees');
  const [modal, setModal] = useState<any>(null);
  const rows = data?.rows || [];
  const summary = data?.summary;

  return (
    <div className="page">
      <PageHead
        title="الحضور والانصراف"
        icon={<CalendarCheck size={22} color="#0ea5e9" />}
        breadcrumb={[{ label: 'الموارد البشرية' }, { label: 'الحضور' }]}
        sub="متابعة الحضور اليومي والتأخيرات والغياب لكل الأقسام."
        actions={(
          <>
            <input type="date" className="input" style={{ width: 165 }} value={date} onChange={(e) => setDate(e.target.value)} />
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setModal({ date, checkIn: '08:00', checkOut: '16:00', status: 'present' })}>تسجيل حضور</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="الحاضرون" value={summary?.present ?? 0} icon={<UserCheck size={19} />} accent="#10b981" foot={`من ${summary?.total ?? 0} موظف`} />
        <Stat label="المتأخرون" value={summary?.late ?? 0} icon={<AlarmClock size={19} />} accent="#f59e0b" foot="تجاوزوا وقت الدوام" />
        <Stat label="الغائبون" value={summary?.absent ?? 0} icon={<UserX size={19} />} accent="#ef4444" foot="بدون إذن مسبق" />
        <Stat label="في إجازة" value={summary?.leave ?? 0} icon={<CalendarDays size={19} />} accent="#8b5cf6" foot="إجازات معتمدة" />
      </div>

      <Card>
        <div className="card-head">
          <h3><CalendarDays size={15} /> سجل {formatDate(date)}</h3>
          <div className="row gap-8">
            <Btn size="sm" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>اليوم</Btn>
            <Btn size="sm" onClick={() => setDate(lastWorkday())}>آخر يوم عمل</Btn>
          </div>
        </div>
        {loading && !data ? <div style={{ padding: 20 }}><div className="skeleton" style={{ height: 200 }} /></div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الموظف</th><th>القسم</th><th>الحضور</th><th>الانصراف</th><th>ساعات العمل</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {rows.map((r: any) => {
                  let hours = '—';
                  if (r.check_in && r.check_out) {
                    const [h1, m1] = r.check_in.split(':').map(Number);
                    const [h2, m2] = r.check_out.split(':').map(Number);
                    hours = `${Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60).toFixed(1)} س`;
                  }
                  return (
                    <tr key={r.id}>
                      <td><div className="row gap-8"><Avatar name={r.employee_name} size="sm" /><div><div className="cell-title">{r.employee_name}</div><div className="cell-sub num">{r.code}</div></div></div></td>
                      <td className="small">{r.department_name || '—'}</td>
                      <td className="num-cell">{r.check_in || '—'}</td>
                      <td className="num-cell">{r.check_out || '—'}</td>
                      <td className="num-cell small">{hours}</td>
                      <td><Badge tone={r.status === 'present' ? 'green' : r.status === 'late' ? 'amber' : r.status === 'leave' ? 'blue' : 'red'} dot>{ATTENDANCE_LABELS[r.status]}</Badge></td>
                      <td><Btn size="sm" variant="ghost" onClick={() => setModal({ employeeId: r.employee_id, date, checkIn: r.check_in || '', checkOut: r.check_out || '', status: r.status })}>تعديل</Btn></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <Empty title="لا سجلات في هذا اليوم" message="قد يكون يوم عطلة، أو لم يُسجّل الحضور بعد." action={<Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setModal({ date, checkIn: '08:00', checkOut: '16:00', status: 'present' })}>تسجيل حضور</Btn>} />}
          </div>
        )}
      </Card>

      {modal && (
        <AttendanceModal initial={modal} employees={emps.data?.items || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />
      )}
    </div>
  );
}

function AttendanceModal({ initial, employees, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.employeeId) { toast.push('اختر الموظف', 'error'); return; }
    setSaving(true);
    try { await api.post('/attendance', form); toast.push('تم تسجيل الحضور'); onSaved(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="تسجيل حضور"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>حفظ</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="الموظف" required style={{ gridColumn: '1 / -1' }}>
          <Select value={form.employeeId} onChange={(e: any) => setForm({ ...form, employeeId: e.target.value })} placeholder="اختر الموظف"
            options={employees.map((e: any) => ({ value: e.id, label: `${e.name} — ${e.job_title || ''}` }))} />
        </Field>
        <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="الحالة">
          <Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })}
            options={Object.entries(ATTENDANCE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </Field>
        <Field label="وقت الحضور"><TextInput type="time" value={form.checkIn || ''} onChange={(e: any) => setForm({ ...form, checkIn: e.target.value })} /></Field>
        <Field label="وقت الانصراف"><TextInput type="time" value={form.checkOut || ''} onChange={(e: any) => setForm({ ...form, checkOut: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
