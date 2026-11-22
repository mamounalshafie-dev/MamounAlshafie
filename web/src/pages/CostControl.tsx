import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ClipboardCheck, FileText, HardHat, Plus, Receipt,
  Search, Send, ShieldAlert, X,
} from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import {
  Badge, Btn, Field, Modal, PageHead, Select, Tabs, TextInput, Textarea,
} from '../components/ui';
import { KpiTile, MoneyCell } from '../components/re-ui';
import { formatCompact, formatDate, formatMoney } from '../lib/format';

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة', submitted: 'بانتظار المراجعة', approved: 'معتمد', rejected: 'مرفوض', paid: 'مدفوع',
};
const STATUS_TONE: Record<string, string> = {
  draft: 'slate', submitted: 'amber', approved: 'green', rejected: 'red', paid: 'blue',
};
const TABS = [
  { id: 'overview', label: 'الملخص الرقابي', icon: <ShieldAlert size={15} /> },
  { id: 'boq', label: 'جدول الكميات BOQ', icon: <ClipboardCheck size={15} /> },
  { id: 'invoices', label: 'فواتير الموردين', icon: <Receipt size={15} /> },
  { id: 'certificates', label: 'المستخلصات', icon: <FileText size={15} /> },
];

export default function CostControl() {
  const { code, setCode } = useRe();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState<{ kind: string; item?: any } | null>(null);
  const [review, setReview] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useApi<any>(`/re/cost-control${qs({ project: code })}`, [code]);

  const summary = data?.summary || {};
  const items = data?.items || [];
  const invoices = data?.invoices || [];
  const certificates = data?.certificates || [];
  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item: any) => [item.item_code, item.description, item.category, item.project_name]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [items, query]);

  const createKind = tab === 'boq' ? 'boq' : tab === 'invoices' ? 'invoice' : tab === 'certificates' ? 'certificate' : 'boq';
  const openCreate = (kind = createKind) => setModal({ kind });

  const transition = async (kind: 'invoice' | 'certificate', document: any, status: string) => {
    if (status === 'rejected' || (status === 'approved' && document.warnings?.length)) {
      setReview({ kind, document, status });
      return;
    }
    try {
      await api.patch(`/re/cost-control/${kind === 'invoice' ? 'invoices' : 'certificates'}/${document.id}/status`, { status });
      toast.push(status === 'paid' ? 'تم تسجيل المستند مدفوعاً' : status === 'approved' ? 'تم اعتماد المستند' : 'تم إرسال المستند للمراجعة');
      reload();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر تحديث الحالة', 'error'); }
  };

  const showDetail = async (kind: 'invoice' | 'certificate', id: number) => {
    try {
      setDetail({ loading: true, kind });
      const result = await api.get<any>(`/re/cost-control/${kind === 'invoice' ? 'invoices' : 'certificates'}/${id}`);
      setDetail({ kind, document: result });
    } catch (e) {
      setDetail(null);
      toast.push(e instanceof ApiError ? e.message : 'تعذّر تحميل المستند', 'error');
    }
  };

  return (
    <div className="page">
      <PageHead
        title="رقابة تكاليف المشاريع"
        icon={<ClipboardCheck size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المشاريع والوحدات' }, { label: 'رقابة التكاليف' }]}
        sub="خط أساس من جدول الكميات، ثم مطابقة فواتير التوريد والمستخلصات مع الكميات والأسعار المعتمدة."
        actions={(
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 185 }}>
              <option value="all">كل المشاريع</option>
              {(data?.projects || []).map((project: any) => <option key={project.code} value={project.code}>{project.name}</option>)}
            </Select>
            {tab !== 'overview' && <Btn icon={<Plus size={15} />} onClick={() => openCreate()}>
              {tab === 'boq' ? 'إضافة بند BOQ' : tab === 'invoices' ? 'تسجيل فاتورة مورد' : 'تسجيل مستخلص'}
            </Btn>}
          </div>
        )}
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {error && <div className="card card-pad" style={{ color: 'var(--red-600)', marginBottom: 14 }}>{error}</div>}
      {tab === 'overview' && <Overview data={data} summary={summary} items={items} loading={loading} onOpen={(next) => setTab(next)} />}
      {tab === 'boq' && (
        <BOQTable items={visibleItems} loading={loading} query={query} setQuery={setQuery}
          onEdit={(item) => setModal({ kind: 'boq', item })} onCreate={() => openCreate('boq')} />
      )}
      {tab === 'invoices' && <DocumentTable kind="invoice" items={invoices} loading={loading} onTransition={transition} onDetail={showDetail} />}
      {tab === 'certificates' && <DocumentTable kind="certificate" items={certificates} loading={loading} onTransition={transition} onDetail={showDetail} />}

      <CostDocumentModal
        state={modal} projects={data?.projects || []} currentProject={code}
        onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); toast.push('تم حفظ بيانات الرقابة بنجاح'); }}
      />
      <ReviewModal review={review} onClose={() => setReview(null)} onSaved={() => { setReview(null); reload(); toast.push('تم تحديث حالة المستند'); }} />
      <DocumentDetail detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function Overview({ data, summary, items, loading, onOpen }: any) {
  const flags = items.filter((item: any) => item.flags?.length);
  return (
    <>
      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="قيمة خط الأساس BOQ" value={formatCompact(summary.budget)} icon={<HardHat size={19} />} foot={`${summary.boqItems || 0} بنداً معتمداً`} />
        <KpiTile label="فواتير موردين معتمدة" value={formatCompact(summary.approvedInvoices)} icon={<Receipt size={19} />} foot={`تعرض الفواتير ${formatCompact(summary.invoiceExposure)}`} />
        <KpiTile label="مستخلصات معتمدة" value={formatCompact(summary.approvedCertificates)} icon={<FileText size={19} />} foot={`تعرض المستخلصات ${formatCompact(summary.certificateExposure)}`} />
        <KpiTile label="بنود تحتاج مراجعة" value={summary.flaggedItems || 0} icon={<AlertTriangle size={19} />} foot={`${(summary.pendingInvoices || 0) + (summary.pendingCertificates || 0)} مستند بانتظار المراجعة`} gold={!!summary.flaggedItems} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.8fr) minmax(290px,1fr)', gap: 14 }}>
        <div className="card">
          <div className="row-between" style={{ padding: '14px 16px' }}>
            <div>
              <h3 style={{ fontSize: 14 }}>مؤشرات الانحراف حسب بند BOQ</h3>
              <div className="tiny muted mt-4">الفواتير والمستخلصات معروضة منفصلة لتفادي ازدواج احتساب التكلفة.</div>
            </div>
            <Btn size="sm" variant="ghost" onClick={() => onOpen('boq')}>عرض جدول الكميات</Btn>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>البند</th><th>المخطط</th><th>فواتير المورد</th><th>المستخلصات</th><th>الرقابة</th></tr></thead>
              <tbody>
                {items.slice(0, 12).map((item: any) => (
                  <tr key={item.id}>
                    <td><b className="num small">{item.item_code}</b><div className="tiny muted">{item.description}</div></td>
                    <td><div className="small num">{formatMoney(item.planned_qty)} {item.unit}</div><div className="tiny muted">{formatCompact(item.planned_amount)}</div></td>
                    <td><div className="small num">{formatMoney(item.invoiced_qty)} {item.unit}</div><div className="tiny muted">معتمد: {formatCompact(item.approved_invoice_amount)}</div></td>
                    <td><div className="small num">{formatMoney(item.certified_qty)} {item.unit}</div><div className="tiny muted">معتمد: {formatCompact(item.approved_certificate_amount)}</div></td>
                    <td>{item.flags?.length ? <Badge tone="red">{item.flags.length} تنبيه</Badge> : <Badge tone="green">ضمن الخطة</Badge>}</td>
                  </tr>
                ))}
                {!loading && !items.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center' }} className="muted">ابدأ بإدخال جدول الكميات للمشروع، ثم سجّل الفواتير والمستخلصات لمطابقتها.</td></tr>}
              </tbody>
            </table>
          </div>
          {flags.length > 0 && (
            <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="row gap-8 small" style={{ color: 'var(--red-600)', fontWeight: 700 }}><ShieldAlert size={16} /> تنبيهات رقابية ({flags.length})</div>
              <div className="grid grid-2 mt-8" style={{ gap: 8 }}>
                {flags.slice(0, 6).map((item: any) => <div key={item.id} className="tiny" style={{ color: 'var(--red-600)' }}><b>{item.item_code}:</b> {item.flags.join('، ')}</div>)}
              </div>
            </div>
          )}
        </div>
        <div className="col gap-14">
          <div className="card card-pad">
            <div className="row gap-8" style={{ color: '#9a6b09', fontWeight: 800, marginBottom: 8 }}><AlertTriangle size={17} /> قواعد الرقابة</div>
            <ul className="small muted" style={{ lineHeight: 2, paddingInlineStart: 18, margin: 0 }}>
              <li>تنبيه عند تجاوز كمية BOQ أو اختلاف السعر بأكثر من 5%.</li>
              <li>المستند المتجاوز يحتاج مبرراً قبل اعتماده.</li>
              <li>اعتماد المستندات لا يرحّل قيداً محاسبياً تلقائياً في هذه المرحلة.</li>
              <li>الفواتير والمستخلصات مؤشرات منفصلة؛ لا تجمعهما لتجنب تكرار القيمة نفسها.</li>
            </ul>
          </div>
          <div className="card card-pad">
            <div className="row-between small"><span className="muted">فواتير بانتظار المراجعة</span><b>{summary.pendingInvoices || 0}</b></div>
            <div className="row-between small mt-12"><span className="muted">مستخلصات بانتظار المراجعة</span><b>{summary.pendingCertificates || 0}</b></div>
            <div className="row-between small mt-12"><span className="muted">إجمالي البنود الرقابية</span><b>{summary.boqItems || 0}</b></div>
          </div>
        </div>
      </div>
      {!data?.project && data?.projects?.length === 0 && <div className="card card-pad mt-14">لا توجد مشاريع عقارية لعرضها.</div>}
    </>
  );
}

