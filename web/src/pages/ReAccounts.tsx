import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, CircleDollarSign, Landmark, Link2, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import { useApi, useToast } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, Field, PageHead, PageSkeleton, Select } from '../components/ui';
import { KpiTile, Panel } from '../components/re-ui';

type AccountMap = {
  receivable: string;
  revenue: string;
  cash: string;
  bank: string;
  downPaymentLiability: string;
  maintenanceExpense: string;
  costOfSales: string;
};

const DEFAULT_MAP: AccountMap = {
  receivable: '1300',
  revenue: '4200',
  cash: '1100',
  bank: '1200',
  downPaymentLiability: '2500',
  maintenanceExpense: '5400',
  costOfSales: '5300',
};

const FIELDS: { key: keyof AccountMap; label: string; description: string; group: string }[] = [
  { key: 'receivable', label: 'ذمم العملاء — الوحدات والعقود', description: 'مدين عند إثبات عقد البيع، ودائن عند تسجيل التحصيل.', group: 'المبيعات والتحصيل' },
  { key: 'revenue', label: 'إيرادات بيع الوحدات', description: 'دائن بقيمة عقد البيع عند اعتماده.', group: 'المبيعات والتحصيل' },
  { key: 'cash', label: 'الصندوق النقدي', description: 'مدين عند استلام المقبوضات نقداً.', group: 'المبيعات والتحصيل' },
  { key: 'bank', label: 'الحسابات البنكية', description: 'مدين عند التحويل البنكي، ودائن عند سداد التكاليف.', group: 'المبيعات والتحصيل' },
  { key: 'downPaymentLiability', label: 'التزامات الدفعات المقدمة', description: 'الحساب المخصص لإظهار الدفعات المقدمة كالتزام عند الحاجة.', group: 'الالتزامات' },
  { key: 'maintenanceExpense', label: 'مصروف صيانة المشاريع', description: 'مدين عند إقفال طلب صيانة ذي تكلفة.', group: 'المصروفات والتكاليف' },
  { key: 'costOfSales', label: 'تكاليف التطوير والمبيعات', description: 'مدين عند تسجيل تكلفة مشروع، مقابل دائن البنك.', group: 'المصروفات والتكاليف' },
];

const TYPE_LABEL: Record<string, string> = {
  asset: 'أصول', liability: 'التزامات', equity: 'حقوق ملكية', income: 'إيرادات', expense: 'مصروفات',
};
const ROLE_TYPE: Record<keyof AccountMap, string> = {
  receivable: 'asset', revenue: 'income', cash: 'asset', bank: 'asset',
  downPaymentLiability: 'liability', maintenanceExpense: 'expense', costOfSales: 'expense',
};

