import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CircleCheck, ListChecks, Plus, Table2, Timer, TriangleAlert, Columns3, User } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useAuth, useMeta, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, Empty, PageHead, PageSkeleton, Progress, SearchBox, Select, Stat,
} from '../components/ui';
import { TaskForm } from './ProjectDetail';
import { PRIORITY_LABELS, PRIORITY_TONE, cx, formatDate, relativeTime } from '../lib/format';

const COLS = [
  { id: 'backlog', label: 'قائمة الانتظار', color: '#cbd5e1' },
  { id: 'todo', label: 'قائمة المهام', color: '#64748b' },
  { id: 'in_progress', label: 'قيد التنفيذ', color: '#0ea5e9' },
  { id: 'review', label: 'مراجعة', color: '#8b5cf6' },
  { id: 'done', label: 'مكتملة', color: '#10b981' },
];

export default function Tasks() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const [q, setQ] = useState(params.get('q') || '');
  const [projectId, setProjectId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('all');
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [modal, setModal] = useState<any>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const { data, loading, reload } = useApi<any>('/tasks');

  const tasks = data?.items || [];
  const stats = data?.stats;

  const filtered = useMemo(() => tasks.filter((t: any) => {
    if (projectId && String(t.project_id) !== projectId) return false;
    if (assignee && String(t.assignee_id) !== assignee) return false;
    if (mine && t.assignee_id !== user?.id) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (q && !`${t.title} ${t.project_name || ''} ${t.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tasks, projectId, assignee, priority, q, mine, user?.id]);

  const move = async (id: number, stage: string) => {
    try {
      await api.patch(`/tasks/${id}`, { stage });
      reload();
      if (stage === 'done') toast.push('أُنجزت المهمة 🎉');
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر التحديث', 'error'); }
  };

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="المهام"
        icon={<ListChecks size={22} color="#0ea5e9" />}
        breadcrumb={[{ label: 'المهام' }]}
        sub="إدارة مهام كل المشاريع في لوحة موحّدة مع متابعة الأولويات والمواعيد."
        actions={<Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModal({})}>مهمة جديدة</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي المهام" value={stats?.total ?? 0} icon={<ListChecks size={19} />} accent="#6366f1" foot="عبر جميع المشاريع" />
        <Stat label="قيد التنفيذ" value={(stats?.byStage?.in_progress ?? 0) + (stats?.byStage?.review ?? 0)} icon={<Timer size={19} />} accent="#0ea5e9" foot={`${stats?.byStage?.todo ?? 0} في الانتظار`} />
        <Stat label="متأخرة" value={stats?.overdue ?? 0} icon={<TriangleAlert size={19} />} accent="#ef4444" foot="تجاوزت تاريخ الاستحقاق" />
        <Stat label="مكتملة" value={stats?.done ?? 0} icon={<CircleCheck size={19} />} accent="#10b981"
          foot={<div className="row gap-8" style={{ width: '100%' }}><Progress value={stats?.total ? (stats.done / stats.total) * 100 : 0} tone="green" /><span className="num tiny">{stats?.total ? Math.round((stats.done / stats.total) * 100) : 0}%</span></div>} />
      </div>

      <Card className="mb-16">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث في المهام…" className="grow" />
          <Select value={projectId} onChange={(e: any) => setProjectId(e.target.value)} placeholder="كل المشاريع"
            options={(meta?.projects || []).map((p: any) => ({ value: p.id, label: p.name }))} />
          <Select value={assignee} onChange={(e: any) => setAssignee(e.target.value)} placeholder="كل الأعضاء"
            options={(meta?.users || []).map((u: any) => ({ value: u.id, label: u.name }))} />
          <Select value={priority} onChange={(e: any) => setPriority(e.target.value)}
            options={[{ value: 'all', label: 'كل الأولويات' }, ...Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
          <button className={cx('btn btn-sm', mine && 'btn-primary')} onClick={() => setMine((m) => !m)}>
            <User size={14} /> مهامي
          </button>
          <div className="segmented">
            <button className={cx(view === 'board' && 'active')} onClick={() => setView('board')}><Columns3 size={14} /> لوحة</button>
            <button className={cx(view === 'list' && 'active')} onClick={() => setView('list')}><Table2 size={14} /> قائمة</button>
          </div>
        </div>
      </Card>

      {view === 'board' ? (
        <div className="kanban">
          {COLS.map((c) => {
            const list = filtered.filter((t: any) => t.stage === c.id);
            return (
              <div key={c.id} className="kanban-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (drag) { move(drag, c.id); setDrag(null); } }}>
                <div className="kanban-head">
                  <span className="title"><span className="stage-dot" style={{ background: c.color }} />{c.label}</span>
                  <span className="count">{list.length}</span>
                  <span className="grow" />
                  <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24 }} onClick={() => setModal({ stage: c.id })}><Plus size={13} /></button>
                </div>
                <div className="kanban-body">
                  {list.map((t: any) => (
                    <div key={t.id} className={cx('task-card', drag === t.id && 'dragging')} draggable
                      onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onClick={() => setModal(t)}>
                      <div className="row-between">
                        <span className="row gap-4"><span className={cx('priority-dot', `p-${t.priority}`)} /><span className="tiny muted">{PRIORITY_LABELS[t.priority]}</span></span>
                        {t.is_overdue ? <Badge tone="red">متأخرة</Badge> : null}
                      </div>
                      <div className="t-title mt-4">{t.title}</div>
                      <div className="tiny muted mt-4 truncate">{t.project_name || 'بدون مشروع'}</div>
                      <div className="t-meta">
                        <span className={cx('tiny', t.is_overdue ? 'neg' : 'muted')}><CalendarDays size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{formatDate(t.due_date)}</span>
                        <Avatar name={t.assignee_name} color={t.assignee_color} size="sm" />
                      </div>
                    </div>
                  ))}
                  {!list.length && <div className="tiny muted text-center" style={{ padding: 18 }}>لا مهام</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>المهمة</th><th>المشروع</th><th>المسؤول</th><th>الأولوية</th><th>الحالة</th><th>الاستحقاق</th><th>الساعات</th></tr></thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t.id} className="clickable" onClick={() => setModal(t)}>
                    <td><div className="cell-title">{t.title}</div><div className="cell-sub">{t.tags || ''}</div></td>
                    <td className="small">{t.project_name || '—'}</td>
                    <td><div className="row gap-8"><Avatar name={t.assignee_name} color={t.assignee_color} size="sm" /><span className="small">{t.assignee_name || 'غير مسند'}</span></div></td>
                    <td><Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge></td>
                    <td>{COLS.find((c) => c.id === t.stage)?.label || t.stage}</td>
                    <td className={cx('small', t.is_overdue && 'neg')}>{formatDate(t.due_date)}</td>
                    <td className="num-cell small">{t.spent_hours || 0}/{t.estimated_hours || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <Empty title="لا توجد مهام مطابقة" />}
          </div>
        </Card>
      )}

      {modal && (
        <TaskForm initial={modal.id ? modal : null} projectId={modal.project_id || ''} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload(); }} />
      )}
    </div>
  );
}