function BOQTable({ items, loading, query, setQuery, onEdit, onCreate }: any) {
  return (
    <div className="card">
      <div className="row-between" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
        <div><h3 style={{ fontSize: 14 }}>خط الأساس المعتمد</h3><div className="tiny muted mt-4">يُقفل البند بعد ربطه بمستند حفاظاً على أثر المراجعة؛ أضف بند تغيير جديداً بدلاً من تعديل الأساس.</div></div>
        <div className="row gap-8"><div className="search-input"><Search size={15} /><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث برمز البند أو الوصف" /></div><Btn size="sm" icon={<Plus size={14} />} onClick={onCreate}>إضافة بند</Btn></div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>المشروع</th><th>رمز البند</th><th>التصنيف والوصف</th><th>الوحدة</th><th>الكمية المخططة</th><th>سعر BOQ</th><th>القيمة المخططة</th><th>فواتير / مستخلصات</th><th /></tr></thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td className="small">{item.project_code}</td>
                <td className="num small" style={{ fontWeight: 800 }}>{item.item_code}</td>
                <td className="small"><b>{item.category}</b><div className="tiny muted">{item.description}</div></td>
                <td className="small">{item.unit}</td>
                <td className="num small">{formatMoney(item.planned_qty)}</td>
                <td><MoneyCell value={item.planned_rate} /></td>
                <td><MoneyCell value={item.planned_amount} strong /></td>
                <td className="small"><span className="num">{formatMoney(item.invoiced_qty)}</span> / <span className="num">{formatMoney(item.certified_qty)}</span></td>
                <td><button className="link tiny" onClick={() => onEdit(item)}>تعديل</button></td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 34 }}>لا توجد بنود BOQ للمشروع. أضف خط الأساس قبل إدخال المستندات.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row-between card-pad" style={{ borderTop: '1px solid var(--border)' }}><span className="tiny muted">{items.length} بند</span><span className="tiny muted">إجمالي المخطط: <b className="num">{formatMoney(items.reduce((sum: number, item: any) => sum + item.planned_amount, 0))} د.ع</b></span></div>
    </div>
  );
}

