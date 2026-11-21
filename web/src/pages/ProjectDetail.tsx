import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, CheckCircle2, Clock, FolderKanban, ListChecks, Plus, Users, Wallet,
  Pencil, Paperclip, TrendingUp, FileText, Activity, CircleDollarSign, Target, Trash2, Download,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useAuth, useMeta, useToast } from '../lib/app-context';
import {
  Avatar, AvatarStack, Badge, Btn, Card, CardHead, Empty, Field, Modal, Money, PageHead,
  PageSkeleton, Progress, Select, StatusBadge, Tabs, Textarea, TextInput, useConfirm,
} from '../components/ui';
import { Donut, HBar } from '../components/charts';
import {
  PRIORITY_LABELS, PRIORITY_TONE, STAGE_LABELS, STAGE_TONE, HEALTH_LABELS, HEALTH_TONE,
  INVOICE_STATUS, INVOICE_TONE, cx, formatCompact, formatDate, formatMoney, relativeTime, todayISO, dueLabel,
} from '../lib/format';
import { ProjectForm } from './Projects';

const TASK_STAGES = [
  { id: 'backlog', label: 'قائمة الانتظار', color: '#cbd5e1' },
  { id: 'todo', label: 'قائمة المهام', color: '#64748b' },
  { id: 'in_progress', label: 'قيد التنفيذ', color: '#0ea5e9' },
  { id: 'review', label: 'مراجعة', color: '#8b5cf6' },
  { id: 'done', label: 'مكتملة', color: '#10b981' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useApi<any>(`/projects/${id}`);
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [taskModal, setTaskModal] = useState<any>(null);
  const [timeModal, setTimeModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { meta } = useMeta();
  const navigate = useNavigate();
  const [dragTask, setDragTask] = useState<number | null>(null);

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <Empty title="المشروع غير موجود" action={<Link to="/projects" className="btn">عودة للمشاريع</Link>} />;

  const { project: p, tasks, members, timesheets, invoices, activities, stats } = data;
  const util = p.budget ? Math.round((p.spent / p.budget) * 100) : 0;

  const moveTask = async (taskId: number, stage: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { stage });
      reload();
      if (stage === 'done') toast.push('أُنجزت المهمة 🎉');
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : 'تعذّر تحديث المهمة', 'error');
    }
  };

  const openEditTask = (task: any) => setTaskModal(task || { project_id: p.id, projectId: p.id });

  return (
    <div className="page">
      <PageHead
        title={p.name}
        icon={<FolderKanban size={22} color="#6366f1" />}
        breadcrumb={[{ label: 'المشاريع', to: '/projects' }, { label: p.code }]}
        sub={<span className="row gap-8 wrap"><span className="num">{p.code}</span> · {p.customer_name || 'بدون عميل'} · <StatusBadge status={p.stage} labels={STAGE_LABELS} tones={STAGE_TONE} /> <Badge tone={HEALTH_TONE[p.health]}>{HEALTH_LABELS[p.health]}</Badge></span>}
        actions={(
          <>
            <Btn icon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>تعديل</Btn>
            <Btn icon={<Clock size={15} />} onClick={() => setTimeModal(true)}>تسجيل وقت</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => openEditTask(null)}>مهمة جديدة</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-16">
        <Card pad>
          <div className="row-between">
            <span className="small muted">نسبة الإنجاز</span>
            <Target size={16} color="var(--brand-500)" />
          </div>
          <div className="row gap-12 mt-8" style={{ alignItems: 'flex-end' }}>
            <span className="num" style={{ fontSize: 30, fontWeight: 800 }}>{p.progress}%</span>
            <span className="small muted" style={{ paddingBottom: 5 }}>{data.tasks.filter((t: any) => t.stage === 'done').length}/{data.tasks.length} مهمة</span>
          </div>
          <Progress value={p.progress} className="mt-12" tone={p.progress === 100 ? 'green' : undefined} />
        </Card>
        <Card pad>
          <div className="row-between"><span className="small muted">الميزانية</span><Wallet size={16} color="#0ea5e9" /></div>
          <div className="num mt-8" style={{ fontSize: 23, fontWeight: 800 }}>{formatCompact(p.budget)} <span style={{ fontSize: 11 }}>د.ع</span></div>
          <div className="row-between mt-8">
            <span className="tiny muted">مصروف {formatCompact(p.spent)}</span>
            <Badge tone={util > 90 ? 'red' : util > 70 ? 'amber' : 'green'}>{util}%</Badge>
          </div>
          <Progress value={util} className="mt-8" tone={util > 90 ? 'red' : util > 70 ? 'amber' : 'green'} />
        </Card>
        <Card pad>
          <div className="row-between"><span className="small muted">الساعات المسجلة</span><Clock size={16} color="#8b5cf6" /></div>
          <div className="num mt-8" style={{ fontSize: 23, fontWeight: 800 }}>{stats.hoursLogged} <span style={{ fontSize: 11 }}>ساعة</span></div>
          <div className="tiny muted mt-8">{stats.billableHours} ساعة قابلة للفوترة · {members.length} عضو</div>
        </Card>
        <Card pad>
          <div className="row-between"><span className="small muted">المفوتر / المحصّل</span><CircleDollarSign size={16} color="#10b981" /></div>
          <div className="num mt-8" style={{ fontSize: 20, fontWeight: 800 }}>{formatCompact(stats.invoiced)}</div>
          <div className="row-between mt-8">
            <span className="tiny muted">محصّل {formatCompact(stats.collected)}</span>
            <div className="progress sm" style={{ width: 70 }}><i style={{ width: `${stats.invoiced ? Math.round((stats.collected / stats.invoiced) * 100) : 0}%` }} /></div>
          </div>
          <div className="tiny muted mt-4">متبقي من الميزانية {formatCompact(Math.max(0, stats.budgetRemaining))} د.ع</div>
        </Card>
      </div>

      <Card>
        <div style={{ padding: '0 18px' }} className="no-print">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'overview', label: 'نظرة عامة', icon: <Activity size={14} /> },
              { id: 'tasks', label: 'المهام', count: tasks.length, icon: <ListChecks size={14} /> },
              { id: 'team', label: 'الفريق', count: members.length, icon: <Users size={14} /> },
              { id: 'time', label: 'سجل الأوقات', count: timesheets.length, icon: <Clock size={14} /> },
              { id: 'invoices', label: 'الفواتير', count: invoices.length, icon: <FileText size={14} /> },
              { id: 'activity', label: 'النشاطات', icon: <Activity size={14} /> },
            ]}
          />
        </div>

        {tab === 'overview' && (
          <div style={{ padding: 20 }}>
            <div className="grid grid-3-2">
              <div>
                <CardHead title="وصف المشروع" right={null} />
                <p style={{ padding: '0 20px 16px', color: 'var(--text-2)', lineHeight: 1.9, fontSize: 13.5 }}>
                  {p.description || 'لا يوجد وصف للمشروع.'}
                </p>
                <div className="divider" style={{ margin: '0 20px 16px' }} />
                <dl className="kv" style={{ padding: '0 20px 20px' }}>
                  <dt>الرمز</dt><dd className="num">{p.code}</dd>
                  <dt>العميل</dt><dd>{p.customer_id ? <Link to={`/customers/${p.customer_id}`} style={{ color: 'var(--brand-600)' }}>{p.customer_name}</Link> : '—'}</dd>
                  <dt>مدير المشروع</dt><dd className="row gap-8"><Avatar name={p.manager_name} color={p.manager_color} size="sm" />{p.manager_name}</dd>
                  <dt>فترة التنفيذ</dt><dd>{formatDate(p.start_date)} ← {formatDate(p.end_date)}</dd>
                  <dt>المتبقي</dt><dd>{dueLabel(p.end_date)}</dd>
                  <dt>الوسوم</dt><dd className="row gap-4 wrap">{(p.tags || '').split(',').filter(Boolean).map((t: string) => <Badge key={t} tone="slate">{t.trim()}</Badge>) || '—'}</dd>
                </dl>
              </div>
              <div>
                <CardHead title="توزيع المهام" sub="حسب المرحلة" />
                <div style={{ padding: 16 }}>
                  <Donut
                    data={TASK_STAGES.map((s) => ({ name: s.label, value: tasks.filter((t: any) => t.stage === s.id).length, color: s.color }))}
                    height={190}
                    centerLabel="مهمة"
                    centerValue={String(tasks.length)}
                  />
                  <div className="mt-8">
                    {TASK_STAGES.map((s) => {
                      const count = tasks.filter((t: any) => t.stage === s.id).length;
                      return (
                        <div key={s.id} className="row-between" style={{ padding: '4px 0' }}>
                          <span className="small muted"><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 3, background: s.color, marginInlineEnd: 6 }} />{s.label}</span>
                          <span className="num small">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="card-head" style={{ borderTop: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 13 }}><Users size={14} /> الفريق</h3>
                  <Btn size="sm" variant="ghost" onClick={() => setMemberModal(true)}><Plus size={13} /> إضافة</Btn>
                </div>
                <div style={{ padding: '12px 18px' }}>
                  <AvatarStack users={members} max={5} />
                  <div className="small muted mt-8">{members.length} عضو في الفريق</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div style={{ padding: 18 }}>
            <div className="row-between mb-12">
              <div className="small muted">اسحب البطاقات بين الأعمدة لتحديث حالة المهمة</div>
              <Btn size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openEditTask(null)}>إضافة مهمة</Btn>
            </div>
            <div className="kanban">
              {TASK_STAGES.map((s) => {
                const list = tasks.filter((t: any) => t.stage === s.id);
                return (
                  <div key={s.id} className="kanban-col"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragTask) { moveTask(dragTask, s.id); setDragTask(null); } }}>
                    <div className="kanban-head">
                      <span className="title"><span className="stage-dot" style={{ background: s.color }} />{s.label}</span>
                      <span className="count">{list.length}</span>
                    </div>
                    <div className="kanban-body">
                      {list.map((t: any) => (
                        <div key={t.id} className={cx('task-card', dragTask === t.id && 'dragging')}
                          draggable
                          onDragStart={() => setDragTask(t.id)}
                          onDragEnd={() => setDragTask(null)}
                          onClick={() => openEditTask(t)}>
                          <div className="row-between">
                            <span className="row gap-4" style={{ fontSize: 10.5 }}>
                              <span className={cx('priority-dot', `p-${t.priority}`)} />
                              <span className="muted">{PRIORITY_LABELS[t.priority]}</span>
                            </span>
                            {t.is_overdue ? <Badge tone="red">متأخرة</Badge> : null}
                          </div>
                          <div className="t-title mt-4">{t.title}</div>
                          {t.tags && <div className="t-tags">{String(t.tags).split(',').slice(0, 2).map((tag: string) => <span key={tag} className="badge badge-slate" style={{ fontSize: 10 }}>{tag}</span>)}</div>}
                          <div className="t-meta">
                            <span className="tiny muted row gap-4"><CalendarDays size={11} />{formatDate(t.due_date)}</span>
                            <Avatar name={t.assignee_name} color={t.assignee_color} size="sm" />
                          </div>
                        </div>
                      ))}
                      {!list.length && <div className="tiny muted text-center" style={{ padding: 16 }}>لا مهام — أفلت هنا</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'team' && (
          <div style={{ padding: 20 }}>
            <div className="row-between mb-16">
              <div><h3 style={{ fontSize: 15 }}>أعضاء الفريق</h3><div className="small muted">الأدوار والمسؤوليات داخل المشروع</div></div>
              <Btn size="sm" icon={<Plus size={14} />} onClick={() => setMemberModal(true)}>إضافة عضو</Btn>
            </div>
            <div className="grid grid-3">
              {members.map((m: any) => (
                <div key={m.id} className="card card-pad row gap-12">
                  <Avatar name={m.name} color={m.avatar_color} size="lg" />
                  <div className="grow">
                    <div className="strong">{m.name}</div>
                    <div className="tiny muted">{m.job_title || 'عضو فريق'}</div>
                    <Badge tone="indigo" className="mt-4">{m.role}</Badge>
                  </div>
                  <Btn size="sm" variant="ghost" className="btn-icon" onClick={async () => {
                    confirm({
                      title: 'إزالة عضو', message: `هل تريد إزالة ${m.name} من فريق المشروع؟`, danger: true, confirmLabel: 'إزالة',
                      onConfirm: async () => { await api.del(`/projects/${p.id}/members/${m.id}`); reload(); toast.push('تمت إزالة العضو'); },
                    });
                  }}><Trash2 size={14} /></Btn>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'time' && (
          <div style={{ padding: 20 }}>
            <div className="row-between mb-16">
              <div><h3 style={{ fontSize: 15 }}>سجل الأوقات</h3><div className="small muted">{stats.hoursLogged} ساعة إجمالاً · {stats.billableHours} قابلة للفوترة</div></div>
              <Btn size="sm" icon={<Plus size={14} />} onClick={() => setTimeModal(true)}>تسجيل وقت</Btn>
            </div>
            <div className="table-wrap card">
              <table className="table table-compact">
                <thead><tr><th>التاريخ</th><th>العضو</th><th>المهمة</th><th>الساعات</th><th>الوصف</th><th>الفوترة</th></tr></thead>
                <tbody>
                  {timesheets.map((t: any) => (
                    <tr key={t.id}>
                      <td className="small">{formatDate(t.date)}</td>
                      <td><div className="row gap-8"><Avatar name={t.user_name} size="sm" />{t.user_name}</div></td>
                      <td className="small">{t.task_title || '—'}</td>
                      <td className="num-cell strong">{t.hours}</td>
                      <td className="small muted">{t.description || '—'}</td>
                      <td>{t.billable ? <Badge tone="green">قابلة</Badge> : <Badge tone="slate">غير قابلة</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!timesheets.length && <Empty title="لا توجد ساعات مسجلة" />}
            </div>
          </div>
        )}

        {tab === 'invoices' && (
          <div style={{ padding: 20 }}>
            <div className="row-between mb-16">
              <div><h3 style={{ fontSize: 15 }}>فواتير المشروع</h3><div className="small muted">إجمالي {formatMoney(stats.invoiced)} · محصّل {formatMoney(stats.collected)}</div></div>
              <Link to="/invoices?new=1" className="btn btn-sm"><Plus size={14} /> فاتورة جديدة</Link>
            </div>
            <div className="table-wrap card">
              <table className="table">
                <thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الاستحقاق</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                      <td className="num-cell strong">{inv.number}</td>
                      <td className="small">{formatDate(inv.date)}</td>
                      <td className="small">{formatDate(inv.due_date)}</td>
                      <td><StatusBadge status={inv.status} labels={INVOICE_STATUS} tones={INVOICE_TONE} /></td>
                      <td className="num-cell">{formatMoney(inv.total)}</td>
                      <td className="num-cell pos">{formatMoney(inv.amount_paid)}</td>
                      <td className="num-cell">{formatMoney(inv.total - inv.amount_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!invoices.length && <Empty title="لا توجد فواتير مرتبطة" message="أصدر فاتورة واربطها بهذا المشروع." />}
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div style={{ padding: 20 }}>
            {activities.length ? (
              <div className="timeline">
                {activities.map((a: any) => (
                  <div key={a.id} className="timeline-item">
                    <div className="t-head"><b>{a.user_name}</b> <span className="muted">{a.message}</span></div>
                    <div className="t-time">{relativeTime(a.created_at)}</div>
                  </div>
                ))}
              </div>
            ) : <Empty title="لا نشاطات بعد" />}
          </div>
        )}
      </Card>

      {editOpen && <ProjectForm initial={p} meta={meta} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); reload(); toast.push('تم تحديث المشروع'); }} />}
      {taskModal && <TaskForm initial={taskModal.id ? taskModal : null} projectId={p.id} members={members} onClose={() => setTaskModal(null)} onSaved={() => { setTaskModal(null); reload(); }} />}
      {timeModal && <TimeForm projectId={p.id} tasks={tasks} onClose={() => setTimeModal(false)} onSaved={() => { setTimeModal(false); reload(); toast.push('تم تسجيل الوقت'); }} />}
      {memberModal && <MemberForm projectId={p.id} existing={members} onClose={() => setMemberModal(false)} onSaved={() => { setMemberModal(false); reload(); toast.push('تمت إضافة العضو'); }} />}
    </div>
  );
}

/* ------------------------------ Task form ----------------------------- */
export function TaskForm({ initial, projectId, members, onClose, onSaved }: any) {
  const { meta } = useMeta();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<any>({
    title: initial?.title || '',
    description: initial?.description || '',
    stage: initial?.stage || 'todo',
    priority: initial?.priority || 'medium',
    assigneeId: initial?.assignee_id || '',
    startDate: initial?.start_date || todayISO(),
    dueDate: initial?.due_date || '',
    estimatedHours: initial?.estimated_hours || '',
    tags: initial?.tags || '',
    projectId: initial?.project_id || projectId || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const people = members?.length ? members : (meta?.users || []).map((u: any) => ({ ...u, avatar_color: u.avatar_color }));

  const save = async () => {
    if (!form.title.trim()) { toast.push('عنوان المهمة مطلوب', 'error'); return; }
    setSaving(true);
    try {
      if (initial?.id) await api.patch(`/tasks/${initial.id}`, form);
      else await api.post('/tasks', form);
      toast.push(initial?.id ? 'تم تحديث المهمة' : 'تم إنشاء المهمة');
      onSaved();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={initial?.id ? 'تعديل المهمة' : 'مهمة جديدة'} size="lg"
      footer={(
        <>
          {initial?.id && (
            <Btn variant="danger" icon={<Trash2 size={14} />} onClick={() => confirm({
              title: 'حذف المهمة', message: `سيتم حذف «${initial.title}» نهائياً.`, danger: true, confirmLabel: 'حذف',
              onConfirm: async () => { await api.del(`/tasks/${initial.id}`); toast.push('تم حذف المهمة'); onSaved(); },
            })}>حذف</Btn>
          )}
          <div className="grow" />
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn variant="primary" loading={saving} onClick={save}>حفظ</Btn>
        </>
      )}>
      <div className="grid grid-2 gap-16">
        <Field label="عنوان المهمة" required style={{ gridColumn: '1 / -1' }}>
          <TextInput value={form.title} onChange={(e: any) => set('title', e.target.value)} placeholder="ماذا يجب إنجازه؟" />
        </Field>
        <Field label="المشروع">
          <Select value={form.projectId} onChange={(e: any) => set('projectId', e.target.value)} placeholder="بدون مشروع"
            options={(meta?.projects || []).map((p: any) => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label="المسؤول">
          <Select value={form.assigneeId} onChange={(e: any) => set('assigneeId', e.target.value)} placeholder="غير مسند"
            options={people.map((u: any) => ({ value: u.id, label: u.name }))} />
        </Field>
        <Field label="المرحلة">
          <Select value={form.stage} onChange={(e: any) => set('stage', e.target.value)}
            options={TASK_STAGES.map((s) => ({ value: s.id, label: s.label }))} />
        </Field>
        <Field label="الأولوية">
          <Select value={form.priority} onChange={(e: any) => set('priority', e.target.value)}
            options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </Field>
        <Field label="تاريخ البداية"><TextInput type="date" value={form.startDate} onChange={(e: any) => set('startDate', e.target.value)} /></Field>
        <Field label="تاريخ الاستحقاق"><TextInput type="date" value={form.dueDate} onChange={(e: any) => set('dueDate', e.target.value)} /></Field>
        <Field label="الساعات التقديرية"><TextInput type="number" value={form.estimatedHours} onChange={(e: any) => set('estimatedHours', e.target.value)} /></Field>
        <Field label="الوسوم"><TextInput value={form.tags} onChange={(e: any) => set('tags', e.target.value)} placeholder="تطوير, اختبار" /></Field>
        <Field label="الوصف" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.description} onChange={(e: any) => set('description', e.target.value)} placeholder="تفاصيل المهمة والمخرجات المطلوبة…" />
        </Field>
      </div>
      {initial?.id && (
        <div className="tiny muted mt-12">
          أُنشئت {relativeTime(initial.created_at)} · الساعات المسجلة {initial.spent_hours || 0} / {initial.estimated_hours || 0}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------ Time form ----------------------------- */
function TimeForm({ projectId, tasks, onClose, onSaved }: any) {
  const toast = useToast();
  const { meta } = useMeta();
  const { user } = useAuth();
  const [form, setForm] = useState<any>({ projectId, taskId: '', userId: user?.id, date: todayISO(), hours: 2, description: '', billable: true });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.post('/timesheets', form);
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="تسجيل وقت عمل" sub="تُستخدم الساعات في تحليل أداء المشروع والفوترة."
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>تسجيل</Btn></>}>
      <div className="grid grid-2 gap-16">
        <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="عدد الساعات"><TextInput type="number" step="0.5" value={form.hours} onChange={(e: any) => setForm({ ...form, hours: e.target.value })} /></Field>
        <Field label="المهمة" style={{ gridColumn: '1 / -1' }}>
          <Select value={form.taskId} onChange={(e: any) => setForm({ ...form, taskId: e.target.value })} placeholder="بدون مهمة محددة"
            options={tasks.map((t: any) => ({ value: t.id, label: t.title }))} />
        </Field>
        <Field label="العضو" style={{ gridColumn: '1 / -1' }}>
          <Select value={form.userId} onChange={(e: any) => setForm({ ...form, userId: e.target.value })}
            options={(meta?.users || []).map((u: any) => ({ value: u.id, label: u.name }))} />
        </Field>
        <Field label="الوصف" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="ما تم إنجازه خلال هذه الساعات…" />
        </Field>
        <label className="checkbox" style={{ gridColumn: '1 / -1' }}>
          <input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} /> ساعات قابلة للفوترة
        </label>
      </div>
    </Modal>
  );
}

/* ----------------------------- Member form ---------------------------- */
function MemberForm({ projectId, existing, onClose, onSaved }: any) {
  const { meta } = useMeta();
  const toast = useToast();
  const taken = new Set(existing.map((m: any) => m.id));
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('عضو فريق');
  const save = async () => {
    if (!userId) { toast.push('اختر عضواً', 'error'); return; }
    try {
      await api.post(`/projects/${projectId}/members`, { userId, role });
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
  };
  return (
    <Modal open onClose={onClose} title="إضافة عضو للفريق"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" onClick={save}>إضافة</Btn></>}>
      <div className="grid gap-16">
        <Field label="العضو">
          <Select value={userId} onChange={(e: any) => setUserId(e.target.value)} placeholder="اختر من المستخدمين"
            options={(meta?.users || []).filter((u: any) => !taken.has(u.id)).map((u: any) => ({ value: u.id, label: `${u.name} — ${u.job_title || ''}` }))} />
        </Field>
        <Field label="الدور في المشروع">
          <Select value={role} onChange={(e: any) => setRole(e.target.value)}
            options={['مدير المشروع', 'مطور', 'محلل', 'مصمم', 'مهندس', 'مختبر', 'عضو فريق'].map((r) => ({ value: r, label: r }))} />
        </Field>
      </div>
    </Modal>
  );
}
