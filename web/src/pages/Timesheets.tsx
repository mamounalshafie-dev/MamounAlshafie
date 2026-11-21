import React, { useMemo, useState } from 'react';
import { Clock, Plus, Timer, Trash2, TrendingUp, Users } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useAuth, useMeta, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, CardHead, Empty, Field, Modal, PageHead, PageSkeleton, Select, Stat, Textarea, TextInput, useConfirm,
} from '../components/ui';
import { HBar } from '../components/charts';
import { formatDate, formatNumber, todayISO } from '../lib/format';

export default function Timesheets() {
  const { data, loading, reload } = useApi<any>('/timesheets');
  const { meta } = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [modal, setModal] = useState<any>(null);
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');

  const items = data?.items || [];
  const totals = data?.totals || { hours: 0, billable: 0 };

  const filtered = useMemo(() => items.filter((t: any) => {
    if (projectId && String(t.project_id) !== projectId) return false;
    if (userId && String(t.user_id) !== userId) return false;
    return true;
  }), [items, projectId, userId]);

  const byUser = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => map.set(t.user_name || 'غير معروف', (map.get(t.user_name || 'غير معروف') || 0) + t.hours));
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filtered]);

  const byProject = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => map.set(t.project_name || 'بدون مشروع', (map.get(t.project_name || 'بدون مشروع') || 0) + t.hours));
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filtered]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="سجل الأوقات"
        icon={<Clock size={22} color="#8b5cf6" />}
        breadcrumb={[{ label: 'سجل الأوقات' }]}
        sub="تتبّع ساعات العمل على المشاريع والمهام لتحسين التخطيط والفوترة."
        actions={<Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModal({ projectId: '', taskId: '', userId: user?.id, date: todayISO(), hours: 2, billable: true })}>تسجيل وقت</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي الساعات" value={formatNumber(totals.hours, 1)} icon={<Timer size={19} />} accent="#6366f1" foot="حسب السجلات المعروضة" />
        <Stat label="ساعات قابلة للفوترة" value={formatNumber(totals.billable, 1)} icon={<TrendingUp size={19} />} accent="#10b981"
          foot={`${totals.hours ? Math.round((totals.billable / totals.hours) * 100) : 0}% من الإجمالي`} />
        <Stat label="عدد الأعضاء" value={new Set(filtered.map((t: any) => t.user_id)).size} icon={<Users size={19} />} accent="#0ea5e9" foot="سجلوا أوقاتاً" />
        <Stat label="عدد السجلات" value={filtered.length} icon={<Clock size={19} />} accent="#f59e0b" foot="آخر 300 سجل" />
      </div>

      <div className="grid grid-2 mb-20">
        <Card>
          <CardHead title="الساعات حسب العضو" sub="أعلى 8 أعضاء" />
          <div style={{ padding: '10px 16px 16px' }}>
            {byUser.length ? <HBar data={byUser} height={240} valueName="ساعات" color="#6366f1" /> : <Empty title="لا توجد بيانات" />}
          </div>
        </Card>
        <Card>
          <CardHead title="الساعات حسب المشروع" sub="أعلى 6 مشاريع" />
          <div style={{ padding: '10px 16px 16px' }}>
            {byProject.length ? <HBar data={byProject} height={240} valueName="ساعات" color="#0ea5e9" /> : <Empty title="لا توجد بيانات" />}
          </div>
        </Card>
      </div>

      <Card>
        <div className="toolbar">
          <Select value={projectId} onChange={(e: any) => setProjectId(e.target.value)} placeholder="كل المشاريع"
            options={(meta?.projects || []).map((p: any) => ({ value: p.id, label: p.name }))} />
          <Select value={userId} onChange={(e: any) => setUserId(e.target.value)} placeholder="كل الأعضاء"
            options={(meta?.users || []).map((u: any) => ({ value: u.id, label: u.name }))} />
          <div className="spacer" />
          <span className="small muted">{filtered.length} سجل</span>
        </div>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead><tr><th>التاريخ</th><th>العضو</th><th>المشروع</th><th>المهمة</th><th>الساعات</th><th>الوصف</th><th>الفوترة</th><th></th></tr></thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr key={t.id}>
                  <td className="small">{formatDate(t.date)}</td>
                  <td><div className="row gap-8"><Avatar name={t.user_name} color={t.avatar_color} size="sm" /><span className="small">{t.user_name}</span></div></td>
                  <td className="small">{t.project_name || '—'}</td>
                  <td className="small muted">{t.task_title || '—'}</td>
                  <td className="num-cell strong">{t.hours}</td>
                  <td className="small muted truncate" style={{ maxWidth: 220 }}>{t.description || '—'}</td>
                  <td>{t.billable ? <Badge tone="green">قابلة</Badge> : <Badge tone="slate">غير قابلة</Badge>}</td>
                  <td>
                    <Btn variant="ghost" className="btn-icon btn-sm" onClick={() => confirm({
                      title: 'حذف السجل', message: 'سيتم حذف سجل الوقت نهائياً.', danger: true, confirmLabel: 'حذف',
                      onConfirm: async () => { await api.del(`/timesheets/${t.id}`); reload(); toast.push('تم حذف السجل'); },
                    })}><Trash2 size={13} /></Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="لا توجد سجلات أوقات" message="ابدأ بتسجيل ساعات العمل على المشاريع." />}
        </div>
      </Card>

      {modal && <TimeModal initial={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); toast.push('تم تسجيل الوقت'); }} />}
    </div>
  );
}

function TimeModal({ initial, onClose, onSaved }: any) {
  const { meta } = useMeta();
  const toast = useToast();
  const [form, setForm] = useState<any>(initial);
  const [saving, setSaving] = useState(false);
  const tasks = useApi<any>(form.projectId ? `/tasks?projectId=${form.projectId}` : null, [form.projectId]);
  const save = async () => {
    if (!form.projectId || !form.hours) { toast.push('المشروع وعدد الساعات مطلوبان', 'error'); return; }
    setSaving(true);
    try { await api.post('/timesheets', form); onSaved(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="تسجيل وقت عمل" size="lg"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>تسجيل</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="المشروع" required>
          <Select value={form.projectId} onChange={(e: any) => setForm({ ...form, projectId: e.target.value, taskId: '' })} placeholder="اختر المشروع"
            options={(meta?.projects || []).map((p: any) => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label="العضو">
          <Select value={form.userId} onChange={(e: any) => setForm({ ...form, userId: e.target.value })}
            options={(meta?.users || []).map((u: any) => ({ value: u.id, label: u.name }))} />
        </Field>
        <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="عدد الساعات"><TextInput type="number" step="0.5" min="0.5" value={form.hours} onChange={(e: any) => setForm({ ...form, hours: e.target.value })} /></Field>
        <Field label="المهمة" style={{ gridColumn: '1 / -1' }}>
          <Select value={form.taskId} onChange={(e: any) => setForm({ ...form, taskId: e.target.value })} placeholder="بدون مهمة"
            options={(tasks.data?.items || []).map((t: any) => ({ value: t.id, label: t.title }))} />
        </Field>
        <Field label="الوصف" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.description || ''} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="ملخص الأعمال المنجزة…" />
        </Field>
        <label className="checkbox" style={{ gridColumn: '1 / -1' }}>
          <input type="checkbox" checked={!!form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} /> ساعات قابلة للفوترة
        </label>
      </div>
    </Modal>
  );
}