function DocumentTable({ kind, items, loading, onTransition, onDetail }: any) {
  const isInvoice = kind === 'invoice';
  return (
    <div className="card">
      <div className="row-between card-pad" style={{ paddingBottom: 12 }}>
        <div><h3 style={{ fontSize: 14 }}>{isInvoice ? 'سجل فواتير الموردين' : 'سجل المستخلصات'}</h3><div className="tiny muted mt-4">دورة المراجعة: مسودة ← إرسال للمراجعة ← اعتماد أو رفض ← مدفوع.</div></div>
        <Badge tone="slate">{items.length} مستند</Badge>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>الرقم</th><th>{isInvoice ? 'المورد' : 'المقاول'}</th><th>المشروع</th><th>التاريخ</th><th>البنود</th><th>القيمة</th><th>الحالة</th><th>الرقابة</th><th>الإجراء</th></tr></thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td><button className="link num small" onClick={() => onDetail(kind, item.id)}>{isInvoice ? item.invoice_no : item.certificate_no}</button></td>
                <td className="small">{isInvoice ? item.supplier : item.contractor}</td>
                <td className="small">{item.project_code}</td>
                <td className="small">{formatDate(isInvoice ? item.invoice_date : item.certificate_date)}</td>
                <td className="num small">{item.line_count || 0}</td>
                <td><MoneyCell value={item.total_amount} strong /></td>
                <td><Badge tone={STATUS_TONE[item.status] || 'slate'}>{STATUS_LABEL[item.status] || item.status}</Badge></td>
                <td>{item.warnings?.length ? <Badge tone="red">{item.warnings.length} تنبيه</Badge> : <span className="tiny muted">—</span>}</td>
                <td><div className="row gap-4" style={{ flexWrap: 'wrap' }}>{statusActions(kind, item, onTransition)}</div></td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 34 }}>لا توجد مستندات بعد. أضف فاتورة أو مستخلصاً مربوطاً ببند BOQ.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusActions(kind: 'invoice' | 'certificate', item: any, onTransition: any) {
  if (item.status === 'draft') return <Btn size="sm" variant="ghost" icon={<Send size={13} />} onClick={() => onTransition(kind, item, 'submitted')}>إرسال</Btn>;
  if (item.status === 'submitted') return <><Btn size="sm" onClick={() => onTransition(kind, item, 'approved')}>اعتماد</Btn><Btn size="sm" variant="ghost" onClick={() => onTransition(kind, item, 'rejected')}>رفض</Btn></>;
  if (item.status === 'approved') return <Btn size="sm" variant="ghost" icon={<Check size={13} />} onClick={() => onTransition(kind, item, 'paid')}>تسجيل مدفوع</Btn>;
  if (item.status === 'rejected') return <Btn size="sm" variant="ghost" onClick={() => onTransition(kind, item, 'draft')}>إعادة كمسودة</Btn>;
  return <span className="tiny muted">مكتمل</span>;
}