export default function ReAccounts() {
  const { code, setCode, projects, project } = useRe();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, reload } = useApi<any>(`/re/accounts${qs({ project: code })}`, [code]);
  const [form, setForm] = useState<AccountMap>(DEFAULT_MAP);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.map) setForm({ ...DEFAULT_MAP, ...data.map });
  }, [data]);

  const accounts = data?.accounts || [];
  const selectedAccounts = useMemo(() => {
    const byCode = new Map(accounts.map((a: any) => [a.code, a]));
    return FIELDS.map((f) => ({ field: f, account: byCode.get(form[f.key]) as any }));
  }, [accounts, form]);

  const change = (key: keyof AccountMap, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.patch('/re/accounts', { project: code, map: form });
      setForm({ ...DEFAULT_MAP, ...result.map });
      toast.push(code === 'all' ? 'تم تحديث الربط المحاسبي الافتراضي' : `تم حفظ ربط حسابات ${project?.name || 'المشروع'}`);
      reload();
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'تعذّر حفظ ربط الحسابات', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    const next = code === 'all' ? { ...DEFAULT_MAP } : { ...DEFAULT_MAP, ...(data?.globalMap || {}) };
    setForm(next);
    toast.push(code === 'all' ? 'أُعيدت القيم الافتراضية — احفظ لتطبيقها' : 'تم نسخ الربط الافتراضي للمشروع — احفظ للتطبيق', 'info');
  };

  if (loading && !data) return <PageSkeleton />;

  const groups = [...new Set(FIELDS.map((f) => f.group))];
  const uniqueBound = new Set(Object.values(form)).size;

  return (
    <div className="page">
      <PageHead
        title="ربط الحسابات العقارية"
        icon={<Link2 size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المالية' }, { label: 'ربط الحسابات' }]}
        sub="حدد حساب الأستاذ لكل حركة عقارية. تُستخدم التهيئة عند إنشاء العقود والتحصيلات والتكاليف وإقفال الصيانة، وتبقى القيود متوازنة ومرتبطة بالمشروع."
        actions={(
          <div className="row gap-8">
            <Btn variant="ghost" icon={<RotateCcw size={15} />} onClick={resetToDefault}>إعادة الضبط</Btn>
            <Btn icon={<Save size={15} />} loading={saving} onClick={save}>حفظ الربط</Btn>
          </div>
        )}
      />

      <div className="grid grid-3 mb-14" style={{ gap: 12 }}>
        <KpiTile label="حسابات مرتبطة" value={FIELDS.length} icon={<Link2 size={19} />} foot={`${uniqueBound} حساباً مختلفاً`} gold />
        <KpiTile label="مشاريع لها ربط خاص" value={Object.keys(data?.projectOverrides || {}).length ? 1 : 0} icon={<Landmark size={19} />} foot={code === 'all' ? 'اختر مشروعاً لإدارة استثنائه' : (project?.name || code)} />
        <KpiTile label="دليل الحسابات المتاح" value={accounts.length} icon={<BookOpen size={19} />} foot="حساب نشط للاختيار" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.55fr) minmax(300px,.9fr)', gap: 14 }}>
        <Panel
          title="حسابات الأستاذ المرتبطة بالعمليات"
          icon={<BookOpen size={16} color="var(--gold)" />}
          right={(
            <Field label="نطاق الربط" className="mc-inline-field">
              <Select value={code} onChange={(e: any) => setCode(e.target.value)} style={{ minWidth: 220 }}>
                <option value="all">الربط الافتراضي — كل المشاريع</option>
                {(projects || []).map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
            </Field>
          )}
          pad
        >
          <div className="col gap-16">
            {groups.map((group) => (
              <section key={group}>
                <div className="sec-head" style={{ marginBottom: 8 }}><span>{group}</span></div>
                <div className="grid grid-2" style={{ gap: 10 }}>
                  {FIELDS.filter((f) => f.group === group).map((field) => {
                    const account = accounts.find((a: any) => a.code === form[field.key]);
                    return (
                      <Field key={field.key} label={field.label} hint={field.description}>
                        <Select value={form[field.key] || ''} onChange={(e: any) => change(field.key, e.target.value)}>
                          {accounts.filter((a: any) => a.type === ROLE_TYPE[field.key]).map((a: any) => (
                            <option key={`${field.key}-${a.id}`} value={a.code}>
                              {a.code} — {a.name} ({TYPE_LABEL[a.type] || a.type})
                            </option>
                          ))}
                        </Select>
                        {account && <div className="tiny muted mt-4">الحساب الحالي: <b className="num">{account.code}</b> · {TYPE_LABEL[account.type] || account.type}</div>}
                      </Field>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="row-between mt-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <span className="tiny muted">{code === 'all' ? 'هذا الربط الافتراضي للمشاريع التي لا تملك إعداداً مستقلاً.' : `الإعدادات تخص ${project?.name || code} فقط، ولا تغيّر ربط المشاريع الأخرى.`}</span>
            <Btn icon={<Save size={15} />} loading={saving} onClick={save}>حفظ التغييرات</Btn>
          </div>
        </Panel>

        <div className="col gap-14">
          <Panel title="كيف يعمل الربط؟" icon={<ShieldCheck size={16} color="var(--gold)" />}>
            <div className="col gap-12 small" style={{ lineHeight: 1.8 }}>
              <div className="row gap-8"><Badge tone="blue">١</Badge><span>اعتماد عقد البيع يثبت الذمم المدينة مقابل إيراد الوحدة.</span></div>
              <div className="row gap-8"><Badge tone="green">٢</Badge><span>التحصيل يثبت الصندوق أو البنك مقابل تخفيض ذمم العميل.</span></div>
              <div className="row gap-8"><Badge tone="amber">٣</Badge><span>تكاليف التطوير والصيانة تنشئ قيوداً محاسبية مرتبطة بالمشروع.</span></div>
              <div className="row gap-8"><Badge tone="gold">٤</Badge><span>تُحفظ خريطة مستقلة لكل مشروع، مع ربط افتراضي للمشاريع الجديدة.</span></div>
            </div>
            <div className="mc-account-note mt-14">
              <b>سلامة القيد</b>
              <p className="small muted mt-4">يُنشئ النظام طرفي المدين والدائن في معاملة واحدة، ويتراجع عن العملية كاملة إذا تعذر ترحيل أحد الحسابات.</p>
            </div>
          </Panel>

          <Panel title="انتقال سريع" icon={<ArrowLeftRight size={16} color="var(--gold)" />}>
            <div className="col gap-8">
              <Btn variant="ghost" className="w-full" icon={<CircleDollarSign size={15} />} onClick={() => navigate('/re/treasury')}>الصندوق والبنوك</Btn>
              <Btn variant="ghost" className="w-full" icon={<BookOpen size={15} />} onClick={() => navigate('/accounting')}>دليل الحسابات العام</Btn>
              <Btn variant="ghost" className="w-full" icon={<ArrowLeftRight size={15} />} onClick={() => navigate('/accounting/journal')}>قيود اليومية</Btn>
            </div>
          </Panel>

          <div className="small muted" style={{ lineHeight: 1.8, padding: '0 4px' }}>
            تغيير الربط لا يعيد كتابة القيود السابقة؛ يُطبق على العمليات الجديدة فقط ويحافظ على سجل المراجعة.
          </div>
        </div>
      </div>
    </div>
  );
}
