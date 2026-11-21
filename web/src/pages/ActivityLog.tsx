import React, { useMemo, useState } from 'react';
import { Activity, Filter, RefreshCw } from 'lucide-react';
import { useApi } from '../lib/app-context';
import { Avatar, Badge, Btn, Card, Empty, PageHead, PageSkeleton, Select } from '../components/ui';
import { formatDateTime, relativeTime } from '../lib/format';

const ENTITY_LABELS: Record<string, string> = {
  project: 'مشروع', task: 'مهمة', invoice: 'فاتورة', quotation: 'عرض سعر', payment: 'دفعة',
  partner: 'عميل/مورد', product: 'منتج', employee: 'موظف', leave: 'إجازة', journal_entry: 'قيد',
  purchase_order: 'أمر شراء', user: 'مستخدم', settings: 'إعدادات', stock: 'مخزون', payroll: 'رواتب',
};

const ACTION_TONE: Record<string, string> = {
  create: 'green', update: 'blue', delete: 'red', payment: 'green', post: 'purple',
  approve: 'green', receive: 'teal', generate: 'indigo', risk: 'amber', done: 'green',
};
const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء', update: 'تحديث', delete: 'حذف', payment: 'دفعة', post: 'ترحيل',
  approve: 'موافقة', receive: 'استلام', generate: 'توليد', risk: 'تنبيه', done: 'إنجاز',
  update_status: 'تحديث حالة', rejected: 'رفض', approved: 'موافقة',
};

export default function ActivityLog() {
  const { data, loading, reload } = useApi<any>('/activities?limit=150');
  const [entity, setEntity] = useState('all');
  const [q, setQ] = useState('');

  const items = useMemo(() => (data || []).filter((a: any) => {
    if (entity !== 'all' && a.entity !== entity) return false;
    if (q && !`${a.message} ${a.user_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, entity, q]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="سجل النشاطات"
        icon={<Activity size={22} color="#0ea5e9" />}
        breadcrumb={[{ label: 'سجل النشاطات' }]}
        sub="تتبّع كامل لكل العمليات التي أجراها فريق العمل على النظام."
        actions={<Btn icon={<RefreshCw size={15} />} onClick={reload}>تحديث</Btn>}
      />

      <Card className="mb-16">
        <div className="toolbar">
          <div className="search-input grow">
            <Filter size={14} style={{ opacity: 0 }} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في النشاطات…" />
          </div>
          <Select value={entity} onChange={(e: any) => setEntity(e.target.value)}
            options={[{ value: 'all', label: 'كل الوحدات' }, ...Object.entries(ENTITY_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
          <span className="small muted">{items.length} نشاط</span>
        </div>
      </Card>

      <Card>
        <div style={{ padding: '20px 22px' }}>
          {items.length ? (
            <div className="timeline">
              {items.map((a: any) => (
                <div key={a.id} className="timeline-item">
                  <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                    <Avatar name={a.user_name} color={a.avatar_color} size="sm" />
                    <div className="grow">
                      <div className="row gap-8 wrap">
                        <b className="small">{a.user_name}</b>
                        {a.entity && <Badge tone="slate">{ENTITY_LABELS[a.entity] || a.entity}</Badge>}
                        {a.action && <Badge tone={ACTION_TONE[a.action] || 'slate'}>{ACTION_LABELS[a.action] || a.action}</Badge>}
                      </div>
                      <div className="mt-4" style={{ fontSize: 12.8, color: 'var(--text-2)' }}>{a.message}</div>
                      <div className="tiny muted mt-4">{relativeTime(a.created_at)} · {formatDateTime(a.created_at)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty title="لا توجد نشاطات" message="لم تُسجّل عمليات مطابقة." />}
        </div>
      </Card>
    </div>
  );
}
