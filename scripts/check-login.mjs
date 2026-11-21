/* Verifies the unauthenticated login screen renders on its own. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const DIST = path.join(process.cwd(), 'web', 'dist-smoke');
const PORT = 4998;
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="/style.css"></head><body><div id="root"></div>
<script src="/app.js"></script></body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.join(DIST, url.replace(/^\//, ''));
  if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': url.endsWith('.css') ? 'text/css' : 'application/javascript' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(PORT, r));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { if (!String(e.message).includes('Could not load link')) errors.push(e.message); });
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

const dom = await JSDOM.fromURL(`http://127.0.0.1:${PORT}/login`, {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    window.fetch = () => Promise.resolve(new Response('{"error":"unauthorized"}', { status: 401, headers: { 'Content-Type': 'application/json' } }));
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  },
});
await new Promise((r) => setTimeout(r, 2200));
const text = (dom.window.document.getElementById('root')?.textContent || '').replace(/\s+/g, ' ').trim();
const checks = [
  ['renders content', text.length > 80],
  ['shows login title', /تسجيل الدخول|الدخول إلى النظام/.test(text)],
  ['shows email field', /البريد الإلكتروني/.test(text)],
  ['shows password field', /كلمة المرور/.test(text)],
  ['no runtime errors', errors.length === 0],
];
let failed = 0;
for (const [name, ok] of checks) { if (!ok) failed++; console.log(`${ok ? '✔' : '✖'} ${name}`); }
if (!text.length || errors.length) console.log(`sample: ${text.slice(0, 160)}\n${errors.slice(0, 2).join('\n')}`);
server.close();
process.exit(failed ? 1 : 0);
