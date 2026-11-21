import React, { useState } from 'react';
import {
  Building2, Users, SlidersHorizontal, Server, Plus, Save, ShieldCheck, Database, Activity,
  UserCog, Mail, CheckCircle2, XCircle, Settings as SettingsIcon, KeyRound,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useAuth, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, CardHead, Field, Modal, PageHead, PageSkeleton, Select, Tabs, TextInput, Textarea,
} from '../components/ui';
import { ROLE_LABELS, formatDateTime, formatNumber, relativeTime } from '../lib/format';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('company');
  const settingsApi = useApi<any>('/settings');
  const usersApi = useApi<any>('/users');
  const infoApi = useApi<any>('/system/info');
  const activities = useApi<any>('/activities?limit=15');
  const [form, setForm] = useState<any>(null);
  const [modules, setModules] = useState<any>(null);
  const [userModal, setUserModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const company = form || settingsApi.data?.company || {};
  const mods = modules || settingsApi.data?.modules || {};
  const set = (k: string, v: any) => setForm({ ...(form || settingsApi.data?.company || {}), [k]: v });

  const saveCompany = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', { company: form || settingsApi.data?.company });
      toast.push('تم حفظ إعدادات الشركة');
      settingsApi.reload();
      setForm(null);
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  const toggleModule = async (key: string) => {
    const next = { ...mods, [key]: !mods[key] };
    setModules(next);
    try { await api.patch('/settings', { modules: next }); toast.push('تم تحديث الوحدات'); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر التحديث', 'error'); }
  };

  if (settingsApi.loading && !settingsApi.data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="الإعدادات"
        icon={<SettingsIcon size={22} color="#6366f1" />}
        breadcrumb={[{ label: 'الإعدادات' }]}
        sub="إعدادات الشركة والمستخدمين والوحدات ومعلومات النظام."
      />

      <div className="settings-layout">
        <div className="settings-nav">
          {[
            { id: 'company', label: 'بيانات الشركة', icon: Building2 },
            { id: 'users', label: 'المستخدمون والصلاحيات', icon: Users },
            { id: 'modules', label: 'الوحدات والتفضيلات', icon: SlidersHorizontal },
            { id: 'system', label: 'معلومات النظام', icon: Server },
          ].map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div>
          {tab === 'company' && (
            <Card>
              <CardHead title="بيانات الشركة" sub="تظهر في الفواتير والتقارير المطبوعة" right={isAdmin ? <Btn variant="primary" icon={<Save size={15} />} loading={saving} onClick={saveCompany}>حفظ التغييرات</Btn> : <Badge tone="amber">للعرض فقط</Badge>} />
              <div style={{ padding: 22 }}>
                <div className="grid grid-2 gap-16">
                  <Field label="اسم الشركة (عربي)"><TextInput disabled={!isAdmin} value={company.name || ''} onChange={(e: any) => set('name', e.target.value)} /></Field>
                  <Field label="اسم الشركة (إنجليزي)"><TextInput disabled={!isAdmin} value={company.nameEn || ''} onChange={(e: any) => set('nameEn', e.target.value)} dir="ltr" /></Field>
                  <Field label="الرقم الضريبي"><TextInput disabled={!isAdmin} value={company.taxId || ''} onChange={(e: any) => set('taxId', e.target.value)} dir="ltr" /></Field>
                  <Field label="السجل التجاري"><TextInput disabled={!isAdmin} value={company.cr || ''} onChange={(e: any) => set('cr', e.target.value)} /></Field>
                  <Field label="الهاتف"><TextInput disabled={!isAdmin} value={company.phone || ''} onChange={(e: any) => set('phone', e.target.value)} dir="ltr" /></Field>
                  <Field label="البريد الإلكتروني"><TextInput disabled={!isAdmin} value={company.email || ''} onChange={(e: any) => set('email', e.target.value)} dir="ltr" /></Field>
                  <Field label="الموقع الإلكتروني"><TextInput disabled={!isAdmin} value={company.website || ''} onChange={(e: any) => set('website', e.target.value)} dir="ltr" /></Field>
                  <Field label="العملة"><TextInput disabled={!isAdmin} value={company.currency || 'IQD'} onChange={(e: any) => set('currency', e.target.value)} dir="ltr" /></Field>
                  <Field label="السنة المالية"><TextInput disabled={!isAdmin} value={company.fiscalYear || ''} onChange={(e: any) => set('fiscalYear', e.target.value)} dir="ltr" /></Field>
                  <Field label="نسبة الضريبة %"><TextInput disabled={!isAdmin} type="number" value={company.taxRate ?? 15} onChange={(e: any) => set('taxRate', e.target.value)} /></Field>
                  <Field label="البنك"><TextInput disabled={!isAdmin} value={company.bankName || ''} onChange={(e: any) => set('bankName', e.target.value)} /></Field>
                  <Field label="رقم الحساب البنكي"><TextInput disabled={!isAdmin} value={company.bankAccount || ''} onChange={(e: any) => set('bankAccount', e.target.value)} dir="ltr" /></Field>
                  <Field label="العنوان" style={{ gridColumn: '1 / -1' }}>
                    <Textarea disabled={!isAdmin} value={company.address || ''} onChange={(e: any) => set('address', e.target.value)} />
                  </Field>
                </div>
                {!isAdmin && <div className="badge badge-amber mt-16">يمكن لمدير النظام فقط تعديل إعدادات الشركة.</div>}
              </div>
            </Card>
          )}

          {tab === 'users' && (
            <Card>
              <CardHead title="المستخدمون والصلاحيات" sub={`${usersApi.data?.length ?? 0} مستخدم`}
                right={isAdmin ? <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setUserModal(true)}>مستخدم جديد</Btn> : <Badge tone="amber">للعرض فقط</Badge>} />
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>المستخدم</th><th>الدور</th><th>القسم</th><th>المهام المفتوحة</th><th>آخر دخول</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {(usersApi.data || []).map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <div className="row gap-8">
                            <Avatar name={u.name} color={u.avatar_color} size="sm" />
                            <div><div className="cell-title">{u.name}</div><div className="cell-sub" dir="ltr">{u.email}</div></div>
                          </div>
                        </td>
                        <td><Badge tone={u.role === 'admin' ? 'purple' : u.role === 'manager' ? 'indigo' : 'slate'}>{ROLE_LABELS[u.role] || u.role}</Badge></td>
                        <td className="small">{u.department || '—'}</td>
                        <td className="num-cell">{u.open_tasks}</td>
                        <td className="small muted">{u.last_login ? relativeTime(u.last_login) : '—'}</td>
                        <td>
                          {isAdmin ? (
                            <button className="switch" onClick={async () => {
                              await api.patch(`/users/${u.id}`, { active: u.active ? 0 : 1 });
                              usersApi.reload();
                              toast.push(u.active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
                            }}>
                              <input type="checkbox" checked={!!u.active} readOnly /><span />
                            </button>
                          ) : (u.active ? <Badge tone="green" dot>نشط</Badge> : <Badge tone="slate" dot>معطّل</Badge>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === 'modules' && (
            <div className="grid gap-16">
              <Card>
                <CardHead title="وحدات النظام" sub="تفعيل أو تعطيل الوحدات حسب احتياج المؤسسة" />
                <div style={{ padding: 18 }}>
                  {[
                    ['projects', 'إدارة المشاريع', 'مشاريع، مهام، فرق، سجلات أوقات'],
                    ['sales', 'المبيعات والعملاء', 'عملاء، عروض أسعار، فواتير وتحصيل'],
                    ['purchases', 'المشتريات والموردون', 'موردون، أوامر شراء واستلام'],
                    ['inventory', 'المخزون', 'منتجات، أرصدة وحركات مخزنية'],
                    ['accounting', 'المحاسبة', 'دليل حسابات، قيود وقوائم مالية'],
                    ['hr', 'الموارد البشرية', 'موظفون، حضور، إجازات ورواتب'],
                    ['reports', 'التقارير والتحليلات', 'لوحات معلومات وتقارير تنفيذية'],
                  ].map(([key, title, desc]) => (
                    <div key={key} className="row-between" style={{ padding: '13px 6px', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div className="strong" style={{ fontSize: 13 }}>{title}</div>
                        <div className="tiny muted">{desc}</div>
                      </div>
                      <label className="switch">
                        <input type="checkbox" checked={!!mods[key]} onChange={() => isAdmin && toggleModule(key)} disabled={!isAdmin} />
                        <span />
                      </label>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHead title="تفضيلات العرض" sub="إعدادات إقليمية" />
                <div style={{ padding: 18 }}>
                  <div className="grid grid-3 gap-16">
                    <Field label="العملة"><TextInput value="دينار عراقي (IQD)" disabled /></Field>
                    <Field label="اللغة"><TextInput value="العربية (RTL)" disabled /></Field>
                    <Field label="المنطقة الزمنية"><TextInput value="Asia/Baghdad (GMT+3)" disabled /></Field>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab === 'system' && (
            <div className="grid gap-16">
              <Card>
                <CardHead title="معلومات النظام" sub="بيانات التشغيل وقاعدة البيانات" />
                <div style={{ padding: 20 }}>
                  <div className="grid grid-2 gap-16">
                    {[
                      ['اسم النظام', infoApi.data?.name || 'NOOR ERP'],
                      ['الإصدار', infoApi.data?.version || '—'],
                      ['قاعدة البيانات', infoApi.data?.database || '—'],
                      ['إصدار Node', infoApi.data?.node || '—'],
                      ['مدة التشغيل', `${formatNumber(infoApi.data?.uptime || 0)} ثانية`],
                      ['التاريخ', infoApi.data?.today || '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="row-between card card-pad">
                        <span className="small muted">{l}</span><b className="num small">{v}</b>
                      </div>
                    ))}
                  </div>
                  <div className="divider" style={{ margin: '18px 0' }} />
                  <div className="grid grid-4 gap-12">
                    {Object.entries(infoApi.data?.counts || {}).map(([k, v]) => (
                      <div key={k} className="text-center card card-pad">
                        <div className="num" style={{ fontSize: 19, fontWeight: 800 }}>{formatNumber(Number(v))}</div>
                        <div className="tiny muted">{({ projects: 'مشاريع', tasks: 'مهام', invoices: 'فواتير', partners: 'شركاء', products: 'منتجات', employees: 'موظفون', journal_entries: 'قيود' } as any)[k] || k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card>
                <CardHead title="آخر عمليات النظام" sub="سجل النشاطات" />
                <div style={{ padding: '16px 20px' }}>
                  <div className="timeline">
                    {(activities.data || []).slice(0, 8).map((a: any) => (
                      <div key={a.id} className="timeline-item">
                        <div className="t-head"><b>{a.user_name}</b> <span className="muted">{a.message}</span></div>
                        <div className="t-time">{relativeTime(a.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {userModal && <UserModal onClose={() => setUserModal(false)} onSaved={() => { setUserModal(false); usersApi.reload(); toast.push('تم إنشاء المستخدم'); }} />}
    </div>
  );
}

function UserModal({ onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({ name: '', email: '', password: '', role: 'employee', jobTitle: '', department: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.post('/users', form); onSaved(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="مستخدم جديد" sub="سيتمكن المستخدم من الدخول مباشرة بعد الإنشاء"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>إنشاء المستخدم</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="الاسم الكامل" required><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="البريد الإلكتروني" required><TextInput type="email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} dir="ltr" /></Field>
        <Field label="كلمة المرور" required hint="6 أحرف على الأقل"><TextInput type="password" value={form.password} onChange={(e: any) => setForm({ ...form, password: e.target.value })} dir="ltr" /></Field>
        <Field label="الدور">
          <Select value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })}
            options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </Field>
        <Field label="المسمى الوظيفي"><TextInput value={form.jobTitle} onChange={(e: any) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
        <Field label="القسم"><TextInput value={form.department} onChange={(e: any) => setForm({ ...form, department: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
