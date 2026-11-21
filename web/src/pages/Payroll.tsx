import React, { useEffect, useRef, useState } from 'react';
import { Banknote, CheckCircle2, Download, Plus, Wallet, Users, CalendarDays, Printer } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import {
  Avatar, Badge, Btn, Card, Empty, PageHead, PageSkeleton, Select, Stat, exportCsv, useConfirm,
} from '../components/ui';
import { formatMoney, monthLabel } from '../lib/format';

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function Payroll() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data, loading, reload } = useApi<any>(`/payslips?period=${period}`, [period]);
  const toast = useToast();
  const confirm = useConfirm();
  const [genPeriod, setGenPeriod] = useState(currentPeriod());
  const [busy, setBusy] = useState(false);
  const rows = data?.rows || [];
  const totals = data?.totals;
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || !data) return;
    if (data.rows?.length === 0 && data.periods?.length && data.periods[0] !== period) {
      autoPicked.current = true;
      setPeriod(data.periods[0]);
    }
  }, [data]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.post('/payslips/generate', { period: genPeriod });
      toast.push(res.created ? `تم إنشاء ${res.created} كشف راتب` : 'كشوف الرواتب موجودة مسبقاً');
      setPeriod(genPeriod);
      reload();
    } catch (e) { toast.push(e instanceof ApiError ? e.message : 'تعذّر الإنشاء', 'error'); }
    finally { setBusy(false); }
  };

  const payAll = () => confirm({
    title: 'صرف جميع الرواتب',
    message: `سيتم تعليم كشوف ${monthLabel(period)} كمدفوعة بإجمالي ${formatMoney(totals?.net)}.`,
    confirmLabel: 'صرف الكل',
    onConfirm: async () => {
      for (const r of rows.filter((x: any) => x.status !== 'paid')) {
        await api.post(`/payslips/${r.id}/pay`);
      }
      toast.push('تم صرف كشوف الرواتب');
      reload();
    },
  });

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="page">
      <PageHead
        title="الرواتب"
        icon={<Wallet size={22} color="#10b981" />}
        breadcrumb={[{ label: 'الموارد البشرية' }, { label: 'الرواتب' }]}
        sub="إعداد وصرف كشوف الرواتب الشهرية مع البدلات والخصومات."
        actions={(
          <>
            <Btn icon={<Download size={15} />} onClick={() => exportCsv(`payroll-${period}`, rows.map((r: any) => ({
              code: r.code, name: r.employee_name, basic: r.basic, allowances: r.allowances,
              deductions: r.deductions, net: r.net, status: r.status,
            })))}>تصدير</Btn>
            <Btn icon={<Printer size={15} />} onClick={() => window.print()}>طباعة</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} loading={busy} onClick={generate}>إنشاء كشوف الشهر</Btn>
          </>
        )}
      />

      <div className="grid grid-4 mb-20">
        <Stat label="إجمالي الصافي" value={formatMoney(totals?.net)} icon={<Banknote size={19} />} accent="#10b981" foot={`${rows.length} موظف`} />
        <Stat label="الرواتب الأساسية" value={formatMoney(totals?.basic)} icon={<Wallet size={19} />} accent="#6366f1" />
        <Stat label="المخصصات" value={formatMoney(totals?.allowances)} icon={<Users size={19} />} accent="#0ea5e9" />
        <Stat label="الخصومات" value={formatMoney(totals?.deductions)} icon={<CalendarDays size={19} />} accent="#f59e0b" foot="ضمان اجتماعي وغياب" />
      </div>

      <Card>
        <div className="toolbar">
          <div className="row gap-8">
            <span className="small muted">الفترة</span>
            <Select value={period} onChange={(e: any) => setPeriod(e.target.value)} style={{ width: 170 }}
              options={(data?.periods?.length ? data.periods : [period]).map((p: string) => ({ value: p, label: monthLabel(p) }))} />
            <input type="month" className="input" style={{ width: 155 }} value={genPeriod} onChange={(e) => setGenPeriod(e.target.value)} />
          </div>
          <div className="spacer" />
          <Badge tone={rows.every((r: any) => r.status === 'paid') ? 'green' : 'amber'} dot>
            {rows.filter((r: any) => r.status === 'paid').length}/{rows.length} مصروف
          </Badge>
          <Btn size="sm" variant="success" onClick={payAll} disabled={!rows.some((r: any) => r.status !== 'paid')}>
            <CheckCircle2 size={14} /> صرف الكل
          </Btn>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الموظف</th><th>القسم</th><th>الأساسي</th><th>المخصصات</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td><div className="row gap-8"><Avatar name={r.employee_name} size="sm" /><div><div className="cell-title">{r.employee_name}</div><div className="cell-sub num">{r.code} · {r.job_title}</div></div></div></td>
                  <td className="small">{r.department_name || '—'}</td>
                  <td className="num-cell">{formatMoney(r.basic)}</td>
                  <td className="num-cell pos">{formatMoney(r.allowances)}</td>
                  <td className="num-cell neg">{formatMoney(r.deductions)}</td>
                  <td className="num-cell strong">{formatMoney(r.net)}</td>
                  <td>{r.status === 'paid' ? <Badge tone="green" dot>مدفوع</Badge> : <Badge tone="amber" dot>مسودة</Badge>}</td>
                  <td>
                    {r.status !== 'paid' && (
                      <Btn size="sm" onClick={async () => { await api.post(`/payslips/${r.id}/pay`); toast.push('تم الصرف'); reload(); }}>صرف</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>الإجمالي — {monthLabel(period)}</td>
                  <td className="num-cell">{formatMoney(totals?.basic)}</td>
                  <td className="num-cell">{formatMoney(totals?.allowances)}</td>
                  <td className="num-cell">{formatMoney(totals?.deductions)}</td>
                  <td className="num-cell">{formatMoney(totals?.net)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
          {!rows.length && <Empty title="لا كشوف رواتب لهذه الفترة" message="اضغط «إنشاء كشوف الشهر» لتوليد الكشوف تلقائياً من بيانات الموظفين." action={<Btn variant="primary" icon={<Plus size={15} />} onClick={generate}>إنشاء كشوف الشهر</Btn>} />}
        </div>
      </Card>
    </div>
  );
}
