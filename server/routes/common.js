import { get, all } from '../db.js';

export function nextDocNumber(prefix, table, opts = {}) {
  const { column = 'number', width = 4, year = new Date().getFullYear() } = opts;
  const pattern = `${prefix}-${year}-%`;
  const rows = all(`SELECT ${column} AS n FROM ${table} WHERE ${column} LIKE ?`, pattern);
  let max = 0;
  for (const row of rows) {
    const match = String(row.n || '').match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  let seq = max + 1;
  let candidate = `${prefix}-${year}-${String(seq).padStart(width, '0')}`;
  let guard = 0;
  while (get(`SELECT ${column} AS n FROM ${table} WHERE ${column} = ?`, candidate) && guard < 500) {
    seq += 1;
    candidate = `${prefix}-${year}-${String(seq).padStart(width, '0')}`;
    guard += 1;
  }
  return candidate;
}

export function paginate(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function sortClause(query, allowed, fallback) {
  const col = allowed.includes(query.sort) ? query.sort : fallback;
  const dir = String(query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${col} ${dir}`;
}

export const like = (q) => `%${String(q || '').trim()}%`;

export function recalcProject(projectId) {
  const tasks = get(
    `SELECT COUNT(*) total,
            SUM(CASE WHEN stage = 'done' THEN 1 ELSE 0 END) done,
            COALESCE(AVG(CASE WHEN stage <> 'backlog' THEN 1.0 ELSE NULL END), 0) AS x
       FROM tasks WHERE project_id = ?`,
    projectId
  );
  const total = tasks?.total || 0;
  const done = tasks?.done || 0;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const hours = get(
    'SELECT COALESCE(SUM(hours), 0) h FROM timesheets WHERE project_id = ?', projectId
  );
  get('UPDATE projects SET progress = ? WHERE id = ?', progress, projectId);
  return { progress, total, done, hours: hours?.h || 0 };
}

export const STAGES = ['planning', 'in_progress', 'on_hold', 'review', 'done', 'cancelled'];
export const TASK_STAGES = ['backlog', 'todo', 'in_progress', 'review', 'done'];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];
