/* Spins up an isolated API instance on port 4100, runs the mutation suite, then shuts it down. */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, 'data', '.test');
rmSync(dataDir, { recursive: true, force: true });

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: root,
  env: { ...process.env,PORT: '4100', DATA_DIR: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let exited = null;
server.stdout.on('data', (d) => { output += d; });
server.stderr.on('data', (d) => { output += d; });
server.on('exit', (code) => { exited = code ?? 1; });

const waitForServer = async () => {
  for (let i = 0; i < 60; i++) {
    if (exited !== null) break;
    try {
      const res = await fetch('http://127.0.0.1:4100/api/health');
      if (res.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('API did not start in time:\n' + output);
};

let code = 0;
try {
  await waitForServer();
  const test = spawn(process.execPath, ['scripts/api-test.mjs'], {
    cwd: root, env: { ...process.env, API: 'http://127.0.0.1:4100' }, stdio: 'inherit',
  });
  code = await new Promise((resolve) => test.on('exit', (c) => resolve(c ?? 1)));
} catch (err) {
  console.error(err.message);
  code = 1;
} finally {
  server.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 400));
  rmSync(dataDir, { recursive: true, force: true });
}
process.exit(code);
