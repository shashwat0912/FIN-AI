import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../../src/advisor/service', () => ({ adviseUser: run }));
vi.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    Object.assign(req, { user: { id: 'owner' } });
    next();
  },
}));
vi.mock('../../src/middleware/chatRateLimiter', () => ({
  chatMessageLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}));
import advisor from '../../src/routes/advisor';
const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/advisor', advisor);
let server: Server | undefined;
afterEach(async () => {
  vi.clearAllMocks();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
  }
});
it('keeps health responsive while the provider is pending and aborts upstream on disconnect', async () => {
  let upstream: AbortSignal | undefined;
  run.mockImplementation(
    (_id, _input, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        upstream = signal;
        signal.addEventListener('abort', () => reject(new Error('private upstream details')), {
          once: true,
        });
      })
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const controller = new AbortController();
  const pending = fetch(`${base}/advisor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Summarize my finances' }),
    signal: controller.signal,
  }).catch(() => undefined);
  await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  const health = await fetch(`${base}/health`);
  expect(await health.json()).toEqual({ status: 'ok' });
  expect(upstream?.aborted).toBe(false);
  controller.abort();
  await pending;
  await vi.waitFor(() => expect(upstream?.aborted).toBe(true));
});
it('contains provider failure in the Advisor response without exposing credentials', async () => {
  run.mockRejectedValue(new Error('provider credential and financial payload'));
  const response = await request(app)
    .post('/advisor')
    .send({ question: 'Review my finances' })
    .expect(503);
  expect(response.text).not.toContain('credential');
  expect(response.text).not.toContain('financial payload');
  expect((await request(app).get('/health')).status).toBe(200);
});
