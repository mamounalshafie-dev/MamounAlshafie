export const iso = (d = new Date()) => d.toISOString().slice(0, 10);

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return iso(d);
}

export function money(n) {
  return Number(Number(n || 0).toFixed(2));
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'العنصر غير موجود') => new HttpError(404, msg);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function nextNumber(prefix, table, column = 'number', pad = 5) {
  const rows = [];
  return { prefix, pad, rows };
}

export function buildDateRange(query) {
  const to = query.to || null;
  const from = query.from || null;
  return { from, to };
}

/** simple deterministic PRNG for reproducible seed data */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
