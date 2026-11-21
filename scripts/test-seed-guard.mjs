import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const qaRoot = path.join(root, '.arena-seed-guard-qa');
fs.mkdirSync(qaRoot, { recursive: true });
const data = fs.mkdtempSync(path.join(qaRoot, 'isolated-'));
const run = (args, extraEnv = {}) => spawnSync(
  process.execPath, ['server/seed.js', ...args],
  {
    cwd: root,
    encoding: 'utf8',
    timeout: 40000,
    env: {
      ...process.env,
      DATA_DIR: data,
      NODE_ENV: 'development',
      ALLOW_DESTRUCTIVE_SEED: '',
      ...extraEnv,
    },
  },
);
const checkCount = () => {
  const connection = new DatabaseSync(path.join(data, 'noor.db'));
  const count = connection.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  connection.close();
  return count;
};

try {
  const prod = run([], { NODE_ENV: 'production' });
  assert.equal(prod.status, 2, prod.stderr);
  assert.match(prod.stderr, /SEED BLOCKED/);
  assert.equal(checkCount(), 0);
  const forced = run(['--force']);
  assert.equal(forced.status, 2, forced.stderr);
  assert.match(forced.stderr, /SEED BLOCKED/);
  assert.equal(checkCount(), 0);
  const first = run([]);
  assert.equal(first.status, 0, first.stderr);
  const seeded = checkCount();
  assert.ok(seeded > 0);
  const second = run([]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /No changes made/);
  assert.equal(checkCount(), seeded);
  console.log('PASS: production seed blocked; unacknowledged force blocked; initial development seed and no-op repeated seed.');
} finally {
  fs.rmSync(data, { recursive: true, force: true });
  try { fs.rmdirSync(qaRoot); } catch {}
}
