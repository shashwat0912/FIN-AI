import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootCwd = process.cwd();

const children = [];
let shuttingDown = false;

function prefixAndPipe(stream, label, target) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.length > 0) {
        target.write(`[${label}] ${line}\n`);
      }
    }
  });

  stream.on('end', () => {
    if (buffer.length > 0) {
      target.write(`[${label}] ${buffer}\n`);
      buffer = '';
    }
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 750);
}

function startProcess(label, args) {
  const child = spawn(npmCommand, args, {
    cwd: rootCwd,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  prefixAndPipe(child.stdout, label, process.stdout);
  prefixAndPipe(child.stderr, label, process.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      process.stderr.write(`[${label}] exited because of signal ${signal}\n`);
      shutdown(1);
      return;
    }

    if (code !== 0) {
      if (label === 'frontend') {
        process.stderr.write('[frontend] Failed to start on port 5173. Stop any old Vite process using 5173, then rerun npm run dev.\n');
      }
      if (label === 'server') {
        process.stderr.write('[server] Failed to start on port 3000. Stop any old backend process using 3000, then rerun npm run dev.\n');
      }
      process.stderr.write(`[${label}] exited with code ${code}\n`);
      shutdown(code ?? 1);
      return;
    }

    process.stdout.write(`[${label}] exited normally\n`);
    shutdown(0);
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stdout.write('Starting frontend and backend together...\n');
startProcess('server', ['--prefix', 'server', 'run', 'dev']);
startProcess('frontend', ['run', 'dev:frontend']);
