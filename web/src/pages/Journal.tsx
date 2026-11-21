import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Plus, Trash2, Equal, Eye, Scale } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useMeta, useToast } from '../lib/app-context';
import {
  Badge, Btn, Card, Drawer, Empty, Field, Modal, PageHead, PageSkeleton, SearchBox, Select, Stat, TextInput, useConfirm,
} from '../components/ui';
import { SOURCE_LABELS, cx, formatCompact, formatDate, formatMoney, todayISO } from '../lib/format';

export default function Journal() {
  const { data, loading, reload } = useApi<any>('/journal-entries');
  const { meta } = useMeta();
  const [q, setQ] = useState('');
  const [source, setSource] = useState('all');
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const toast = useToast();
  const items = data?.items || [];

  const filtered = useMemo(() => items.filter((e: any) => {
    if (source !== 'all' && e.source !== source) return false;
    if (q && !`${e.number} ${e.memo || ''} ${e.reference || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, source]);

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="قيود اليومية"
        icon={<BookOpen size={22} color="#6366f1" />}
        breadcrumb={[{ label: 'المالية' }, { label: 'قيود اليومية' }]}
        sub="سجل القيود المحاسبية بنظام القيد المزدوج مع الترحيل التلقائي للمستندات."
        actions={<Btn variant="primary" icon={<Plus size={15} />} onClick={() => setModal(true)}>قيد يدوي جديد</Btn>}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي القيود" value={items.length} icon={<BookOpen size={19} />} accent="#6366f1" foot={`${items.filter((e: any) => e.status === 'posted').length} مرحّل`} />
        <Stat label="إجمالي المبالغ" value={formatCompact(data?.total)} suffix="د.ع" icon={<Scale size={19} />} accent="#0ea5e9" foot="مجموع الحركات" />
        <Stat label="قيود آلية" value={items.filter((e: any) => e.source !== 'manual').length} icon={<CheckCircle2 size={19} />} accent="#10b981" foot="من الفواتير والمشتريات" />
        <Stat label="قيود يدوية" value={items.filter((e: any) => e.source === 'manual').length} icon={<BookOpen size={19} />} accent="#f59e0b" foot="مسجلة يدوياً" />
      </div>

      <Card>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="بحث برقم القيد أو البيان…" className="grow" />
          <Select value={source} onChange={(e: any) => setSource(e.target.value)}
            options={[{ value: 'all', label: 'كل المصادر' }, ...Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
          <span className="small muted">{filtered.length} قيد</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>رقم القيد</th><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>المصدر</th><th>عدد السطور</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {filtered.map((e: any) => (
                <tr key={e.id} className="clickable" onClick={() => setDetail(e)}>
                  <td className="num-cell strong">{e.number}</td>
                  <td className="small muted">{formatDate(e.date)}</td>
                  <td className="small truncate" style={{ maxWidth: 280 }}>{e.memo}</td>
                  <td className="small muted num">{e.reference || '—'}</td>
                  <td><Badge tone="slate">{SOURCE_LABELS[e.source] || e.source}</Badge></td>
                  <td className="num-cell small">{e.line_count}</td>
                  <td className="num-cell strong">{formatMoney(e.amount)}</td>
                  <td>{e.status === 'posted' ? <Badge tone="green" dot>مرحّل</Badge> : <Badge tone="amber" dot>مسودة</Badge>}</td>
                  <td><Eye size={14} color="var(--muted-2)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="لا توجد قيود" />}
        </div>
      </Card>

      {modal && <EntryForm accounts={meta?.accounts || []} onClose={() => setModal(false)} onSaved={() => { setModal(false); reload(); toast.push('تم تسجيل القيد بنجاح'); }} />}
      {detail && <EntryDrawer entry={detail} onClose={() => setDetail(null)} onChanged={() => { reload(); setDetail(null); }} />}
    </div>
  );
}

function EntryForm({ accounts, onClose, onSaved }: any) {
  const toast = useToast();
  const empty = () => ({ accountId: '', debit: '', credit: '', memo: '' });
  const [form, setForm] = useState<any>({ date: todayISO(), reference: '', memo: '', status: 'posted' });
  const [lines, setLines] = useState<any[]>([empty(), empty()]);
  const [saving, setSaving] = useState(false);

  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.abs(debit - credit) < 0.01 && debit > 0;

  const setLine = (i: number, patch: any) => setLines((prev) => prev.map((l, x) => (x === i ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!balanced) { toast.push('القيد غير متوازن — يجب أن يتساوى المدين والدائن', 'error'); return; }
    if (lines.some((l) => !l.accountId)) { toast.push('يجب تحديد حساب لكل سطر', 'error'); return; }
    setSaving(true);
    try { await api.post('/journal-entries', { ...form, lines }); onSaved(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="قيد محاسبي جديد" sub="يجب أن يتساوى مجموع المدين مع مجموع الدائن" size="xl"
      footer={(
        <>
          <div className="row gap-16" style={{ marginInlineEnd: 'auto' }}>
            <span className="small muted">مدين: <b className={cx('num', !balanced && 'neg')}>{formatMoney(debit)}</b></span>
            <span className="small muted">دائن: <b className={cx('num', !balanced && 'neg')}>{formatMoney(credit)}</b></span>
            {balanced ? <Badge tone="green" dot>متوازن</Badge> : <Badge tone="red" dot>غير متوازن</Badge>}
          </div>
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn variant="primary" loading={saving} onClick={save} disabled={!balanced}>ترحيل القيد</Btn>
        </>
      )}>
      <div className="grid grid-3 gap-16 mb-16">
        <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="المرجع"><TextInput value={form.reference} onChange={(e: any) => setForm({ ...form, reference: e.target.value })} placeholder="INV-2026-0001" dir="ltr" /></Field>
        <Field label="الحالة">
          <Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'posted', label: 'مرحّل' }, { value: 'draft', label: 'مسودة' }]} />
        </Field>
      </div>
      <Field label="البيان" className="mb-16">
        <TextInput value={form.memo} onChange={(e: any) => setForm({ ...form, memo: e.target.value })} placeholder="وصف القيد المحاسبي…" />
      </Field>

      <div className="card">
        <div className="card-head" style={{ padding: '12px 16px' }}>
          <h3 style={{ fontSize: 13.5 }}><Equal size={14} /> سطور القيد</h3>
          <Btn size="sm" icon={<Plus size={13} />} onClick={() => setLines((l) => [...l, empty()])}>إضافة سطر</Btn>
        </div>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead><tr><th style={{ minWidth: 240 }}>الحساب</th><th style={{ width: 150 }}>مدين</th><th style={{ width: 150 }}>دائن</th><th>ملاحظة</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <Select value={l.accountId} onChange={(e: any) => setLine(i, { accountId: e.target.value })} placeholder="اختر الحساب"
                      options={accounts.map((a: any) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                  </td>
                  <td><TextInput type="number" value={l.debit} onChange={(e: any) => setLine(i, { debit: e.target.value, credit: '' })} placeholder="0" /></td>
                  <td><TextInput type="number" value={l.credit} onChange={(e: any) => setLine(i, { credit: e.target.value, debit: '' })} placeholder="0" /></td>
                  <td><TextInput value={l.memo} onChange={(e: any) => setLine(i, { memo: e.target.value })} placeholder="شرح السطر" /></td>
                  <td>
                    <Btn variant="ghost" className="btn-icon btn-sm" onClick={() => setLines((prev) => prev.length > 2 ? prev.filter((_, x) => x !== i) : prev)}><Trash2 size={13} /></Btn>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي</td>
                <td className="num-cell">{formatMoney(debit, { currency: false })}</td>
                <td className="num-cell">{formatMoney(credit, { currency: false })}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function EntryDrawer({ entry, onClose, onChanged }: any) {
  const { data, loading } = useApi<any>(`/journal-entries/${entry.id}`);
  const toast = useToast();
  const confirm = useConfirm();
  const e = data?.entry || entry;
  const lines = data?.lines || [];
  const canDelete = e.source === 'manual';

  return (
    <Drawer open onClose={onClose} title={e.number} sub={`${formatDate(e.date)} · ${SOURCE_LABELS[e.source] || e.source}`}
      footer={(
        <>
          {canDelete && (
            <Btn variant="danger" icon={<Trash2 size={14} />} onClick={() => confirm({
              title: 'حذف القيد', message: 'سيتم حذف القيد نهائياً من دفتر اليومية.', danger: true, confirmLabel: 'حذف',
              onConfirm: async () => { await api.del(`/journal-entries/${e.id}`); toast.push('تم حذف القيد'); onChanged(); },
            })}>حذف</Btn>
          )}
          <div className="grow" />
          {e.status !== 'posted' && (
            <Btn variant="primary" icon={<CheckCircle2 size={14} />} onClick={async () => { await api.post(`/journal-entries/${e.id}/post`); toast.push('تم ترحيل القيد'); onChanged(); }}>ترحيل</Btn>
          )}
        </>
      )}>
      {loading ? <div className="skeleton" style={{ height: 160 }} /> : (
        <>
          <div className="row-between mb-16">
            <Badge tone={e.status === 'posted' ? 'green' : 'amber'} dot>{e.status === 'posted' ? 'مرحّل' : 'مسودة'}</Badge>
            <span className="small muted">{e.reference || '—'}</span>
          </div>
          <div className="card card-pad mb-16">
            <div className="small strong mb-8">البيان</div>
            <p className="small muted" style={{ lineHeight: 1.8 }}>{e.memo}</p>
          </div>
          <div className="table-wrap card">
            <table className="table table-compact">
              <thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>ملاحظة</th></tr></thead>
              <tbody>
                {lines.map((l: any) => (
                  <tr key={l.id}>
                    <td><div className="cell-title small">{l.account_name}</div><div className="cell-sub num">{l.account_code}</div></td>
                    <td className="num-cell">{l.debit ? formatMoney(l.debit) : '—'}</td>
                    <td className="num-cell">{l.credit ? formatMoney(l.credit) : '—'}</td>
                    <td className="small muted">{l.memo || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>الإجمالي</td>
                  <td className="num-cell">{formatMoney(lines.reduce((s: number, l: any) => s + l.debit, 0))}</td>
                  <td className="num-cell">{formatMoney(lines.reduce((s: number, l: any) => s + l.credit, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Drawer>
  );
}