function CostDocumentModal({ state, projects, currentProject, onClose, onSaved }: any) {
  const toast = useToast();
  const open = !!state;
  const kind = state?.kind || 'boq';
  const initial = state?.item;
  const [project, setProject] = useState(currentProject !== 'all' ? currentProject : projects[0]?.code || '');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState('أعمال إنشائية');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('م³');
  const [plannedQty, setPlannedQty] = useState('');
  const [plannedRate, setPlannedRate] = useState('');
  const [number, setNumber] = useState('');
  const [party, setParty] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<any[]>([{ boqItemId: '', quantity: '', unitRate: '' }]);
  const [saving, setSaving] = useState(false);
  const projectPath = open ? `/re/cost-control${qs({ project })}` : null;
  const { data: projectData } = useApi<any>(projectPath, [open, project]);
  const boqItems = projectData?.items || [];
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitRate) || 0), 0);

  React.useEffect(() => {
    if (!open) return;
    setProject(currentProject !== 'all' ? currentProject : projects[0]?.code || '');
    setItemCode(initial?.item_code || ''); setCategory(initial?.category || 'أعمال إنشائية');
    setDescription(initial?.description || ''); setUnit(initial?.unit || 'م³');
    setPlannedQty(initial?.planned_qty ? String(initial.planned_qty) : '');
    setPlannedRate(initial?.planned_rate !== undefined ? String(initial.planned_rate) : '');
    setNumber(''); setParty(''); setDate(new Date().toISOString().slice(0, 10)); setDueDate('');
    setPeriodFrom(''); setPeriodTo(''); setNotes(''); setLines([{ boqItemId: '', quantity: '', unitRate: '' }]);
  }, [open, initial, currentProject, projects]);

  const updateLine = (index: number, key: string, value: any) => setLines((prev) => prev.map((line, i) => {
    if (i !== index) return line;
    if (key === 'boqItemId') {
      const boq = boqItems.find((item: any) => item.id === Number(value));
      return { ...line, boqItemId: value, unitRate: boq ? String(boq.planned_rate) : '' };
    }
    return { ...line, [key]: value };
  }));

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === 'boq') {
        const body = { project, itemCode, category, description, unit, plannedQty: Number(plannedQty), plannedRate: Number(plannedRate), notes };
        if (initial?.id) await api.patch(`/re/cost-control/boq/${initial.id}`, body);
        else await api.post('/re/cost-control/boq', body);
      } else {
        const payload = {
          project,
          [kind === 'invoice' ? 'invoiceNo' : 'certificateNo']: number,
          [kind === 'invoice' ? 'supplier' : 'contractor']: party,
          [kind === 'invoice' ? 'invoiceDate' : 'certificateDate']: date,
          ...(kind === 'invoice' ? { dueDate } : { periodFrom, periodTo }),
          notes,
          lines: lines.map((line) => ({ boqItemId: Number(line.boqItemId), quantity: Number(line.quantity), unitRate: Number(line.unitRate) })),
        };
        await api.post(`/re/cost-control/${kind === 'invoice' ? 'invoices' : 'certificates'}`, payload);
      }
      onSaved();
    } catch (e) {
      // Preserve user input and surface API validation messages.
      toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error');
    } finally { setSaving(false); }
  };

  const title = kind === 'boq' ? (initial ? 'تعديل بند BOQ' : 'إضافة بند إلى جدول الكميات') : kind === 'invoice' ? 'تسجيل فاتورة مورد' : 'تسجيل مستخلص مقاول';
  return (
    <Modal open={open} onClose={onClose} title={title} sub={kind === 'boq' ? 'ثبّت خط الأساس قبل تسجيل المستندات' : 'اربط كل سطر ببند BOQ للمقارنة الرقابية'} size="wide"
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} loading={saving}>{kind === 'boq' ? 'حفظ البند' : 'حفظ كمسودة'}</Btn></>}>
      {kind === 'boq' ? (
        <div className="grid grid-2" style={{ gap: 12 }}>
          <Field label="المشروع" required><Select value={project} onChange={(e: any) => setProject(e.target.value)}>{projects.map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
          <Field label="رمز البند" required><TextInput value={itemCode} onChange={(e: any) => setItemCode(e.target.value)} placeholder="مثال: CON-001" disabled={!!initial?.id} /></Field>
          <Field label="التصنيف"><TextInput value={category} onChange={(e: any) => setCategory(e.target.value)} placeholder="خرسانة، حديد، تشطيبات…" /></Field>
          <Field label="وحدة القياس" required><TextInput value={unit} onChange={(e: any) => setUnit(e.target.value)} placeholder="م³، طن، م²، عدد" /></Field>
          <Field label="الكمية المخططة" required><TextInput type="number" min="0.001" step="any" value={plannedQty} onChange={(e: any) => setPlannedQty(e.target.value)} /></Field>
          <Field label="سعر الوحدة المخطط (د.ع)" required><TextInput type="number" min="0" step="any" value={plannedRate} onChange={(e: any) => setPlannedRate(e.target.value)} /></Field>
          <Field label="الوصف" required style={{ gridColumn: '1 / -1' }}><Textarea rows={2} value={description} onChange={(e: any) => setDescription(e.target.value)} /></Field>
          <Field label="ملاحظات" style={{ gridColumn: '1 / -1' }}><Textarea rows={2} value={notes} onChange={(e: any) => setNotes(e.target.value)} /></Field>
          <div className="small" style={{ gridColumn: '1 / -1', background: 'var(--surface-2)', borderRadius: 10, padding: 12 }}>القيمة المخططة: <b className="num">{formatMoney((Number(plannedQty) || 0) * (Number(plannedRate) || 0))} د.ع</b></div>
        </div>
      ) : (
        <>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <Field label="المشروع" required><Select value={project} onChange={(e: any) => { setProject(e.target.value); setLines([{ boqItemId: '', quantity: '', unitRate: '' }]); }}>{projects.map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
            <Field label={kind === 'invoice' ? 'رقم فاتورة المورد' : 'رقم المستخلص'} required><TextInput value={number} onChange={(e: any) => setNumber(e.target.value)} /></Field>
            <Field label={kind === 'invoice' ? 'اسم المورد' : 'اسم المقاول'} required><TextInput value={party} onChange={(e: any) => setParty(e.target.value)} /></Field>
            <Field label={kind === 'invoice' ? 'تاريخ الفاتورة' : 'تاريخ المستخلص'} required><TextInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field>
            {kind === 'invoice'
              ? <Field label="تاريخ الاستحقاق"><TextInput type="date" value={dueDate} onChange={(e: any) => setDueDate(e.target.value)} /></Field>
              : <><Field label="الفترة من"><TextInput type="date" value={periodFrom} onChange={(e: any) => setPeriodFrom(e.target.value)} /></Field><Field label="الفترة إلى"><TextInput type="date" value={periodTo} onChange={(e: any) => setPeriodTo(e.target.value)} /></Field></>}
          </div>
          <div className="row-between mt-16 mb-8"><b className="small">بنود المستند</b><Btn size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setLines((prev) => [...prev, { boqItemId: '', quantity: '', unitRate: '' }])}>إضافة سطر</Btn></div>
          <div className="col gap-8">
            {lines.map((line, index) => (
              <div key={index} className="card-pad" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
                <div className="grid" style={{ gridTemplateColumns: 'minmax(190px,2fr) minmax(100px,1fr) minmax(120px,1fr) minmax(130px,1.2fr) 36px', gap: 8, alignItems: 'end' }}>
                  <Field label="بند BOQ" required><Select value={line.boqItemId} onChange={(e: any) => updateLine(index, 'boqItemId', e.target.value)}><option value="">اختر البند</option>{boqItems.map((item: any) => <option key={item.id} value={item.id}>{item.item_code} — {item.description}</option>)}</Select></Field>
                  <Field label="الكمية" required><TextInput type="number" min="0.001" step="any" value={line.quantity} onChange={(e: any) => updateLine(index, 'quantity', e.target.value)} /></Field>
                  <Field label="سعر الوحدة" required><TextInput type="number" min="0" step="any" value={line.unitRate} onChange={(e: any) => updateLine(index, 'unitRate', e.target.value)} /></Field>
                  <div className="field"><label>قيمة السطر</label><div className="num small" style={{ fontWeight: 800, padding: '9px 0' }}>{formatMoney((Number(line.quantity) || 0) * (Number(line.unitRate) || 0))} د.ع</div></div>
                  <Btn size="sm" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))} aria-label="حذف السطر"><X size={15} /></Btn>
                </div>
              </div>
            ))}
          </div>
          {!boqItems.length && <div className="small" style={{ color: 'var(--amber-700)', marginTop: 10 }}>لا توجد بنود BOQ لهذا المشروع. أنشئ جدول الكميات أولاً.</div>}
          <div className="row-between mt-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}><span className="small muted">الإجمالي الرقابي للمستند</span><b className="num">{formatMoney(total)} د.ع</b></div>
          <Field label="ملاحظات" className="mt-12"><Textarea rows={2} value={notes} onChange={(e: any) => setNotes(e.target.value)} /></Field>
        </>
      )}
    </Modal>
  );
}

