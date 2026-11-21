import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Download, HandCoins, Search, Users, Wallet } from 'lucide-react';
import { qs } from '../lib/api';
import { useApi, useDebounced } from '../lib/app-context';
import { useRe } from '../lib/re-context';
import { Badge, Btn, PageHead, Pagination, SearchBox, Select, exportCsv } from '../components/ui';
import { KpiTile, MoneyCell } from '../components/re-ui';
import { formatCompact, formatMoney, initials } from '../lib/format';

const TYPES = [
  { id: '', label: 'الكل' },
  { id: 'customer', label: 'عملاء' },
  { id: 'investor', label: 'مستثمرون' },
  { id: 'tenant', label: 'مستأجرون' },
];

export default function RePartners() {
  const navigate = useNavigate();
  const { code, project } = useRe();
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 350);
  const [page, setPage] = useState(1);
  const { data, loading } = useApi<any>(`/re/partners${qs({ project: code, type, q: debounced, page, pageSize: 20 })}`, [code, type, debounced, page]);
  React.useEffect(() => setPage(1), [code, type, debounced]);

  const items = data?.items || [];
  const stats = data?.stats || {};

  const doExport = () => exportCsv('partners', items.map((p: any) => ({
    name: p.name, type: p.type, phone: p.phone, contracts: p.contracts, value: p.contract_value, collected: p.collected,
  })), [
    { key: 'name', label: 'الاسم' }, { key: 'type', label: 'النوع' }, { key: 'phone', label: 'الهاتف' },
    { key: 'contracts', label: 'العقود' }, { key: 'value', label: 'القيمة' }, { key: 'collected', label: 'المحصل' },
  ]);

  return (
    <div className="page">
      <PageHead
        title="العملاء والمستثمرون"
        icon={<Users size={22} color="#8a6a1f" />}
        breadcrumb={[{ label: 'المبيعات' }, { label: 'العملاء والمستثمرون' }]}
        sub={`ملفات المشترين والمستثمرين والمستأجرين${code === 'all' ? ' في كل المشاريع' : ` في ${project?.name || 'المشروع المحدد'}`} مع قيمة العقود والمحصل والوحدات المملوكة.`}
        actions={<Btn variant="ghost" icon={<Download size={15} />} onClick={doExport}>تصدير</Btn>}
      />

      <div className="grid grid-4 mb-14" style={{ gap: 12 }}>
        <KpiTile label="إجمالي الملفات" value={stats.total || 0} icon={<Users size={19} />} />
        <KpiTile label="عملاء" value={stats.buyers || 0} icon={<HandCoins size={19} />} foot="مشترون أفراد وشركات" />
        <KpiTile label="مستثمرون" value={stats.investors || 0} icon={<Building size={19} />} foot="مؤسسات وصناديق" />
        <KpiTile label="مستأجرون" value={stats.tenants || 0} icon={<Wallet size={19} />} foot="عقود إيجار" gold />
      </div>

      <div className="card">
        <div className="row-between" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
          <div className="row gap-6">
            {TYPES.map((t) => (
              <button key={t.id || 'all'} onClick={() => setType(t.id)} className="tiny" style={{
                padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${type === t.id ? 'var(--brand-600)' : 'var(--border)'}`,
                background: type === t.id ? 'var(--brand-600)' : 'var(--surface)',
                color: type === t.id ? '#fff' : 'var(--text-2)',
              }}>{t.label}</button>
            ))}
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="بحث بالاسم أو الهاتف…" />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الاسم</th><th>النوع</th><th>الهاتف</th><th>الوحدات</th><th>العقود</th><th>قيمة العقود</th><th>المحصل</th><th>المتبقي</th></tr></thead>
            <tbody>
              {items.map((p: any) => (
                <tr key={p.id} onClick={() => navigate(`/re/contracts?q=${encodeURIComponent(p.name)}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="row gap-8">
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11 }}>{initials(p.name)}</div>
                      <div><div className="small" style={{ fontWeight: 700 }}>{p.name}</div><div className="tiny muted">{p.city || '—'}</div></div>
                    </div>
                  </td>
                  <td><Badge tone={p.type === 'investor' ? 'indigo' : p.type === 'tenant' ? 'blue' : 'green'}>{p.type === 'investor' ? 'مستثمر' : p.type === 'tenant' ? 'مستأجر' : 'عميل'}</Badge></td>
                  <td className="small" style={{ direction: 'ltr' }}>{p.phone || '—'}</td>
                  <td className="num">{p.units || 0}</td>
                  <td className="num">{p.contracts || 0}</td>
                  <td><MoneyCell value={p.contract_value || 0} /></td>
                  <td><MoneyCell value={p.collected || 0} tone="var(--green-600)" /></td>
                  <td><MoneyCell value={(p.contract_value || 0) - (p.collected || 0)} strong /></td>
                </tr>
              ))}
              {!loading && !items.length && <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center' }} className="muted">لا توجد نتائج</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="tiny muted">عرض {items.length} من {stats.total || 0}</span>
          <Pagination page={page} pageSize={20} total={stats.total || 0} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
