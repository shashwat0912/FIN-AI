import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request, { type SuperAgentTest } from 'supertest';
import app from '../../src/index';
import prisma from '../../src/config/database';

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

const PASSWORD = 'Password@123';

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function resetTransactionData(): Promise<void> {
  await prisma.transaction.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function getCsrfToken(agent: SuperAgentTest): Promise<string> {
  const res = await agent.get('/api/v1/health').expect(200);
  const token = res.headers['x-csrf-token'] as string | undefined;
  if (!token) {
    throw new Error('CSRF token header missing from /health response');
  }
  return token;
}

describeIntegration('Transaction API Routes', () => {
  let agent: SuperAgentTest;
  let accessToken: string;

  beforeEach(async () => {
    await resetTransactionData();
    agent = request.agent(app);

    const register = await agent
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('txn'),
        password: PASSWORD,
        name: 'Transaction User',
      })
      .expect(201);

    accessToken = register.body.data.accessToken as string;
  });

  afterAll(async () => {
    await resetTransactionData();
    await prisma.$disconnect();
  });

  it('creates, lists, updates and deletes a transaction', async () => {
    const csrf = await getCsrfToken(agent);

    const created = await agent
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-CSRF-Token', csrf)
      .send({
        amount: 1200,
        description: 'Groceries from market',
        category: 'Food',
        type: 'EXPENSE',
        date: '2026-03-10T10:00:00.000Z',
      })
      .expect(201);

    expect(created.body.success).toBe(true);
    expect(created.body.data.description).toBe('Groceries from market');
    const txnId = created.body.data.id as string;

    const list = await agent
      .get('/api/v1/transactions?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.some((t: any) => t.id === txnId)).toBe(true);

    const csrfForUpdate = await getCsrfToken(agent);
    const updated = await agent
      .put(`/api/v1/transactions/${txnId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-CSRF-Token', csrfForUpdate)
      .send({
        amount: 1500,
        category: 'Shopping',
      })
      .expect(200);

    expect(updated.body.success).toBe(true);
    expect(Number(updated.body.data.amount)).toBe(1500);
    expect(updated.body.data.category).toBe('Shopping');

    const csrfForDelete = await getCsrfToken(agent);
    const deleted = await agent
      .delete(`/api/v1/transactions/${txnId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-CSRF-Token', csrfForDelete)
      .expect(200);

    expect(deleted.body.success).toBe(true);
    expect(deleted.body.message).toBe('Transaction deleted successfully');
  }, 20000);

  it('rejects create transaction without auth token', async () => {
    const csrf = await getCsrfToken(agent);

    const response = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrf)
      .send({
        amount: 500,
        description: 'Unauthorized create',
        category: 'Food',
        type: 'EXPENSE',
        date: '2026-03-10T10:00:00.000Z',
      })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Access token');
  });

  it('rejects create transaction without CSRF token', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('txn-no-csrf'),
        password: PASSWORD,
        name: 'No Csrf User',
      })
      .expect(201);

    const tokenWithoutCookie = register.body.data.accessToken as string;

    const response = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenWithoutCookie}`)
      .send({
        amount: 500,
        description: 'Missing csrf',
        category: 'Food',
        type: 'EXPENSE',
        date: '2026-03-10T10:00:00.000Z',
      })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('CSRF token');
  });
});
