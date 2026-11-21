import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays, Download, Filter, FolderKanban, LayoutGrid, List, Plus, Table2, Target,
  TrendingUp, Users, Wallet, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useMeta, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead, PageSkeleton, Progress, SearchBox,
  Select, Stat, Textarea, TextInput, StatusBadge, exportCsv,
} from '../components/ui';
import {
  STAGE_LABELS, STAGE_TONE, PRIORITY_LABELS, PRIORITY_TONE, HEALTH_LABELS, HEALTH_TONE,
  cx, formatCompact, formatDate, formatMoney, dueLabel, todayISO,
} from '../lib/format';

const STAGES = ['planning', 'in_progress', 'on_hold', 'review', 'done'];
const STAGE_COLORS: Record<string, string> = {
  planning: '#94a3b8', in_progress: '#0ea5e9', on_hold: '#f59e0b', review: '#8b5cf6', done: '#10b981', cancelled: '#ef4444',
};

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'grid' | 'table' | 'kanban'>('grid');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');
  const [priority, setPriority] = useState('all');
  const [manager, setManager] = useState('');
  const [modal, setModal] = useState<any>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { meta } = useMeta();
  const { data, loading, reload } = useApi<any>('/projects');

  useEffect(() => {
    if (params.get('new')) { setModal({}); params.delete('new'); setParams(params, { replace: true }); }
  }, [params]);

  const items = data?.items || [];
  const summary = data?.summary;

  const filtered = useMemo(() => items.filter((p: any) => {
    if (stage !== 'all' && p.stage !== stage) return false;
    if (priority !== 'all' && p.priority !== priority) return false;
    if (manager && String(p.manager_id) !== manager) return false;
    if (q) {
      const hay = `${p.name} ${p.code} ${p.customer_name || ''} ${p.description || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [items, stage, priority, manager, q]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="المشاريع"
        icon={<FolderKanban size={22} color="#6366f1" />}
        breadcrumb={[{ label: 'المشاريع' }]}
        sub={`${summary?.total ?? 0} مشروع · ميزانية إجمالية ${formatMoney(summary?.budget)} · ${summary?.byStage?.in_progress ?? 0} قيد التنفيذ`}
        actions={(
          <>
            <Btn icon={<Download size={15} />} onClick={() => exportCsv('projects',
              filtered.map((p: any) => ({
                code: p.code, name: p.name, customer: p.customer_name, stage: STAGE_LABELS[p.stage],
                progress: p.progress, budget: p.budget, spent: p.spent, start: p.start_date, end: p.end_date,
              })))}>تصدير</Btn>
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModal({})}>مشروع جديد</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي المشاريع" value={summary?.total ?? 0} icon={<FolderKanban size={19} />} accent="#6366f1"
          foot={<>متوسط الإنجاز <b>{summary?.avgProgress ?? 0}%</b></>} />
        <Stat label="إجمالي الميزانيات" value={formatCompact(summary?.budget)} suffix="د.ع" icon={<Wallet size={19} />} accent="#0ea5e9"
          foot={<>المصروف {formatCompact(summary?.spent)} د.ع</>} />
        <Stat label="قيد التنفيذ" value={summary?.byStage?.in_progress ?? 0} icon={<TrendingUp size={19} />} accent="#10b981"
          foot={<>تخطيط {summary?.byStage?.planning ?? 0} · مراجعة {summary?.byStage?.review ?? 0}</>} />
        <Stat label="مكتملة" value={(summary?.byStage?.done ?? 0)} icon={<CheckCircle2 size={19} />} accent="#8b5cf6"
          foot={<>ملغاة {summary?.byStage?.cancelled ?? 0} · متوقفة {summary?.byStage?.on_hold ?? 0}</>} />
      </div>

      <Card className="mb-16">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث باسم المشروع أو الرمز أو العميل…" className="grow" />
          <Select
            value={priority}
            onChange={(e: any) => setPriority(e.target.value)}
            options={[{ value: 'all', label: 'كل الأولويات' }, ...Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
          />
          <Select
            value={manager}
            onChange={(e: any) => setManager(e.target.value)}
            placeholder="كل المدراء"
            options={(meta?.users || []).map(( u: any) => ({ value: u.id, label: u.name }))}
          />
          <div className="segmented">
            <button className={cx(view === 'grid' && 'active')} onClick={() => setView('grid')}><LayoutGrid size={14} /> بطاقات</button>
            <button className={cx(view === 'table' && 'active')} onClick={() => setView('table')}><Table2 size={14} /> جدول</button>
            <button className={cx(view === 'kanban' && 'active')} onClick={() => setView('kanban')}><List size={14} /> كانبان</button>
          </div>
        </div>
        <div className="row gap-6 wrap" style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
          <button className={cx('badge', stage === 'all' ? 'badge-indigo' : 'badge-slate')} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setStage('all')}>
            الكل · {items.length}
          </button>
          {STAGES.map((s) => (
            <button key={s} className={cx('badge', stage === s ? 'badge-indigo' : 'badge-slate')} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setStage(s)}>
              <span className="stage-dot" style={{ background: STAGE_COLORS[s] }} /> {STAGE_LABELS[s]} · {items.filter((p: any) => p.stage === s).length}
            </button>
          ))}
        </div>
      </Card>

      {view === 'grid' && (
        filtered.length ? (
          <div className="grid grid-3">
            {filtered.map((p: any) => <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />)}
          </div>
        ) : <Card><Empty title="لا توجد مشاريع مطابقة" message="جرّب تغيير عوامل التصفية أو أنشئ مشروعاً جديداً." action={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setModal({})}>مشروع جديد</Btn>} /></Card>
      )}

      {view === 'table' && (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المشروع</th><th>العميل</th><th>المدير</th><th>المرحلة</th><th>الأولوية</th>
                  <th>التقدم</th><th>الميزانية</th><th>المصروف</th><th>التسليم</th><th>الصحة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className="clickable" onClick={() => navigate(`/projects/${p.id}`)}>
                    <td><div className="cell-title">{p.name}</div><div className="cell-sub num">{p.code}</div></td>
                    <td className="small">{p.customer_name || '—'}</td>
                    <td><div className="row gap-8"><Avatar name={p.manager_name} color={p.manager_color} size="sm" /><span className="small">{p.manager_name}</span></div></td>
                    <td><StatusBadge status={p.stage} labels={STAGE_LABELS} tones={STAGE_TONE} /></td>
                    <td><Badge tone={PRIORITY_TONE[p.priority]}>{PRIORITY_LABELS[p.priority]}</Badge></td>
                    <td>
                      <div className="row gap-8" style={{ minWidth: 120 }}>
                        <div className="progress" style={{ flex: 1 }}><i style={{ width: `${p.progress}%` }} /></div>
                        <span className="num tiny">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="num-cell small">{formatCompact(p.budget)}</td>
                    <td className="num-cell small">{formatCompact(p.spent)}</td>
                    <td className="small muted">{formatDate(p.end_date)}</td>
                    <td><Badge tone={HEALTH_TONE[p.health]}>{HEALTH_LABELS[p.health]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && <Empty title="لا توجد مشاريع مطابقة" />}
        </Card>
      )}

      {view === 'kanban' && (
        <div className="kanban">
          {STAGES.map((s) => {
            const list = filtered.filter((p: any) => p.stage === s);
            return (
              <div key={s} className="kanban-col">
                <div className="kanban-head">
                  <span className="title"><span className="stage-dot" style={{ background: STAGE_COLORS[s] }} /> {STAGE_LABELS[s]}</span>
                  <span className="count">{list.length}</span>
                  <span className="grow" />
                  <span className="tiny muted num">{formatCompact(list.reduce((sum: number, p: any) => sum + p.budget, 0))}</span>
                </div>
                <div className="kanban-body">
                  {list.map((p: any) => (
                    <div key={p.id} className="task-card" onClick={() => navigate(`/projects/${p.id}`)}>
                      <div className="row-between">
                        <span className="p-code" style={{ fontSize: 10 }}>{p.code}</span>
                        <Badge tone={PRIORITY_TONE[p.priority]}>{PRIORITY_LABELS[p.priority]}</Badge>
                      </div>
                      <div className="t-title mt-4">{p.name}</div>
                      <div className="tiny muted mt-4">{p.customer_name}</div>
                      <div className="mt-8">
                        <div className="progress sm"><i style={{ width: `${p.progress}%` }} /></div>
                        <div className="row-between mt-4">
                          <span className="tiny muted">{formatCompact(p.budget)} د.ع</span>
                          <span className="tiny num">{p.progress}%</span>
                        </div>
                      </div>
                      <div className="t-meta">
                        <span className="tiny muted">{p.task_count} مهمة</span>
                        <Avatar name={p.manager_name} color={p.manager_color} size="sm" />
                      </div>
                    </div>
                  ))}
                  {!list.length && <div className="tiny muted text-center" style={{ padding: '18px 0' }}>لا توجد مشاريع</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ProjectForm
          initial={modal}
          meta={meta}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload(); toast.push('تم حفظ المشروع بنجاح'); }}
        />
      )}
    </div>
  );
}

export function ProjectCard({ project: p, onClick }: { project: any; onClick: () => void }) {
  const util = p.budget ? Math.round((p.spent / p.budget) * 100) : 0;
  const overdue = p.end_date && new Date(p.end_date) < new Date() && !['done', 'cancelled'].includes(p.stage);
  return (
    <div className="project-card" style={{ ['--bar' as any]: STAGE_COLORS[p.stage] }} onClick={onClick}>
      <div className="row-between">
        <span className="p-code">{p.code}</span>
        <div className="row gap-6">
          {p.health === 'at_risk' && <Badge tone="amber"><AlertTriangle size={11} /> خطر</Badge>}
          <Badge tone={PRIORITY_TONE[p.priority]}>{PRIORITY_LABELS[p.priority]}</Badge>
        </div>
      </div>
      <h4>{p.name}</h4>
      <div className="p-customer"><Users size={12} /> {p.customer_name || 'بدون عميل'}</div>

      <div className="mt-16">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span className="tiny muted">نسبة الإنجاز</span>
          <span className="num tiny strong">{p.progress}%</span>
        </div>
        <Progress value={p.progress} tone={p.progress === 100 ? 'green' : undefined} />
      </div>

      <div className="kpi-mini">
        <div><b>{formatCompact(p.budget)}</b><span>الميزانية (د.ع)</span></div>
        <div><b>{formatCompact(p.spent)}</b><span>المصروف (د.ع)</span></div>
        <div><b style={{ color: util > 90 ? 'var(--red-500)' : undefined }}>{util}%</b><span>استهلاك</span></div>
      </div>

      <div className="p-foot">
        <div className="row gap-8">
          <Avatar name={p.manager_name} color={p.manager_color} size="sm" />
          <div>
            <div className="tiny strong">{p.manager_name}</div>
            <div className="tiny muted">{p.task_done}/{p.task_count} مهمة</div>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <StatusBadge status={p.stage} labels={STAGE_LABELS} tones={STAGE_TONE} />
          <span className={cx('tiny', overdue ? 'neg' : 'muted')} style={{ marginTop: 4 }}>
            <CalendarDays size={10} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
            {overdue ? `متأخر · ${formatDate(p.end_date)}` : formatDate(p.end_date)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProjectForm({ initial, meta, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>({
    name: initial?.name || '',
    code: initial?.code || '',
    customerId: initial?.customer_id || '',
    managerId: initial?.manager_id || '',
    stage: initial?.stage || 'planning',
    priority: initial?.priority || 'medium',
    startDate: initial?.start_date || todayISO(),
    endDate: initial?.end_date || '',
    budget: initial?.budget || '',
    spent: initial?.spent || 0,
    description: initial?.description || '',
    tags: initial?.tags || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setError('اسم المشروع مطلوب'); return; }
    setSaving(true);
    try {
      if (initial?.id) await api.patch(`/projects/${initial.id}`, form);
      else await api.post('/projects', form);
      onSaved();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial?.id ? 'تعديل المشروع' : 'إنشاء مشروع جديد'}
      sub="أدخل بيانات المشروع الأساسية — يمكنك إضافة المهام والفريق بعد الإنشاء."
      size="lg"
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" loading={saving} onClick={save}>{initial?.id ? 'حفظ التعديلات' : 'إنشاء المشروع'}</Btn></>}
    >
      <div className="grid grid-2 gap-16">
        <Field label="اسم المشروع" required className="grid-span-2" style={{ gridColumn: '1 / -1' }}>
          <TextInput value={form.name} onChange={(e: any) => set('name', e.target.value)} placeholder="مثال: منصة الخدمات الحكومية — المرحلة الثانية" />
        </Field>
        <Field label="رمز المشروع" hint="يُنشأ تلقائياً إن تُرك فارغاً">
          <TextInput value={form.code} onChange={(e: any) => set('code', e.target.value)} placeholder="PRJ-2026-XXX" dir="ltr" />
        </Field>
        <Field label="العميل">
          <Select value={form.customerId} onChange={(e: any) => set('customerId', e.target.value)} placeholder="اختر العميل"
            options={(meta?.customers || []).map((c: any) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="مدير المشروع">
          <Select value={form.managerId} onChange={(e: any) => set('managerId', e.target.value)} placeholder="اختر المدير"
            options={(meta?.users || []).map((u: any) => ({ value: u.id, label: `${u.name} — ${u.job_title || ''}` }))} />
        </Field>
        <Field label="المرحلة">
          <Select value={form.stage} onChange={(e: any) => set('stage', e.target.value)}
            options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} />
        </Field>
        <Field label="الأولوية">
          <Select value={form.priority} onChange={(e: any) => set('priority', e.target.value)}
            options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </Field>
        <Field label="تاريخ البداية">
          <TextInput type="date" value={form.startDate} onChange={(e: any) => set('startDate', e.target.value)} />
        </Field>
        <Field label="تاريخ التسليم">
          <TextInput type="date" value={form.endDate || ''} onChange={(e: any) => set('endDate', e.target.value)} />
        </Field>
        <Field label="الميزانية (د.ع)">
          <TextInput type="number" value={form.budget} onChange={(e: any) => set('budget', e.target.value)} placeholder="0" />
        </Field>
        <Field label="المصروف حتى الآن (د.ع)">
          <TextInput type="number" value={form.spent} onChange={(e: any) => set('spent', e.target.value)} />
        </Field>
        <Field label="الوسوم" hint="افصل بينها بفاصلة">
          <TextInput value={form.tags} onChange={(e: any) => set('tags', e.target.value)} placeholder="حكومي, تحول رقمي" />
        </Field>
        <Field label="الوصف" style={{ gridColumn: '1 / -1' }}>
          <Textarea value={form.description} onChange={(e: any) => set('description', e.target.value)} placeholder="نطاق العمل والأهداف الرئيسية…" />
        </Field>
      </div>
      {error && <div className="badge badge-red mt-16">{error}</div>}
      <style>{`.grid-span-2 { grid-column: 1 / -1; }`}</style>
    </Modal>
  );
}