function ReviewModal({ review, onClose, onSaved }: any) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { setReason(''); }, [review]);
  const isReject = review?.status === 'rejected';
  const isReasonRequired = isReject || !!review?.document?.warnings?.length;
  const submit = async () => {
    setSaving(true);
    try {
      const kind = review.kind;
      await api.patch(`/re/cost-control/${kind === 'invoice' ? 'invoices' : 'certificates'}/${review.document.id}/status`, { status: review.status, reason });
      onSaved();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر تحديث المستند', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={!!review} onClose={onClose} title={isReject ? 'رفض المستند' : 'اعتماد بعد مراجعة الانحرافات'} sub={review?.document?.invoice_no || review?.document?.certificate_no}>
      {!!review?.document?.warnings?.length && <div className="card-pad" style={{ background: 'var(--red-50)', borderRadius: 10, marginBottom: 12 }}><b className="small" style={{ color: 'var(--red-700)' }}>تنبيهات الرقابة</b><ul className="small" style={{ lineHeight: 1.8, marginBottom: 0 }}>{review.document.warnings.map((warning: string, i: number) => <li key={i}>{warning}</li>)}</ul></div>}
      <Field label={isReject ? 'سبب الرفض' : 'مبرر الاعتماد / معالجة الانحراف'} required={isReasonRequired} hint={isReasonRequired ? 'لا يقل عن 8 أحرف عند وجود تجاوز.' : 'اختياري إذا لم توجد تنبيهات.'}><Textarea rows={4} value={reason} onChange={(e: any) => setReason(e.target.value)} /></Field>
      <div className="row gap-8 mt-16" style={{ justifyContent: 'flex-end' }}><Btn variant="ghost" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} loading={saving}>{isReject ? 'تأكيد الرفض' : 'اعتماد المستند'}</Btn></div>
    </Modal>
  );
}

