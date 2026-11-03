import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'ADMIN', authenticated: true }));
vi.mock('../src/middleware/auth', () => ({
  authenticateToken: (_req: unknown, res: express.Response, next: express.NextFunction) => auth.authenticated ? next() : res.sendStatus(401),
  requireRole: (roles: string[]) => (_req: unknown, res: express.Response, next: express.NextFunction) => roles.includes(auth.role) ? next() : res.sendStatus(403),
}));
import cloudOps from '../src/routes/cloudOps';
const app = express();
app.use(express.json());
app.use('/cloud-ops', cloudOps);

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); auth.role = 'ADMIN'; auth.authenticated = true; });
describe('Cloud Ops boundary', () => {
  it('requires authentication and administrator role', async () => {
    auth.authenticated = false;
    expect((await request(app).post('/cloud-ops/investigate').send({})).status).toBe(401);
    auth.authenticated = true;
    auth.role = 'USER';
    expect((await request(app).post('/cloud-ops/investigate').send({})).status).toBe(403);
  });
  it('stays disabled without service configuration', async () => {
    vi.stubEnv('AGENT_SERVICE_URL', '');
    expect((await request(app).post('/cloud-ops/investigate').send({})).status).toBe(503);
  });
  it('uses a fixed upstream path and keeps credentials server side', async () => {
    vi.stubEnv('AGENT_SERVICE_URL', 'http://agent:8000');
    vi.stubEnv('AGENT_API_TOKEN', 'private-test-token');
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data_mode: 'simulation' }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const result = await request(app).post('/cloud-ops/investigate').send({ incident: 'Why unhealthy?' });
    expect(result.status).toBe(200);
    expect(upstream.mock.calls[0][0].toString()).toBe('http://agent:8000/api/v1/agent/investigate');
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe('Bearer private-test-token');
    expect(result.text).not.toContain('private-test-token');
    expect((await request(app).post('/cloud-ops/remediation/approve').send({})).status).toBe(404);
  });
});
