import React, { useMemo, useState } from 'react';
import { ArrowDownUp, Download } from 'lucide-react';
import { cx } from '../lib/format';
import { Empty, Pagination, SearchBox, exportCsv } from './ui';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  width?: number | string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  hideOnMobile?: boolean;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (row: T) => string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  pageSize?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  exportName?: string;
  rowKey?: (row: T) => string | number;
  compact?: boolean;
  sortable?: boolean;
  footer?: React.ReactNode;
  className?: string;
};

export function DataTable<T extends Record<string, any>>({
  rows, columns, loading, searchable = true, searchPlaceholder = 'بحث…', searchKeys,
  onRowClick, toolbar, pageSize = 12, emptyTitle, emptyMessage, exportName,
  rowKey, compact, sortable = true, footer, className,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = searchKeys
        ? searchKeys(row).toLowerCase()
        : columns.map((c) => String(row[c.key] ?? '')).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const val = (row: T) => (col?.sortValue ? col.sortValue(row) : row[sort.key]);
    return [...filtered].sort((a, b) => {
      const av = val(a); const bv = val(b);
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv), 'ar') : String(bv).localeCompare(String(av), 'ar');
    });
  }, [filtered, sort, columns]);

  const total = sorted.length;
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => {
    if (!sortable) return;
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  };

  return (
    <div className={cx('card', className)}>
      {(searchable || toolbar || exportName) && (
        <div className="toolbar">
          {searchable && (
            <SearchBox value={query} onChange={(v: string) => { setQuery(v); setPage(1); }} placeholder={searchPlaceholder} />
          )}
          <div className="spacer" />
          {toolbar}
          {exportName && (
            <button
              className="btn btn-sm"
              onClick={() => exportCsv(exportName, sorted, columns.map((c) => ({ key: c.key, label: c.header })))}
            >
              <Download size={14} /> تصدير
            </button>
          )}
        </div>
      )}
      <div className="table-wrap">
        <table className={cx('table', compact && 'table-compact')}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx(sortable && 'sortable', c.className)}
                  style={{ width: c.width, textAlign: c.align === 'center' ? 'center' : c.align === 'end' ? 'end' : 'start' }}
                  onClick={() => toggleSort(c.key)}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="row gap-4" style={{ display: 'inline-flex', justifyContent: c.align === 'end' ? 'flex-end' : undefined }}>
                    {c.header}
                    {sortable && <ArrowDownUp size={11} style={{ opacity: sort?.key === c.key ? 0.9 : 0.28 }} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row) : row.id ?? i}
                className={cx(onRowClick && 'clickable')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(c.className)}
                    style={{ textAlign: c.align === 'center' ? 'center' : c.align === 'end' ? 'end' : 'start' }}
                  >
                    {c.render ? c.render(row, i) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      {!loading && !pageRows.length && (
        query
          ? <Empty title="لا توجد نتائج مطابقة" message="جرّب تغيير كلمات البحث أو إزالة عوامل التصفية." />
          : <Empty title={emptyTitle || 'لا توجد بيانات بعد'} message={emptyMessage} />
      )}

      {loading && (
        <div style={{ padding: 18 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 42, marginBottom: 8, opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      )}

      {!loading && <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />}
    </div>
  );
}