function DocumentDetail({ detail, onClose }: any) {
  const document = detail?.document;
  const isInvoice = detail?.kind === 'invoice';
  return (
    <Modal open={!!detail} onClose={onClose} title={detail?.loading ? 'تحميل المستند…' : (isInvoice ? 'تفاصيل فاتورة المورد' : 'تفاصيل المستخلص')} sub={document?.invoice_no || document?.certificate_no} size="wide">
      {detail?.loading ? <div className="card-pad muted">جارٍ التحميل…</div> : document && <>
        <div className="grid grid-4 mb-14" style={{ gap: 10 }}>
          <div className="card-pad"><div className="tiny muted">المشروع</div><b className="small">{document.project_code} — {document.project_name}</b></div>
          <div className="card-pad"><div className="tiny muted">المورد / المقاول</div><b className="small">{isInvoice ? document.supplier : document.contractor}</b></div>
          <div className="card-pad"><div className="tiny muted">التاريخ</div><b className="small">{formatDate(isInvoice ? document.invoice_date : document.certificate_date)}</b></div>
          <div className="card-pad"><div className="tiny muted">الحالة</div><Badge tone={STATUS_TONE[document.status]}>{STATUS_LABEL[document.status]}</Badge></div>
        </div>
        <div className="table-wrap"><table className="table"><thead><tr><th>رمز BOQ</th><th>الوصف</th><th>الكمية</th><th>سعر المستند</th><th>سعر BOQ</th><th>قيمة السطر</th></tr></thead><tbody>
          {document.lines.map((line: any) => <tr key={line.id}><td className="num small">{line.item_code}</td><td className="small">{line.description}</td><td className="num small">{formatMoney(line.quantity)} {line.unit}</td><td><MoneyCell value={line.unit_rate} /></td><td><MoneyCell value={line.planned_rate} /></td><td><MoneyCell value={line.amount} strong /></td></tr>)}
        </tbody></table></div>
        {document.variance_reason && <div className="small mt-12"><b>مبرر الانحراف:</b> {document.variance_reason}</div>}
        {document.rejection_reason && <div className="small mt-12" style={{ color: 'var(--red-600)' }}><b>سبب الرفض:</b> {document.rejection_reason}</div>}
        {document.notes && <div className="small muted mt-12">{document.notes}</div>}
        <div className="row-between mt-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}><b>الإجمالي</b><b className="num">{formatMoney(document.total_amount)} د.ع</b></div>
      </>}
    </Modal>
  );
}
