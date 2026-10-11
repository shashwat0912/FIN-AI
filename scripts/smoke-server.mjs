import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const database = process.env.TEST_DATABASE_URL || 'postgresql://financeai_test@localhost:5433/finance_ai_test';
const url = new URL(database);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !decodeURIComponent(url.pathname).endsWith('_test')) {
  throw new Error('Smoke server requires a disposable PostgreSQL database ending in _test');
}
const child = spawn(process.execPath, ['backend/node_modules/tsx/dist/cli.mjs', 'backend/src/index.ts'], {
  stdio: 'inherit', env: { ...process.env, DATABASE_URL: database, NODE_ENV: 'development', PORT: '3001',
    JWT_SECRET: randomBytes(64).toString('hex'), JWT_REFRESH_SECRET: randomBytes(64).toString('hex'),
    CORS_ORIGIN: 'http://127.0.0.1:5173', CORS_CREDENTIALS: 'true', AI_PROVIDER: 'local', EMBEDDING_PROVIDER: 'local',
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', REDIS_AUTH_MODE: 'url', REDIS_URL: 'redis://127.0.0.1:6399',
  },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
