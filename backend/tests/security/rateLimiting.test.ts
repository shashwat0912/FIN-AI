import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request, { type SuperAgentTest } from 'supertest';
import app from '../../src/index';
import prisma from '../../src/config/database';
import { config } from '../../src/config/env';

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

const PASSWORD = 'Password@123';

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function resetSecurityData(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function getCsrfToken(agent: SuperAgentTest): Promise<string> {
  const res = await agent.get('/api/v1/health').expect(200);
  const token = res.headers['x-csrf-token'] as string | undefined;
  if (!token) {
    throw new Error('CSRF token header missing');
  }
  return token;
}

describeIntegration('Rate Limiting & Security Integration', () => {
  let agent: SuperAgentTest;

  beforeEach(async () => {
    await resetSecurityData();
    agent = request.agent(app);
  });

  afterAll(async () => {
    await resetSecurityData();
    await prisma.$disconnect();
  });

  it('returns standard rate-limit headers', async () => {
    const res = await agent.get('/api/v1/health').expect(200);
    const limitHeader = res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'];
    const remainingHeader = res.headers['ratelimit-remaining'] || res.headers['x-ratelimit-remaining'];
    const resetHeader = res.headers['ratelimit-reset'] || res.headers['x-ratelimit-reset'];

    expect(limitHeader).toBeDefined();
    expect(remainingHeader).toBeDefined();
    expect(resetHeader).toBeDefined();
  });

  it('locks account after repeated failed login attempts', async () => {
    const email = uniqueEmail('lockout');

    await agent.post('/api/v1/auth/register').send({
      email,
      password: PASSWORD,
      name: 'Security User',
    }).expect(201);

    const maxAttemptsBeforeLockout = config.NODE_ENV === 'development' ? 20 : 5;

    for (let i = 0; i < maxAttemptsBeforeLockout; i += 1) {
      await agent.post('/api/v1/auth/login').send({
        email,
        password: 'WrongPassword@123',
      }).expect(401);
    }

    const locked = await agent.post('/api/v1/auth/login').send({
      email,
      password: 'WrongPassword@123',
    }).expect(423);

    expect(locked.body.success).toBe(false);
    expect(String(locked.body.message).toLowerCase()).toContain('locked');
  }, 20000);

  it('enforces per-user limiter on logout endpoint', async () => {
    const email = uniqueEmail('logout-limiter');

    const register = await agent.post('/api/v1/auth/register').send({
      email,
      password: PASSWORD,
      name: 'Security User',
    }).expect(201);

    const accessToken = register.body.data.accessToken as string;

    // 5 requests allowed, 6th request should be limited by perUserRateLimiter(5, 5 min)
    for (let i = 0; i < 5; i += 1) {
      const csrf = await getCsrfToken(agent);
      await agent
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-CSRF-Token', csrf)
        .send({})
        .expect(200);
    }

    const csrf = await getCsrfToken(agent);
    const limited = await agent
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-CSRF-Token', csrf)
      .send({});

    expect(limited.status).toBe(429);
    expect(limited.body.success).toBe(false);
    expect(String(limited.body.message).toLowerCase()).toContain('too many requests');
  });
});
