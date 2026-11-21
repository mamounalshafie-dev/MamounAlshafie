import React, { useState } from 'react';
import { KeyRound, Mail, Phone, ShieldCheck, UserCog, Briefcase, CheckCircle2, ListChecks } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useAuth, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, CardHead, Empty, Field, PageHead, Stat, TextInput,
} from '../components/ui';
import { ROLE_LABELS, formatDate, relativeTime } from '../lib/format';

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const tasks = useApi<any>('/tasks?mine=true');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.newPassword !== form.confirmPassword) { toast.push('كلمتا المرور غير متطابقتين', 'error'); return; }
    if (form.newPassword.length < 6) { toast.push('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.push('تم تحديث كلمة المرور بنجاح');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر التحديث', 'error'); }
    finally { setSaving(false); }
  };

  const openTasks = tasks.data?.items || [];

  return (
    <div className="page">
      <PageHead
        title="الملف الشخصي"
        icon={<UserCog size={22} color="#8b5cf6" />}
        breadcrumb={[{ label: 'الملف الشخصي' }]}
        sub="بيانات حسابك وصلاحياتك وأمان كلمة المرور."
      />

      <div className="grid grid-4 mb-20">
        <Stat label="صلاحيتك" value={ROLE_LABELS[user?.role || ''] || user?.role} icon={<ShieldCheck size={19} />} accent="#6366f1" foot="دور الحساب الحالي" />
        <Stat label="المهام المفتوحة" value={openTasks.length} icon={<ListChecks size={19} />} accent="#f59e0b" foot="مسندة إليك" />
        <Stat label="القسم" value={user?.department || '—'} icon={<Briefcase size={19} />} accent="#0ea5e9" />
        <Stat label="الحالة" value="نشط" icon={<CheckCircle2 size={19} />} accent="#10b981" foot="اتصال آمن" />
      </div>

      <div className="grid grid-2-1">
        <div className="col gap-16">
          <Card>
            <CardHead title="البيانات الشخصية" />
            <div style={{ padding: 22 }}>
              <div className="row gap-16 mb-20">
                <Avatar name={user?.name} color={user?.avatarColor} size="xl" />
                <div>
                  <h3 style={{ fontSize: 18 }}>{user?.name}</h3>
                  <div className="small muted">{user?.jobTitle || 'مستخدم النظام'} · {user?.department || '—'}</div>
                  <Badge tone="purple" className="mt-8">{ROLE_LABELS[user?.role || ''] || user?.role}</Badge>
                </div>
              </div>
              <dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}>
                <dt><Mail size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} /> البريد</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{user?.email}</dd>
                <dt><Phone size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} /> الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{user?.phone || '—'}</dd>
                <dt>الدور</dt><dd>{ROLE_LABELS[user?.role || ''] || user?.role}</dd>
                <dt>القسم</dt><dd>{user?.department || '—'}</dd>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHead title="مهامي المفتوحة" sub={`${openTasks.length} مهمة`} />
            <div style={{ padding: 14 }}>
              {openTasks.slice(0, 6).map((t: any) => (
                <div key={t.id} className="row-between" style={{ padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
                  <div className="row gap-8">
                    <span className={`priority-dot p-${t.priority}`} />
                    <div>
                      <div className="small strong">{t.title}</div>
                      <div className="tiny muted">{t.project_name || 'بدون مشروع'}</div>
                    </div>
                  </div>
                  <Badge tone={t.is_overdue ? 'red' : 'slate'}>{formatDate(t.due_date)}</Badge>
                </div>
              ))}
              {!openTasks.length && <Empty title="لا مهام مفتوحة" message="كل مهامك مكتملة 🎉" />}
            </div>
          </Card>
        </div>

        <Card>
          <CardHead title="تغيير كلمة المرور" sub="حماية حسابك" />
          <div style={{ padding: 22 }}>
            <div className="row gap-8 mb-16">
              <span className="badge badge-green"><ShieldCheck size={12} /> تشفير scrypt</span>
              <span className="badge badge-slate">جلسة 7 أيام</span>
            </div>
            <div className="grid gap-16">
              <Field label="كلمة المرور الحالية" required>
                <TextInput type="password" value={form.currentPassword} onChange={(e: any) => setForm({ ...form, currentPassword: e.target.value })} dir="ltr" />
              </Field>
              <Field label="كلمة المرور الجديدة" required>
                <TextInput type="password" value={form.newPassword} onChange={(e: any) => setForm({ ...form, newPassword: e.target.value })} dir="ltr" />
              </Field>
              <Field label="تأكيد كلمة المرور" required>
                <TextInput type="password" value={form.confirmPassword} onChange={(e: any) => setForm({ ...form, confirmPassword: e.target.value })} dir="ltr" />
              </Field>
              <Btn variant="primary" block icon={<KeyRound size={15} />} loading={saving} onClick={save}>تحديث كلمة المرور</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
