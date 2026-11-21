import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Banknote, Landmark, ReceiptText } from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import { Btn, Field, Modal, Select, TextInput, Textarea } from './ui';
import { DueCell, MoneyCell } from './re-ui';
import { formatMoney } from '../lib/format';

type Props = {
  open: boolean;
  onClose: () => void;
  unit?: any;
  contract?: any;
  installments?: any[];
  preset?: any;
  projectCode?: string;
  onDone?: () => void;
};

export function CollectionModal({ open, onClose, unit, contract, installments = [], preset, projectCode, onDone }: Props) {
  const toast = useToast();
  const accountProject = projectCode || contract?.project_code || 'all';
  const { data: accounts } = useApi<any>(open ? `/re/accounts${qs({ project: accountProject })}` : null, [open, accountProject]);
  const [installmentId, setInstallmentId] = useState<any>(preset?.id || '');
  const [amount, setAmount] = useState<any>(preset ? preset.amount - preset.paid_amount : '');
  const [method, setMethod] = useState('تحويل بنكي');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const openItems = useMemo(() => installments.filter((i) => i.status !== 'paid'), [installments]);
  const current = useMemo(() => installments.find((i) => i.id === Number(installmentId)) || null, [installments, installmentId]);

  useEffect(() => {
    if (!open) return;
    const chosen = preset || openItems[0] || null;
    setInstallmentId(chosen?.id || '');
    setAmount(chosen ? Math.round(chosen.amount - chosen.paid_amount) : '');
    setMethod('تحويل بنكي');
    setDate(new Date().toISOString().slice(0, 10));
    setReference('');
    setNotes('');
  }, [open, preset?.id]);

  const remaining = current ? current.amount - current.paid_amount : 0;
  const numeric = Number(amount) || 0;
  const over = numeric > remaining + 0.01;

  const map = accounts?.map || {};
  const accountName = (code: string) => accounts?.accounts?.find((a: any) => a.code === code)?.name || code;
  const debitAccount = method === 'نقدي' ? map.cash : map.bank;

  const submit = async () => {
    if (!current) return toast.push('يرجى اختيار القسط', 'error');
    if (numeric <= 0) return toast.push('أدخل مبلغاً صحيحاً', 'error');
    if (over) return toast.push('المبلغ أكبر من المتبقي على القسط', 'error');
    setSaving(true);
    try {
      await api.post('/re/collections', {
        installmentId: current.id, amount: numeric, method,
        date, reference: reference || null, notes: notes || null,
      });
      toast.push('تم تسجيل التحصيل وترحيل القيد المحاسبي');
      onDone?.();
      onClose();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : 'تعذّر تسجيل التحصيل', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تسجيل تحصيل"
      sub={unit ? `الوحدة ${unit.code}${contract ? ` · عقد ${contract.number}` : ''}` : undefined}
      footer={(
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={submit} loading={saving} icon={<BadgeCheck size={15} />}>تأكيد التحصيل</Btn>
        </>
      )}
    >
      <div className="grid" style={{ gridTemplateColumns: '1.15fr .85fr', gap: 16 }}>
        <div className="col gap-12">
          <Field label="القسط" required>
            <Select
              value={installmentId}
              onChange={(e: any) => {
                setInstallmentId(e.target.value);
                const inst = installments.find((i) => i.id === Number(e.target.value));
                setAmount(inst ? Math.round(inst.amount - inst.paid_amount) : '');
              }}
            >
              <option value="">اختر القسط</option>
              {openItems.map((i) => (
                <option key={i.id} value={i.id}>
                  القسط {i.seq} — استحقاق {i.due_date} — متبقي {formatMoney(i.amount - i.paid_amount)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-2" style={{ gap: 10 }}>
            <Field label="المبلغ المحصل" required>
              <TextInput type="number" value={amount} onChange={(e: any) => setAmount(e.target.value)} />
            </Field>
            <Field label="تاريخ التحصيل" required>
              <TextInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
            </Field>
            <Field label="طريقة الدفع">
              <Select value={method} onChange={(e: any) => setMethod(e.target.value)}>
                <option>نقدي</option>
                <option>تحويل بنكي</option>
                <option>شيك</option>
                <option>بطاقة</option>
                <option>صك مصرفي</option>
              </Select>
            </Field>
            <Field label="رقم المرجع">
              <TextInput value={reference} onChange={(e: any) => setReference(e.target.value)} placeholder="TRF-…" />
            </Field>
          </div>

          <Field label="ملاحظات">
            <Textarea rows={2} value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder="ملاحظات على عملية التحصيل…" />
          </Field>

          {current && (
            <div className="row-between" style={{ background: 'var(--surface-3)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="tiny muted">المتبقي على القسط</div>
              <MoneyCell value={remaining} strong />
            </div>
          )}
          {over && <div className="small" style={{ color: 'var(--red-600)' }}>المبلغ المدخل أكبر من المتبقي على القسط.</div>}
        </div>

        <div>
          <div className="tiny muted mb-6" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ReceiptText size={13} /> معاينة الأثر المحاسبي
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="mini-table">
              <thead><tr><th>الحساب</th><th style={{ textAlign: 'end' }}>مدين</th><th style={{ textAlign: 'end' }}>دائن</th></tr></thead>
              <tbody>
                <tr>
                  <td className="small"><Landmark size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{accountName(debitAccount)}</td>
                  <td style={{ textAlign: 'end' }}><MoneyCell value={numeric} /></td>
                  <td style={{ textAlign: 'end' }} className="muted">—</td>
                </tr>
                <tr>
                  <td className="small"><Banknote size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{accountName(map.receivable)}</td>
                  <td style={{ textAlign: 'end' }} className="muted">—</td>
                  <td style={{ textAlign: 'end' }}><MoneyCell value={numeric} /></td>
                </tr>
                <tr style={{ background: 'var(--surface-3)' }}>
                  <td className="small" style={{ fontWeight: 800 }}>إجمالي القيد</td>
                  <td style={{ textAlign: 'end' }}><MoneyCell value={numeric} strong /></td>
                  <td style={{ textAlign: 'end' }}><MoneyCell value={numeric} strong /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="tiny muted mt-8" style={{ lineHeight: 1.8 }}>
            يُرحّل النظام قيداً متوازناً تلقائياً عند التأكيد، ويُحدّث حالة القسط ورصيد العقد وذمم العميل.
          </div>
          {current && (
            <div className="mt-10 small">
              <div className="row-between"><span className="muted">تاريخ الاستحقاق</span><DueCell due={current.due_date} status={current.status} /></div>
              <div className="row-between mt-4"><span className="muted">حالة القسط</span><span>{current.status === 'overdue' ? 'متأخر' : current.status === 'partial' ? 'جزئي' : 'مستحق'}</span></div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
