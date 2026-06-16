import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/config/database';

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

const PASSWORD = 'Password@123';

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function resetAuthData(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

describeIntegration('Auth Routes', () => {
  beforeEach(async () => {
    await resetAuthData();
  });

  afterAll(async () => {
    await resetAuthData();
    await prisma.$disconnect();
  });

  it('registers a user with strong password', async () => {
    const email = uniqueEmail('register');

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: PASSWORD,
        name: 'Integration User',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.refreshToken).toBeTruthy();
  });

  it('rejects duplicate registration', async () => {
    const email = uniqueEmail('duplicate');

    await request(app).post('/api/v1/auth/register').send({
      email,
      password: PASSWORD,
      name: 'Integration User',
    }).expect(201);

    const second = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: PASSWORD,
        name: 'Integration User',
      })
      .expect(400);

    expect(second.body.success).toBe(false);
    expect(second.body.message).toContain('already exists');
  });

  it('logs in with valid credentials', async () => {
    const email = uniqueEmail('login');

    await request(app).post('/api/v1/auth/register').send({
      email,
      password: PASSWORD,
      name: 'Integration User',
    }).expect(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: PASSWORD,
      })
      .expect(200);

    expect(login.body.success).toBe(true);
    expect(login.body.data.user.email).toBe(email);
    expect(login.body.data.accessToken).toBeTruthy();
    expect(login.body.data.refreshToken).toBeTruthy();
  });

  it('rejects login with wrong password', async () => {
    const email = uniqueEmail('invalid-login');

    await request(app).post('/api/v1/auth/register').send({
      email,
      password: PASSWORD,
      name: 'Integration User',
    }).expect(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'WrongPassword@123',
      })
      .expect(401);

    expect(login.body.success).toBe(false);
    expect(login.body.message).toContain('Invalid credentials');
  });

  it('refreshes access token with valid refresh token', async () => {
    const email = uniqueEmail('refresh');

    const register = await request(app).post('/api/v1/auth/register').send({
      email,
      password: PASSWORD,
      name: 'Integration User',
    }).expect(201);

    const refreshToken = register.body.data.refreshToken as string;

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken })
      .expect(200);

    expect(refreshed.body.success).toBe(true);
    expect(refreshed.body.data.accessToken).toBeTruthy();
    expect(refreshed.body.data.refreshToken).toBeTruthy();
  });
});
