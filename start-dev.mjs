import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[36m%s\x1b[0m', ' 🚀 Starting Real-Time Collaborative System');
console.log('\x1b[36m%s\x1b[0m', '   - Backend Server (Yjs CRDTs + WebSockets + Redis PubSub)');
console.log('\x1b[36m%s\x1b[0m', '   - Frontend Client (Docs + Whiteboard + Multi-user Sandbox)');
console.log('\x1b[36m%s\x1b[0m', '=====================================================\n');

function runProcess(name, cmd, args, cwd, color) {
  const proc = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWindows,
  });

  proc.on('close', (code) => {
    console.log(`${color}[${name}]\x1b[0m exited with code ${code}`);
  });

  return proc;
}

const serverProc = runProcess('SERVER', npmCmd, ['run', 'dev'], path.join(__dirname, 'server'), '\x1b[32m');
const clientProc = runProcess('CLIENT', npmCmd, ['run', 'dev'], path.join(__dirname, 'client'), '\x1b[34m');

function cleanup() {
  console.log('\nGracefully shutting down all processes...');
  try {
    if (isWindows) {
      if (serverProc.pid) spawn('taskkill', ['/pid', serverProc.pid.toString(), '/f', '/t']);
      if (clientProc.pid) spawn('taskkill', ['/pid', clientProc.pid.toString(), '/f', '/t']);
    } else {
      serverProc.kill('SIGTERM');
      clientProc.kill('SIGTERM');
    }
  } catch (err) {
    // ignore
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
