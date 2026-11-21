import { spawn } from 'node:child_process';
import process from 'node:process';

const procs = [];
function run(cmd, args, name, color) {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (d) => {
    String(d).split('\n').filter(Boolean).forEach((line) => out.write(tag + line + '\n'));
  });
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);
  p.on('exit', (code) => {
    console.log(`${tag}exited with ${code}`);
    shutdown(code ?? 0);
  });
  procs.push(p);
  return p;
}

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  procs.forEach((p) => { try { p.kill('SIGTERM'); } catch {} });
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run(process.execPath, ['server/index.js'], 'api', '36');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', 'web', 'run', 'dev'], 'web', '35');
