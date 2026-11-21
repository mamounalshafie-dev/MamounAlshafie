import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Link2, Plus, Receipt, Wallet } from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, Field, Modal, PageHead, Select, TextInput, Textarea } from '../components/ui';
import { KpiTile, MoneyCell, Panel } from '../components/re-ui';
import { BarList } from '../components/re-charts';
import { formatCompact, formatDate, formatMoney } from '../lib/format';

export default function Costs() {
  const { code, setCode, projects, project } = useRe();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { data, loading, reload } = useApi<any>(`/re/costs${qs({ project: code })}`, [code]);
  const { data: accountData } = useApi<any>(`/re/accounts${qs({ project: code })}`, [code]);

  const items = data?.items || [];
  const byCategory = data?.byCategory || [];
  const stats = data?.stats || {};
  const budget = project?.budget ?? projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);
  const budgetSpent = project?.spent ?? projects.reduce((sum: number, p: any) => sum + (p.spent || 0), 0);
  const accountName = (accountCode: string) => accountData?.accounts?.find((a: any) => a.code === accountCode)?.name || accountCode || 'غير مربوط';

  return (
    <div className="page">
      <PageHead
        title="التكاليف"
        icon={<HardHat size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المالية' }, { label: 'التكاليف' }]}
        sub={`تكاليف التطوير والبناء${code === 'all' ? ' لجميع المشاريع' : ` في ${project?.name || 'المشروع الحالي'}`}، مصنفة ومرتبطة بقيود محاسبية.`}
        actions={(
          <div className="row gap-8">
            <Btn variant="ghost" icon={<Link2 size={15} />} onClick={() => navigate('/re/accounts')}>ربط الحسابات</Btn>
            <Btn icon={<Plus size={15} />} onClick={() => setOpen(true)}>تسجيل تكلفة</Btn>
          </div>
        )}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي التكاليف" value={formatCompact(stats.total)} icon={<Wallet size={19} />} foot={`${stats.count || 0} بند`} />
        <KpiTile label={code === 'all' ? 'ميزانية المشاريع' : 'ميزانية المشروع'} value={formatCompact(budget)} icon={<HardHat size={19} />} foot={project?.name || 'إجمالي الميزانيات'} />
        <KpiTile label="المنفذ من الميزانية" value={`${budget ? Math.round((budgetSpent / budget) * 100) : 0}%`} icon={<Receipt size={19} />} foot={formatCompact(budgetSpent)} />
        <KpiTile label="نسبة التكاليف المسجلة" value={`${budget ? Math.round((stats.total / budget) * 100) : 0}%`} icon={<Wallet size={19} />} foot="من الميزانية المحددة" gold />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(300px,1fr)', gap: 14 }}>
        <div className="card">
          <div className="row-between" style={{ padding: '14px 16px' }}>
            <h3 style={{ fontSize: 14 }}>بنود التكلفة</h3>
            <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 170 }}>
              <option value="all">كل المشاريع</option>
              {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>التصنيف</th><th>الوصف</th><th>المورد</th><th>التاريخ</th><th>المبلغ</th><th>القيد</th></tr></thead>
              <tbody>
                {items.map((c: any) => (
                  <tr key={c.id}>
                    <td><Badge tone="slate">{c.category}</Badge></td>
                    <td className="small" style={{ maxWidth: 260 }}>{c.description}</td>
                    <td className="small">{c.vendor || '—'}</td>
                    <td className="small">{formatDate(c.date)}</td>
                    <td><MoneyCell value={c.amount} strong /></td>
                    <td>{c.journal_entry_id ? <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>مرحّل</span> : <span className="muted small">—</span>}</td>
                  </tr>
                ))}
                {!loading && !items.length && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد تكاليف</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col gap-14">
          <Panel title="التوزيع حسب التصنيف" icon={<HardHat size={16} color="var(--gold)" />}>
            <BarList data={byCategory.map((c: any) => ({ label: c.category, amount: c.amount }))} color="#153a63" />
          </Panel>
          <Panel title="ربط الحسابات" icon={<Receipt size={16} color="var(--gold)" />}>
            <div className="small muted" style={{ lineHeight: 2 }}>
              كل تكلفة تُرحّل تلقائياً: <b>مدين</b> {accountName(accountData?.map?.costOfSales)} ({accountData?.map?.costOfSales || '—'}) و<b>دائن</b> {accountName(accountData?.map?.bank)} ({accountData?.map?.bank || '—'}).<br />
              <button className="link tiny" onClick={() => navigate('/re/accounts')} style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer' }}>تعديل الحسابات المرتبطة</button>
            </div>
          </Panel>
        </div>
      </div>

      <AddCostModal open={open} onClose={() => setOpen(false)} projects={projects} defaultProject={code}
        onSaved={() => { setOpen(false); reload(); toast.push('تم تسجيل التكلفة وترحيل القيد'); }} />
    </div>
  );
}

function AddCostModal({ open, onClose, projects, defaultProject, onSaved }: any) {
  const toast = useToast();
  const fallbackProject = defaultProject && defaultProject !== 'all' ? defaultProject : (projects?.[0]?.code || 'MC-A');
  const [project, setProject] = useState(fallbackProject);
  const [category, setCategory] = useState('أعمال إنشائية');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setProject(fallbackProject); }, [fallbackProject, open]);

  const submit = async () => {
    if (!amount) return toast.push('أدخل المبلغ', 'error');
    setSaving(true);
    try {
      await api.post('/re/costs', { project, category, amount: Number(amount), date, vendor, description });
      onSaved();
      setAmount(''); setDescription('');
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="تسجيل تكلفة" sub="تُرحّل تلقائياً إلى الحسابات"
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} loading={saving}>حفظ وترحيل</Btn></>}>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Field label="المشروع" required><Select value={project} onChange={(e: any) => setProject(e.target.value)}>{(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label="التصنيف"><Select value={category} onChange={(e: any) => setCategory(e.target.value)}><option>أعمال إنشائية</option><option>مواد بناء</option><option>تشطيبات</option><option>بنى تحتية</option><option>استشارات هندسية</option><option>أمن وحراسة</option><option>تسويق وبيع</option><option>عام</option></Select></Field>
        <Field label="المبلغ" required><TextInput type="number" value={amount} onChange={(e: any) => setAmount(e.target.value)} /></Field>
        <Field label="التاريخ"><TextInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field>
        <Field label="المورد"><TextInput value={vendor} onChange={(e: any) => setVendor(e.target.value)} /></Field>
      </div>
      <Field label="الوصف"><Textarea rows={2} value={description} onChange={(e: any) => setDescription(e.target.value)} /></Field>
    </Modal>
  );
}
