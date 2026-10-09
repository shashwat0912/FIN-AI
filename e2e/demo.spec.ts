import { test, expect } from '@playwright/test';

test('email login, ledger, goal, advisor, refresh and logout', async ({ page, request }) => {
  const email = process.env.SMOKE_EMAIL || `smoke-${Date.now()}@example.com`;
  const api = process.env.SMOKE_BASE_URL ? `${process.env.SMOKE_BASE_URL}/api/v1` : 'http://127.0.0.1:3001/api/v1';
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await page.goto('/login');
  await page.locator('#identifier').fill(email);
  const sent = page.waitForResponse(response => response.url().endsWith('/auth/send-otp'));
  await page.locator('form button[type="submit"]').click();
  const response = await sent;
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()).data;
  let otp = data.otpForDev;
  if (!otp) {
    // Staging uses a private SMTP sink, never a production auth bypass.
    const inbox = process.env.SMOKE_MAILPIT_URL;
    expect(inbox, 'Set SMOKE_MAILPIT_URL for the private staging SMTP sink').toBeTruthy();
    await expect.poll(async () => {
      const messages = await (await request.get(`${inbox}/api/v1/search`, { params: { query: `to:${email}`, limit: 1 } })).json();
      if (!messages.messages?.length) return '';
      const message = await (await request.get(`${inbox}/api/v1/message/${messages.messages[0].ID}`)).json();
      otp = (message.Text || message.HTML).match(/\b\d{6}\b/)?.[0];
      return otp || '';
    }).toMatch(/^\d{6}$/);
  }
  await page.locator('#otp').fill(otp);
  if (data.requiresName) await page.locator('input[name="name"]').fill('Smoke User');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  // Use real authenticated endpoints and verify persisted data in the UI.
  const call = (path: string, method = 'GET', body?: unknown) => page.evaluate(async ({ url, method, body }) => {
    const bootstrap = await fetch(`${url.split('/api/v1')[0]}/api/v1/csrf-token`, { credentials: 'include' });
    const result = await fetch(url, { method, credentials: 'include', headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      'X-CSRF-Token': bootstrap.headers.get('X-CSRF-Token') || '',
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: result.status, body: await result.json() };
  }, { url: `${api}${path}`, method, body });

  const description = `Smoke expense ${Date.now()}`;
  const created = await call('/transactions', 'POST', { amount: 12.5, description, category: 'Food & Dining', type: 'EXPENSE', date: new Date().toISOString() });
  expect(created.status).toBe(201);
  const goal = await call('/goals', 'POST', { name: `Smoke goal ${Date.now()}`, targetAmount: 1000 });
  expect(goal.status).toBe(201);
  try {
    await page.goto('/dashboard/transactions');
    await expect(page.getByText(description, { exact: true }).first()).toBeVisible();
    expect((await call(`/goals/${goal.body.data.id}`, 'PUT', { targetAmount: 1500 })).status).toBe(200);
    await page.goto('/dashboard/goals');
    await expect(page.getByText(goal.body.data.name, { exact: true }).first()).toBeVisible();
    const advice = await call('/ai/advice', 'POST', { query: 'How should I plan emergency savings?' });
    expect(advice.status).toBe(200);
    expect(advice.body.data.advice.length).toBeGreaterThan(20);
    if (advice.body.data.sessionId) await call(`/ai/sessions/${advice.body.data.sessionId}`, 'DELETE');

    // Force the real refresh path; no signed token forgery or mocked network.
    await page.evaluate(() => {
      const expired = btoa(JSON.stringify({ exp: 1 }));
      localStorage.setItem('accessToken', `expired.${expired}.expired`);
    });
    const refresh = page.waitForResponse(response => response.url().endsWith('/auth/refresh-token'));
    await page.reload();
    expect((await refresh).ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/dashboard\/goals$/);
  } finally {
    await call(`/transactions/${created.body.data.id}`, 'DELETE');
    await call(`/goals/${goal.body.data.id}`, 'DELETE');
  }
  const oldRefresh = await page.evaluate(() => localStorage.getItem('refreshToken'));
  await page.getByRole('button', { name: 'User profile' }).click();
  page.once('dialog', dialog => dialog.accept());
  const logout = page.waitForResponse(response => response.url().endsWith('/auth/logout'));
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  expect((await logout).ok()).toBeTruthy();
  await page.waitForURL('/');
  await page.waitForLoadState('domcontentloaded');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
  const rejected = await request.post(`${api}/auth/refresh-token`, { data: { refreshToken: oldRefresh } });
  expect(rejected.status()).toBe(401);
});
