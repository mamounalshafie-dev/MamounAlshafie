/* Headless render smoke-test: serves the IIFE test bundle, loads it in jsdom,
   visits every route, reports runtime errors / empty pages. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const API = process.env.API || 'http://127.0.0.1:4000';
const DIST = path.join(process.cwd(), 'web', 'dist-smoke');
const PORT = 4999;

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="/style.css"></head><body><div id="root"></div>
<script src="/app.js"></script></body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  const file = path.join(DIST, url.replace(/^\//, ''));
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': url.endsWith('.css') ? 'text/css' : 'application/javascript' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(PORT, r));

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@noor.iq', password: 'admin123' }),
});
const { token } = await login.json();
if (!token) throw new Error('login failed');

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e) => { if (!String(e.message).includes('Could not load link')) errors.push(`jsdom: ${e.message}`); });
virtualConsole.on('error', (...args) => errors.push(`console.error: ${args.map(String).join(' ').slice(0, 300)}`));

const routes = process.argv.slice(2).length ? process.argv.slice(2) : [
  '/', '/projects', '/projects/1', '/tasks', '/timesheets', '/customers', '/customers/1',
  '/vendors', '/quotations', '/invoices', '/invoices/1', '/purchase-orders',
  '/inventory', '/inventory/1', '/accounting', '/accounting/journal', '/accounting/reports',
  '/reports', '/hr/employees', '/hr/employees/1', '/hr/attendance', '/hr/payroll',
  '/hr/leaves', '/settings', '/activity', '/profile',
];

const dom = await JSDOM.fromURL(`http://127.0.0.1:${PORT}/`, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? new URL(input, API) : input;
      const headers = { ...(init.headers || {}), 'x-session-token': token };
      return fetch(url, { ...init, headers });
    };
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    const rect = () => ({ width: 820, height: 380, top: 0, left: 0, bottom: 380, right: 820, x: 0, y: 0, toJSON() {} });
    window.Element.prototype.getBoundingClientRect = rect;
    Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get: () => 820 });
    Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get: () => 380 });
    window.print = () => {};
  },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
const { window } = dom;

const results = [];
for (const route of routes) {
  errors.length = 0;
  window.history.pushState({}, '', route);
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  await sleep(1100);
  const root = window.document.getElementById('root');
  const text = (root?.textContent || '').replace(/\s+/g, ' ').trim();
  results.push({ route, length: text.length, sample: text.slice(0, 100), errors: [...new Set(errors)] });
}

let failed = 0;
for (const r of results) {
  const ok = r.length > 150 && r.errors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✖'} ${r.route.padEnd(22)} len=${String(r.length).padEnd(5)} ${r.errors.length ? 'ERR: ' + r.errors.slice(0, 2).join(' | ') : ''}`);
  if (!ok) console.log(`     content: ${r.sample}`);
}
console.log(`\n${results.length - failed}/${results.length} routes rendered cleanly`);
server.close();
process.exit(failed ? 1 : 0);
